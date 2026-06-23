// Conversational Understanding Layer
// Semantic analysis engine that understands natural language queries
// without requiring specific keywords. Handles context, follow-ups, and fuzzy matching.

const normalizeForIntent = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const SUBJECT_CONCEPTS = {
  plan: {
    weight: 1,
    vi: ['goi tap', 'goi gym', 'goi hoi vien', 'membership', 'package', 'dang ky', 'gia tap'],
    en: ['plan', 'plans', 'membership', 'package', 'subscription', 'pricing'],
    aliases: ['goi', 'vip', 'combo', 'premium', 'basic', 'co ban', 'nang cao'],
  },
  pt: {
    weight: 1,
    vi: ['huan luyen vien', 'personal trainer', 'coach', 'huan luyen', 'pt'],
    en: ['trainer', 'personal trainer', 'coach', 'instructor'],
    aliases: ['pt', 'hlv'],
  },
  workout: {
    weight: 1,
    vi: ['bai tap', 'tap luyen', 'lich tap', 'giao an', 'tap the hinh', 'tron bo tap'],
    en: ['workout', 'exercise', 'training', 'routine', 'gym session'],
    aliases: ['tap', 'workout', 'cardio', 'running'],
  },
  checkin: {
    weight: 1,
    vi: ['diem danh', 'vao phong', 'checkin'],
    en: ['checkin', 'check in', 'attendance'],
    aliases: ['checkin', 'diem danh'],
  },
  health: {
    weight: 1,
    vi: ['suc khoe', 'can nang', 'so do co the', 'chi so co the', 'bmi', 'mo co', 'mo'],
    en: ['health', 'weight', 'bmi', 'body fat', 'measurement', 'vitamin'],
    aliases: ['can nang', 'bmi', 'health', 'suc khoe'],
  },
  booking: {
    weight: 1,
    vi: ['dat lich', 'lich pt', 'lich huan luyen', 'booking', 'huy lich', 'doi lich'],
    en: ['booking', 'schedule', 'appointment', 'session booking'],
    aliases: ['booking', 'lich'],
  },
  shop: {
    weight: 1,
    vi: ['san pham', 'cua hang', 'shop', 'mua hang', 'do tap', 'thuc pham bo sung'],
    en: ['product', 'store', 'shop', 'supplement', 'gear', 'nutrition'],
    aliases: ['shop', 'store', 'san pham', 'mua'],
  },
  policy: {
    weight: 1,
    vi: ['chinh sach', 'quy dinh', 'dieu khoan', 'hoan tien', 'bao mat', 'thanh toan'],
    en: ['policy', 'terms', 'refund', 'privacy', 'payment'],
    aliases: ['policy', 'refund', 'privacy'],
  },
}

const ACTION_CONCEPTS = {
  info: {
    weight: 1,
    patterns: {
      vi: ['la gi', 'co gi', 'the nao', 'gom', 'bao gom', 'co nhung', 'giong nao', 'thong tin', 'chi tiet'],
      en: ['what is', 'what are', 'tell me about', 'information', 'details', 'show', 'list'],
    },
    aliases: ['xem', 'show', 'list', 'cho xem', 'thong tin', 'chi tiet'],
  },
  compare: {
    weight: 1,
    patterns: {
      vi: ['so sanh', 'khac gi', 'khac nhau', 'vs', 'versus', 'hon', 'kem hon', 'bang nhau'],
      en: ['compare', 'difference', 'vs', 'versus', 'better', 'worse'],
    },
    aliases: ['so sanh', 'compare'],
  },
  recommend: {
    weight: 1,
    patterns: {
      vi: ['nen chon', 'phu hop', 'hop voi', 'khuyen', 'goi y', 'nen tap', 'nen mua', 'chon'],
      en: ['recommend', 'suggest', 'suitable', 'best', 'which', 'should'],
    },
    aliases: ['recommend', 'khuyen', 'goi y', 'suggest'],
  },
  analyze: {
    weight: 1,
    patterns: {
      vi: ['phan tich', 'danh gia', 'nhan xet', 'thong ke', 'tong ket', 'kiem tra'],
      en: ['analyze', 'evaluate', 'review', 'stats', 'summary', 'check my'],
    },
    aliases: ['phan tich', 'analyze', 'danh gia'],
  },
  explain: {
    weight: 1,
    patterns: {
      vi: ['giai thich', 'y nghia', 'tai sao', 'the nao la', 'dinh nghia'],
      en: ['explain', 'meaning', 'why', 'how does', 'what does'],
    },
    aliases: ['giai thich', 'explain'],
  },
  check: {
    weight: 1,
    patterns: {
      vi: ['kiem tra', 'xem co', 'co', 'con han khong', 'con khong'],
      en: ['check', 'do i have', 'is there', 'any', 'available'],
    },
    aliases: ['check', 'kiem tra', 'xem'],
  },
}

