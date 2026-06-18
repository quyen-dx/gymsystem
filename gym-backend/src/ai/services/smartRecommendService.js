import Plan from '../../models/Plan.js'
import Product from '../../models/Product.js'
import User from '../../models/User.js'
import PT from '../../models/PT.js'
import Membership from '../../models/Membership.js'
import Booking from '../../models/Booking.js'

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()

const uniq = (items = []) => [...new Set(items.filter(Boolean).map((item) => String(item).trim().toLowerCase()))]

const CATEGORY_GOAL_MAP = {
  muscle_gain: { planKeywords: ['nang cao', 'pro', 'premium', 'cao cap'], ptKeywords: ['tang co', 'muscle', 'hypertrophy', 'strength'], productCategories: ['Whey Protein', 'Creatine', 'BCAA', 'Pre-Workout'] },
  fat_loss: { planKeywords: ['co ban', 'basic', 'standard'], ptKeywords: ['giam mo', 'fat loss', 'cardio', 'hitt'], productCategories: ['Fat Burner', 'L-Carnitine', 'Whey Isolate', 'CLA'] },
  weight_gain: { planKeywords: ['vip', 'premium', 'unlimited'], ptKeywords: ['tang can', 'bulk', 'gain weight'], productCategories: ['Mass Gainer', 'Creatine', 'Whey Protein'] },
  general_fitness: { planKeywords: ['co ban', 'basic', 'standard'], ptKeywords: ['fitness', 'general', 'suc khoe'], productCategories: ['Multivitamin', 'Whey Protein', 'BCAA'] },
  endurance: { planKeywords: ['co ban', 'standard'], ptKeywords: ['cardio', 'endurance', 'suc ben'], productCategories: ['BCAA', 'Pre-Workout', 'Energy Gel'] },
}

const getGoalFromProfile = (userProfile, query = '') => {
  const text = normalizeText(query || '')
  const goal = userProfile?.fitnessGoal || userProfile?.goal || ''
  const goalNorm = normalizeText(goal)
  const combined = `${text} ${goalNorm}`
  if (/\b(tang co|muscle|hypertrophy|strength)\b/.test(combined)) return 'muscle_gain'
  if (/\b(giam mo|giam can|fat loss|weight loss|cut)\b/.test(combined)) return 'fat_loss'
  if (/\b(tang can|gain weight|bulk)\b/.test(combined)) return 'weight_gain'
  if (/\b(suc ben|endurance|cardio)\b/.test(combined)) return 'endurance'
  return 'general_fitness'
}

const parseBudget = (query = '') => {
  const text = normalizeText(query)
  const isMonthly = /\b(thang|month|per month|moi thang|hang thang)\b/.test(text)
  const cuMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cu)\b/)
  if (cuMatch) return { amount: parseFloat(cuMatch[1]) * 1000000, period: isMonthly ? 'month' : 'total' }
  const trieuMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:trieu|tr)\b/)
  if (trieuMatch) return { amount: parseFloat(trieuMatch[1]) * 1000000, period: isMonthly ? 'month' : 'total' }
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/)
  if (kMatch) return { amount: parseFloat(kMatch[1]) * 1000, period: isMonthly ? 'month' : 'total' }
  const numMatch = text.match(/\b(\d{4,9})\b/)
  if (numMatch) return { amount: parseInt(numMatch[1], 10), period: isMonthly ? 'month' : 'total' }
  return null
}

const getWeeklyFrequency = (query = '') => {
  const text = normalizeText(query)
  const match = text.match(/(\d{1,2})\s*(?:buoi|lan|ngay)\s*(?:\/|moi|tren|per)?\s*(?:tuan|week)\b/)
  if (match) {
    const val = parseInt(match[1], 10)
    if (val > 0 && val <= 14) return val
  }
  return null
}

const scorePlanFit = (plan, budget, frequency, goal, isStudent) => {
  const planGoalMap = {
    muscle_gain: { keywords: ['nang cao', 'pro', 'premium', 'cao cap', 'vip'], boost: 10 },
    fat_loss: { keywords: ['co ban', 'basic', 'standard'], boost: 8 },
    weight_gain: { keywords: ['vip', 'premium', 'unlimited', 'platinum'], boost: 10 },
    general_fitness: { keywords: ['co ban', 'basic', 'standard', 'starter'], boost: 6 },
    endurance: { keywords: ['co ban', 'standard'], boost: 6 },
  }
  const planNorm = normalizeText(`${plan.nameVi || ''} ${plan.nameEn || ''} ${plan.descriptionVi || ''} ${plan.descriptionEn || ''} ${(plan.featuresVi || []).join(' ')} ${(plan.featuresEn || []).join(' ')}`)

  let score = 50

  if (budget) {
    const monthlyCost = plan.durationDays > 0 ? plan.price / Math.max(plan.durationDays / 30, 1) : plan.price
    const comparable = budget.period === 'month' ? monthlyCost : plan.price
    if (comparable <= budget.amount) {
      score += 40 - ((comparable / budget.amount) * 20)
    } else {
      score -= Math.min(40, ((comparable - budget.amount) / budget.amount) * 30)
    }
  }

  const goalMatch = planGoalMap[goal]
  if (goalMatch) {
    const hasKeyword = goalMatch.keywords.some((kw) => planNorm.includes(kw))
    if (hasKeyword) score += goalMatch.boost
  }

  const benefitCount = Math.max(
    Array.isArray(plan.featuresVi) ? plan.featuresVi.length : 0,
    Array.isArray(plan.featuresEn) ? plan.featuresEn.length : 0,
  )
  score += Math.min(benefitCount, 8)

  if (isStudent) {
    const monthlyCost = plan.durationDays > 0 ? plan.price / Math.max(plan.durationDays / 30, 1) : plan.price
    if (monthlyCost <= 300000) score += 20
    else if (monthlyCost <= 500000) score += 10
    else score -= 20
    if (plan.durationDays <= 90) score += 10
  }

  if (frequency) {
    if (frequency >= 5 && planNorm.includes('vip')) score += 8
    if (frequency <= 2 && !planNorm.includes('vip')) score += 5
  }

  const pricePerDay = plan.durationDays > 0 ? plan.price / plan.durationDays : Infinity
  score -= Math.max(0, pricePerDay - 5000) / 20000

  return score
}

