import { GoogleGenAI } from '@google/genai'

const GEMINI_MODEL = 'gemini-2.5-flash'

export const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

export const getAdminGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY_ADMIN) {
    throw new Error('GEMINI_API_KEY_ADMIN is not configured')
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_ADMIN })
}

const getResponseText = (response) => {
  if (typeof response?.text === 'string') return response.text.trim()
  return response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim() || ''
}

const buildContents = ({ systemPrompt, context, userQuestion }) => {
  const combined = [
    systemPrompt,
    context,
    userQuestion ? `USER_QUESTION:\n${userQuestion}` : '',
  ].filter(Boolean).join('\n\n')

  return [{ role: 'user', parts: [{ text: combined }] }]
}

export async function generateResponse({
  systemPrompt,
  context,
  userQuestion,
  language,
  model = GEMINI_MODEL,
  temperature = 0.25,
  maxTokens = 1200,
  thinkingBudget,
  responseMimeType = null,
}) {
  const client = getGeminiClient()
  const config = {
    temperature,
    maxOutputTokens: maxTokens,
  }

  if (responseMimeType) {
    config.responseMimeType = responseMimeType
  }

  if (Number.isFinite(thinkingBudget)) {
    config.thinkingConfig = { thinkingBudget }
  }

  const response = await client.models.generateContent({
    model,
    contents: buildContents({ systemPrompt, context, userQuestion, language }),
    config,
  })

  const text = getResponseText(response)
  if (!text) throw new Error('Gemini returned empty response')
  return { text, provider: 'gemini', model }
}
