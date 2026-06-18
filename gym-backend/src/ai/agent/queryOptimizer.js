import { entityResolver } from './entityResolver.js'

const normalizeQuery = (text = '') => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const hasComplexPersonalization = (n) => (
  /\b(toi muon|muc tieu|giam can|tang co|tang can|suc ben|ngan sach|budget|k|trieu|buoi\/tuan|lan\/tuan|phu hop|nen chon|recommend|goi y)\b/.test(n)
)

const hasPlanSignal = (n) => /\b(goi|goi tap|plan|plans|membership|package)\b/.test(n)
const hasPTSignal = (n) => /\b(pt|trainer|coach|hlv|huan luyen vien|nguoi)\b/.test(n)
const hasProductSignal = (n) => /\b(san pham|product|shop|whey|protein|creatine|gia san pham)\b/.test(n)

const extractPTSearch = (n) => {
  const match = n.match(/\b(?:chi tiet|thong tin|profile|ho so|ve)\s+(?:pt|trainer|coach|hlv|huan luyen vien)?\s*(.+)$/)
    || n.match(/\b(?:pt|trainer|coach|hlv|huan luyen vien)\s+(.+)$/)
  if (!match?.[1]) return ''
  return match[1]
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

export const optimizeQuery = ({ query, memory = {} } = {}) => {
  const n = normalizeQuery(query)
  if (!n) {
    return { shouldUseAI: false, directTool: null, reason: 'empty_query', confidence: 0 }
  }

  const memoryFollowUp = getLastEntityFollowUp({ query, memory })
  if (memoryFollowUp) return memoryFollowUp

  if (hasComplexPersonalization(n)) {
    return { shouldUseAI: true, directTool: null, reason: 'complex_personalized_query', confidence: 0.78 }
  }

  if (hasPlanSignal(n)) {
    if (/\b(co may|bao nhieu|danh sach|liet ke|tat ca|cac|xem|cho xem|hien thi|show|list|all|view|gia|price|cost|re nhat|it tien nhat|thap nhat|dat nhat|cao nhat|chi tiet|thong tin)\b/.test(n)) {
      const wantsAllPlans = /\b(danh sach|liet ke|tat ca|cac|xem|cho xem|hien thi|show|list|all|view)\b/.test(n)
        && !/\b(chi tiet|quyen loi|benefit|co gi|bao gom|gom|detail|details)\b/.test(n)
      return {
        shouldUseAI: false,
        directTool: 'getAvailablePlans',
        subject: 'plan',
        action: /\b(re nhat|it tien nhat|thap nhat|dat nhat|cao nhat)\b/.test(n) ? 'compare' : /\b(chi tiet|thong tin)\b/.test(n) && !wantsAllPlans ? 'detail' : /\b(co may|bao nhieu)\b/.test(n) ? 'count' : 'list',
        intent: wantsAllPlans ? 'plan_list' : 'membership_info',
        reason: 'simple_database_query',
        confidence: 0.9,
      }
    }
  }

  if (hasPTSignal(n)) {
    if (/\b(co may|bao nhieu|danh sach|liet ke|tat ca|rating cao nhat|danh gia cao nhat|gioi nhat|chi tiet|thong tin)\b/.test(n)) {
      const action = /\b(rating cao nhat|danh gia cao nhat|gioi nhat)\b/.test(n) ? 'compare' : /\b(chi tiet|thong tin)\b/.test(n) ? 'detail' : /\b(co may|bao nhieu)\b/.test(n) ? 'count' : 'list'
      const specialization = action === 'detail' ? extractPTSearch(n) : ''
      return {
        shouldUseAI: false,
        directTool: 'getAvailablePTs',
        subject: 'pt',
        action,
        intent: 'pt_advice',
        reason: 'simple_database_query',
        confidence: 0.9,
        args: specialization ? { specialization } : {},
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
