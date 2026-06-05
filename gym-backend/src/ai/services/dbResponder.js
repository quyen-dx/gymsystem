const COLOR_MAP = {
  '#3B82F6': { vi: 'Xanh dương', en: 'Blue' },
  '#10B981': { vi: 'Xanh lá', en: 'Green' },
  '#F59E0B': { vi: 'Vàng', en: 'Yellow' },
  '#EF4444': { vi: 'Đỏ', en: 'Red' },
  '#8B5CF6': { vi: 'Tím', en: 'Purple' },
  '#EC4899': { vi: 'Hồng', en: 'Pink' },
  '#F97316': { vi: 'Cam', en: 'Orange' },
  '#14B8A6': { vi: 'Xanh ngọc', en: 'Teal' },
  '#6366F1': { vi: 'Chàm', en: 'Indigo' },
  '#06B6D4': { vi: 'Xanh cyan', en: 'Cyan' },
  '#84CC16': { vi: 'Xanh vàng', en: 'Lime' },
  '#E11D48': { vi: 'Đỏ hồng', en: 'Rose' },
  '#0EA5E9': { vi: 'Xanh trời', en: 'Sky blue' },
  '#A855F7': { vi: 'Tím hoa', en: 'Violet' },
  '#64748B': { vi: 'Xám', en: 'Gray' },
  '#1E293B': { vi: 'Xanh đen', en: 'Dark blue' },
  '#020617': { vi: 'Đen', en: 'Black' },
  '#FFFFFF': { vi: 'Trắng', en: 'White' },
}

function colorName(hex, lang) {
  if (!hex || typeof hex !== 'string') return ''
  const normalized = hex.toUpperCase()
  return COLOR_MAP[normalized]?.[lang] || hex
}

