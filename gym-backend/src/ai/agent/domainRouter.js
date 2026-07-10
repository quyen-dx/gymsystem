const normalizeQuery = (text = '') => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const has = (n, pattern) => pattern.test(n)

const goalFromQuery = (n) => {
  if (/\b(giam mo|giam can|fat loss|lose weight)\b/.test(n)) return 'fat_loss'
  if (/\b(tang co|len co|muscle gain|hypertrophy)\b/.test(n)) return 'muscle_gain'
  if (/\b(tang can|len can|tang ky|weight gain|bulk)\b/.test(n)) return 'weight_gain'
  if (/\b(chay ben|suc ben|endurance|cardio)\b/.test(n)) return 'endurance'
  if (/\b(khoe hon|suc khoe|healthy|fitness)\b/.test(n)) return 'health'
  if (/\b(duy tri|giu dang|maintenance)\b/.test(n)) return 'maintenance'
  return null
}

const PRICE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(k|nghin|ngàn|nghìn|triệu|triêu|tr|trieu|m|đ|dong|vnd)?\b|\b(dưới|duoi|dướí|trên|tren|khoảng|khoang)\s+\d+/
const isPriceQuery = (n) => PRICE_PATTERN.test(n)

const isPriceExtractedPlan = (value) => {
  if (!value) return false
  // If the "plan name" contains a number + price unit, it's a budget, not a name
  return /^\d/.test(value) || /\d+\s*(k|nghin|ngàn|nghìn|triệu|triêu|tr|trieu|m)\b/.test(value)
}

