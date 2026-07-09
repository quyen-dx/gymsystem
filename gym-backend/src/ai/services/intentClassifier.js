import { runAIWithFallback } from './aiFallbackService.js'
import { validateIntentOutput, sanitizeIntentOutput, buildIntentSchema } from './intentSchema.js'

const buildClassifierSystemPrompt = () => {
  const schema = buildIntentSchema()
  return `You are an intent classifier for GymPro AI. Classify the user's query into one of the known intents.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation, no code fences:
${JSON.stringify(schema, null, 2)}

Allowed intents: membership, pt, booking, checkin, product, workout, faq, policy, navigation, health, nutrition, account, report, general

Rules:
- intent=membership for plan/price/compare/recommend questions
- intent=pt for PT related questions
- intent=booking for schedule/booking questions
- intent=checkin for check-in/streak/attendance questions
- intent=product for shop/product questions
- intent=workout for workout analysis/exercise plan questions
- intent=faq for FAQ about gym rules, opening hours
- intent=policy for refund/privacy/payment policies
- intent=navigation ONLY for UI questions: "ở đâu", "vào đâu", "bấm chỗ nào", "cách thao tác"
- intent=health/nutrition for health/diet advice
- intent=account for account/profile/password questions
- intent=report for revenue/member count/system data
- intent=general for greetings, thank you, chit-chat
- Permission check (needsPermissionCheck=true) when asking about other users' data
- tools must be from the available tools list in the schema
- No explanation, no markdown, no code blocks — ONLY the JSON object`
}

export const classifyIntent = async ({ query, conversationContext, memory, language = 'vi' }) => {
  const systemPrompt = buildClassifierSystemPrompt()
  const userPrompt = `Query: "${query}"
Language: ${language}
${conversationContext ? `Context: lastSubject=${conversationContext.lastSubject || ''}, lastAction=${conversationContext.lastAction || ''}` : ''}

Return JSON only.`

  try {
    const result = await runAIWithFallback({
      systemPrompt,
      userMessage: userPrompt,
    }, { temperature: 0.1, maxTokens: 500, timeoutMs: 10000, responseMimeType: 'application/json' })

    let parsed
    try {
      parsed = JSON.parse(result.text || '{}')
    } catch {
      const jsonMatch = (result.text || '').match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]) } catch { parsed = {} }
      } else {
        parsed = {}
      }
    }

    const validation = validateIntentOutput(parsed)
    if (!validation.valid) {
      console.log('[INTENT_CLASSIFIER] Schema validation failed:', validation.errors.join('; '))
      return sanitizeIntentOutput(parsed)
    }

    return sanitizeIntentOutput(parsed)
  } catch (err) {
    console.error('[INTENT_CLASSIFIER] LLM call failed:', err.message)
    return {
      intent: 'general',
      confidence: 0,
      tools: [],
      subject: 'general',
      action: 'ask_general',
      entityName: '',
      isFollowUp: false,
      needsPermissionCheck: false,
      reason: 'Classifier LLM unavailable',
    }
  }
}