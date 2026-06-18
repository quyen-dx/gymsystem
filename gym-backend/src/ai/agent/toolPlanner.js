const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const SUBJECT_TERMS = {
  plan: { terms: ['goi tap', 'goi gym', 'goi hoi vien', 'membership', 'package', 'gia tap', 'dang ky', 'goi', 'vip', 'combo', 'premium', 'basic', 'co ban', 'nang cao', 'subscription', 'plan', 'plans'], weight: 1 },
  workout: { terms: ['bai tap', 'tap luyen', 'lich tap', 'giao an', 'tap the hinh', 'tron bo tap', 'workout', 'exercise', 'training', 'routine', 'gym session', 'tap', 'cardio', 'running', 'checkin', 'diem danh', 'vao phong'], weight: 1 },
  pt: { terms: ['huan luyen vien', 'personal trainer', 'coach', 'huan luyen', 'pt', 'trainer', 'instructor', 'hlv'], weight: 1 },
  health: { terms: ['suc khoe', 'can nang', 'so do co the', 'chi so co the', 'bmi', 'mo', 'mo co', 'health', 'weight', 'body fat', 'measurement'], weight: 1 },
  shop: { terms: ['san pham', 'cua hang', 'shop', 'mua hang', 'do tap', 'thuc pham bo sung', 'product', 'store', 'supplement', 'gear', 'nutrition', 'mua'], weight: 1 },
  booking: { terms: ['dat lich', 'lich pt', 'lich huan luyen', 'booking', 'huy lich', 'doi lich', 'schedule', 'appointment'], weight: 1 },
  policy: { terms: ['chinh sach', 'quy dinh', 'dieu khoan', 'hoan tien', 'bao mat', 'thanh toan', 'policy', 'terms', 'refund', 'privacy', 'payment'], weight: 1 },
}

const ACTION_TERMS = {
  list: { terms: ['danh sach', 'co bao nhieu', 'co may', 'may', 'list', 'all', 'show', 'cac loai', 'nhung'], weight: 1 },
  compare: { terms: ['so sanh', 'khac gi', 'khac nhau', 'vs', 'versus', 'hon', 'kem hon', 'bang nhau', 'compare', 'difference', 'better', 'worse'], weight: 1 },
  recommend: { terms: ['nen chon', 'phu hop', 'hop voi', 'khuyen', 'goi y', 'nen tap', 'nen mua', 'chon', 'recommend', 'suggest', 'suitable', 'best', 'which', 'should'], weight: 1 },
  analyze: { terms: ['phan tich', 'danh gia', 'nhan xet', 'thong ke', 'tong ket', 'kiem tra', 'analyze', 'evaluate', 'review', 'stats', 'summary', 'check'], weight: 1 },
  info: { terms: ['la gi', 'co gi', 'the nao', 'thong tin', 'chi tiet', 'information', 'details', 'tell me'], weight: 1 },
  check: { terms: ['co khong', 'co pt', 'con han', 'available', 'is there', 'do i have'], weight: 1 },
}

const GOAL_TERMS = {
  muscle_gain: ['tang co', 'tap co', 'len co', 'co to', 'bigger', 'muscle', 'hypertrophy', 'co bap', 'bodybuilding', 'bulk'],
  fat_loss: ['giam mo', 'giam can', 'lose fat', 'lose weight', 'cut', 'fat loss', 'giam beo', 'ep can'],
  weight_gain: ['tang can', 'bulking', 'gain weight', 'tang kg'],
  endurance: ['suc ben', 'cardio', 'chay bo', 'stamina', 'endurance', 'chay xa'],
  general_fitness: ['gym', 'tap', 'workout', 'fitness', 'suc khoe'],
}

const TOOL_MAP = {
  plan: ['getAvailablePlans'],
  membership: ['getMembershipInfo'],
  pt: ['getAvailablePTs'],
  workout: ['analyzeWorkout'],
  shop: ['getRecommendedProducts'],
  booking: ['getUpcomingBookings'],
}

const scoreTerms = (text, concepts) => {
  const scores = {}
  for (const [key, config] of Object.entries(concepts)) {
    let score = 0
    for (const term of config.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp('\\b' + escaped + '\\b').test(text)) score += config.weight
    }
    if (score > 0) scores[key] = score
  }
  return scores
}

const pickBest = (scores) => {
  const entries = Object.entries(scores)
  if (entries.length === 0) return { key: null, confidence: 0 }
  entries.sort((a, b) => b[1] - a[1])
  const max = entries[0][1]
  const total = entries.reduce((s, [, v]) => s + v, 0)
  return { key: entries[0][0], confidence: Math.min(1, max / (total || 1)) }
}