function formatDuration(days, lang) {
  if (!days || days <= 0) return ''
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

const normalizeLanguage = (lang) => lang === 'en' ? 'en' : 'vi'

const normalizeQuestion = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()

const isAvailablePlansQuestion = (query = '') => {
  const normalized = normalizeQuestion(query)
  const asksPersonalPlan = /\b(cua toi|toi dang|dang dung|goi hien tai|my|mine|current|active|con bao nhieu|het han|gia han|renew|expire)\b/.test(normalized)
  if (asksPersonalPlan) return false

  return /\b(hien dang co|co nhung|danh sach|cac goi|goi nao|goi tap nao|available|offered|list)\b/.test(normalized)
    && /\b(goi tap|membership|plan|plans)\b/.test(normalized)
}

const findRequestedPlan = (query, plans, lang) => {
  if (!plans || plans.length === 0 || !query) return null

  const normalizedQuery = normalizeQuestion(query)
  const isDetailQuery = /\b(chi tiet|thong tin|gom|nhung|quyen loi|benefits|detail|details|describe|what.*include|what.*offer|gia|price)\b/.test(normalizedQuery)
    || /\b(co gi|gom gi|the nao|nhu the nao|like what|about)\b/.test(normalizedQuery)

  if (!isDetailQuery) return null

  let bestMatch = null
  let bestScore = 0

  for (const plan of plans) {
    const planNameVi = normalizeQuestion(plan.nameVi || '')
    const planNameEn = normalizeQuestion(plan.nameEn || '')
    const planNameShortVi = planNameVi.replace(/^goi\s+/, '')
    const planNameShortEn = planNameEn.replace(/^(basic|premium|vip|standard|plan)\s+/i, '')

    const candidates = [
      { name: planNameVi, scoreWeight: 2 },
      { name: planNameEn, scoreWeight: 2 },
      { name: planNameShortVi, scoreWeight: 1.2 },
      { name: planNameShortEn, scoreWeight: 1.2 },
    ]

    for (const { name, scoreWeight } of candidates) {
      if (!name || name.length < 2) continue

      if (normalizedQuery.includes(name)) {
        const score = (name.length / normalizedQuery.length) * scoreWeight
        if (score > bestScore) {
          bestScore = score
          bestMatch = plan
        }
      }
    }
  }

  return bestMatch
}

const findMentionedPlans = (query, plans) => {
  if (!plans || plans.length === 0 || !query) return []
  const normalizedQuery = normalizeQuestion(query)

  const matched = []
  for (const plan of plans) {
    const planNameVi = normalizeQuestion(plan.nameVi || '')
    const planNameEn = normalizeQuestion(plan.nameEn || '')
    const planNameShortVi = planNameVi.replace(/^goi\s+/, '')
    const planNameShortEn = planNameEn.replace(/^(basic|premium|vip|standard|plan)\s+/i, '')

    const candidates = [planNameVi, planNameEn, planNameShortVi, planNameShortEn]
    for (const name of candidates) {
      const index = name && name.length >= 2 ? normalizedQuery.indexOf(name) : -1
      if (index >= 0) {
        matched.push({ plan, index })
        break
      }
    }
  }

  return matched.sort((a, b) => a.index - b.index).map((item) => item.plan)
}

const formatPlanDetail = (plan, lang) => {
  const name = lang === 'en' ? (plan.nameEn || plan.nameVi) : (plan.nameVi || plan.nameEn)
  const price = plan.price?.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')
  const currency = '₫'
  const dur = formatDuration(plan.durationDays, lang)
  const description = lang === 'en' ? (plan.descriptionEn || plan.descriptionVi) : (plan.descriptionVi || plan.descriptionEn)
  const features = lang === 'en' ? (plan.featuresEn || plan.featuresVi) : (plan.featuresVi || plan.featuresEn)

  let text = lang === 'en'
    ? `**${name}** costs **${price}${currency} / ${dur}**.`
    : `**${name}** có giá **${price}${currency} / ${dur}**.`

  if (description) {
    text += lang === 'en'
      ? `\n\nDescription:\n${description}`
      : `\n\nMô tả:\n${description}`
  }

  if (Array.isArray(features) && features.length > 0) {
    text += lang === 'en'
      ? `\n\nBenefits:\n${features.map(f => `- ${f}`).join('\n')}`
      : `\n\nQuyền lợi:\n${features.map(f => `- ${f}`).join('\n')}`
  } else {
    text += lang === 'en'
      ? `\n\nThis plan has no benefits configured in the system.`
      : `\n\nHiện gói này chưa được cấu hình quyền lợi chi tiết trong hệ thống.`
  }

  return text
}

const buildPlanDetailSuggestions = (plan, plans, lang) => {
  const planName = lang === 'en' ? (plan.nameEn || plan.nameVi) : (plan.nameVi || plan.nameEn)
  const otherPlans = plans.filter(p => String(p._id) !== String(plan._id))
  const fallbackOther = lang === 'en' ? 'Basic Plan' : 'Gói Cơ Bản'

  const suggestions = [
    lang === 'en' ? 'Register for this plan' : 'Đăng ký gói này',
  ]

  if (otherPlans.length > 0) {
    const otherName = lang === 'en'
      ? (otherPlans[0].nameEn || otherPlans[0].nameVi)
      : (otherPlans[0].nameVi || otherPlans[0].nameEn)
    suggestions.push(
      lang === 'en' ? `Compare with ${otherName}` : `So sánh với ${otherName}`
    )
  } else {
    suggestions.push(lang === 'en' ? `Compare with ${fallbackOther}` : `So sánh với ${fallbackOther}`)
  }

  suggestions.push(
    lang === 'en' ? 'Is this plan right for me?' : 'Gói này có phù hợp với tôi không?',
    lang === 'en' ? 'View other plans' : 'Xem các gói khác',
  )

  return suggestions
}

const buildPlanListSuggestions = (plans, lang) => {
  const vipPlan = plans.find((plan) => /\bvip\b/i.test(`${plan.nameVi || ''} ${plan.nameEn || ''}`))
  const vipName = vipPlan ? (lang === 'en' ? (vipPlan.nameEn || vipPlan.nameVi) : (vipPlan.nameVi || vipPlan.nameEn)) : (lang === 'en' ? 'VIP Plan' : 'Gói VIP')
  return lang === 'en'
    ? ['Compare plans', 'Recommend a suitable plan', `Details of ${vipName}`]
    : ['So sánh các gói', 'Tư vấn gói phù hợp', `Chi tiết ${vipName}`]
}

const buildCompareTwoSuggestions = (lang) => (
  lang === 'en'
    ? ['Which should I choose?', 'Which plan saves more?', 'Register for the suitable plan']
    : ['Tôi nên chọn gói nào?', 'Gói nào tiết kiệm hơn?', 'Đăng ký gói phù hợp']
)

const buildRecommendSuggestions = (lang) => (
  lang === 'en'
    ? ['Register for the recommended plan', 'Compare with another plan', 'View all plans']
    : ['Đăng ký gói được đề xuất', 'So sánh với gói khác', 'Xem tất cả gói']
)

const countBenefits = (plan) => Math.max(
  Array.isArray(plan.featuresVi) ? plan.featuresVi.length : 0,
  Array.isArray(plan.featuresEn) ? plan.featuresEn.length : 0,
)

const pricePerDay = (plan) => {
  const price = Number(plan.price || 0)
  const days = Number(plan.durationDays || 0)
  return days > 0 ? price / days : Number.POSITIVE_INFINITY
}

const planMonthlyCost = (plan) => {
  const price = Number(plan.price || 0)
  const days = Number(plan.durationDays || 0)
  return days > 0 ? price / Math.max(days / 30, 1) : Number.POSITIVE_INFINITY
}

const normalizeMoneyFromQuery = (query = '') => {
  const normalized = normalizeQuestion(query)
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|trieu|m|million)?/)
  if (!match) return null
  const rawNumber = Number(String(match[1]).replace(',', '.'))
  if (!Number.isFinite(rawNumber)) return null
  const unit = match[2] || ''
  if (unit === 'k' || unit === 'nghin' || unit === 'ngan') return Math.round(rawNumber * 1000)
  if (unit === 'trieu' || unit === 'm' || unit === 'million') return Math.round(rawNumber * 1000000)
  return Math.round(rawNumber)
}

