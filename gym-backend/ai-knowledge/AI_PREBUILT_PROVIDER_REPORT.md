# AI Prebuilt Provider Report

## 1. New Providers

| Provider | File | API | Status |
|----------|------|-----|--------|
| DeepSeek | `deepseekChatProvider.js` | `api.deepseek.com/v1` | Prebuilt, key=gated |
| Groq | `groqChatProvider.js` | `api.groq.com/openai/v1` | Prebuilt, verified ("Hello") |
| OpenRouter | `openrouterChatProvider.js` | `openrouter.ai/api/v1` | Prebuilt, key available |

All three use the OpenAI-compatible API format with conversion via `openaiFormat.js`.

## 2. Shared Module: openaiFormat.js

```js
contentsToMessages(contents)        // Gemini parts → OpenAI messages
functionDeclarationsToTools(decls)   // Gemini functionDeclarations → OpenAI tools
toGeminiResponse(data)              // OpenAI response → Gemini format
toGeminiChunk(data)                 // OpenAI stream chunk → Gemini stream chunk
```

Handles:
- Text conversion (parts[n].text → choice.message.content)
- Function call conversion (functionCall → tool_calls[n].function)
- Function response conversion (functionResponse → role:tool message)
- Token usage mapping
- Stream delta parsing (SSE data: lines)

## 3. Provider Interface (all 4 identical)

| Export | Type | Description |
|--------|------|-------------|
| `isAvailable()` | () → boolean | Returns false when API_KEYS is empty |
| `generateContent({contents, config})` | async → Response | Gemini-format response |
| `generateStream({contents, config})` | async generator | Yields Gemini-format chunks |

Each provider independently:
- Reads `MODELS` and `API_KEYS` from config/env
- Implements key rotation (on 429/resource exhaustion)
- Implements model rotation (when all keys exhausted)
- Throws `PROVIDER_EXHAUSTED` when all resources used
- Throws `PROVIDER_UNAVAILABLE` when no keys configured

## 4. Empty Key Behavior

When no API key is configured (e.g., `DEEPSEEK_API_KEYS=`):
- `isAvailable()` → `false`
- `generateContent()` → throws `PROVIDER_UNAVAILABLE`
- Failover system catches → skips to next provider

No errors thrown at module load time. Providers compile and export all functions regardless of key availability.

## 5. Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/ai/providers/chat/openaiFormat.js` | 121 | Gemini ↔ OpenAI format conversion |
| `src/ai/providers/chat/deepseekChatProvider.js` | 142 | DeepSeek provider (api.deepseek.com) |
| `src/ai/providers/chat/groqChatProvider.js` | 154 | Groq provider (api.groq.com) |
| `src/ai/providers/chat/openrouterChatProvider.js` | 160 | OpenRouter provider (openrouter.ai) |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/ai/providers/chat/chatProvider.js` | `PROVIDER_LOADERS` now imports real modules for deepseek, groq, openrouter (was `null`) |

## 7. Activation

### Today (no key):
```env
DEEPSEEK_API_KEYS=          # empty → provider skipped by failover
```

### Tomorrow (add key):
```env
DEEPSEEK_API_KEYS=sk-abc    # filled → restart → provider works immediately
```
No code changes. No re-imports. No module reloads.

## 8. End-to-End Verification

| Check | Result |
|-------|--------|
| DeepSeek loads, exports all 3 functions | ✅ |
| Groq loads, exports all 3 functions | ✅ |
| OpenRouter loads, exports all 3 functions | ✅ |
| DeepSeek `isAvailable()` = false (no key) | ✅ |
| Groq `isAvailable()` = true (has key) | ✅ |
| OpenRouter `isAvailable()` = true (has key) | ✅ |
| Failover: deepseek→skip, groq→success | ✅ "Hello" |
| Format conversion: Gemini↔OpenAI | ✅ Response parses correctly |
| Chat facade exports all 4 functions | ✅ |
| Assistant unchanged | ✅ Same interface |
