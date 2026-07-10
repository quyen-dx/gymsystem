import { entityResolver } from './entityResolver.js'
import { inferFaqCategory, inferPolicyCategory, isPolicyQuery, isStrongPolicyQuery, isSupportFaqQuery } from '../services/faqPolicySearchService.js'
import { routeGymQuery, toOptimizerResult } from './domainRouter.js'

const normalizeQuery = (text = '') => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const isPriceExtractedPlan = (value) => {
  if (!value) return false
  return /^\d/.test(value) || /\d+\s*(k|nghin|ngàn|nghìn|triệu|triêu|tr|trieu|m)\b/.test(value)
}

const hasComplexPersonalization = (n) => (
  /\b(toi muon|muc tieu|giam can|tang co|tang can|suc ben|ngan sach|budget|k|trieu|buoi\/tuan|lan\/tuan|phu hop|nen chon|recommend|goi y)\b/.test(n)
)

const hasPlanSignal = (n) => /\b(goi|goi tap|plan|plans|membership|package)\b/.test(n)
const hasPTSignal = (n) => /\b(pt|trainer|coach|hlv|huan luyen vien|nguoi)\b/.test(n)
const hasProductSignal = (n) => /\b(san pham|product|shop|whey|protein|creatine|gia san pham)\b/.test(n)
const hasReportSignal = (n) => /\b(doanh thu|bao cao|thong ke|bao nhieu hoi vien|so luong hoi vien|member count|email hoi vien|so dien thoai pt|don hang gan nhat|mat khau ma hoa|password hash)\b/.test(n)
const hasDynamicDataSignal = (n) => /\b(gia|bao nhieu|doanh thu|hoi vien|hoc vien|pt|trainer|checkin|check in|thanh toan|don hang|trang thai|lich hien tai)\b/.test(n)