const findPlanByNamePattern = (plans, pattern) => (
  plans.find((plan) => pattern.test(planSearchText(plan)))
)

const planSearchText = (plan) => normalizeQuestion([
  plan.nameVi,
  plan.nameEn,
  plan.descriptionVi,
  plan.descriptionEn,
  ...(Array.isArray(plan.featuresVi) ? plan.featuresVi : []),
  ...(Array.isArray(plan.featuresEn) ? plan.featuresEn : []),
].filter(Boolean).join(' '))

const hasPlanText = (plan, pattern) => pattern.test(planSearchText(plan))

const isMonthlyBudgetQuery = (normalized = '') => (
  /\b(per month|monthly|month|thang|moi thang|hang thang)\b/.test(normalized)
)

const isPlanVip = (plan) => hasPlanText(plan, /\b(vip|platinum|unlimited|all access|full)\b/)

const extractFrequency = (normalized = '') => {
  const match = normalized.match(/\b(\d{1,2})\s*(?:buoi|lan|ngay|sessions?)\s*(?:\/|per)?\s*(?:tuan|week)\b/)
    || normalized.match(/\btap\s+(\d{1,2})\s*(?:buoi|lan|ngay)\b/)
  return match ? parseInt(match[1], 10) : null
}

const inferGoal = (normalized = '') => {
  if (/\btang\s*(co|can)\b/.test(normalized)) return 'muscle_gain'
  if (/\bgiam\s*(mo|can)\b/.test(normalized)) return 'fat_loss'
  return null
}

const scoreRecommendationFit = (plan, query, maxPrice) => {
  const normalized = normalizeQuestion(query)
  const budget = normalizeMoneyFromQuery(query)
  const monthlyBudget = budget && isMonthlyBudgetQuery(normalized)
  const student = /\b(student|sinh vien)\b/.test(normalized)
  const explicitVip = /\b(vip|platinum|cao cap|premium service|premium benefits|all access|full access)\b/.test(normalized)
  const wantsLongTerm = /\b(lau dai|long term|longest|dai han|commit|on dinh)\b/.test(normalized)
  const wantsBasic = /\b(co ban|basic|starter|tiet kiem|cheap|affordable)\b/.test(normalized)
  const price = Number(plan.price || 0)
  const days = Number(plan.durationDays || 0)
  const monthlyCost = planMonthlyCost(plan)
  const vip = isPlanVip(plan)
  const frequency = extractFrequency(normalized)
  const goal = inferGoal(normalized)

  let score = 0

  // 1. budgetFit (highest priority)
  if (budget) {
    const comparableCost = monthlyBudget ? monthlyCost : price
    if (comparableCost <= budget) score += 50
    else score -= Math.min(50, ((comparableCost - budget) / Math.max(budget, 1)) * 50)

    if (monthlyBudget && price > budget) score -= student ? 25 : 10
    if (monthlyBudget && price <= budget) score += 15
  }

  // 2. workoutFrequency
  if (frequency !== null) {
    if (frequency <= 3) {
      if (vip) score -= 25
      else if (days > 90) score -= 15
    }
    if (frequency >= 5 && !vip && days > 90) score += 10
  }

  // 3. goalFit
  if (goal === 'muscle_gain' && !vip) score += 8

  // 4. audienceFit
  if (student) {
    score += 15
    if (vip && !explicitVip) score -= 40
    if (days > 120 && !wantsLongTerm) score -= 22
    if (days > 0 && days <= 60) score += 12
    if (hasPlanText(plan, /\b(premium|standard|student|sinh vien|pro|nang cao)\b/) && !vip) score += 12
  }

  // 5. commitmentFit
  if (wantsBasic && hasPlanText(plan, /\b(basic|co ban|starter|moi|beginner)\b/)) score += 12
  if (wantsLongTerm) score += Math.min(days / 30, 6)
  if (explicitVip && vip) score += 30

  // 6. pricePerDay & benefits (lowest priority)
  score += Math.min(countBenefits(plan), 6)
  score -= (price / Math.max(maxPrice, 1)) * 0.5
  score -= Math.max(0, pricePerDay(plan) - 5000) / 50000

  return score
}