const scorePTFit = (pt, ptProfile, goal, query = '') => {
  const specialtiesNorm = uniq([...(pt?.specialties || []), ...(ptProfile?.specialties || [])])
  const bioNorm = normalizeText(`${pt?.bio || ''} ${ptProfile?.bio || ''}`)
  const queryNorm = normalizeText(query)

  let score = 60

  if (ptProfile?.rating) score += ptProfile.rating * 8
  if (ptProfile?.experienceYears) score += Math.min(ptProfile.experienceYears, 10) * 3
  if (ptProfile?.totalSessions) score += Math.min(ptProfile.totalSessions / 10, 10)
  if (ptProfile?.totalStudents) score += Math.min(ptProfile.totalStudents, 20)

  const goalPTKeywords = {
    muscle_gain: ['tang co', 'muscle', 'strength', 'hypertrophy', 'the hinh'],
    fat_loss: ['giam mo', 'giam can', 'fat loss', 'cardio', 'hitt', 'giam beo'],
    weight_gain: ['tang can', 'bulk', 'gain weight', 'mass'],
    endurance: ['cardio', 'endurance', 'suc ben', 'chay bo', 'cycling'],
    general_fitness: ['fitness', 'general', 'suc khoe', 'the duc'],
  }

  const keywords = goalPTKeywords[goal] || goalPTKeywords.general_fitness
  const matchCount = keywords.filter((kw) =>
    specialtiesNorm.some((s) => normalizeText(s).includes(kw))
    || bioNorm.includes(kw)
  ).length
  score += matchCount * 6

  return score
}

const scoreProductFit = (product, goal) => {
  const nameNorm = normalizeText(product.name || '')
  const catNorm = normalizeText(product.category || '')
  const descNorm = normalizeText(product.description || '')
  const combined = `${nameNorm} ${catNorm} ${descNorm}`

  let score = 50
  if (product.rating) score += product.rating * 6
  if (product.reviewCount) score += Math.min(product.reviewCount, 50) * 0.3

  const goalCategories = CATEGORY_GOAL_MAP[goal]?.productCategories || []
  const matchCount = goalCategories.filter((cat) => combined.includes(normalizeText(cat))).length
  score += matchCount * 10

  return score
}

