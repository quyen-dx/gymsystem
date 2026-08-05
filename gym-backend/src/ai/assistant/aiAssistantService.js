import { isAvailable, generateContent, makeFunctionResponsePart } from '../providers/chat/chatProvider.js'
import { getSystemPrompt } from '../prompts/systemPromptLoader.js'
import { getAllDeclarations } from '../utils/toolRegistry.js'
import { getFirstPart, extractText, hasFunctionCall } from '../utils/responseParser.js'
import { databaseQuery } from '../tools/databaseTool.js'
import { webQuery } from '../tools/webTool.js'
import { vectorQuery } from '../tools/vectorTool.js'
import { loadMemory, updateMemory, buildMemoryPrompt } from '../memory/conversationMemory.js'
import { loadContext, updateContext, buildContextPrompt, inferContextFromResponse } from '../context/conversationContext.js'
import { buildRichResponse } from '../ui/responseBuilder.js'
import { detectActions } from '../ui/actionDetector.js'

const ROLE_LABELS = {
  member: 'Hội viên',
  pt: 'Huấn luyện viên',
  staff: 'Nhân viên',
  seller: 'Người bán',
  admin: 'Quản lý',
  super_admin: 'Quản lý cấp cao',
}

function buildContents(message, user, memoryContext = '', contextPrompt = '') {
  const roleLabel = ROLE_LABELS[user?.role] || 'Người dùng'
  const userName = user?.fullName || user?.name || user?.email?.split('@')[0] || 'bạn'

  const resolvedPrompt = getSystemPrompt()
    .replace(/\{\{userName\}\}/g, userName)
    .replace(/\{\{userRoleLabel\}\}/g, roleLabel)

  const prefix = [memoryContext, contextPrompt].filter(Boolean).join('\n')
  const prefixStr = prefix ? `${prefix}\n\n` : ''
  const userPart = `${prefixStr}${resolvedPrompt}\n\n[USER_MESSAGE]\n${message}\n[/USER_MESSAGE]`

  return [{ role: 'user', parts: [{ text: userPart }] }]
}

export async function process(message, user) {
  if (!isAvailable()) {
    return { message: 'Trợ lý hiện không khả dụng. Vui lòng thử lại sau.', cards: [], suggestions: [], deeplinks: [], actions: [] }
  }

  const sessionId = user?._id?.toString() || user?.id?.toString()

  let memory = null
  let memoryContext = ''
  try {
    memory = loadMemory(sessionId)
    memoryContext = buildMemoryPrompt(memory)
  } catch {
    // Non-critical; continue without memory
  }

  let conversationCtx = null
  let contextPrompt = ''
  try {
    conversationCtx = loadContext(sessionId)
    contextPrompt = buildContextPrompt(conversationCtx)
  } catch {
    // Non-critical; continue without context
  }

  try {
    const contents = buildContents(message, user, memoryContext, contextPrompt)
    const tools = [{ functionDeclarations: getAllDeclarations() }]

    const response = await generateContent({
      contents,
      config: { temperature: 0.1, tools },
    })

    const part = getFirstPart(response)

    if (hasFunctionCall(part)) {
      const { name, args, id } = part.functionCall

      let result
      if (name === 'vectorQuery') {
        result = await vectorQuery(args?.query)
      } else if (name === 'webQuery') {
        result = await webQuery(args?.query)
      } else {
        result = await databaseQuery(args?.intent, user, args)
      }

      const frPart = await makeFunctionResponsePart(id, name, result);
      console.log('[ASSISTANT] Request #2 PREP: result=' + JSON.stringify(result).substring(0, 200));
      console.log('[ASSISTANT] Request #2 PREP: frPart=' + JSON.stringify(frPart));
      if (frPart && typeof frPart === 'object') {
        const keys = Object.keys(frPart);
        console.log('[ASSISTANT] Request #2 PREP: frPart keys=[' + keys.join(',') + ']');
        if (keys.length === 0) console.log('[ASSISTANT] *** frPart IS EMPTY OBJECT {} ***');
      } else {
        console.log('[ASSISTANT] *** frPart IS ' + typeof frPart + ' / ' + String(frPart) + ' ***');
      }

      const functionResponseContent = {
        role: 'user',
        parts: [frPart],
      }

      console.log('[ASSISTANT] Request #2 PREP: functionResponseContent=' + JSON.stringify(functionResponseContent).substring(0, 300));

      const finalResponse = await generateContent({
        contents: [...contents, functionResponseContent],
        config: { temperature: 0.1, tools },
      })

      const text = extractText(finalResponse) || 'Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu của bạn. Vui lòng thử lại sau.'

      try { updateMemory(sessionId, message, text) } catch { /* non-critical */ }

      const rich = buildRichResponse(name, args, result, text)

      try {
        const inferred = inferContextFromResponse(name, args, result, text, rich)
        updateContext(sessionId, inferred)
      } catch { /* non-critical */ }

      return rich
    }

    const text = extractText(response) || 'Xin chào, tôi là Trợ lý GymPro. Tôi có thể giúp gì cho bạn?'

    try { updateMemory(sessionId, message, text) } catch { /* non-critical */ }

    try {
      const inferred = inferContextFromResponse(null, {}, {}, text, {})
      updateContext(sessionId, inferred)
    } catch { /* non-critical */ }

    return { message: text, cards: [], suggestions: [], deeplinks: [], actions: detectActions(null, text) }
  } catch (error) {
    console.error('[AI] Gemini API error:', error)
    return { message: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.', cards: [], suggestions: [], deeplinks: [], actions: [] }
  }
}
