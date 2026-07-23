function contentsToMessages(contents) {
  return contents.map(c => {
    const role = c.role === 'model' ? 'assistant' : c.role
    let content = ''
    const toolCalls = []

    for (const part of (c.parts || [])) {
      if (part.text) {
        content += (content ? '\n' : '') + part.text
      } else if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.id || `call_${Date.now()}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        })
      } else if (part.functionResponse) {
        return {
          role: 'tool',
          tool_call_id: part.functionResponse.id || 'unknown',
          content: JSON.stringify(part.functionResponse.response || {}),
        }
      }
    }

    const msg = { role, content: content || null }
    if (toolCalls.length > 0) msg.tool_calls = toolCalls
    return msg
  })
}

function functionDeclarationsToTools(declarations) {
  if (!declarations?.length) return undefined
  return declarations.map(d => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }))
}

function toGeminiResponse(data) {
  const choice = data.choices?.[0]
  const msg = choice?.message
  const parts = []

  if (msg?.content) parts.push({ text: msg.content })

  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      parts.push({
        functionCall: {
          id: tc.id,
          name: tc.function.name,
          args: (() => { try { return JSON.parse(tc.function.arguments) } catch { return {} } })(),
        },
      })
    }
  }

  return {
    candidates: [{
      content: { parts, role: 'model' },
      finishReason: choice?.finish_reason,
    }],
    usageMetadata: data.usage ? {
      promptTokenCount: data.usage.prompt_tokens,
      candidatesTokenCount: data.usage.completion_tokens,
      totalTokenCount: data.usage.total_tokens,
    } : undefined,
  }
}

function toGeminiChunk(data) {
  const choice = data.choices?.[0]
  if (!choice?.delta) return { candidates: [] }

  const parts = []
  if (choice.delta.content) parts.push({ text: choice.delta.content })

  if (choice.delta.tool_calls) {
    for (const tc of choice.delta.tool_calls) {
      if (tc.function?.name) {
        parts.push({
          functionCall: {
            id: tc.id || '',
            name: tc.function.name,
            args: (() => { try { return JSON.parse(tc.function.arguments || '{}') } catch { return {} } })(),
          },
        })
      }
    }
  }

  return { candidates: parts.length ? [{ content: { parts } }] : [] }
}

export { contentsToMessages, functionDeclarationsToTools, toGeminiResponse, toGeminiChunk }