export async function getSmartRecommendations({ userId, query, language = 'vi' }) {
  const lang = language === 'en' ? 'en' : 'vi'
  const goal = lang === 'en' ? 'general_fitness' : 'general_fitness'
  const budget = parseBudget(query)
  const frequency = getWeeklyFrequency(query)
  const isStudent = /\b(sinh vien|student)\b/.test(normalizeText(query))

  let userProfile = null
  let currentMembership = null

  if (userId) {
    const [user, membershipDoc] = await Promise.all([
      User.findById(userId).lean(),
      Membership.findOne({ memberId: userId }).sort({ endDate: -1 }).populate('planId', 'nameVi nameEn').lean(),
    ])
    userProfile = user
    currentMembership = membershipDoc
  }

  const inferredGoal = getGoalFromProfile(userProfile, query)
  const activeGoal = goal || inferredGoal

  const [plans, allPTs, ptProfiles, products] = await Promise.all([
    Plan.find({ isActive: true }).lean(),
    User.find({ role: 'pt', isActive: true, status: { $ne: 'locked' } }).select('name specialties avatar').lean(),
    PT.find({}).lean(),
    Product.find({ isActive: true, stock: { $gt: 0 } }).sort({ rating: -1 }).limit(20).lean(),
  ])

  const ptProfileMap = new Map(ptProfiles.map((p) => [String(p.userId), p]))

  const scoredPlans = plans
    .map((plan) => ({ plan, score: scorePlanFit(plan, budget, frequency, activeGoal, isStudent) }))
    .sort((a, b) => b.score - a.score)

  const scoredPTs = allPTs
    .map((pt) => {
      const profile = ptProfileMap.get(String(pt._id)) || {}
      return { pt, ptProfile: profile, score: scorePTFit(pt, profile, activeGoal, query) }
    })
    .sort((a, b) => b.score - a.score)

  const scoredProducts = products
    .map((product) => ({ product, score: scoreProductFit(product, activeGoal) }))
    .sort((a, b) => b.score - a.score)

  const topPlan = scoredPlans[0]?.plan || null
  const topPT = scoredPTs[0]?.pt || null
  const topPTProfile = topPT ? ptProfileMap.get(String(topPT._id)) || {} : null
  const topProduct = scoredProducts[0]?.product || null

  const goalLabels = {
    muscle_gain: lang === 'en' ? 'Muscle Gain' : 'Tăng cơ',
    fat_loss: lang === 'en' ? 'Fat Loss' : 'Giảm mỡ',
    weight_gain: lang === 'en' ? 'Weight Gain' : 'Tăng cân',
    endurance: lang === 'en' ? 'Endurance' : 'Sức bền',
    general_fitness: lang === 'en' ? 'General Fitness' : 'Sức khỏe tổng quát',
  }

  const buildReason = (item, label, score, lang) => {
    const reasons = []
    if (score >= 90) reasons.push(lang === 'en' ? 'Perfect match' : 'Phù hợp nhất')
    else if (score >= 70) reasons.push(lang === 'en' ? 'Great fit' : 'Rất phù hợp')
    else reasons.push(lang === 'en' ? 'Good option' : 'Lựa chọn tốt')
    return reasons
  }

  const planReason = topPlan ? buildReason(topPlan, 'plan', scoredPlans[0]?.score || 0, lang) : []
  const ptReason = topPT ? buildReason(topPT, 'pt', scoredPTs[0]?.score || 0, lang) : []
  const productReason = topProduct ? buildReason(topProduct, 'product', scoredProducts[0]?.score || 0, lang) : []

  const alternativePlans = scoredPlans.slice(1, 3).map((item) => item.plan).filter(Boolean)
  const alternativePTs = scoredPTs.slice(1, 3).map((item) => item.pt).filter(Boolean)
  const alternativeProducts = scoredProducts.slice(1, 3).map((item) => item.product).filter(Boolean)

  return {
    type: 'smart_recommend',
    goal: activeGoal,
    goalLabel: goalLabels[activeGoal] || activeGoal,
    language: lang,
    recommendedPlan: topPlan ? {
      _id: topPlan._id,
      nameVi: topPlan.nameVi,
      nameEn: topPlan.nameEn,
      price: topPlan.price,
      durationDays: topPlan.durationDays,
      descriptionVi: topPlan.descriptionVi,
      descriptionEn: topPlan.descriptionEn,
      featuresVi: topPlan.featuresVi,
      featuresEn: topPlan.featuresEn,
      color: topPlan.color,
      reason: planReason,
      score: Math.round(scoredPlans[0]?.score || 0),
    } : null,
    recommendedPT: topPT ? {
      _id: topPT._id,
      name: topPT.name || '',
      avatar: topPT.avatar || '',
      specialties: (topPTProfile?.specialties || topPT?.specialties || []).slice(0, 5),
      rating: topPTProfile?.rating || topPT?.rating || 0,
      experienceYears: topPTProfile?.experienceYears || 0,
      totalSessions: topPTProfile?.totalSessions || 0,
      reason: ptReason,
      score: Math.round(scoredPTs[0]?.score || 0),
    } : null,
    recommendedProduct: topProduct ? {
      _id: topProduct._id,
      name: topProduct.name,
      price: topProduct.price,
      image: topProduct.image || topProduct.images?.[0] || '',
      category: topProduct.category,
      rating: topProduct.rating || 0,
      reason: productReason,
      score: Math.round(scoredProducts[0]?.score || 0),
    } : null,
    alternatives: {
      plans: alternativePlans.map((p) => ({
        _id: p._id, nameVi: p.nameVi, nameEn: p.nameEn, price: p.price, durationDays: p.durationDays,
        descriptionVi: p.descriptionVi, descriptionEn: p.descriptionEn,
        featuresVi: p.featuresVi, featuresEn: p.featuresEn, color: p.color,
      })),
      pts: alternativePTs.map((pt) => ({ _id: pt._id, name: pt.name, avatar: pt.avatar })),
      products: alternativeProducts.map((p) => ({ _id: p._id, name: p.name, price: p.price, image: p.image || p.images?.[0] || '' })),
    },
    summary: lang === 'en'
      ? `Based on your goal (${goalLabels[activeGoal]}), budget and preferences, here is the best combo for you.`
      : `Dựa trên mục tiêu (${goalLabels[activeGoal]}), ngân sách và nhu cầu của bạn, đây là combo phù hợp nhất.`,
    suggestions: lang === 'en'
      ? ['Tell me more about this plan', 'Book a session with this PT', 'Add this product to cart', 'Compare with another option']
      : ['Tìm hiểu thêm về gói này', 'Đặt lịch với PT này', 'Thêm sản phẩm vào giỏ', 'So sánh với lựa chọn khác'],
  }
}
