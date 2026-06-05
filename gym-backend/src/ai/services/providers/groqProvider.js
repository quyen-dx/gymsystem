import OpenAI from 'openai'

export const GROQ_MODELS = [
  'qwen/qwen3-32b',
]

export const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
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
  if (!model) throw new Error('Groq model is required')
  const client = getGroqClient()
  const response = await client.chat.completions.create({
    model,
    messages: buildMessages({ systemPrompt, context, userQuestion }),
    temperature,
    max_tokens: maxTokens,
  })

  const text = response.choices?.[0]?.message?.content || ''
  if (!text.trim()) throw new Error(`Groq model ${model} returned empty content`)
  return { text: text.trim(), provider: 'groq', model }
}