const GOAL_DETECT_PATTERNS = {
  muscle_gain: [
    'tang co', 'tap co', 'len co', 'co to', 'bigger', 'muscle', 'hypertrophy',
    'co bap', 'co the', 'bodybuilding', 'bulk', 'co',
  ],
  fat_loss: [
    'giam mo', 'giam can', 'giam m0', 'giam beo', 'ep can', 'giam % mo',
    'fat loss', 'lose fat', 'lose weight', 'cut', 'giam eo',
  ],
  weight_gain: [
    'tang can', 'len can', 'bulk', 'bulking', 'gain weight', 'tang kg',
  ],
  endurance: [
    'suc ben', 'cardio', 'chay bo', 'ben hon', 'stamina', 'endurance',
    'chay xa', 'duoc suc',
  ],
}

const isContextualReference = (query) => {
  const normalized = normalizeForIntent(query)
  return /\b(no|do|the con|con|the thi|the|cai do|do|giong|nhu the|nhu vay|the sao|vay sao)\b/.test(normalized)
    || /^(the con|the|con|vay|vay thi|roi|sao|sao lai|tai sao|the thi sao|van con|vay con)/.test(normalized)
    || /\bplan\s+(do|nay|kia|đó|này|kia)|gói\s+(đó|này|kia|do|nay|kia)\b/.test(normalized)
}

const extractFollowUpTarget = (query, context) => {
  const normalized = normalizeForIntent(query)
  const lastPlan = context?.lastMentionedPlan
  const lastPT = context?.lastMentionedPT
  const lastSubject = context?.lastSubject

  if (/\b(plan|goi)\s+(do|day|nay|kia|this|that)\b/.test(normalized)) return { type: 'plan', value: lastPlan }
  if (/\b(pt|trainer)\s+(do|day|nay|kia|this|that)\b/.test(normalized)) return { type: 'pt', value: lastPT }
  if (/\b(no|do|the|the con|con|day)\b/.test(normalized)) {
    if (lastPlan) return { type: 'plan', value: lastPlan }
    if (lastSubject === 'plan') return { type: 'plan', value: lastPlan }
    if (lastSubject === 'pt') return { type: 'pt', value: lastPT }
  }
  if (/\b(so sanh|khac|vs)\b/.test(normalized) && /\b(no|do|giong|premium|vip)\b/.test(normalized)) {
    return { type: 'plan_comparison', value: lastPlan }
  }
  return null
}

const inferSubjectFromQuery = (query) => {
  const normalized = normalizeForIntent(query)
  const scores = {}

  for (const [subject, concept] of Object.entries(SUBJECT_CONCEPTS)) {
    let score = 0
    const allTerms = [...(concept.vi || []), ...(concept.en || []), ...(concept.aliases || [])]
    for (const term of allTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp('\\b' + escaped + '\\b').test(normalized)) {
        score += concept.weight
      }
    }
    // Partial match for longer terms
    if (score === 0) {
      for (const term of [...(concept.vi || []), ...(concept.en || [])]) {
        if (term.length > 5 && normalized.includes(term.slice(0, -2))) {
          score += concept.weight * 0.5
        }
      }
    }
    if (score > 0) scores[subject] = score
  }

  if (Object.keys(scores).length === 0) return { subject: 'general', confidence: 0 }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return { subject: best[0], confidence: best[1] }
}

const inferActionFromQuery = (query) => {
  const normalized = normalizeForIntent(query)
  const scores = {}

  for (const [action, concept] of Object.entries(ACTION_CONCEPTS)) {
    let score = 0
    for (const [, patterns] of Object.entries(concept.patterns)) {
      for (const pattern of patterns) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp('\\b' + escaped + '\\b').test(normalized)) {
          score += concept.weight
        }
      }
    }
    for (const alias of (concept.aliases || [])) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp('\\b' + escaped + '\\b').test(normalized)) {
        score += concept.weight * 0.8
      }
    }
    if (score > 0) scores[action] = score
  }

  if (Object.keys(scores).length === 0) return { action: 'unclear', confidence: 0 }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return { action: best[0], confidence: best[1] }
}

