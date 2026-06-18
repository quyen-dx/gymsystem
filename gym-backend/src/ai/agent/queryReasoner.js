import { runAIWithFallback } from '../services/aiFallbackService.js'
import { conversationalUnderstand } from '../services/conversationalUnderstandingLayer.js'
import { getReasoningGuide } from '../services/reasoningGuideService.js'
import { entityResolver } from './entityResolver.js'

const SUBJECTS = ['membership_plans', 'plan', 'workout', 'pt', 'membership', 'health', 'nutrition', 'booking', 'shop', 'products', 'product', 'policies', 'policy', 'faq', 'checkin', 'account', 'report', 'unknown', 'general']
const ACTIONS = ['list', 'view', 'count', 'detail', 'compare', 'recommend', 'advice', 'create', 'update', 'delete', 'search', 'analyze', 'info', 'check', 'explain', 'ask_general']
const INTENTS = [
  'membership_info', 'membership_benefit_lookup', 'membership_advice', 'plan_comparison',
  'plan_list', 'plan_detail', 'plan_recommendation',
  'cheapest_long_term_plan', 'checkin_summary', 'checkin_goal',
  'pt_advice', 'pt_availability', 'pt_detail', 'booking_info', 'booking_action',
  'workout_advice', 'workout_info', 'workout_analyze',
  'health_advice', 'nutrition_advice', 'shop_advice', 'product_advice',
  'policy_refund', 'policy_privacy', 'policy_payment', 'faq_answer',
  'introduction', 'unknown',
]

