import OpenAI from 'openai'

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || process.env.APP_URL || process.env.CLIENT_URL
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'GymPro'

const DEFAULT_OPENROUTER_MODELS = [
  // Prioritize strong, available models (check current slug validity via OpenRouter API)
  'google/gemini-2.5-flash:free',
  'qwen/qwq-32b:free',
  'deepseek/deepseek-r1-distill-qwen-32b:free',
]

export const getOpenRouterModels = () => {
  const configured = String(process.env.OPENROUTER_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
  return configured.length > 0 ? configured : DEFAULT_OPENROUTER_MODELS
}

export const getOpenRouterClient = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME,
    },
  })
}

const buildMessages = ({ systemPrompt, context, userQuestion }) => [
  { role: 'system', content: systemPrompt || '' },
  {
    role: 'user',
    content: [
      context,
      userQuestion ? `USER_QUESTION:\n${userQuestion}` : '',
    ].filter(Boolean).join('\n\n'),
  },
]

export async function generateResponse({
  systemPrompt,
  context,
  userQuestion,
  model,
  temperature = 0.4,
  maxTokens = 800,
}) {
  if (!model) throw new Error('OpenRouter model is required')
  const client = getOpenRouterClient()
  const response = await client.chat.completions.create({
    model,
    messages: buildMessages({ systemPrompt, context, userQuestion }),
    temperature,
    max_tokens: maxTokens,
  })

  const text = response.choices?.[0]?.message?.content || ''
  if (!text.trim()) throw new Error(`OpenRouter model ${model} returned empty content`)
  return { text: text.trim(), provider: 'openrouter', model }
}