const inferGoal = (query) => {
  const normalized = normalizeForIntent(query)
  for (const [goal, patterns] of Object.entries(GOAL_DETECT_PATTERNS)) {
    for (const pattern of patterns) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp('\\b' + escaped + '\\b').test(normalized)) {
        return goal
      }
    }
  }
  return null
}

const detectQuestionType = (query) => {
  const normalized = normalizeForIntent(query)

  const questionIndicators = {
    yesno: (/\b(co|co khong|phai khong|dung khong|that khong|that a|khong a|is there|do you|does it|can i|are there|co the)\b/.test(normalized) && /\?/.test(query))
      || /\b(co.*khong|co.*khong a)\b/.test(normalized),
    list: /\b(nhung|danh sach|cac|cac loai|list|all|show|cho xem|nao)\b/.test(normalized),
    comparison: /\b(so sanh|khac|vs|versus|better|worse|hon|kem)\b/.test(normalized),
    recommendation: /\b(nen|chon|phu hop|recommend|suggest|best|which|khuyen)\b/.test(normalized),
    factual: /\b(la gi|the nao|gia bao nhieu|what is)\b/.test(normalized) && !/\b(co.*khong)\b/.test(normalized),
    count: /\b(co may|co bao nhieu|may|how many|how much)\b/.test(normalized) && /\b(goi|plan|buoi|ngay|lan|checkin|pt)\b/.test(normalized),
  }

  for (const [type, matched] of Object.entries(questionIndicators)) {
    if (matched) return type
  }
  return 'unknown'
}

export const conversationalUnderstand = ({ query, userMessage = '', context = {}, language = 'vi' }) => {
  const input = query || userMessage || ''
  const normalized = normalizeForIntent(input)
  if (!normalized) return { subject: 'general', action: 'unclear', intent: 'unknown', confidence: 0, isFollowUp: false }

  const lang = language === 'en' ? 'en' : 'vi'
  const isFollowUp = isContextualReference(input)
  const followUpTarget = isFollowUp ? extractFollowUpTarget(input, context) : null

  const { subject, confidence: subjectConfidence } = inferSubjectFromQuery(input)
  const { action, confidence: actionConfidence } = inferActionFromQuery(input)
  const questionType = detectQuestionType(input)
  const goal = inferGoal(input)

  const budget = (typeof context?.lastBudget === 'number' ? context.lastBudget : null)
    || normalizeVietnameseMoney(input) || null
  const frequency = typeof context?.lastFrequency === 'number' ? context.lastFrequency : normalizeWeeklyFrequency(input) || null

  const hasBudget = Boolean(budget)
  const hasFrequency = Boolean(frequency)
  const hasGoal = Boolean(goal)

  // Override subject/action with resolved values (using let to avoid const reassignment)
  let resolvedSubject = subject
  let resolvedAction = action

  const hasHowMany = /\b(co may|co bao nhieu|how many|how much)\b/.test(normalized)
  if (hasHowMany && resolvedAction === 'check') resolvedAction = 'info'

  const hasPlanTerm = /\b(goi|plan|membership|package)\b/.test(normalized)
  const hasYesNoCheck = /\b(co.*khong|does.*include|is there|co pt\b)/.test(normalized) || /\bco\s+pt\s+khong\b/.test(normalized)
  if (hasPlanTerm && hasYesNoCheck && resolvedSubject === 'pt') resolvedSubject = 'plan'

  // "mấy" + duration unit → info action for workout
  if (/\b(bao lau|may phut|may tieng|thoi gian)\b/.test(normalized) && resolvedSubject === 'workout') resolvedAction = 'info'

  let confidence = Math.min(1, (subjectConfidence + actionConfidence) / 2)
  if (isFollowUp && followUpTarget) confidence = Math.max(confidence, 0.7)
  if (resolvedSubject === 'general' && resolvedAction === 'unclear' && input.length > 15) confidence = Math.max(0.25, confidence)

  // Handle introduction queries
  if (resolvedSubject === 'general' && /\b(gympro|ban la ai|la gi|what is|who are you)\b/.test(normalized) && confidence < 0.5) {
    confidence = 0.8
  }

  // Map to intent based on natural understanding
  let intent = mapSubjectActionToIntent(resolvedSubject, resolvedAction, questionType, {
    hasBudget,
    hasFrequency,
    hasGoal,
    isFollowUp,
    followUpTarget,
    context,
    lang,
    normalized,
  })

  return {
    subject: resolvedSubject,
    action: resolvedAction,
    intent,
    confidence: Math.round(confidence * 100) / 100,
    isFollowUp,
    followUpTarget,
    questionType,
    entities: {
      budget,
      goal,
      frequencyPerWeek: frequency,
    },
    contextResolved: isFollowUp && followUpTarget ? {
      resolvedSubject: followUpTarget.type,
      resolvedValue: followUpTarget.value,
    } : null,
  }
}