const BASE_SYSTEM_PROMPT = `You are a deep query analyzer for GymPro AI — a Vietnamese gym management assistant.
Analyze the user's question with deep reasoning, considering available entities and conversation context.
Return ONLY valid JSON (no markdown, no explanation).

Deep reasoning steps (think through these internally before outputting):
1. What is the user's true intent? Are they asking about plans, PTs, booking, checkin, shop products, workout, health, or something else?
2. What specific action do they want? List all, compare, get recommended, analyze, check info, explain, or book?
3. What entities/constraints are mentioned? Budget, goal (fat_loss, muscle_gain, general_fitness), frequency, specific plan/PT names?
4. Is this a follow-up to previous context? 
   - Does the query reference an entity from the previous response? (e.g., "chi tiet ve cgpt 1" refers to PT from last list)
   - Does it use pronouns/anaphora? (e.g., "no", "cai do", "it", "that one" refer to the last entity)
   - Does it use positional references? (e.g., "person 1st", "plan 2nd", "thu nhat", "thu hai")
   - Does it ask for details about a previous context? (e.g., after "danh sach PT" → "chi tiet" means detail about one PT)
5. ENTITY RESOLUTION: Given the availableEntities, try to match the user's mention to an actual entity.
   - Exact name match → use entity ID
   - Fuzzy name match → use entity ID  
   - Positional reference (first, second, etc.) → use entity at that position
   - Anaphora (it, that, the person) → use first entity from previous list
   - If ambiguous → return multiple candidates for confirmation
6. Which tools are needed? Choose from the available tool list.
7. What confidence level? Be honest — 0.3 if vague, 0.9+ if clear and matchable.

Return format:
{
  "subject": "membership_plans|workout|nutrition|health|booking|checkin|products|policies|faq|account|unknown",
  "action": "list|view|explain|compare|recommend|create|update|delete|search|ask_general",
  "scope": "all|specific|personalized|unknown",
  "intent": "membership_info|membership_benefit_lookup|membership_advice|plan_comparison|cheapest_long_term_plan|checkin_summary|checkin_goal|pt_advice|pt_availability|pt_detail|booking_info|booking_action|workout_advice|workout_info|workout_analyze|health_advice|nutrition_advice|shop_advice|product_advice|policy_refund|policy_privacy|policy_payment|faq_answer|introduction|unknown",
  "entities": {
    "planName": null | string,
    "productName": null | string,
    "dateRange": null | string,
    "budget": null | number,
    "goal": null | "fat_loss" | "muscle_gain" | "weight_gain" | "endurance" | "general_fitness",
    "frequencyPerWeek": null | number,
    "mentionedPlan": null | string,
    "mentionedPT": null | string
  },
  "confidence": 0.0-1.0,
  "isFollowUp": false | true,
  "followUpTarget": null | { type: "pt" | "plan", id: string, name: string, method: "positional" | "name_match" | "anaphora" },
  "targetEntity": null | string,
  "needsDatabase": false | true,
  "needsWebSearch": false | true,
  "needsTools": ["toolName1", "toolName2"],
  "requiredTools": ["toolName1", "toolName2"],
  "shouldUseWebSearch": false | true,
  "shouldAskClarification": false | true,
  "reasoning": "one sentence explaining the analysis"
}

Available tools: getAvailablePlans, getMembershipInfo, getUpcomingBookings, getAvailablePTs, getRecommendedProducts, getSmartRecommendations, analyzeWorkout, generateWorkoutPlan, webSearchNutrition

Tool mapping guide:
- plan queries (list, count, info) → getAvailablePlans
- plan recommendation (budget, goal, frequency) → getAvailablePlans + getSmartRecommendations
- membership check → getMembershipInfo
- PT queries → getAvailablePTs
- PT detail → getAvailablePTs (may resolve from previous context)
- PT booking → getAvailablePTs + getUpcomingBookings
- workout analysis → analyzeWorkout
- workout plan generation → generateWorkoutPlan
- product/shop queries → getRecommendedProducts
- booking check → getUpcomingBookings
- nutrition general knowledge → webSearchNutrition only when GymPro database/context is insufficient
- GymPro internal data must use database tools, not web search

Examples:
Q: "gym co may goi tap"
A: {"subject":"plan","action":"list","intent":"membership_info","entities":{},"confidence":0.98,"isFollowUp":false,"needsTools":["getAvailablePlans"],"reasoning":"User wants a count/list of all plans"}

Q: "toi muon giam can nen chon goi nao"
A: {"subject":"plan","action":"recommend","intent":"membership_advice","entities":{"goal":"fat_loss"},"confidence":0.97,"isFollowUp":false,"needsTools":["getAvailablePlans","getSmartRecommendations"],"reasoning":"User with fat_loss goal needs plan recommendation"}

Q: "chi tiet ve cgpt 1" (previousContext: PT list with cgpt 1 shown)
A: {"subject":"pt","action":"detail","intent":"pt_detail","entities":{"mentionedPT":"cgpt 1"},"confidence":0.92,"isFollowUp":true,"followUpTarget":{"type":"pt","id":"abc123","name":"cgpt 1","method":"name_match"},"needsTools":[],"reasoning":"Follow-up asking for detail about PT cgpt 1 from previous list"}

Q: "nguoi dau tien thi sao" (previousContext: PT list with 5 PTs)
A: {"subject":"pt","action":"detail","intent":"pt_detail","entities":{},"confidence":0.94,"isFollowUp":true,"followUpTarget":{"type":"pt","id":"pt1_id","name":"PT 1 name","method":"positional"},"needsTools":[],"reasoning":"Positional reference to first PT from previous list"}

Q: "so sanh voi goi premium" (previousContext: just recommended Goi VIP)
A: {"subject":"plan","action":"compare","intent":"plan_comparison","entities":{"mentionedPlan":"premium"},"confidence":0.91,"isFollowUp":true,"followUpTarget":{"type":"plan","id":"prem_id","name":"Goi Premium","method":"name_match"},"needsTools":["getAvailablePlans"],"reasoning":"Follow-up comparing mentioned plan with Goi Premium"}`

const buildReasonerSystemPrompt = () => {
  const guide = getReasoningGuide({
    subject: 'core',
    sections: ['Tool Planning', 'Memory Rule', 'Web Search Rule', 'Response Rule', 'Safety Rule'],
    maxChars: 7000,
  })
  if (!guide.content) return BASE_SYSTEM_PROMPT
  return `${BASE_SYSTEM_PROMPT}\n\nGymPro reasoning guide excerpts:\n${guide.content}`
}

