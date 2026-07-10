// llmWriter.js
// Takes structured knowledge data → generates natural paragraph via LLM.
// Domain-specific writing rules come from writers/ directory via promptSelector.

import { runAIWithFallback } from './aiFallbackService.js'
import { getSystemPrompt, getWriterPrompt } from './promptSelector.js'

const NUTRITION_SYSTEM_PROMPT = getWriterPrompt('nutrition')

const formatList = (items) => items.map(i => `• ${i}`).join('\n')

const formatFoodData = (data) => {
  if (!data) return 'Không có dữ liệu.'
  const parts = []
  if (data.goal) parts.push(`Mục tiêu: ${data.goal}`)
  if (data.topics) parts.push(`Chủ đề: ${data.topics}`)
  if (data.foods) parts.push(`Thực phẩm phù hợp:\n${formatList(data.foods)}`)
  if (data.proteins) parts.push(`Thực phẩm giàu đạm:\n${formatList(data.proteins)}`)
  if (data.carbs) parts.push(`Tinh bột:\n${formatList(data.carbs)}`)
  if (data.fats) parts.push(`Chất béo lành mạnh:\n${formatList(data.fats)}`)
  if (data.veggies) parts.push(`Rau xanh:\n${formatList(data.veggies)}`)
  if (data.tips) parts.push(`Lời khuyên:\n${data.tips.map(t => `• ${t}`).join('\n')}`)
  if (data.avoid) parts.push(`Nên tránh:\n${formatList(data.avoid)}`)
  if (data.breakfast) parts.push(`Bữa sáng:\n${data.breakfast.join('\n')}`)
  if (data.lunch) parts.push(`Bữa trưa:\n${data.lunch.join('\n')}`)
  if (data.snack) parts.push(`Bữa phụ:\n${data.snack.join('\n')}`)
  if (data.dinner) parts.push(`Bữa tối:\n${data.dinner.join('\n')}`)
  if (data.note) parts.push(`Ghi chú: ${data.note}`)
  return parts.join('\n\n')
}

// Strip <think>...</think> reasoning blocks emitted by some providers (e.g. Groq Qwen).
// Handles BOTH cases:
//   1. Properly closed block: <think>...</think>answer
//   2. Truncated block (maxTokens ran out mid-reasoning, no closing tag ever arrives):
//      <think>...reasoning that never ends...
// In case 2 the old regex (requires a closing tag) silently failed to match,
// so the raw reasoning text leaked straight to the user as the "answer".
const stripThinkBlock = (rawText) => {
  if (!rawText.includes('<think>')) {
    return { text: rawText, stripped: false, truncated: false }
  }

  const closedMatch = rawText.match(/<think>[\s\S]*?<\/think>/)
  if (closedMatch) {
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return { text: cleaned, stripped: true, truncated: false }
  }

  // No closing tag found -> the model was still "thinking" when the response
  // was cut off (maxTokens hit). Discard everything from <think> onward.
  const cleaned = rawText.slice(0, rawText.indexOf('<think>')).trim()
  return { text: cleaned, stripped: true, truncated: true }
}

