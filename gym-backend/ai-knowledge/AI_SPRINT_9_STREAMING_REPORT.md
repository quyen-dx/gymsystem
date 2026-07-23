# AI Sprint 9 — Streaming Architecture (SSE)

## 1. Architecture

```
POST /api/ai/chat/stream  (SSE)
  → aiStreamController (sets text/event-stream headers, handles abort)
    → aiAssistantStreamService.processStream()  (async generator)
      → load memory → build context
      → Step 1: generateContent() — check for function call (non-streaming)
        → If tool call: execute tool → generateStream() → stream tokens
        → If direct: generateStream() → stream tokens
      → After stream: buildRichResponse → emit card/suggestion/deeplink events
      → Emit done event
```

**Key design decision:** First check for function calls non-streaming (typically <500ms for verification), then stream the final response. This avoids the complexity of handling function calls mid-stream while still streaming the majority of tokens.

## 2. SSE Protocol

| Event | Payload | When |
|-------|---------|------|
| `token` | `{ text: "Xin" }` | Each text chunk from LLM |
| `card` | `{ id, type, title, ... }` | After streaming, one per built card |
| `suggestion` | `{ text: "Nạp tiền vào ví" }` | After streaming, one per suggestion |
| `deeplink` | `{ url: "/wallet" }` | After streaming, one per deeplink |
| `done` | `{ reply: "full text" }` | Stream complete |
| `error` | `{ message: "..." }` | On failure |

Controller sets headers:
```js
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',  // disable nginx buffering
})
```

## 3. Abort Strategy

Two-layer abort:
1. **Frontend `AbortController`** — passed to `fetch()` via `signal`. On user clicking "Dừng", calls `abortController.abort()`.
2. **Backend `req.on('close')`** — detects client disconnect. Sets `aborted = true` flag. Generator loop checks flag and breaks.

When user stops:
- Frontend: `fetch` throws `AbortError` → handler returns `null` → fallback is NOT invoked (already aborted)
- Backend: stream loop breaks, SSE connection closes gracefully

## 4. Fallback Strategy

```
Try POST /api/ai/chat/stream (SSE)
  ↓
If fetch fails (network, server doesn't support streaming, etc.)
  ↓
Fall back to POST /api/ai/chat (regular JSON)
```

Frontend widget calls `streamChatMessage()` first. If it returns `null` (aborted or failed), falls back to `sendChatMessage()` which returns `{ reply, cards, suggestions, deeplinks }`.

## 5. Files Created

| File | Purpose |
|------|---------|
| `src/ai/assistant/aiAssistantStreamService.js` | Streaming version of `process()`. Async generator `processStream(message, user)` that yields `{ event, ... }` objects. Shares memory, context building, tool dispatch with the non-streaming version. |
| `src/controllers/aiStreamController.js` | SSE controller. Sets headers, iterates generator, writes `event:` / `data:` lines. Handles `req.on('close')` for abort. |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/ai/providers/chat/googleChatProvider.js` | Added `generateStream()` — async generator wrapping `generateContentStream()`. |
| `src/ai/providers/chat/chatProvider.js` | Re-exports `generateStream` from provider. |
| `src/routes/aiRoutes.js` | Added `POST /chat/stream` route → `postChatStream` controller. |
| `gym-frontend/src/services/api.ts` | Added `streamChatMessage()` — fetch-based SSE parser with `ReadableStream` and callbacks for `onToken`, `onCard`, `onSuggestion`, `onDeeplink`, `onDone`, `onError`. Supports `AbortSignal`. |
| `gym-frontend/src/components/chat/AiChatWidget.tsx` | Replaced `handleSend` with streaming-first logic: try streaming with incremental content updates per token, fall back to non-streaming `sendChatMessage()`. Added `abortRef`, `handleStop()`, "Dừng" button in panel header. |

## 7. Files NOT Modified (Compliant)

- `src/ai/tools/databaseTool.js`
- `src/ai/tools/webTool.js`
- `src/ai/tools/visionTool.js`
- `src/ai/tools/vectorTool.js`
- `src/ai/memory/conversationMemory.js`
- `src/ai/memory/memoryStore.js`
- `src/ai/factory/providerFactory.js`
- `src/ai/ui/responseBuilder.js`
- `src/ai/ui/cardRegistry.js`
- `src/ai/assistant/aiAssistantService.js` (legacy non-streaming, still used as fallback)

## 8. Verification Results

| Check | Result |
|-------|--------|
| `generateStream` in Google provider | ✅ function (async generator) |
| `generateStream` in chat facade | ✅ re-exported |
| `processStream` exported | ✅ async generator |
| `postChatStream` exported | ✅ controller |
| Legacy `process` unchanged | ✅ still exports `process` |
| Route `/chat` unchanged | ✅ |
| Route `/chat/stream` added | ✅ |
| Stream generates tokens | ✅ 2 tokens from "Xin chào" test |
| Frontend type compatibility | ✅ `ChatMessage` already has `cards`, `suggestions`, `links` |

## 9. Future Compatibility

| Provider | Streaming Support |
|----------|------------------|
| **Google Gemini** | `generateContentStream()` — already implemented |
| **OpenAI** | `chat.completions.create({ stream: true })` — `openaiChatProvider.js` would implement `generateStream()` with same signature |
| **DeepSeek** | OpenAI-compatible streaming API — same pattern |
| **Claude** | Anthropic streaming with SSE — same async generator interface |

All providers implement `generateStream({ contents, config }) → AsyncGenerator<Chunk>`. The assistant never knows which provider is streaming.
