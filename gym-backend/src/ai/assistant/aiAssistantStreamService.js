import { isAvailable, generateContent, generateStream, makeFunctionResponsePart } from '../providers/chat/chatProvider.js'
import { getSystemPrompt } from '../prompts/systemPromptLoader.js'
import { getAllDeclarations } from '../utils/toolRegistry.js'
import { getFirstPart, hasFunctionCall } from '../utils/responseParser.js'
import { databaseQuery } from '../tools/databaseTool.js'
import { webQuery } from '../tools/webTool.js'
import { vectorQuery } from '../tools/vectorTool.js'
import { loadMemory, updateMemory, buildMemoryPrompt } from '../memory/conversationMemory.js'
import { loadContext, updateContext, buildContextPrompt, inferContextFromResponse } from '../context/conversationContext.js'
import { buildRichResponse } from '../ui/responseBuilder.js'
import { detectActions } from '../ui/actionDetector.js'

const ROLE_LABELS = {
  member: 'Hội viên', pt: 'Huấn luyện viên', staff: 'Nhân viên',
  seller: 'Người bán', admin: 'Quản lý', super_admin: 'Quản lý cấp cao',
}

function buildContents(message, user, memoryContext = '', contextPrompt = '') {
  const roleLabel = ROLE_LABELS[user?.role] || 'Người dùng'
  const userName = user?.fullName || user?.name || user?.email?.split('@')[0] || 'bạn'
  const resolvedPrompt = getSystemPrompt()
    .replace(/\{\{userName\}\}/g, userName)
    .replace(/\{\{userRoleLabel\}\}/g, roleLabel)
  const prefix = [memoryContext, contextPrompt].filter(Boolean).join('\n')
  const prefixStr = prefix ? `${prefix}\n\n` : ''
  return [{ role: 'user', parts: [{ text: `${prefixStr}${resolvedPrompt}\n\n[USER_MESSAGE]\n${message}\n[/USER_MESSAGE]` }] }]
}

async function executeTool(name, args, user) {
  if (name === 'vectorQuery') return { result: await vectorQuery(args?.query), args }
  if (name === 'webQuery') return { result: await webQuery(args?.query), args }
  return { result: await databaseQuery(args?.intent, user, args), args }
}

function extractText(chunk) {
  return chunk?.candidates?.[0]?.content?.parts?.[0]?.text || null
}

export async function* processStream(message, user, deps = {}) {
  const {
    chatAvailable = isAvailable,
    generateContentFn = generateContent,
    generateStreamFn = generateStream,
    makeFunctionResponsePartFn = makeFunctionResponsePart,
  } = deps

  if (!chatAvailable()) {
    yield { event: 'done', reply: 'Trợ lý hiện không khả dụng. Vui lòng thử lại sau.' }
    return
  }

  const sessionId = user?._id?.toString() || user?.id?.toString()
  const tools = [{ functionDeclarations: getAllDeclarations() }]
  let memoryContext = ''
  try {
    const memory = loadMemory(sessionId)
    memoryContext = buildMemoryPrompt(memory)
  } catch { /* non-critical */ }

  let contextPrompt = ''
  try {
    const conversationCtx = loadContext(sessionId)
    contextPrompt = buildContextPrompt(conversationCtx)
  } catch { /* non-critical */ }

  const contents = buildContents(message, user, memoryContext, contextPrompt)

  try {
    // Step 1: Check for function call (non-streaming for speed)
    const firstResponse = await generateContentFn({ contents, config: { temperature: 0.1, tools } })
    const part = getFirstPart(firstResponse)

    let fullText = ''
    let toolResult = null
    let toolName = null
    let toolArgs = null
    let functionCallId = null

    if (hasFunctionCall(part)) {
      // Execute tool call (non-streaming)
      const { name, args, id } = part.functionCall
      toolName = name
      toolArgs = args
      functionCallId = id
      const executed = await executeTool(name, args, user)
      toolResult = executed.result

      const frPart = await makeFunctionResponsePartFn(id, name, toolResult);
      console.log('[ASSISTANT-STREAM] Request #2 PREP: toolResult=' + JSON.stringify(toolResult).substring(0, 200));
      console.log('[ASSISTANT-STREAM] Request #2 PREP: frPart=' + JSON.stringify(frPart));
      if (frPart && typeof frPart === 'object') {
        const keys = Object.keys(frPart);
        console.log('[ASSISTANT-STREAM] Request #2 PREP: frPart keys=[' + keys.join(',') + ']');
        if (keys.length === 0) console.log('[ASSISTANT-STREAM] *** frPart IS EMPTY OBJECT {} ***');
      } else {
        console.log('[ASSISTANT-STREAM] *** frPart IS ' + typeof frPart + ' / ' + String(frPart) + ' ***');
      }

      const frContent = { role: 'user', parts: [frPart] }
      console.log('[ASSISTANT-STREAM] Request #2 PREP: frContent=' + JSON.stringify(frContent).substring(0, 300));

      // Stream the final response
      const stream = generateStreamFn({
        contents: [...contents, frContent],
        config: { temperature: 0.1, tools },
      })

      for await (const chunk of stream) {
        const text = extractText(chunk)
        if (text) {
          fullText += text
          yield { event: 'token', text }
        }
      }
    } else {
      // Direct response: stream it
      const directStream = generateStreamFn({
        contents,
        config: { temperature: 0.1, tools },
      })

      for await (const chunk of directStream) {
        const text = extractText(chunk)
        if (text) {
          fullText += text
          yield { event: 'token', text }
        }
      }
    }

    const finalText = fullText || 'Xin lỗi, hiện tại tôi chưa thể xử lý yêu cầu của bạn.'

    try { updateMemory(sessionId, message, finalText) } catch { /* non-critical */ }

    // Build rich response and emit cards/suggestions/deeplinks
    let richResponse = { cards: [], suggestions: [], deeplinks: [], actions: [] }
    if (toolName && toolResult) {
      richResponse = buildRichResponse(toolName, toolArgs, toolResult, finalText)
      for (const card of richResponse.cards) {
        yield { event: 'card', card }
      }
      for (const s of richResponse.suggestions) {
        yield { event: 'suggestion', text: s }
      }
      for (const d of richResponse.deeplinks) {
        yield { event: 'deeplink', url: d }
      }
    } else {
      richResponse.actions = detectActions(null, finalText)
    }

    for (const action of richResponse.actions || []) {
      yield { event: 'action', action }
    }

    try {
      const inferred = inferContextFromResponse(toolName, toolArgs || {}, toolResult, finalText, richResponse)
      updateContext(sessionId, inferred)
    } catch { /* non-critical */ }

    yield { event: 'done', reply: finalText }
  } catch (error) {
    console.error('[AI stream] Error:', error.message)
    yield { event: 'error', message: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.' }
  }
}