const buildUserPrompt = ({ query, memory, conversationContext }) => {
  const parts = [`User question: "${query}"`]
  if (memory?.lastSubject) parts.push(`Previous context: subject=${memory.lastSubject}, action=${memory.lastAction || 'none'}`)
  if (memory?.lastMentionedPlanName) parts.push(`Last mentioned plan: ${memory.lastMentionedPlanName}`)
  if (memory?.lastMentionedPTName) parts.push(`Last mentioned PT: ${memory.lastMentionedPTName}`)
  if (memory?.lastGoal) parts.push(`Last mentioned goal: ${memory.lastGoal}`)
  if (memory?.lastBudget) parts.push(`Last mentioned budget: ${memory.lastBudget}`)

  // NEW: Include available entities from the last response
  const availableEntities = []
  if (Array.isArray(memory?.lastListedPTs) && memory.lastListedPTs.length > 0) {
    const ptNames = memory.lastListedPTs.map((pt, i) => `${i + 1}. ${pt.name}`).join(', ')
    availableEntities.push(`Available PTs from last list: ${ptNames}`)
  }
  if (Array.isArray(memory?.lastListedPlans) && memory.lastListedPlans.length > 0) {
    const planNames = memory.lastListedPlans.map((p, i) => `${i + 1}. ${p.nameVi || p.name}`).join(', ')
    availableEntities.push(`Available Plans from last list: ${planNames}`)
  }
  if (availableEntities.length > 0) {
    parts.push(`Available entities from previous response:\n${availableEntities.join('\n')}`)
  }

  const recentMessages = conversationContext?.recentMessages
  if (Array.isArray(recentMessages) && recentMessages.length > 0) {
    const lastFew = recentMessages.slice(-3).map((m) => `${m.role}: ${m.content}`).join('\n')
    parts.push(`Recent conversation:\n${lastFew}`)
  }
  return parts.join('\n\n')
}

const normalizeQuery = (text = '') => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const hasTerm = (text, terms = []) => terms.some((term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('\\b' + escaped + '\\b').test(text)
})

const normalizeSemanticSubject = (subject) => {
  if (subject === 'membership_plans') return 'plan'
  if (subject === 'products') return 'product'
  if (subject === 'account') return 'membership'
  if (subject === 'unknown') return 'general'
  return subject
}

const mapSemanticIntent = ({ subject, action, scope }) => {
  if (subject === 'membership_plans') {
    if ((action === 'list' || action === 'view') && scope === 'all') return 'plan_list'
    if ((action === 'explain' || action === 'view') && scope === 'specific') return 'plan_detail'
    if (action === 'compare') return 'plan_comparison'
    if (action === 'recommend' || scope === 'personalized') return 'plan_recommendation'
    return 'membership_info'
  }
  if (subject === 'products') return action === 'recommend' ? 'product_advice' : 'shop_advice'
  if (subject === 'booking') return action === 'view' || action === 'list' ? 'booking_info' : 'booking_action'
  if (subject === 'nutrition') return 'nutrition_advice'
  if (subject === 'health') return 'health_advice'
  if (subject === 'workout') return action === 'create' ? 'workout_advice' : 'workout_info'
  if (subject === 'checkin') return 'checkin_summary'
  if (subject === 'policies' || subject === 'faq') return 'faq_answer'
  return 'unknown'
}

const legacyIntentFromSemantic = (intent) => {
  const map = {
    plan_list: 'membership_info',
    plan_detail: 'membership_info',
    plan_recommendation: 'membership_advice',
  }
  return map[intent] || intent
}