const extractPlanSearch = (n) => {
  const match = n.match(/\bgoi\s+(.+?)\s+(?:gia|bao nhieu tien|co quyen loi|quyen loi|co gi|gom|bao gom|chi tiet|thong tin|la gi|the nao)\b/)
    || n.match(/\bplan\s+(.+?)\s+(?:price|cost|benefit|benefits|detail|details|include|includes)\b/)
  if (!match?.[1]) return ''
  return match[1]
    .replace(/\b(gia|price|cost|vnd|dong|\d+|trieu|nghin|k|m|tr)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractPTSearch = (n) => {
  const match = n.match(/\b(?:chi tiet|thong tin|profile|ho so|ve)\s+(?:pt|trainer|coach|hlv|huan luyen vien)?\s*(.+)$/)
    || n.match(/\b(?:pt|trainer|coach|hlv|huan luyen vien)\s+(.+)$/)
  if (!match?.[1]) return ''
  return match[1]
    .split(/\b(?:dang|hien|nhan|co|bao nhieu|neu|thi|dung|đang|hiện|nhận|có|bao nhiêu|nếu|thì|đừng)\b|\?/i)[0]
    .replace(/\b(la ai|nhu the nao|ra sao|giup toi|cho toi|xem|nhe|nha)\b/g, '')
    .trim()
}

const getLastEntityFollowUp = ({ query, memory = {} }) => {
  const n = normalizeQuery(query)
  const isReference = /\b(no|cai do|goi do|nguoi do|dau tien|cuoi cung|thu \d+|thu nhat|thu hai|thu ba|first|second|last)\b/.test(n)
  if (!isReference) return null

  const entityType = Array.isArray(memory.lastListedPTs) && memory.lastListedPTs.length > 0 && (memory.lastSubject === 'pt' || hasPTSignal(n))
    ? 'pt'
    : Array.isArray(memory.lastListedPlans) && memory.lastListedPlans.length > 0 && (memory.lastSubject === 'plan' || hasPlanSignal(n))
      ? 'plan'
      : Array.isArray(memory.lastListedProducts) && memory.lastListedProducts.length > 0 && (memory.lastSubject === 'product' || hasProductSignal(n))
        ? 'product'
        : null
  if (!entityType) return null

  const lastListedEntities = entityType === 'pt'
    ? memory.lastListedPTs
    : entityType === 'plan'
      ? memory.lastListedPlans
      : memory.lastListedProducts

  const resolution = entityResolver.resolve({
    userReference: query,
    lastListedEntities,
    entityType,
    query,
  })
  if (!resolution.resolved) return null

  const directTool = entityType === 'pt'
    ? 'getAvailablePTs'
    : entityType === 'plan'
      ? 'getAvailablePlans'
      : 'getRecommendedProducts'

  return {
    shouldUseAI: false,
    directTool,
    subject: entityType,
    action: 'detail',
    intent: `${entityType}_detail`,
    reason: 'memory_entity_follow_up',
    confidence: resolution.confidence || 0.85,
    targetEntity: {
      type: entityType,
      id: resolution.resolved.id || resolution.resolved._id || '',
      name: resolution.resolved.name || resolution.resolved.nameVi || resolution.resolved.nameEn || '',
      method: resolution.method,
    },
  }
}

export const detectNavigationSubject = (query = '') => {
  const n = normalizeQuery(query)
  if (/\b(tai khoan|account|mat khau|password|email|profile|ho so|otp|dang nhap|login|dang ky|register|bao mat|doi mat khau|thong tin ca nhan)\b/.test(n)) return 'account'
  if (/\b(dat lich|lich pt|booking|huy lich|doi lich|lich tap|lich cua toi|lich hen)\b/.test(n)) return 'booking'
  if (/\b(checkin|check in|diem danh|vao phong|quet qr|qr)\b/.test(n)) return 'checkin'
  if (/\b(suc khoe|health|bmi|can nang|mo co the|chi so co the|so do)\b/.test(n)) return 'health'
  if (/\b(lo trinh|bai tap|workout|tap luyen|giao an|lich tap luyen)\b/.test(n)) return 'workout'
  if (/\b(don hang|order|orders|lich su mua|hoa don)\b/.test(n)) return 'order'
  if (/\b(mua|whey|store|cua hang|san pham|shop|hang|dung cu tap|thuc pham bo sung)\b/.test(n)) return 'product'
  if (/\b(quen mat khau|forgot password|reset password|otp)\b/.test(n)) return 'forgot_password'
  if (/\b(faq|help|tro giup|huong dan|hoi dap|cau hoi thuong gap)\b/.test(n)) return 'faq'
  if (/\b(chinh sach|policy|dieu khoan|hoan tien|bao mat|quy dinh|chinh sach hoan tien|huy goi)\b/.test(n)) return 'policy'
  if (/\b(nap tien|deposit|vi|tien)\b/.test(n)) return 'payment'
  if (/\b(phan hoi|feedback|gop y)\b/.test(n)) return 'feedback'
  if (/\b(o dau|lam sao vao|trang nao|thao tac|navigation|di den|duong dan)\b/.test(n)) return 'navigation'
  return null
}

export const isNavigationQuery = (query = '') => {
  const n = normalizeQuery(query)
  if (hasDynamicDataSignal(n) && !/\b(o dau|vao dau|bam cho nao|mo trang nao|duong dan|lam sao de vao|cach thao tac)\b/.test(n)) return false
  const patterns = [
    /\bo dau\b/,
    /\blam sao\b/,
    /\btrang nao\b/,
    /\bthao tac\b/,
    /\btim\s+(duong|trang|chuc nang)\b/,
    /\bmuon\s+(xem|tim|vao)\b/,
    /\bcho\s+(toi|minh)\s+(xem|tim)\b/,
    /\bvao\s+(phan|trang|chuc nang)\b/,
    /\bo\s+(phai|dau)\b/,
    /\bduong\s+dan\b/,
    /\blink\s+(vao|den)\b/,
  ]
  return patterns.some((pattern) => pattern.test(n))
}

export const optimizeQuery = ({ query, memory = {} } = {}) => {
  const n = normalizeQuery(query)
  if (!n) {
    return { shouldUseAI: false, directTool: null, reason: 'empty_query', confidence: 0 }
  }

  const memoryFollowUp = getLastEntityFollowUp({ query, memory })
  if (memoryFollowUp) return memoryFollowUp

  const domainRoute = routeGymQuery({ query, memory })
  if (domainRoute.confidence >= 0.88 && domainRoute.intent !== 'general_chat') {
    return toOptimizerResult(domainRoute, { query })
  }

  const supportFaqQuery = isSupportFaqQuery(query)
  const policyQuery = isPolicyQuery(query)
  const strongPolicyQuery = isStrongPolicyQuery(query)
  const navSubject = detectNavigationSubject(query)
  const isNavQuery = isNavigationQuery(query)

  if (hasReportSignal(n)) {
    return {
      shouldUseAI: true,
      directTool: null,
      subject: 'report',
      action: 'list',
      intent: 'report',
      reason: 'permission_sensitive_report_query',
      confidence: 0.92,
    }
  }

  if (policyQuery && (!supportFaqQuery || strongPolicyQuery)) {
    console.log('[AI_TOOLS] selected: policySearch')
    return {
      shouldUseAI: false,
      directTool: 'searchPolicies',
      subject: 'policy',
      action: 'search',
      intent: 'policy_lookup',
      reason: 'policy_database_search',
      confidence: 0.9,
      args: { query, category: inferPolicyCategory(query) },
    }
  }

  if (supportFaqQuery || (isNavQuery && navSubject)) {
    if (hasDynamicDataSignal(n) && !isNavQuery) {
      return { shouldUseAI: true, directTool: null, reason: 'dynamic_data_requires_reasoner', confidence: 0.8 }
    }
    const detectedSubject = navSubject || 'faq'
    const intentMap = {
      booking: 'booking_navigation',
      checkin: 'checkin_navigation',
      health: 'health_navigation',
      workout: 'workout_navigation',
      order: 'order_navigation',
      product: 'product_navigation',
      forgot_password: 'forgot_password_navigation',
      account: 'account_navigation',
      faq: 'faq_navigation',
      policy: 'policy_navigation',
      navigation: 'general_navigation',
      payment: 'payment_navigation',
      feedback: 'feedback_navigation',
    }
    const detectedIntent = intentMap[detectedSubject] || 'account_navigation'
    console.log(`[AI_TOOLS] selected: faqSearch (subject=${detectedSubject}, intent=${detectedIntent})`)
    return {
      shouldUseAI: false,
      directTool: 'searchFaqs',
      subject: detectedSubject,
      action: 'navigate',
      intent: detectedIntent,
      reason: 'navigation_or_faq_search',
      confidence: 0.9,
      args: { query, category: inferFaqCategory(query) },
    }
  }

  const planSearchForDetail = hasPlanSignal(n) ? extractPlanSearch(n) : ''
  const specificPlanDetailQuery = Boolean(planSearchForDetail)
    || (hasPlanSignal(n) && /\b(gia|price|cost|quyen loi|co gi|benefit|benefits|chi tiet|thong tin)\b/.test(n) && !/\b(goi nao|nen chon|phu hop|hop voi|goi y|tu van|tiet kiem|loi nhat|tot nhat|dang tien)\b/.test(n))

  if (hasComplexPersonalization(n) && !specificPlanDetailQuery) {
    return { shouldUseAI: true, directTool: null, reason: 'complex_personalized_query', confidence: 0.78 }
  }

  if (hasPlanSignal(n)) {
    if (/\b(co may|bao nhieu|danh sach|liet ke|tat ca|cac|xem|cho xem|hien thi|show|list|all|view|gia|price|cost|re nhat|it tien nhat|thap nhat|dat nhat|cao nhat|chi tiet|thong tin|quyen loi|co gi|benefit|benefits)\b/.test(n)) {
      const wantsAllPlans = /\b(danh sach|liet ke|tat ca|cac|xem|cho xem|hien thi|show|list|all|view)\b/.test(n)
        && !/\b(chi tiet|quyen loi|benefit|co gi|bao gom|gom|detail|details)\b/.test(n)
      const planSearch = extractPlanSearch(n)
      const isPriceSearch = planSearch && isPriceExtractedPlan(planSearch)
      const wantsSpecificPlan = Boolean(planSearch) && !isPriceSearch || /\b(chi tiet|thong tin|quyen loi|co gi|benefit|benefits|gia|price|cost)\b/.test(n) && !wantsAllPlans && !/\b(goi nao|nhung goi nao|cac goi|tat ca|danh sach)\b/.test(n)
      const wantsSortedList = /\b(re nhat|it tien nhat|thap nhat|dat nhat|cao nhat)\b/.test(n)
      return {
        shouldUseAI: false,
        directTool: 'getAvailablePlans',
        subject: 'plan',
        action: wantsSpecificPlan ? 'detail' : wantsSortedList ? 'list' : /\b(co may|bao nhieu)\b/.test(n) ? 'count' : 'list',
        intent: wantsSpecificPlan ? 'membership_detail' : 'membership_list',
        reason: 'simple_database_query',
        confidence: 0.9,
        args: {},
        targetEntity: planSearch ? { type: 'plan', id: '', name: planSearch, method: 'query_name' } : null,
      }
    }
  }

  if (hasPTSignal(n)) {
    if (/\b(co may|bao nhieu|danh sach|liet ke|tat ca|rating cao nhat|danh gia cao nhat|gioi nhat|chi tiet|thong tin|dang nhan|hoc vien)\b/.test(n)) {
      const action = /\b(rating cao nhat|danh gia cao nhat|gioi nhat)\b/.test(n) ? 'compare' : /\b(chi tiet|thong tin|dang nhan|hoc vien)\b/.test(n) ? 'detail' : /\b(co may|bao nhieu)\b/.test(n) ? 'count' : 'list'
      const specialization = action === 'detail' ? extractPTSearch(n) : ''
      return {
        shouldUseAI: false,
        directTool: 'getAvailablePTs',
        subject: 'pt',
        action,
        intent: action === 'detail' ? 'pt_detail' : 'pt_advice',
        reason: 'simple_database_query',
        confidence: 0.9,
        args: specialization ? { specialization } : {},
        targetEntity: specialization ? { type: 'pt', id: '', name: specialization, method: 'query_name' } : null,
      }
    }
  }

  if (hasProductSignal(n) && /\b(danh sach|liet ke|gia|bao nhieu|co may|san pham nao|product)\b/.test(n)) {
    return {
      shouldUseAI: false,
      directTool: 'getRecommendedProducts',
      subject: 'product',
      action: /\b(co may|bao nhieu)\b/.test(n) ? 'count' : 'list',
      intent: 'product_advice',
      reason: 'simple_database_query',
      confidence: 0.82,
      args: { goal: '' },
    }
  }

  return {
    shouldUseAI: true,
    directTool: null,
    reason: 'needs_reasoning_or_unknown',
    confidence: 0.55,
  }
}

export const __queryOptimizerTestHooks = {
  normalizeQuery,
}