export const chooseRecommendedPlan = (plans, query) => {
  const normalized = normalizeQuestion(query)
  const byPrice = [...plans].sort((a, b) => (a.price || 0) - (b.price || 0))
  const byDuration = [...plans].sort((a, b) => (b.durationDays || 0) - (a.durationDays || 0) || pricePerDay(a) - pricePerDay(b))
  const byBenefits = [...plans].sort((a, b) => countBenefits(b) - countBenefits(a) || (b.price || 0) - (a.price || 0))
  const enterprise = findPlanByNamePattern(plans, /\b(doanh nghiep|enterprise|business|company|corporate|team|group|nhom)\b/)
  const maxPrice = Math.max(...plans.map((plan) => Number(plan.price || 0)), 1)
  const beginnerRanked = [...plans].sort((a, b) => {
    const score = (plan) => (
      (hasPlanText(plan, /\b(moi|nguoi moi|beginner|starter|basic|co ban|tap thu|new|try)\b/) ? 4 : 0)
      - Number(plan.price || 0) / maxPrice
      - Math.abs(Number(plan.durationDays || 30) - 30) / 365
    )
    return score(b) - score(a)
  })
  const premiumRanked = [...plans].sort((a, b) => {
    const score = (plan) => (
      countBenefits(plan) * 2
      + Number(plan.price || 0) / maxPrice
      + Number(plan.durationDays || 0) / 365
      + (hasPlanText(plan, /\b(vip|premium|platinum|cao cap|pro|unlimited|khong gioi han|full|all access)\b/) ? 3 : 0)
    )
    return score(b) - score(a)
  })
  const recommendationQuery = /\b(best|recommend|suitable|which|should|phu hop|nen chon|goi y|tu van|chon)\b/.test(normalized)
  const hasBudgetOrPersona = Boolean(normalizeMoneyFromQuery(query)) || /\b(student|sinh vien|budget|ngan sach)\b/.test(normalized)
  const fitRanked = [...plans].sort((a, b) => (
    scoreRecommendationFit(b, query, maxPrice) - scoreRecommendationFit(a, query, maxPrice)
  ))

  if (/\b(doanh nghiep|enterprise|business|company|corporate|team|group|nhom)\b/.test(normalized) && enterprise) return enterprise
  if (recommendationQuery && hasBudgetOrPersona) {
    const topFit = fitRanked[0]
    const student = /\b(student|sinh vien)\b/.test(normalized)
    const explicitVip = /\b(vip|platinum|cao cap|premium service|premium benefits|all access|full access)\b/.test(normalized)
    const freq = extractFrequency(normalized)
    if (student && !explicitVip && topFit && isPlanVip(topFit) && (freq === null || freq <= 3)) {
      const nonVipFit = fitRanked.find(p => !isPlanVip(p))
      if (nonVipFit) return nonVipFit
    }
    return topFit
  }
  if (/\b(nhieu tien|du tien|cao cap|vip|premium|platinum)\b/.test(normalized)) return premiumRanked[0]
  if (/\b(dich vu|service|chat luong|quality|tot nhat|nhieu quyen loi|premium|vip)\b/.test(normalized)) return byBenefits[0]
  if (/\b(lau dai|long term|commit|gan ket|on dinh)\b/.test(normalized)) return byDuration[0]
  if (/\b(moi tap|nguoi moi|bat dau|tap thu|beginner|new|try)\b/.test(normalized)) return beginnerRanked[0] || byPrice[0]
  if (/\b(re nhat|gia re|cheap|cheapest|tiet kiem)\b/.test(normalized)) return byPrice[0]
  if (/\b(dang tien|best value|value)\b/.test(normalized)) return [...plans].sort((a, b) => pricePerDay(a) - pricePerDay(b) || countBenefits(b) - countBenefits(a))[0]
  return beginnerRanked[0] || byPrice[0]
}

