const sessions = new Map()
const MAX_SESSION_AGE_MS = 30 * 60 * 1000

const createMemory = () => ({
  lastSubject: null,
  lastAction: null,
  lastIntent: null,
  lastMentionedPlanId: null,
  lastMentionedPlanName: null,
  lastMentionedPlan: null,
  lastMentionedPTId: null,
  lastMentionedPTName: null,
  lastMentionedPT: null,
  lastMentionedProductId: null,
  lastMentionedProductName: null,
  lastMentionedProduct: null,
  lastGoal: null,
  lastBudget: null,
  lastBudgetPeriod: null,
  lastFrequencyPerWeek: null,
  lastRecommendation: null,
  lastUsedTools: [],
  conversationSummary: '',
  lastQuery: null,
  lastAnswer: null,
  interactionCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),

  // New: Track listed entities for follow-up resolution
  lastListedPTs: [], // array of PT objects: {id, name, email, phone, specialties, experienceYears, rating, bio, schedule}
  lastListedPlans: [], // array of Plan objects: {id, name, nameVi, nameEn, price, durationDays}
  lastListedProducts: [], // array of products
})

const getSessionKey = (userId, conversationId) => `${userId || 'anonymous'}::${conversationId || 'default'}`

export const agentMemory = {
  get(userId, conversationId) {
    const key = getSessionKey(userId, conversationId)
    let session = sessions.get(key)
    if (!session || (Date.now() - session.updatedAt) > MAX_SESSION_AGE_MS) {
      session = createMemory()
      sessions.set(key, session)
    }
    if (sessions.size > 1000) {
      const oldest = [...sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0]
      if (oldest) sessions.delete(oldest[0])
    }
    return session
  },

  update(userId, conversationId, updates) {
    const session = this.get(userId, conversationId)
    Object.assign(session, updates, { updatedAt: Date.now() })
    if (session.interactionCount < Number.MAX_SAFE_INTEGER) session.interactionCount += 1
    return session
  },

  clear(userId, conversationId) {
    const key = getSessionKey(userId, conversationId)
    sessions.delete(key)
  },
}