const inferGoal = (query) => {
  const n = normalize(query)
  for (const [goal, patterns] of Object.entries(GOAL_TERMS)) {
    for (const pattern of patterns) {
      if (new RegExp('\\b' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(n)) return goal
    }
  }
  return null
}

const detectFollowUp = (query, memory) => {
  const n = normalize(query)
  const isRef = /\b(no|do|the con|con|the thi|the|cai do|giong|nhu the|nhu vay)\b/.test(n)
    || /\b(goi|plan|pt)\s+(do|nay|kia|that|this)\b/.test(n)
  if (!isRef) return null

  if (memory.lastMentionedPlanId && /\b(goi|plan)\s*(do|nay|kia|that|this)?\b/.test(n)) {
    return { type: 'plan', id: memory.lastMentionedPlanId, name: memory.lastMentionedPlanName }
  }
  if (memory.lastMentionedPTId && /\b(pt|trainer)\s*(do|nay|kia|that|this)?\b/.test(n)) {
    return { type: 'pt', id: memory.lastMentionedPTId, name: memory.lastMentionedPTName }
  }
  if (/\b(so sanh|khac|vs)\b/.test(n) && memory.lastMentionedPlanName) {
    return { type: 'plan', id: memory.lastMentionedPlanId, name: memory.lastMentionedPlanName }
  }
  if (memory.lastSubject === 'plan' && memory.lastMentionedPlanName) {
    return { type: 'plan', id: memory.lastMentionedPlanId, name: memory.lastMentionedPlanName }
  }
  return null
}

export const planTools = ({ query, memory = {}, context = {} }) => {
  const n = normalize(query)
  const followUp = detectFollowUp(query, memory)

  const subjectScores = scoreTerms(n, SUBJECT_TERMS)
  const actionScores = scoreTerms(n, ACTION_TERMS)

  const subject = pickBest(subjectScores)
  const action = pickBest(actionScores)

  let resolvedSubject = subject.key
  let resolvedAction = action.key

  if (resolvedSubject === 'workout' && /\b(checkin|diem danh)\b/.test(n)) {
    resolvedSubject = 'workout'
    resolvedAction = resolvedAction || 'list'
  }

  if (!resolvedSubject && followUp) {
    resolvedSubject = followUp.type
    if (!resolvedAction) resolvedAction = 'info'
  }

  const hasBudget = Boolean(
    (typeof context.lastBudget === 'number' ? context.lastBudget : null)
    || normalizeVietnameseMoney(n)
    || memory.lastBudget
  )
  const hasFrequency = Boolean(
    normalizeWeeklyFrequency(n) || memory.lastFrequencyPerWeek
  )
  const goal = inferGoal(n) || memory.lastGoal || null

  const neededTools = new Set()
  if (resolvedSubject === 'plan' || followUp?.type === 'plan') {
    neededTools.add('getAvailablePlans')
    if (hasBudget || hasFrequency || goal || resolvedAction === 'recommend') {
      neededTools.add('getSmartRecommendations')
      neededTools.add('getMembershipInfo')
    }
  }
  if (resolvedSubject === 'workout') {
    if (resolvedAction === 'check' || resolvedAction === 'list') {
      neededTools.add('getAvailablePlans')
    } else {
      neededTools.add('analyzeWorkout')
    }
  }
  if (resolvedSubject === 'pt' || followUp?.type === 'pt') {
    neededTools.add('getAvailablePTs')
  }
  if (resolvedSubject === 'shop') {
    neededTools.add('getRecommendedProducts')
  }
  if (resolvedSubject === 'booking') {
    neededTools.add('getUpcomingBookings')
  }

  if (hasBudget || hasFrequency || goal) {
    const planTools = []
    if (!neededTools.has('getAvailablePlans')) planTools.push('getAvailablePlans')
    if (!neededTools.has('getSmartRecommendations')) planTools.push('getSmartRecommendations')
    for (const t of planTools) neededTools.add(t)
  }

  const confidence = subject.key
    ? Math.min(1, (subject.confidence * 0.6 + (action.confidence || 0) * 0.4))
    : followUp ? 0.6 : 0

  return {
    subject: resolvedSubject || null,
    action: resolvedAction || null,
    target: followUp,
    requiredTools: [...neededTools],
    confidence: Math.max(0, Math.min(1, confidence)),
    entities: { goal, budget: hasBudget, frequencyPerWeek: hasFrequency },
    isFollowUp: Boolean(followUp),
  }
}

function normalizeVietnameseMoney(text = '') {
  const n = normalize(text)
  const match = n.match(/(\d+[.\s]?\d*)\s*(k|nghin|trieu|m|tr|t)?\b/i)
  if (!match) return null
  let value = parseFloat(match[1].replace(/[.\s]/g, ''))
  const unit = (match[2] || '').toLowerCase()
  if (unit === 'k' || unit === 'nghin') value *= 1000
  else if (unit === 'm' || unit === 'tr' || unit === 'trieu') value *= 1000000
  return isNaN(value) ? null : value
}

function normalizeWeeklyFrequency(text = '') {
  const n = normalize(text)
  const match = n.match(/\b(\d{1,2})\s*(buoi|ngay|lan|session)\s*(?:\/|moi|tren|per)?\s*(tuan|week)\b/)
    || n.match(/\btap\s+(\d{1,2})\s*(buoi|ngay|lan)\b/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 && value <= 14 ? value : null
}