export const buildPlanRecommendationPayload = (plans, query, lang = 'vi') => {
  if (!Array.isArray(plans) || plans.length === 0) return null
  const normalizedRecQuery = normalizeQuestion(query)
  const recommendedPlan = chooseRecommendedPlan(plans, query)
  let reason = ''

  if (/\b(student|sinh vien)\b/.test(normalizedRecQuery) && normalizeMoneyFromQuery(query) && isMonthlyBudgetQuery(normalizedRecQuery)) {
    reason = lang === 'en'
      ? 'For a student with a monthly budget, this balances budget fit, lower commitment, useful benefits, and total upfront cost instead of only price per day.'
      : 'Với sinh viên có ngân sách theo tháng, gói này cân bằng ngân sách, mức cam kết, quyền lợi và chi phí trả trước thay vì chỉ tối ưu giá theo ngày.'
  } else if (/\b(re nhat|rẻ nhất|gia re|giá rẻ|cheap|cheapest|tiet kiem|tiết kiệm)\b/.test(normalizedRecQuery)) {
    reason = lang === 'en' ? 'This is the most affordable plan, perfect for trying out.' : 'Đây là gói có giá thấp nhất, phù hợp để tập thử.'
  } else if (/\b(moi tap|mới tập|nguoi moi|người mới|bat dau|bắt đầu|tap thu|tập thử|beginner|new)\b/.test(normalizedRecQuery)) {
    reason = lang === 'en' ? 'This plan is ideal for beginners just starting their fitness journey.' : 'Đây là gói cơ bản dành cho người mới bắt đầu.'
  } else if (/\b(lau dai|lâu dài|long term|commit|gan ket|gắn kết|on dinh|ổn định)\b/.test(normalizedRecQuery)) {
    reason = lang === 'en' ? 'This plan offers strong long-term value with a good price per day.' : 'Đây là gói có thời hạn dài với chi phí theo ngày hợp lý.'
  } else if (/\b(dich vu|dịch vụ|service|chat luong|chất lượng|quality|tot nhat|tốt nhất|nhieu quyen loi|nhiều quyền lợi)\b/.test(normalizedRecQuery)) {
    reason = lang === 'en' ? 'This plan has the most benefits and premium services in the database.' : 'Đây là gói có nhiều quyền lợi và dịch vụ cao cấp nhất trong dữ liệu.'
  } else if (/\b(doanh nghiep|doanh nghiệp|enterprise|team|nhom|nhóm|group)\b/.test(normalizedRecQuery)) {
    reason = lang === 'en' ? 'This plan is designed for corporate groups and teams.' : 'Đây là gói dành cho doanh nghiệp và nhóm tập.'
  } else {
    reason = lang === 'en' ? 'Based on your needs and the available GymPro plans, this is the clearest fit.' : 'Dựa trên nhu cầu của bạn và các gói đang có tại GymPro, đây là lựa chọn phù hợp nhất.'
  }

  const alternatives = plans
    .filter((plan) => String(plan._id) !== String(recommendedPlan._id))
    .slice(0, 2)

  return { type: 'plan_recommend', recommendedPlan, reason, alternatives }
}