const classifySemanticIntent = ({ query, memory = {} }) => {
  const n = normalizeQuery(query)
  const schema = {
    subject: 'unknown',
    action: 'ask_general',
    scope: 'unknown',
    entities: {
      planName: null,
      productName: null,
      dateRange: null,
      goal: null,
    },
    needsDatabase: false,
    needsWebSearch: false,
    confidence: 0,
  }
  if (!n) return schema

  const semanticGoal = (() => {
    if (hasTerm(n, ['giam can', 'giam mo', 'fat loss', 'lose weight'])) return 'fat_loss'
    if (hasTerm(n, ['tang co', 'len co', 'muscle gain', 'hypertrophy'])) return 'muscle_gain'
    if (hasTerm(n, ['tang can', 'gain weight'])) return 'weight_gain'
    if (hasTerm(n, ['suc ben', 'cardio', 'endurance'])) return 'endurance'
    return null
  })()

  const subjectSignals = {
    membership_plans: ['goi tap', 'goi gym', 'goi hoi vien', 'membership', 'package', 'plan', 'plans', 'goi'],
    workout: ['bai tap', 'lich tap', 'giao an', 'workout', 'exercise', 'training'],
    nutrition: ['an gi', 'dinh duong', 'calo', 'protein', 'nutrition', 'diet'],
    health: ['suc khoe', 'bmi', 'can nang', 'mo co the', 'body fat', 'health'],
    booking: ['dat lich', 'lich hen', 'booking', 'appointment', 'schedule'],
    checkin: ['checkin', 'diem danh', 'vao phong'],
    products: ['san pham', 'shop', 'cua hang', 'whey', 'creatine', 'product'],
    policies: ['chinh sach', 'quy dinh', 'hoan tien', 'bao mat', 'policy', 'refund', 'privacy'],
    faq: ['hoi dap', 'faq'],
    account: ['tai khoan', 'profile', 'mat khau', 'account'],
  }
  const scores = Object.entries(subjectSignals).map(([subject, terms]) => ({
    subject,
    score: terms.reduce((sum, term) => sum + (hasTerm(n, [term]) ? 1 : 0), 0),
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
  if (scores[0]) schema.subject = scores[0].subject

  const actionSignals = {
    list: ['danh sach', 'liet ke', 'tat ca', 'cac', 'co may', 'co bao nhieu', 'list', 'all'],
    view: ['xem', 'cho xem', 'hien thi', 'show', 'view', 'thong tin'],
    explain: ['quyen loi', 'co gi', 'bao gom', 'gom nhung gi', 'chi tiet', 'giai thich', 'benefit', 'include', 'detail'],
    compare: ['so sanh', 'khac nhau', 'khac gi', 'vs', 'compare', 'difference'],
    recommend: ['phu hop', 'hop voi toi', 'nen chon', 'goi y', 'tu van', 'recommend', 'suggest', 'which plan'],
    create: ['tao', 'lap', 'create', 'generate'],
    update: ['cap nhat', 'sua', 'update'],
    delete: ['xoa', 'huy', 'delete', 'cancel'],
    search: ['tim', 'search', 'find'],
  }
  const actionScores = Object.entries(actionSignals).map(([action, terms]) => ({
    action,
    score: terms.reduce((sum, term) => sum + (hasTerm(n, [term]) ? 1 : 0), 0),
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
  if (actionScores[0]) schema.action = actionScores[0].action

  const specificPlanFromMemory = /\b(goi\s+(nay|do|kia|this|that)|goi nay|goi do)\b/.test(n) && memory.lastMentionedPlanName
    ? memory.lastMentionedPlanName
    : null
  schema.entities.planName = specificPlanFromMemory
  schema.entities.goal = semanticGoal

  if (schema.subject === 'membership_plans') {
    schema.needsDatabase = true
    const hasPlanReference = /\b(goi\s+(nay|do|kia|this|that)|goi nay|goi do)\b/.test(n)
    const hasPersonalGoal = hasTerm(n, ['giam can', 'giam mo', 'tang co', 'tang can', 'suc ben', 'fat loss', 'lose weight', 'muscle gain'])
    const asksRecommendation = schema.action === 'recommend' || hasPersonalGoal || hasTerm(n, ['nen chon', 'phu hop', 'hop voi toi', 'chon goi nao', 'goi nao phu hop', 'tu van', 'recommend', 'suggest'])
    const asksAll = (schema.action === 'list' || schema.action === 'view')
      && hasTerm(n, ['cac', 'tat ca', 'danh sach', 'liet ke', 'co may', 'co bao nhieu', 'show', 'list', 'all'])
      && !hasTerm(n, ['quyen loi', 'co gi', 'bao gom', 'chi tiet', 'benefit', 'detail'])
    const asksSpecific = Boolean(schema.entities.planName)
      || hasPlanReference
      || hasTerm(n, ['quyen loi', 'co gi', 'bao gom', 'chi tiet', 'benefit', 'detail'])
    if (asksAll) {
      schema.action = schema.action === 'ask_general' ? 'list' : schema.action
      schema.scope = 'all'
      schema.confidence = 0.92
    } else if (asksRecommendation) {
      schema.action = 'recommend'
      schema.scope = 'personalized'
      schema.confidence = 0.88
    } else if (asksSpecific) {
      schema.action = schema.action === 'ask_general' ? 'explain' : schema.action
      schema.scope = schema.entities.planName ? 'specific' : 'unknown'
      schema.confidence = schema.entities.planName ? 0.82 : 0.62
    } else {
      schema.scope = 'all'
      schema.action = schema.action === 'ask_general' ? 'list' : schema.action
      schema.confidence = 0.72
    }
  } else if (schema.subject !== 'unknown') {
    schema.confidence = 0.55 + Math.min(0.3, (scores[0]?.score || 0) * 0.1)
    schema.needsDatabase = ['booking', 'checkin', 'products', 'account'].includes(schema.subject)
    schema.needsWebSearch = schema.subject === 'nutrition'
  }

  return schema
}

const semanticToReasonerResult = (semantic) => {
  const semanticIntent = mapSemanticIntent(semantic)
  const subject = normalizeSemanticSubject(semantic.subject)
  const actionMap = {
    view: semantic.scope === 'all' ? 'list' : 'detail',
    explain: 'detail',
    ask_general: 'info',
  }
  const action = actionMap[semantic.action] || semantic.action
  const needsTools = []
  if (semantic.subject === 'membership_plans') needsTools.push('getAvailablePlans')
  if (semantic.subject === 'products') needsTools.push('getRecommendedProducts')
  if (semantic.subject === 'booking') needsTools.push('getUpcomingBookings')
  if (semanticIntent === 'plan_recommendation') {
    needsTools.push('getSmartRecommendations', 'getMembershipInfo')
  }
  return {
    subject,
    action,
    intent: legacyIntentFromSemantic(semanticIntent),
    semanticIntent,
    questionAnalysis: semantic,
    entities: {
      budget: null,
      goal: semantic.entities.goal || null,
      frequencyPerWeek: null,
      mentionedPlan: semantic.entities.planName,
      mentionedPT: null,
    },
    confidence: semantic.confidence,
    isFollowUp: Boolean(semantic.entities.planName),
    followUpTarget: semantic.entities.planName ? { type: 'plan', id: '', name: semantic.entities.planName, method: 'semantic_memory' } : null,
    needsTools,
    requiredTools: needsTools,
    shouldUseWebSearch: semantic.needsWebSearch,
    shouldAskClarification: semantic.subject === 'membership_plans'
      && (semantic.action === 'explain' || semantic.action === 'view')
      && semantic.scope !== 'all'
      && !semantic.entities.planName,
    reasoning: `Semantic router: ${semantic.subject}/${semantic.action}/${semantic.scope}`,
    source: 'semantic_router',
  }
}

const inferMemoryFollowUp = ({ query, memory = {} }) => {
  const n = normalizeQuery(query)

  if (/\b(danh sach|liet ke|co may|bao nhieu|list|show)\b/.test(n) && /\b(pt|trainer|coach|hlv|huan luyen vien)\b/.test(n)) {
    return {
      subject: 'pt',
      action: 'list',
      intent: 'pt_advice',
      entities: { budget: null, goal: null, frequencyPerWeek: null, mentionedPlan: null, mentionedPT: null },
      confidence: 0.82,
      isFollowUp: false,
      followUpTarget: null,
      needsTools: ['getAvailablePTs'],
      requiredTools: ['getAvailablePTs'],
      shouldUseWebSearch: false,
      shouldAskClarification: false,
      reasoning: 'Local fallback detected PT list intent.',
      source: 'memory_fallback',
    }
  }

  const entityType = Array.isArray(memory.lastListedPTs) && memory.lastListedPTs.length > 0 && memory.lastSubject === 'pt'
    ? 'pt'
    : Array.isArray(memory.lastListedPlans) && memory.lastListedPlans.length > 0 && memory.lastSubject === 'plan'
      ? 'plan'
      : null
  if (!entityType) return null

  const list = entityType === 'pt' ? memory.lastListedPTs : memory.lastListedPlans
  const explicitReference = entityResolver.extractReference({ query, memory }) || query
  const resolution = entityResolver.resolve({
    userReference: explicitReference,
    lastListedEntities: list,
    entityType,
    query,
  })

  const looksLikeFollowUp = resolution.resolved
    || /\b(no|nó|cai do|cái đó|nguoi|người|dau tien|đầu tiên|thu|thứ|first|second|detail|chi tiet|thong tin|xem)\b/.test(n)
  if (!looksLikeFollowUp) return null

  const toolName = entityType === 'pt' ? 'getAvailablePTs' : 'getAvailablePlans'
  const resolved = resolution.resolved || null
  return {
    subject: entityType,
    action: 'detail',
    intent: entityType === 'pt' ? 'pt_detail' : 'membership_info',
    entities: {
      budget: null,
      goal: null,
      frequencyPerWeek: null,
      mentionedPlan: entityType === 'plan' ? (resolved?.nameVi || resolved?.nameEn || resolved?.name || null) : null,
      mentionedPT: entityType === 'pt' ? (resolved?.name || null) : null,
    },
    confidence: resolution.confidence || 0.72,
    isFollowUp: true,
    followUpTarget: resolved ? {
      type: entityType,
      id: resolved.id || resolved._id || '',
      name: resolved.name || resolved.nameVi || resolved.nameEn || '',
      method: resolution.method || 'memory',
      confidence: resolution.confidence,
    } : null,
    needsTools: [toolName],
    requiredTools: [toolName],
    shouldUseWebSearch: false,
    shouldAskClarification: false,
    reasoning: `Memory fallback resolved ${entityType} follow-up.`,
    source: 'memory_fallback',
  }
}

const parseAiResult = (text) => {
  if (!text) return null
  try {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gi, '')
      .replace(/```/g, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed.subject || !parsed.action) return null
    if (!SUBJECTS.includes(parsed.subject)) return null
    if (!ACTIONS.includes(parsed.action)) return null
    const semanticSubject = parsed.subject
    const semanticAction = parsed.action
    const semanticScope = parsed.scope || 'unknown'
    const semanticIntent = mapSemanticIntent({
      subject: semanticSubject,
      action: semanticAction,
      scope: semanticScope,
    })
    const normalizedSubject = normalizeSemanticSubject(semanticSubject)
    const normalizedAction = semanticAction === 'view'
      ? (semanticScope === 'all' ? 'list' : 'detail')
      : semanticAction === 'explain'
        ? 'detail'
        : semanticAction === 'ask_general'
          ? 'info'
          : semanticAction
    return {
      subject: normalizedSubject,
      action: normalizedAction,
      intent: INTENTS.includes(parsed.intent) ? legacyIntentFromSemantic(parsed.intent) : legacyIntentFromSemantic(semanticIntent),
      semanticIntent: INTENTS.includes(parsed.intent) ? parsed.intent : semanticIntent,
      questionAnalysis: {
        subject: semanticSubject,
        action: semanticAction,
        scope: semanticScope,
        entities: {
          planName: parsed.entities?.planName || parsed.entities?.mentionedPlan || null,
          productName: parsed.entities?.productName || null,
          dateRange: parsed.entities?.dateRange || null,
          goal: parsed.entities?.goal || null,
        },
        needsDatabase: Boolean(parsed.needsDatabase),
        needsWebSearch: Boolean(parsed.needsWebSearch || parsed.shouldUseWebSearch),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      },
      entities: {
        budget: typeof parsed.entities?.budget === 'number' ? parsed.entities.budget : null,
        goal: parsed.entities?.goal || null,
        frequencyPerWeek: typeof parsed.entities?.frequencyPerWeek === 'number' ? parsed.entities.frequencyPerWeek : null,
        mentionedPlan: parsed.entities?.planName || parsed.entities?.mentionedPlan || null,
        mentionedPT: parsed.entities?.mentionedPT || null,
      },
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      isFollowUp: Boolean(parsed.isFollowUp),
      followUpTarget: parsed.followUpTarget || null, // {type, id, name, method} or null
      targetEntity: parsed.targetEntity || null,
      needsTools: Array.isArray(parsed.needsTools) ? parsed.needsTools : (Array.isArray(parsed.requiredTools) ? parsed.requiredTools : []),
      requiredTools: Array.isArray(parsed.requiredTools) ? parsed.requiredTools : (Array.isArray(parsed.needsTools) ? parsed.needsTools : []),
      shouldUseWebSearch: Boolean(parsed.shouldUseWebSearch),
      shouldAskClarification: Boolean(parsed.shouldAskClarification)
        || (semanticSubject === 'membership_plans' && (semanticAction === 'explain' || semanticAction === 'view') && semanticScope !== 'all' && !(parsed.entities?.planName || parsed.entities?.mentionedPlan)),
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return null
  }
}

export const reasonQuery = async ({ query, userMessage, memory = {}, conversationContext = {}, language = 'vi' }) => {
  const input = query || userMessage || ''
  if (!input.trim()) {
    return { subject: null, action: null, intent: 'unknown', confidence: 0, needsTools: [], source: 'empty' }
  }

  const semantic = classifySemanticIntent({ query: input, memory })
  if (semantic.confidence >= 0.78
    || (semantic.subject === 'membership_plans' && semantic.scope === 'all')
    || (semantic.subject === 'membership_plans' && semantic.scope === 'unknown' && (semantic.action === 'explain' || semantic.action === 'view'))) {
    const result = semanticToReasonerResult(semantic)
    console.log('[QUERY_REASONER] semantic analyzed:', input, '→', result.questionAnalysis.subject, '/', result.questionAnalysis.action, '/', result.questionAnalysis.scope, 'confidence:', result.confidence)
    return result
  }

  // Always try LLM deep reasoning first for every query
  try {
    const userPrompt = buildUserPrompt({ query: input, memory, conversationContext })
    const result = await runAIWithFallback({
      systemPrompt: buildReasonerSystemPrompt(),
      userMessage: userPrompt,
    }, {
      temperature: 0.1,
      maxTokens: 500,
      timeoutMs: 6000,
    })

    const parsed = parseAiResult(result.text)
    if (parsed && parsed.confidence > 0.3) {
      // NEW: Attempt entity resolution if this is a follow-up with a target reference
      if (parsed.isFollowUp && parsed.followUpTarget) {
        const followUpTarget = parsed.followUpTarget
        const targetType = followUpTarget.type // 'pt' or 'plan'

        let lastListedEntities = []
        if (targetType === 'pt') {
          lastListedEntities = memory?.lastListedPTs || []
        } else if (targetType === 'plan') {
          lastListedEntities = memory?.lastListedPlans || []
        }

        // If we have a name/reference but no ID, try to resolve it
        if (lastListedEntities.length > 0 && !followUpTarget.id && followUpTarget.name) {
          const resolution = entityResolver.resolve({
            userReference: followUpTarget.name,
            lastListedEntities,
            entityType: targetType,
            query: input,
          })

          if (resolution.resolved) {
            // Update followUpTarget with resolved ID
            followUpTarget.id = resolution.resolved.id || resolution.resolved._id
            followUpTarget.method = resolution.method
            followUpTarget.confidence = (followUpTarget.confidence || 0.9) * resolution.confidence
          }
        }
      }

      if (!parsed.needsTools || parsed.needsTools.length === 0) {
        const toolMap = {
          plan: ['getAvailablePlans'], workout: ['analyzeWorkout'], pt: ['getAvailablePTs'],
          membership: ['getMembershipInfo'], health: [], nutrition: ['getRecommendedProducts'],
          booking: ['getUpcomingBookings'], shop: ['getRecommendedProducts'], product: ['getRecommendedProducts'],
          policy: [], faq: [], checkin: [], report: [],
        }
        parsed.needsTools = toolMap[parsed.subject] || []
        parsed.requiredTools = parsed.needsTools
        if ((parsed.intent === 'membership_advice' || parsed.entities.goal || parsed.entities.budget) && parsed.subject === 'plan') {
          if (!parsed.needsTools.includes('getSmartRecommendations')) parsed.needsTools.push('getSmartRecommendations')
          if (!parsed.needsTools.includes('getMembershipInfo')) parsed.needsTools.push('getMembershipInfo')
        }
      }
      parsed.source = 'llm'
      if (parsed.confidence > 0.7) {
        const followUpInfo = parsed.isFollowUp ? `, followUp=${parsed.followUpTarget?.type}/${parsed.followUpTarget?.id || 'unresolved'}` : ''
        console.log('[QUERY_REASONER] LLM analyzed:', input, '→', parsed.subject, '/', parsed.action, 'confidence:', parsed.confidence, 'reasoning:', parsed.reasoning, followUpInfo)
      }
      return parsed
    }
  } catch (err) {
    console.log('[QUERY_REASONER] LLM unavailable, fallback to CU layer:', err.message)
  }

  const cuResult = conversationalUnderstand({ query: input, language, context: { lastSubject: memory.lastSubject, lastMentionedPlan: memory.lastMentionedPlanName, lastMentionedPT: memory.lastMentionedPTName, lastGoal: memory.lastGoal, lastBudget: memory.lastBudget, lastFrequency: memory.lastFrequencyPerWeek } })
  const memoryFallback = inferMemoryFollowUp({ query: input, memory })
  if (memoryFallback && (!cuResult.subject || cuResult.subject === 'general' || cuResult.intent === 'unknown' || cuResult.action === 'unclear' || memoryFallback.confidence >= (cuResult.confidence || 0))) {
    return memoryFallback
  }

  const toolMap = {
    plan: ['getAvailablePlans'], pt: ['getAvailablePTs'], workout: ['analyzeWorkout'],
    membership: ['getMembershipInfo'], health: [], nutrition: ['getRecommendedProducts'],
    booking: ['getUpcomingBookings'], shop: ['getRecommendedProducts'], product: ['getRecommendedProducts'],
    policy: [], faq: [], checkin: [], report: [],
  }
  const tools = toolMap[cuResult.subject] || []
  if ((cuResult.intent === 'membership_advice' || cuResult.entities?.goal || cuResult.entities?.budget) && cuResult.subject === 'plan') {
    if (!tools.includes('getSmartRecommendations')) tools.push('getSmartRecommendations')
    if (!tools.includes('getMembershipInfo')) tools.push('getMembershipInfo')
  }
  return {
    subject: cuResult.subject,
    action: cuResult.action,
    intent: cuResult.intent,
    entities: { budget: cuResult.entities?.budget || null, goal: cuResult.entities?.goal || null, frequencyPerWeek: cuResult.entities?.frequencyPerWeek || null, mentionedPlan: null, mentionedPT: null },
    confidence: cuResult.confidence * 0.8,
    isFollowUp: cuResult.isFollowUp,
    followUpTarget: cuResult.followUpTarget,
    needsTools: tools,
    requiredTools: tools,
    shouldUseWebSearch: cuResult.subject === 'nutrition',
    shouldAskClarification: Boolean(cuResult.shouldAskClarification),
    reasoning: cuResult.reason || `CU fallback: ${cuResult.subject}/${cuResult.action}`,
    source: 'cu_fallback',
  }
}

export const __queryReasonerTestHooks = {
  buildReasonerSystemPrompt,
  buildUserPrompt,
  parseAiResult,
}