const extractAfter = (n, pattern) => {
  const match = n.match(pattern)
  if (!match?.[1]) return null
  const value = match[1]
    .replace(/\b(gia|bao nhieu|tien|co quyen loi|quyen loi|co gi|khac nhau|chuyen mon|dang nhan|hoc vien|la gi|o dau)\b/g, ' ')
    .replace(/\?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return value || null
}

const planNameFromQuery = (n) => extractAfter(n, /\bgoi\s+(.+?)(?:\s+(?:gia|bao nhieu|co quyen loi|quyen loi|co gi|khac nhau|la gi)|\?|$)/)

const ptNameFromQuery = (n) => {
  const value = extractAfter(n, /\b(?:pt|trainer|coach|hlv|huan luyen vien)\s+(.+?)(?:\s+(?:chuyen mon|dang nhan|hoc vien|co lich|lich|la ai|o dau)|\?|$)/)
  if (!value || /^(nao|ai|phu hop|tot|gioi)\b/.test(value)) return null
  return value
}

const productNameFromQuery = (n) => {
  if (/\bwhey protein\b/.test(n)) return 'whey protein'
  if (/\bwhey\b/.test(n)) return 'whey'
  return extractAfter(n, /\b(?:san pham|product)\s+(.+?)(?:\s+(?:gia|bao nhieu|co gi)|\?|$)/)
}

const navigationSubject = (n) => {
  if (/\b(quen mat khau|forgot password|reset password)\b/.test(n)) return 'account'
  if (/\b(mat khau|password|email|ho so|profile|tai khoan|thong tin ca nhan)\b/.test(n)) return 'account'
  if (/\b(dat lich|huy lich|lich tap|lich cho|booking|lich pt)\b/.test(n)) return 'booking'
  if (/\b(doanh thu|bao cao|report|revenue)\b/.test(n)) return 'report'
  if (/\b(don hang|order)\b/.test(n)) return 'order'
  if (/\b(chinh sach|bao mat|policy|privacy)\b/.test(n)) return 'faq_policy'
  if (/\b(san pham|whey|shop|cua hang)\b/.test(n)) return 'product'
  return 'general'
}

const buildRoute = ({
  subject,
  action,
  intent,
  entityName = null,
  needsDatabase = false,
  requiredTools = [],
  selectedBuilder = subject,
  navigationPath = null,
  confidence = 0.9,
  reason = 'domain_router',
  goal = null,
  needsPermissionCheck = false,
  scope = 'unknown',
}) => ({
  subject,
  action,
  intent,
  entityName,
  needsDatabase,
  needsPermissionCheck,
  requiredTools,
  selectedTools: requiredTools,
  selectedBuilder,
  navigationPath,
  confidence,
  reason,
  goal,
  scope,
  usedLLMKnowledge: false,
})

export const routeGymQuery = ({ query = '', memory = {} } = {}) => {
  const n = normalizeQuery(query)
  if (!n) return buildRoute({ subject: 'general', action: 'unknown', intent: 'unknown', confidence: 0 })

  const hasUiNav = /\b(o dau|vao dau|bam dau|bam cho nao|mo trang nao|trang nao|duong dan|lam sao de vao|cach thao tac|lam the nao de vao)\b/.test(n)
  const hasDataAmount = /\b(gia|bao nhieu|doanh thu|so luong|co may|hoc vien|hoi vien|ton kho)\b/.test(n)

  if (/\b(doanh thu|bao cao|thong ke|bao nhieu hoi vien|so luong hoi vien|member nao sap het han|sap het han goi|email tat ca hoi vien|email hoi vien|so dien thoai pt)\b/.test(n)) {
    const nav = hasUiNav
    return buildRoute({
      subject: 'report',
      action: nav ? 'navigate' : 'data',
      intent: nav ? (/\b(doanh thu|revenue)\b/.test(n) ? 'revenue_navigation' : 'report_navigation') : (/\b(doanh thu|revenue)\b/.test(n) ? 'revenue_data' : 'report_data'),
      needsDatabase: !nav,
      requiredTools: [],
      selectedBuilder: nav ? 'navigation' : 'report',
      needsPermissionCheck: true,
      confidence: 0.96,
      reason: 'report_or_revenue_query',
    })
  }

  if (hasUiNav) {
    const navSubject = navigationSubject(n)
    const intentMap = {
      account: /\b(quen mat khau|forgot password)\b/.test(n) ? 'auth_forgot_password' : /\b(mat khau|password)\b/.test(n) ? 'account_security' : /\b(ho so|profile|email|thong tin ca nhan)\b/.test(n) ? 'profile_update' : 'account_navigation',
      booking: /\b(huy|cancel)\b/.test(n) ? 'booking_cancel' : /\b(dat|book)\b/.test(n) ? 'booking_create' : 'booking_navigation',
      report: /\b(doanh thu|revenue)\b/.test(n) ? 'revenue_navigation' : 'report_navigation',
      order: 'order_navigation',
      product: 'order_navigation',
      faq_policy: /\b(chinh sach|bao mat|policy|privacy)\b/.test(n) ? 'policy_navigation' : 'faq_answer',
      general: 'general_chat',
    }
    return buildRoute({
      subject: navSubject,
      action: 'navigate',
      intent: intentMap[navSubject] || 'general_chat',
      needsDatabase: ['faq_policy'].includes(navSubject),
      requiredTools: navSubject === 'faq_policy' ? ['searchPolicies'] : [],
      selectedBuilder: 'navigation',
      confidence: 0.93,
      reason: 'ui_navigation_query',
    })
  }

  if (/\b(quen mat khau|forgot password|reset password|doi mat khau|doi email|cap nhat ho so|ho so ca nhan|thong tin ca nhan|profile)\b/.test(n)) {
    return buildRoute({
      subject: 'account',
      action: 'navigate',
      intent: /\b(quen mat khau|forgot password|reset password)\b/.test(n)
        ? 'auth_forgot_password'
        : /\b(mat khau|password)\b/.test(n)
          ? 'account_security'
          : /\b(ho so|profile|email|thong tin ca nhan)\b/.test(n)
            ? 'profile_update'
            : 'account_navigation',
      selectedBuilder: 'navigation',
      confidence: 0.9,
      reason: 'account_navigation_or_security_query',
    })
  }

  if (/\b(hoan tien|huy lich|chinh sach|bao mat|mo cua|gio mo cua|faq|quy dinh|dieu khoan|privacy|refund|policy)\b/.test(n)) {
    const policy = /\b(hoan tien|chinh sach|bao mat|quy dinh|dieu khoan|privacy|refund|policy)\b/.test(n)
    return buildRoute({
      subject: 'faq_policy',
      action: policy ? 'policy' : 'faq',
      intent: policy ? 'policy_answer' : 'faq_answer',
      needsDatabase: true,
      requiredTools: [policy ? 'searchPolicies' : 'searchFaqs'],
      selectedBuilder: 'faq_policy',
      confidence: 0.91,
      reason: 'faq_policy_query',
    })
  }

  if (/\b(lich tap hom nay|lich cua toi|lich hen|lich cho xac nhan|dat lich|huy lich|booking)\b/.test(n)) {
    const cancel = /\b(huy|cancel)\b/.test(n)
    const create = /\b(dat|book)\b/.test(n)
    const nav = /\b(o dau|vao dau|lam o dau|trang nao)\b/.test(n)
    return buildRoute({
      subject: 'booking',
      action: nav ? 'navigate' : create ? 'create' : cancel ? 'cancel' : 'status',
      intent: nav ? 'booking_navigation' : create ? 'booking_create' : cancel ? 'booking_cancel' : 'booking_status',
      needsDatabase: !nav,
      requiredTools: nav ? [] : ['getUpcomingBookings'],
      selectedBuilder: nav ? 'navigation' : 'booking',
      confidence: 0.9,
      reason: 'booking_query',
    })
  }

  if (/\b(an gi|thuc don|protein|macro|calo|calorie|truoc khi tap|sau khi tap|dinh duong)\b/.test(n)
    && !/\b(whey|creatine|san pham|shop|product|cua hang)\b/.test(n)) {
    const intent = /\b(thuc don|meal plan|menu)\b/.test(n)
      ? 'nutrition_meal_plan'
      : /\b(protein|macro|calo|calorie)\b/.test(n)
        ? 'nutrition_macro'
        : /\b(truoc khi tap|pre workout)\b/.test(n)
          ? 'nutrition_pre_workout'
          : 'nutrition_advice'
    return buildRoute({
      subject: 'nutrition',
      action: intent === 'nutrition_meal_plan' ? 'plan' : 'advice',
      intent,
      selectedBuilder: 'nutrition',
      goal: goalFromQuery(n),
      confidence: 0.95,
      reason: 'nutrition_action_query',
    })
  }

  if (/\b(tap gi|bai tap|lich tap|tap nguc|tap lung|squat|deadlift|dau lung|dau goi|workout|giao an)\b/.test(n)
    && !/\b(lich tap hom nay|lich cua toi|dat lich|huy lich|lich cho)\b/.test(n)) {
    const intent = /\b(dau|chan thuong|squat|sai form|safety)\b/.test(n)
      ? 'workout_safety'
      : /\b(lich tap|giao an|buoi moi tuan|moi tuan|plan)\b/.test(n)
        ? 'workout_plan'
        : /\b(tap nguc|tap lung|tap chan|exercise)\b/.test(n)
          ? 'workout_exercise_detail'
          : 'workout_advice'
    return buildRoute({
      subject: 'workout',
      action: intent === 'workout_plan' ? 'plan' : 'advice',
      intent,
      selectedBuilder: 'workout',
      goal: goalFromQuery(n),
      confidence: 0.94,
      reason: 'workout_action_query',
    })
  }

  if (/\b(muc tieu|toi muon giam mo|toi muon giam can|toi muon tang co|toi muon khoe hon|toi muon chay ben hon|dat muc tieu)\b/.test(n)) {
    const asksSuggestion = /\b(goi y|nen dat|muc tieu gi)\b/.test(n)
    return buildRoute({
      subject: 'goal',
      action: asksSuggestion ? 'suggest' : 'select',
      intent: asksSuggestion ? 'fitness_goal_suggestion' : 'fitness_goal_selection',
      selectedBuilder: 'goal',
      goal: goalFromQuery(n),
      confidence: 0.94,
      reason: 'fitness_goal_query',
    })
  }

  if (/\b(pt|trainer|coach|hlv|huan luyen vien)\b/.test(n) || (/\b(nguoi thu|nguoi dau|nguoi thu \d+|no co lich)\b/.test(n) && memory?.lastSubject === 'pt')) {
    const list = /\b(co nhung|danh sach|tat ca|co may|bao nhieu pt)\b/.test(n)
    const availability = /\b(lich ranh|lich trong|co lich|availability|lich)\b/.test(n)
    const booking = /\b(dat lich|book)\b/.test(n)
    const recommend = /\b(phu hop|nen chon|giam can|giam mo|tang co)\b/.test(n)
    const entityName = ptNameFromQuery(n)
    return buildRoute({
      subject: 'pt',
      action: booking ? 'book' : availability ? 'availability' : recommend ? 'recommend' : entityName ? 'detail' : 'list',
      intent: booking ? 'pt_booking' : availability ? 'pt_availability' : recommend ? 'pt_recommendation' : entityName ? 'pt_detail' : 'pt_list',
      entityName,
      needsDatabase: true,
      requiredTools: ['getAvailablePTs'],
      selectedBuilder: 'pt',
      goal: goalFromQuery(n),
      confidence: 0.93,
      reason: 'pt_database_query',
    })
  }

  if (/\b(whey|protein|creatine|san pham|shop|cua hang|don hang|order)\b/.test(n)) {
    const order = /\b(don hang|order)\b/.test(n)
    if (order) {
      return buildRoute({
        subject: 'product',
        action: 'navigate',
        intent: 'order_navigation',
        selectedBuilder: 'navigation',
        confidence: 0.88,
        reason: 'order_navigation_query',
      })
    }
    const detail = /\b(gia|bao nhieu|chi tiet|co gi)\b/.test(n)
    return buildRoute({
      subject: 'product',
      action: detail ? 'detail' : /\b(phu hop|ho tro|nen mua)\b/.test(n) ? 'recommend' : 'list',
      intent: detail ? 'product_detail' : /\b(phu hop|ho tro|nen mua)\b/.test(n) ? 'product_recommendation' : 'product_list',
      entityName: productNameFromQuery(n),
      needsDatabase: true,
      requiredTools: ['getRecommendedProducts'],
      selectedBuilder: 'product',
      goal: goalFromQuery(n),
      confidence: 0.92,
      reason: 'product_database_query',
    })
  }

  if (/\b(goi|goi tap|membership|plan|package)\b/.test(n)) {
    const compare = /\b(so sanh|khac nhau|khac gi|vs|voi goi)\b/.test(n)
    const recommend = /\b(nen mua|nen chon|chon goi|goi nao phu hop|phu hop|tu van|tiet kiem|đáng tien|loi nhat|tot nhat|dang tien)\b/.test(n)
      && !/\b(dung tu van|khong tu van|chi tra loi dung goi)\b/.test(n)
    const list = /\b(co nhung|nhung goi nao|cac goi|danh sach|liet ke|tat ca|re nhat|dat nhat|cao nhat|thap nhat)\b/.test(n)
    const count = /\b(co may|co bao nhieu|bao nhieu goi)\b/.test(n)
    const status = /\b(cua toi|dang dung|con han|het han|toi con|toi het)\b/.test(n) || /\b(toi|tui)\s+(dang|dang tap|dang dung)\b/.test(n)
    const renewal = /\b(gia han|renew)\b/.test(n)
    const detail = /\b(gia|bao nhieu|quyen loi|co gi|thoi han|chi tiet)\b/.test(n)
    // If "detail" is triggered only by "giá"/"price"/"cost" and a price amount exists, it's a price search
    const isPriceSearch = isPriceQuery(n) && !/\b(quyen loi|co gi|thoi han|chi tiet)\b/.test(n)
    // Exclude "gói nào ... nhất" queries from detail — they are recommendations
    const asksExtreme = /\b(nao|nào)\b/.test(n) && /\b(nhat|nhất)\b/.test(n)
      && !/\b(re nhat|it tien nhat|thap nhat|dat nhat|cao nhat)\b/.test(n)
    // If query has a specific named plan, check it's not a price/budget string
    const rawPlanName = planNameFromQuery(n)
    const extractedPlanName = (asksExtreme || isPriceSearch || (rawPlanName && isPriceExtractedPlan(rawPlanName))) ? null : rawPlanName
    const action = renewal ? 'renew' : status ? 'status' : compare ? 'compare' : (recommend || asksExtreme) ? 'recommend' : count ? 'count' : list ? 'list' : isPriceSearch ? 'list' : detail || extractedPlanName ? 'detail' : 'list'
    const intentMap = {
      renew: 'membership_renewal',
      status: 'membership_status',
      compare: 'membership_compare',
      recommend: 'membership_recommendation',
      detail: 'membership_detail',
      count: 'membership_list',
      list: 'membership_list',
    }
    const tools = action === 'status' || action === 'renew'
      ? ['getMembershipInfo']
      : action === 'recommend'
        ? ['getAvailablePlans', 'getSmartRecommendations']
        : ['getAvailablePlans']
    const entityName = action === 'detail' ? extractedPlanName : null
    return buildRoute({
      subject: 'membership',
      action,
      intent: intentMap[action],
      entityName,
      needsDatabase: true,
      requiredTools: tools,
      selectedBuilder: 'membership',
      goal: goalFromQuery(n),
      confidence: 0.94,
      reason: 'membership_database_query',
    })
  }

  return buildRoute({
    subject: 'general',
    action: 'chat',
    intent: 'general_chat',
    selectedBuilder: 'general',
    confidence: 0.55,
    reason: 'unknown_general_query',
  })
}

export const toLegacySubject = (subject) => {
  if (subject === 'membership') return 'plan'
  if (subject === 'faq_policy') return 'policy'
  return subject
}

export const toOptimizerResult = (route, { query = '' } = {}) => {
  const subject = toLegacySubject(route.subject)
  // For recommendation intents, use getSmartRecommendations as the direct tool
  // (it produces a reasoned recommendation instead of just listing all plans)
  const isRecommend = route.action === 'recommend' && route.requiredTools?.includes('getSmartRecommendations')
  const firstTool = isRecommend ? 'getSmartRecommendations' : (route.requiredTools?.[0] || null)
  const toolArgs = firstTool === 'searchPolicies'
    ? { query }
    : firstTool === 'searchFaqs'
      ? { query }
      : firstTool === 'getRecommendedProducts'
        ? { goal: route.goal || '' }
        : firstTool === 'getSmartRecommendations'
          ? { goal: route.goal || undefined }
        : firstTool === 'getAvailablePTs' && route.entityName
          ? { specialization: route.entityName }
        : {}

  return {
    shouldUseAI: false,
    directTool: firstTool,
    subject,
    domainSubject: route.subject,
    action: route.action,
    intent: route.intent,
    reason: route.reason,
    confidence: route.confidence,
    args: toolArgs,
    targetEntity: route.entityName ? { type: subject, id: '', name: route.entityName, method: 'domain_router' } : null,
    needsDatabase: route.needsDatabase,
    selectedBuilder: route.selectedBuilder,
    navigationPath: route.navigationPath,
    needsPermissionCheck: route.needsPermissionCheck,
    requiredTools: route.requiredTools,
    goal: route.goal,
  }
}

export const toReasonerResult = (route) => {
  const subject = toLegacySubject(route.subject)
  const forbiddenFallbacks = []
  if (route.intent === 'membership_detail') forbiddenFallbacks.push('membership_recommendation', 'faq', 'navigation', 'policy')
  if (route.intent === 'membership_list') forbiddenFallbacks.push('membership_recommendation')
  if (route.intent === 'pt_detail') forbiddenFallbacks.push('faq', 'navigation', 'recommendation')
  if (['report_data', 'revenue_data', 'report'].includes(route.intent)) forbiddenFallbacks.push('faq', 'navigation', 'policy', 'recommendation')
  if (route.needsDatabase) forbiddenFallbacks.push('llm_internal_data')
  return {
    subject,
    domainSubject: route.subject,
    action: route.action,
    intent: route.intent,
    entityName: route.entityName || '',
    entities: {
      budget: null,
      goal: route.goal || null,
      frequencyPerWeek: null,
      mentionedPlan: route.subject === 'membership' ? route.entityName : null,
      mentionedPT: route.subject === 'pt' ? route.entityName : null,
      mentionedProduct: route.subject === 'product' ? route.entityName : null,
    },
    isFollowUp: false,
    followUpTarget: null,
    needsDatabase: route.needsDatabase,
    needsPermissionCheck: route.needsPermissionCheck,
    requiredTools: route.requiredTools,
    needsTools: route.requiredTools,
    forbiddenFallbacks: [...new Set(forbiddenFallbacks)],
    shouldUseWebSearch: false,
    shouldAskClarification: false,
    confidence: route.confidence,
    reason: route.reason,
    source: 'domain_router',
    selectedBuilder: route.selectedBuilder,
    navigationPath: route.navigationPath,
  }
}

export const __domainRouterTestHooks = {
  normalizeQuery,
  goalFromQuery,
}