function formatDate(dateStr, lang) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function buildSuggestions(intent, hasData, lang) {
  const sets = lang === 'en' ? {
    membership_has: ['Should I renew my membership?', 'Compare available plans', 'What are my benefits?'],
    membership_none: ['View available plans', 'Register for a plan', 'Contact sales for advice'],
    schedule_has: ['When is my next PT session?', 'Did I miss any sessions?', 'Reschedule my booking'],
    schedule_none: ['Book a PT session', 'View class schedule', 'When are slots available?'],
    checkin_has: ['Am I checking in enough?', 'How was my attendance last month?', 'Set a check-in goal'],
    checkin_none: ['How do I check in?', 'Start my first check-in', 'Join a class today'],
    health_has: ['How is my BMI trending?', 'What health metric should I improve?', 'Set a health goal'],
    health_none: ['How to log health metrics?', 'What metrics should I track?', 'Ask PT for health advice'],
    progress_has: ['How is my progress this month?', 'What goal should I set next?', 'Compare to last month'],
    progress_none: ['Start tracking your workouts', 'Set your first fitness goal', 'Book a PT session'],
  } : {
    membership_has: ['Có nên gia hạn gói tập?', 'So sánh các gói tập', 'Quyền lợi của tôi là gì?'],
    membership_none: ['Xem các gói tập', 'Đăng ký gói tập', 'Liên hệ tư vấn'],
    schedule_has: ['Buổi PT tiếp theo khi nào?', 'Tôi đã bỏ lỡ buổi nào chưa?', 'Đổi lịch tập'],
    schedule_none: ['Đặt lịch với PT', 'Xem lịch lớp tập', 'Khi nào còn chỗ trống?'],
    checkin_has: ['Tôi check-in có đều không?', 'Tháng trước tôi đi tập thế nào?', 'Đặt mục tiêu check-in'],
    checkin_none: ['Cách check-in như thế nào?', 'Bắt đầu check-in đầu tiên', 'Tham gia lớp tập hôm nay'],
    health_has: ['Chỉ số BMI của tôi thế nào?', 'Tôi nên cải thiện chỉ số nào?', 'Đặt mục tiêu sức khỏe'],
    health_none: ['Làm sao để nhập chỉ số?', 'Nên theo dõi chỉ số nào?', 'Hỏi PT về sức khỏe'],
    progress_has: ['Tiến độ tháng này thế nào?', 'Mục tiêu tiếp theo là gì?', 'So sánh với tháng trước'],
    progress_none: ['Bắt đầu theo dõi tập luyện', 'Đặt mục tiêu đầu tiên', 'Đặt lịch với PT'],
  }

  const key = `${intent}_${hasData ? 'has' : 'none'}`
  return sets[key] || []
}