export const writeNutritionAnswer = async ({ question = '', knowledge = {} } = {}) => {
  const formatted = formatFoodData(knowledge)
  const refs = Array.isArray(knowledge.references) ? knowledge.references : []
  const refSection = refs.length > 0
    ? '\n\n## Nguồn tham khảo\n' + refs.map(r => `- ${r.title}: ${r.url}`).join('\n')
    : ''
  // Split nutrition.prompt.md: role instructions go to systemPrompt, Q/A goes to userMessage
  const fullPrompt = NUTRITION_SYSTEM_PROMPT
    .replace('{{question}}', question)
    .replace('{{knowledge}}', formatted + refSection)
  const questionMarker = '=========================\nCÂU HỎI\n========================='
  const qaStart = fullPrompt.indexOf(questionMarker)
  const roleInstructions = qaStart > 0 ? fullPrompt.slice(0, qaStart).trim() : ''
  const qaSection = qaStart > 0 ? fullPrompt.slice(qaStart).trim() : fullPrompt.trim()
  const combinedSystem = [getSystemPrompt(), roleInstructions].filter(Boolean).join('\n\n')
  console.log('[LLM_WRITER] DEBUG:', JSON.stringify({
    roleInstructionsLen: roleInstructions.length,
    qaSectionLen: qaSection.length,
    systemPromptLen: combinedSystem.length,
    questionReplaced: !fullPrompt.includes('{{question}}'),
    knowledgeReplaced: !fullPrompt.includes('{{knowledge}}'),
    foodsCount: Array.isArray(knowledge.foods) ? knowledge.foods.length : 0,
    tipsCount: Array.isArray(knowledge.tips) ? knowledge.tips.length : 0,
    avoidCount: Array.isArray(knowledge.avoid) ? knowledge.avoid.length : 0,
  }))

  // maxTokens raised 500 -> 900: qwen3-32b (Groq) emits a <think> reasoning
  // block before the real answer. At 500 tokens the model was regularly cut
  // off mid-thought, producing an empty/garbage final answer and, worse, an
  // unclosed <think> tag that the old regex couldn't strip (see below).
  const result = await runAIWithFallback({
    systemPrompt: combinedSystem,
    userMessage: qaSection,
  }, { temperature: 0.7, maxTokens: 900, timeoutMs: 15000 })

  let text = (result.text || '').trim()
  const usedFallback = result.usedFallback || false

  const { text: stripped, stripped: didStrip, truncated } = stripThinkBlock(text)
  text = stripped
  if (didStrip) {
    console.log('[LLM_WRITER] stripped <think> block', truncated ? '(truncated, no closing tag — maxTokens likely too low)' : '(closed)')
  }
  if (truncated) {
    // We discarded reasoning but have no real answer left either — treat as
    // a failed generation rather than returning an empty/near-empty string.
    console.log('[LLM_WRITER] WARN: response was cut off mid-<think>, no usable answer text remained')
    text = ''
  }

  // If only thinking remained, null out
  if (text.length < 10) text = ''

  console.log('[LLM_WRITER] generated answer:', text.slice(0, 200))

  // Diagnostic: flag suspicious "not enough data" answers when we actually
  // DO have food data — this used to be silently accepted as a valid answer
  // (47 chars > the 30-char fallback threshold) even with foodsCount: 3.
  const looksLikeInsufficientDataAnswer = /chưa có đủ dữ liệu|không đủ dữ liệu|không có đủ thông tin/i.test(text)
  const hasUsableKnowledge = (Array.isArray(knowledge.foods) && knowledge.foods.length > 0)
  if (looksLikeInsufficientDataAnswer && hasUsableKnowledge) {
    console.log('[LLM_WRITER] WARN: model claimed insufficient data despite having', knowledge.foods.length, 'foods in knowledge — likely a prompt/model issue, not an actual data gap')
  }

  if (text.length > 30 && !(looksLikeInsufficientDataAnswer && hasUsableKnowledge)) {
    return { answer: text, usedFallback }
  }
  // Fallback: return formatted data as text
  return { answer: formatted, usedFallback: true }
}

export const writeMealPlanAnswer = async ({ question = '', mealData = {} } = {}) => {
  const formatted = formatFoodData(mealData)
  let userPrompt = NUTRITION_SYSTEM_PROMPT
    .replace('{{question}}', question)
    .replace('{{knowledge}}', formatted)
  console.log('[LLM_WRITER] meal plan FINAL PROMPT:', userPrompt.slice(0, 800) + '...')
  try {
    const result = await runAIWithFallback({
      systemPrompt: getSystemPrompt(),
      userMessage: userPrompt,
    }, { temperature: 0.7, maxTokens: 700, timeoutMs: 10000 })

    let text = (result.text || '').trim()
    const { text: stripped, stripped: didStrip, truncated } = stripThinkBlock(text)
    text = stripped
    if (didStrip) {
      console.log('[LLM_WRITER] meal plan stripped <think> block', truncated ? '(truncated)' : '(closed)')
    }

    console.log('[LLM_WRITER] meal plan answer:', text.slice(0, 200))
    if (text.length > 30) return { answer: text, usedFallback: result.usedFallback || false }
  } catch (err) {
    console.log('[LLM_WRITER] meal plan error:', err.message)
  }
  return { answer: formatFoodData(mealData), usedFallback: true }
}