function mapSubjectActionToIntent(subject, action, questionType, { hasBudget, hasFrequency, hasGoal, isFollowUp, followUpTarget, context, lang, normalized }) {
  // Handle follow-ups with resolved context
  if (isFollowUp && followUpTarget?.type === 'plan_comparison') return 'plan_comparison'
  if (isFollowUp && followUpTarget?.type === 'plan' && action === 'info') return 'membership_benefit_lookup'
  if (isFollowUp && followUpTarget?.type === 'plan' && (action === 'recommend' || hasFrequency)) return 'membership_advice'

  // Direct mappings
  if (subject === 'plan') {
    if (action === 'compare') return 'plan_comparison'
    if (action === 'info' && (questionType === 'list' || questionType === 'count')) return 'membership_info'
    if (action === 'info' && questionType === 'factual') return 'membership_benefit_lookup'
    if (questionType === 'yesno') return 'membership_benefit_lookup'
    if (action === 'recommend' || hasBudget || hasFrequency || hasGoal) return 'membership_advice'
    if (questionType === 'factual' || action === 'info') return 'membership_info'
    return 'membership_advice'
  }

  if (subject === 'pt') {
    if (action === 'info' || action === 'recommend') return 'pt_advice'
    if (action === 'check' && /\b(slot|lich|free|available)\b/.test(normalizeForIntent(context?.lastQuery || ''))) return 'pt_availability'
    return 'pt_advice'
  }

  if (subject === 'workout') {
    if (action === 'analyze') return 'workout_analyze'
    if (action === 'recommend' || action === 'info') return 'workout_advice'
    if (hasFrequency) return 'workout_info'
    return 'workout_advice'
  }

  if (subject === 'checkin') {
    return 'checkin_summary'
  }

  if (subject === 'health') {
    if (action === 'analyze') return 'workout_analyze'
    return 'health_advice'
  }

  if (subject === 'booking') {
    if (action === 'check') return 'booking_info'
    return 'booking_action'
  }

  if (subject === 'shop') {
    return 'shop_advice'
  }

  if (subject === 'policy') {
    const normalized = normalizeForIntent(context?.lastQuery || '')
    if (/\b(refund|hoan|tra)\b/.test(normalized)) return 'policy_refund'
    if (/\b(privacy|bao mat|rieng tu)\b/.test(normalized)) return 'policy_privacy'
    if (/\b(payment|thanh toan|payment)\b/.test(normalized)) return 'policy_payment'
    return 'faq_answer'
  }

  // General: try to map budget/goal to membership_advice
  if (hasBudget || hasGoal || hasFrequency) return 'membership_advice'

  // Introduction / about
  const introPattern = /\b(introduce|about|gympro|ban la ai|who are you|la gi)\b/
  if (introPattern.test(normalized) || introPattern.test(normalizeForIntent(context?.lastQuery || ''))) {
    return 'introduction'
  }

  return 'unknown'
}

function normalizeVietnameseMoney(text = '') {
  const normalized = normalizeForIntent(text)
  const match = normalized.match(/(\d+[\.\s]?\d*)\s*(k|nghin|trieu|m|tr|t)?\b/i)
  if (!match) return null
  let value = parseFloat(match[1].replace(/[.\s]/g, ''))
  const unit = (match[2] || '').toLowerCase()
  if (unit === 'k' || unit === 'nghin') value *= 1000
  else if (unit === 'm' || unit === 'tr' || unit === 'trieu') value *= 1000000
  return isNaN(value) ? null : value
}

function normalizeWeeklyFrequency(text = '') {
  const normalized = normalizeForIntent(text)
  const match = normalized.match(/\b(\d{1,2})\s*(buoi|ngay|lan|session)\s*(?:\/|moi|tren|per)?\s*(tuan|week)\b/)
    || normalized.match(/\btap\s+(\d{1,2})\s*(buoi|ngay|lan)\b/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 && value <= 14 ? value : null
}