export function formatDbResponse({ intent, memberContext, language, query = '' }) {
  const lang = normalizeLanguage(language)
  const data = memberContext?.availableData || {}
  const missing = memberContext?.missingData || []

  let answer = ''
  let suggestions = []
  let planPayload = null

  switch (intent) {
    case 'membership': {
      const membership = data.membership
      const plans = data.availablePlans || []

      const specificPlan = findRequestedPlan(query, plans, lang)

      if (specificPlan) {
        answer = ''
        suggestions = buildPlanDetailSuggestions(specificPlan, plans, lang)
        planPayload = { type: 'plan_detail', plan: specificPlan }
        break
      }

      const availablePlansQuestion = isAvailablePlansQuestion(query)

      if (availablePlansQuestion) {
        answer = lang === 'en'
          ? 'GymPro currently offers these plans:'
          : 'Hiện GymPro có các gói:'
      } else if (membership?.found) {
        const dur = formatDuration(membership.planDurationDays, lang)
        if (membership.status === 'expired') {
          answer = lang === 'en'
            ? `Your **${membership.planName}** plan has expired (ended ${formatDate(membership.endDate, lang)}).`
            : `Gói **${membership.planName}** của bạn đã hết hạn (kết thúc ${formatDate(membership.endDate, lang)}).`
        } else {
          answer = lang === 'en'
            ? `You are on **${membership.planName}**. ${membership.remainingDays} days left${dur ? ` (${dur})` : ''}.`
            : `Bạn đang dùng **${membership.planName}**. Còn ${membership.remainingDays} ngày${dur ? ` (${dur})` : ''}.`
        }
      } else {
        answer = lang === 'en'
          ? 'You do not have an active membership plan yet.'
          : 'Hiện tại bạn chưa có gói tập nào.'
      }

      if (plans.length > 0 && !specificPlan) {
        answer = availablePlansQuestion ? '' : answer
      }

      if (!specificPlan) {
        suggestions = plans.length > 0 ? buildPlanListSuggestions(plans, lang) : buildSuggestions('membership', !!membership?.found, lang)
        planPayload = plans.length > 0 ? { type: 'plan_list', plans } : null
      }
      break
    }

    case 'membership_compare': {
      const comparePlans = data.availablePlans || []

      if (comparePlans.length === 0) {
        answer = lang === 'en'
          ? 'There are no active plans available for comparison.'
          : 'Hiện chưa có gói tập nào để so sánh.'
        suggestions = []
        break
      }

      const mentioned = findMentionedPlans(query, comparePlans)

      // compare_two: exactly 2 specific plans mentioned
      if (mentioned.length >= 2) {
        const twoPlans = mentioned.slice(0, 2)
        const cheaper = [...twoPlans].sort((a, b) => (a.price || 0) - (b.price || 0))[0]
        const richer = [...twoPlans].sort((a, b) => countBenefits(b) - countBenefits(a))[0]
        const cheaperName = lang === 'en' ? (cheaper.nameEn || cheaper.nameVi) : (cheaper.nameVi || cheaper.nameEn)
        const richerName = lang === 'en' ? (richer.nameEn || richer.nameVi) : (richer.nameVi || richer.nameEn)
        const conclusion = lang === 'en'
          ? `${cheaperName} is better for saving cost; ${richerName} is better if you want more benefits.`
          : `${cheaperName} phù hợp hơn nếu muốn tiết kiệm; ${richerName} phù hợp hơn nếu muốn nhiều quyền lợi.`
        answer = ''
        suggestions = buildCompareTwoSuggestions(lang)
        planPayload = { type: 'plan_compare_two', plans: twoPlans, conclusion }
        break
      }

      // single plan mentioned in a compare query → treat as detail
      if (mentioned.length === 1) {
        answer = ''
        suggestions = buildPlanDetailSuggestions(mentioned[0], comparePlans, lang)
        planPayload = { type: 'plan_detail', plan: mentioned[0] }
        break
      }

      // compare_all: no specific plans mentioned → show everything
      answer = ''

      const compareSuggestions = []
      comparePlans.forEach((p) => {
        const name = lang === 'en' ? (p.nameEn || p.nameVi) : (p.nameVi || p.nameEn)
        compareSuggestions.push(lang === 'en' ? `Details of ${name}` : `Chi tiết ${name}`)
      })
      compareSuggestions.push(
        lang === 'en' ? 'I am new, which plan should I choose?' : 'Tôi mới tập nên chọn gói nào?',
        lang === 'en' ? 'Register for a plan' : 'Đăng ký gói tập',
      )
      suggestions = compareSuggestions.slice(0, 4)
      planPayload = { type: 'plan_compare_all', plans: comparePlans }
      break
    }

    case 'membership_recommend': {
      const recPlans = data.availablePlans || []

      if (recPlans.length === 0) {
        answer = lang === 'en'
          ? 'There are no active plans available right now.'
          : 'Hiện chưa có gói tập nào đang hoạt động.'
        suggestions = []
        break
      }

      answer = ''
      suggestions = buildRecommendSuggestions(lang)
      planPayload = buildPlanRecommendationPayload(recPlans, query, lang)
      break
    }

    case 'schedule': {
      const bookings = data.upcomingBookings || []

      if (bookings.length > 0) {
        const lines = bookings.map((b, i) => {
          const date = formatDate(b.date, lang)
          return lang === 'en'
            ? `${i + 1}. ${date} at ${b.slot}${b.ptName ? ` — PT: ${b.ptName}` : ''}`
            : `${i + 1}. ${date} — ${b.slot}${b.ptName ? ` — PT: ${b.ptName}` : ''}`
        })
        answer = (lang === 'en' ? 'Your upcoming sessions:\n' : 'Lịch tập sắp tới của bạn:\n') + lines.join('\n')
      } else {
        answer = lang === 'en'
          ? 'You have no upcoming sessions scheduled.'
          : 'Bạn chưa có lịch tập nào sắp tới.'
      }

      suggestions = buildSuggestions('schedule', bookings.length > 0, lang)
      break
    }

    case 'checkin': {
      const checkins = data.checkins || []

      if (checkins.length > 0) {
        const count = checkins.length
        const lastCheckin = formatDate(checkins[0]?.createdAt || checkins[0]?.date, lang)
        answer = lang === 'en'
          ? `You have checked in **${count} time${count > 1 ? 's' : ''}**. Last check-in: ${lastCheckin}.`
          : `Bạn đã check-in **${count} lần**. Lần gần nhất: ${lastCheckin}.`
      } else {
        answer = lang === 'en'
          ? 'You have no check-in records yet.'
          : 'Bạn chưa có lịch sử check-in nào.'
      }

      suggestions = buildSuggestions('checkin', checkins.length > 0, lang)
      break
    }

    case 'health': {
      const metrics = data.healthMetrics || []

      if (metrics.length > 0) {
        const latest = metrics[0]
        answer = lang === 'en'
          ? `Your latest health metrics (${formatDate(latest.createdAt, lang)}): ${latest.title || latest.description || ''}`
          : `Chỉ số sức khỏe gần nhất (${formatDate(latest.createdAt, lang)}): ${latest.title || latest.description || ''}`
        if (metrics.length > 1) {
          answer += `\n` + (lang === 'en' ? `Total entries: ${metrics.length}` : `Tổng số lần ghi nhận: ${metrics.length}`)
        }
      } else {
        answer = lang === 'en'
          ? 'You have not logged any health metrics yet. You can update them in your profile or ask the front desk.'
          : 'Bạn chưa ghi nhận chỉ số sức khỏe nào. Bạn có thể cập nhật trong hồ sơ hoặc nhờ lễ tân hỗ trợ.'
      }

      suggestions = buildSuggestions('health', metrics.length > 0, lang)
      break
    }

    case 'progress': {
      const bookings = data.recentBookings || []
      const checkins = data.checkins || []
      const metrics = data.healthMetrics || []
      const activities = data.progressActivities || []
      const hasData = bookings.length > 0 || checkins.length > 0 || metrics.length > 0 || activities.length > 0

      if (hasData) {
        const parts = []
        if (bookings.length > 0) {
          parts.push(lang === 'en' ? `${bookings.length} recent sessions` : `${bookings.length} buổi tập gần đây`)
        }
        if (checkins.length > 0) {
          parts.push(lang === 'en' ? `${checkins.length} check-ins` : `${checkins.length} lần check-in`)
        }
        if (metrics.length > 0) {
          parts.push(lang === 'en' ? `${metrics.length} health records` : `${metrics.length} chỉ số sức khỏe`)
        }
        answer = (lang === 'en' ? 'Your progress summary:\n• ' : 'Tổng quan tiến độ của bạn:\n• ') + parts.join('\n• ')
      } else {
        answer = lang === 'en'
          ? 'No progress data found yet. Start working out and tracking your metrics!'
          : 'Chưa có dữ liệu tiến độ. Hãy bắt đầu tập luyện và theo dõi chỉ số của bạn!'
      }

      suggestions = buildSuggestions('progress', hasData, lang)
      break
    }

    case 'member_profile': {
      const profile = data.profile || {}
      const membership = data.membership || {}
      const lines = lang === 'en'
        ? [
            `Member: **${profile.name || 'Member'}**`,
            profile.email ? `Email: ${profile.email}` : '',
            profile.phone ? `Phone: ${profile.phone}` : '',
            membership.found ? `Current plan: **${membership.planName || membership.planNameEn || ''}** (${membership.remainingDays || 0} days left)` : 'No active membership plan found.',
          ]
        : [
            `Hội viên: **${profile.name || 'Hội viên'}**`,
            profile.email ? `Email: ${profile.email}` : '',
            profile.phone ? `SĐT: ${profile.phone}` : '',
            membership.found ? `Gói hiện tại: **${membership.planName || membership.planNameVi || ''}** (còn ${membership.remainingDays || 0} ngày)` : 'Chưa tìm thấy gói tập đang hoạt động.',
          ]
      answer = lines.filter(Boolean).join('\n')
      suggestions = lang === 'en'
        ? ['View available plans', 'When does my plan expire?', 'View my workout schedule']
        : ['Xem các gói tập', 'Gói của tôi khi nào hết hạn?', 'Xem lịch tập của tôi']
      break
    }

    default:
      answer = lang === 'en'
        ? 'I could not find the relevant information in your account.'
        : 'Tôi không tìm thấy thông tin phù hợp trong tài khoản của bạn.'
      suggestions = []
  }

  return {
    answer,
    suggestions: suggestions.filter(Boolean).slice(0, 4),
    planPayload,
  }
}
