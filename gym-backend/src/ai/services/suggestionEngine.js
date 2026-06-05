const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

const planName = (plan, language = 'vi') => {
  if (!plan) return ''
  return normalizeLanguage(language) === 'en'
    ? (plan.nameEn || plan.nameVi || plan.name || '')
    : (plan.nameVi || plan.nameEn || plan.name || '')
}

const countBenefits = (plan) => Math.max(
  Array.isArray(plan?.featuresVi) ? plan.featuresVi.length : 0,
  Array.isArray(plan?.featuresEn) ? plan.featuresEn.length : 0,
)

const pricePerDay = (plan) => {
  const price = Number(plan?.price || 0)
  const days = Number(plan?.durationDays || 0)
  return days > 0 ? price / days : Number.POSITIVE_INFINITY
}

const byId = (a, b) => String(a?._id || a?.id || '') === String(b?._id || b?.id || '')

const uniqPlans = (plans = []) => {
  const seen = new Set()
  return (Array.isArray(plans) ? plans : [])
    .filter(Boolean)
    .filter((plan) => {
      const key = String(plan._id || plan.id || planName(plan, 'vi') || planName(plan, 'en'))
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const getCheapestPlan = (plans) => [...plans].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0]
const getRichestPlan = (plans) => [...plans].sort((a, b) => countBenefits(b) - countBenefits(a) || Number(b.price || 0) - Number(a.price || 0))[0]
const getFeaturedPlan = (plans) => [...plans].sort((a, b) => countBenefits(b) - countBenefits(a) || Number(b.price || 0) - Number(a.price || 0))[0]
const getBestValuePlan = (plans) => [...plans].sort((a, b) => pricePerDay(a) - pricePerDay(b) || countBenefits(b) - countBenefits(a))[0]

const findAlternativePlan = (plans, primaryPlan) => {
  const candidates = uniqPlans(plans).filter((plan) => !byId(plan, primaryPlan))
  if (candidates.length === 0) return null
  return getBestValuePlan(candidates) || candidates[0]
}

const getCurrentPlanName = (currentMembership, language) => {
  if (!currentMembership?.found) return ''
  return normalizeLanguage(language) === 'en'
    ? (currentMembership.planNameEn || currentMembership.planName || currentMembership.planNameVi || '')
    : (currentMembership.planNameVi || currentMembership.planName || currentMembership.planNameEn || '')
}

const inferGoal = (...texts) => {
  const normalized = normalizeText(texts.filter(Boolean).join(' '))
  if (/\b(tang co|muscle|gain muscle|hypertrophy)\b/.test(normalized)) return 'muscle'
  if (/\b(giam mo|giam can|fat loss|lose fat|weight loss|cut)\b/.test(normalized)) return 'fat_loss'
  if (/\b(tang can|bulk|bulking|gain weight)\b/.test(normalized)) return 'weight_gain'
  return ''
}

const hasPersonalHealthData = (memberProfile) => {
  if (!memberProfile) return false
  if (Array.isArray(memberProfile.healthMetrics) && memberProfile.healthMetrics.length > 0) return true
  if (Array.isArray(memberProfile.progressActivities) && memberProfile.progressActivities.length > 0) return true
  if (memberProfile.goal || memberProfile.fitnessGoal || memberProfile.healthScore) return true
  return false
}

const sanitizeSuggestions = (suggestions, userQuestion, limit = 4) => {
  const normalizedQuestion = normalizeText(userQuestion)
  const seen = new Set()
  return suggestions
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => {
      const normalized = normalizeText(item)
      if (!normalized || normalized === normalizedQuestion || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    .slice(0, limit)
}

const addMembershipAwareSuggestions = ({ suggestions, currentMembership, recommendedPlan, language }) => {
  const lang = normalizeLanguage(language)
  if (!currentMembership?.found) return suggestions

  const result = [...suggestions]
  const contextual = []

  contextual.push(lang === 'en'
    ? 'What is the difference between my current plan and the recommended plan?'
    : 'Điểm khác biệt giữa gói hiện tại và gói tập mới được đề xuất là gì?')

  contextual.push(lang === 'en'
    ? 'How many days are left on my current plan?'
    : 'Gói hiện tại của tôi còn bao nhiêu ngày?')

  result.splice(1, 0, ...contextual)
  return result
}

const buildPlanListSuggestions = ({ plans, language }) => {
  const lang = normalizeLanguage(language)
  return lang === 'en'
    ? [
        'Which plan saves the most?',
        'Compare VIP and Advanced plans',
        'I am new, what should I choose?',
        'What if I want to lose weight?'
      ]
    : [
        'Gói nào tiết kiệm nhất?',
        'So sánh VIP và Nâng Cao',
        'Tôi mới tập nên chọn gì?',
        'Tôi muốn giảm cân thì sao?'
      ]
}

const buildPlanDetailSuggestions = ({ plans, selectedPlan, language }) => {
  const lang = normalizeLanguage(language)
  return lang === 'en'
    ? [
        'How can I register for this plan?',
        'How does this plan compare with other plans?',
        'Is this plan really suitable for my goals?',
        'Can I check out other gym plans?'
      ]
    : [
        'Làm thế nào để đăng ký gói tập này?',
        'So sánh gói này với các gói tập khác thế nào?',
        'Gói tập này có thực sự phù hợp với mục tiêu của tôi không?',
        'Tôi có thể tham khảo các gói tập khác không?'
      ]
}

const buildPlanCompareTwoSuggestions = ({ plans, language }) => {
  const lang = normalizeLanguage(language)
  return lang === 'en'
    ? [
        'Which of these two plans should I choose?',
        'Which plan saves more money?',
        'What are the details of the first plan?',
        'What are the details of the second plan?'
      ]
    : [
        'Tôi nên chọn gói nào trong hai gói này?',
        'Gói nào tiết kiệm chi phí hơn?',
        'Tôi muốn biết chi tiết hơn về gói thứ nhất?',
        'Tôi muốn biết chi tiết hơn về gói thứ hai?'
      ]
}

const buildPlanRecommendSuggestions = ({ plans, recommendedPlan, language }) => {
  const lang = normalizeLanguage(language)
  return lang === 'en'
    ? [
        'Which plan saves the most?',
        'Compare VIP and Advanced plans',
        'I am new, what should I choose?',
        'What if I want to lose weight?'
      ]
    : [
        'Gói nào tiết kiệm nhất?',
        'So sánh VIP và Nâng Cao',
        'Tôi mới tập nên chọn gì?',
        'Tôi muốn giảm cân thì sao?'
      ]
}

const buildWorkoutHealthSuggestions = ({ userQuestion, aiAnswer, memberProfile, language }) => {
  const lang = normalizeLanguage(language)
  const goal = inferGoal(userQuestion, aiAnswer, JSON.stringify(memberProfile || {}))
  const missingData = !hasPersonalHealthData(memberProfile)

  if (missingData) {
    return lang === 'en'
      ? ['Is my goal muscle gain or fat loss?', 'Where should I start?', 'Do I need a PT?', 'How many sessions per week should I train?']
      : ['Mục tiêu của tôi là tăng cơ hay giảm mỡ?', 'Tôi nên bắt đầu từ đâu?', 'Tôi có cần PT không?', 'Tôi nên tập mấy buổi/tuần?']
  }

  const suggestions = lang === 'en'
    ? ['How should I organize my workout schedule this week?', 'How many sessions per week should I train?', 'What should I eat to reach my goal faster?', 'How can I track my progress?']
    : ['Bạn gợi ý lịch tập tuần này cho tôi được không?', 'Tôi nên tập mấy buổi một tuần là hợp lý?', 'Ăn gì để đạt mục tiêu nhanh hơn?', 'Làm sao để tôi có thể theo dõi tiến độ của mình?']

  if (goal === 'muscle') {
    suggestions[2] = lang === 'en' ? 'What should I eat to gain muscle faster?' : 'Ăn gì để tăng cơ nhanh hơn?'
  } else if (goal === 'fat_loss') {
    suggestions[2] = lang === 'en' ? 'What should I eat to lose fat faster?' : 'Ăn gì để giảm mỡ nhanh hơn?'
  } else if (goal === 'weight_gain') {
    suggestions[2] = lang === 'en' ? 'What should I eat to gain weight safely?' : 'Ăn gì để tăng cân an toàn?'
  }

  return suggestions
}

const buildGeneralSmartSuggestions = ({ userQuestion, aiAnswer, memberProfile, currentMembership, language }) => {
  const lang = normalizeLanguage(language)
  const normalized = normalizeText(`${userQuestion} ${aiAnswer}`)

  if (/\b(thong bao|notification|reminder|alert|nhac lich)\b/.test(normalized)) {
    return lang === 'en'
      ? ['Which notification should I pay attention to?', 'Could you remind me about my next PT session?', 'Did I miss any important update?', 'How do I manage GymPro notifications?']
      : ['Thông báo nào tôi cần chú ý?', 'Bạn nhắc tôi lịch PT tiếp theo được không?', 'Tôi có bỏ lỡ cập nhật quan trọng nào không?', 'Quản lý thông báo GymPro thế nào?']
  }

  if (/\b(dashboard|tong quan|overview|man hinh chinh|trang chu hoi vien)\b/.test(normalized)) {
    return lang === 'en'
      ? ['How is my training progress?', 'How is my check-in consistency?', 'When is my next PT session?', 'What should I focus on this week?']
      : ['Tiến độ tập luyện của tôi hiện tại thế nào?', 'Tôi check-in có đều không?', 'Buổi PT tiếp theo của tôi khi nào?', 'Tuần này tôi nên tập trung vào gì?']
  }

  if (/\b(checkin|check in|diem danh|attendance|qr)\b/.test(normalized)) {
    return lang === 'en'
      ? ['Am I checking in enough?', 'Should I set a check-in goal for this week?', 'How can I rebuild my training streak?', 'What should I train today?']
      : ['Tôi check-in có đủ đều không?', 'Tôi có nên đặt mục tiêu check-in tuần này không?', 'Làm sao để lấy lại streak tập luyện?', 'Hôm nay tôi nên tập gì?']
  }

  if (/\b(lich|schedule|booking|pt|trainer|session|dat lich)\b/.test(normalized)) {
    return lang === 'en'
      ? ['When is my next PT session?', 'Should I book a PT session this week?', 'Could you suggest my workout schedule this week?', 'Did I miss any sessions?']
      : ['Buổi PT tiếp theo của tôi khi nào?', 'Tuần này tôi có nên đặt PT không?', 'Bạn gợi ý lịch tập tuần này cho tôi được không?', 'Tôi đã bỏ lỡ buổi nào chưa?']
  }

  if (/\b(goi|membership|plan|expire|renew|upgrade|gia han|het han)\b/.test(normalized) || currentMembership?.found) {
    return lang === 'en'
      ? ['Should I upgrade my current plan?', 'How many days are left on my current plan?', 'Which plan fits my current goal?', 'Can I compare my current plan with other plans?']
      : ['Tôi có nên nâng cấp gói hiện tại không?', 'Gói hiện tại còn bao nhiêu ngày?', 'Gói nào phù hợp với mục tiêu hiện tại của tôi?', 'Tôi muốn so sánh gói hiện tại với các gói tập khác?']
  }

  return buildWorkoutHealthSuggestions({ userQuestion, aiAnswer, memberProfile, language: lang })
}

export function generateSmartSuggestions({
  userQuestion,
  aiAnswer,
  responseType,
  activePlans,
  selectedPlan,
  recommendedPlan,
  memberProfile,
  currentMembership,
  language,
}) {
  const lang = normalizeLanguage(language)
  const plans = uniqPlans(activePlans)
  const type = responseType || 'ai_advice'

  let suggestions = []

  if (type === 'plan_list' || type === 'plan_compare_all') {
    suggestions = buildPlanListSuggestions({ plans, language: lang })
  } else if (type === 'plan_detail') {
    suggestions = buildPlanDetailSuggestions({ plans, selectedPlan, language: lang })
  } else if (type === 'plan_compare_two') {
    suggestions = buildPlanCompareTwoSuggestions({ plans, language: lang })
  } else if (type === 'plan_recommend') {
    suggestions = buildPlanRecommendSuggestions({ plans, recommendedPlan, language: lang })
  } else if (/\b(workout|health|nutrition|progress|checkin|schedule|ai_advice)\b/.test(type)) {
    suggestions = buildGeneralSmartSuggestions({
      userQuestion,
      aiAnswer,
      memberProfile,
      currentMembership,
      language: lang,
    })
  }

  suggestions = addMembershipAwareSuggestions({
    suggestions,
    currentMembership,
    recommendedPlan,
    language: lang,
  })

  if (suggestions.length < 3) {
    suggestions.push(...(lang === 'en'
      ? ['What should I do next?', 'Do I need a PT?', 'How can I track my progress?']
      : ['Tôi nên làm gì tiếp theo?', 'Tôi có cần PT không?', 'Theo dõi tiến độ của tôi thế nào?']))
  }

  return sanitizeSuggestions(suggestions, userQuestion, 4)
}
