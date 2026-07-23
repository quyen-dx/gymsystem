# AI Cross-Provider Failover Report

## 1. Architecture

```
Assistant
  ↓
chatProvider.js (facade)
  ↓
CHAT_PROVIDER=auto ?
  ├── YES → tryProvidersInOrder(CHAT_PROVIDER_ORDER)
  │         ↓ google   → key1→key2→model2 → PROVIDER_EXHAUSTED
  │         ↓ deepseek → key1→key2→model2 → SUCCESS ✨
  │         ↓ groq     → (not called)
  │
  └── NO  → useSingleProvider(CHAT_PROVIDER=google)
              ↓ google → key1→key2→model2 → PROVIDER_EXHAUSTED
```

**Layers (inside-out):**
1. **API Key Rotation** — per provider, cycles keys on 429 (in `googleChatProvider.js`)
2. **Model Rotation** — per provider, cycles models when all keys exhausted (in `googleChatProvider.js`)
3. **Provider Failover** — cycles providers on exhaustion (in `chatProvider.js` facade) **← NEW**

## 2. Provider Flow

```
Preferred:  CHAT_PROVIDER_ORDER=google,deepseek,groq,openrouter

Step 1:   google   →  PROVIDER_EXHAUSTED  →  [AI failover] switching...
Step 2:   deepseek →  PROVIDER_EXHAUSTED  →  [AI failover] switching...
Step 3:   groq     →  SUCCESS             →  response returned

None available           →  SERVICE_UNAVAILABLE
```

Single provider mode (`CHAT_PROVIDER=google`): same as before, no changes. Only the specified provider is used.

## 3. Error Classification

**Retryable (switches provider):**
- `PROVIDER_EXHAUSTED` (all keys + models used)
- HTTP 429 (Rate Limit)
- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- Timeouts, connection refused, DNS failures

**Non-retryable (thrown immediately):**
- HTTP 400 (Bad Request)
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 404 (Not Found)
- Validation errors, programming errors

## 4. Implementation

### chatProvider.js — Failover Loop

```js
async function callWithFailover(fnName, ...args) {
  const order = cfg.provider === 'auto'
    ? parseOrder(CHAT_PROVIDER_ORDER)
    : [cfg.provider]

  for (const name of order) {
    try {
      const prov = await loadProvider(name)
      return await prov[fnName](...args)
    } catch (err) {
      if (isRetryable(err)) {
        console.warn(`[AI failover] ${name} exhausted → switching`)
        continue
      }
      throw err
    }
  }
  throw SERVICE_UNAVAILABLE
}
```

### generateStream — Same logic applied to async generator

```js
export async function* generateStream(opts) {
  for (const name of order) {
    try {
      for await (const chunk of prov.generateStream(opts)) yield chunk
      return
    } catch (err) {
      if (isRetryable(err)) continue
      throw err
    }
  }
  throw SERVICE_UNAVAILABLE
}
```

### makeFunctionResponsePart

Always uses Google's implementation (`createPartFromFunctionResponse`) since all LLMs produce compatible functionCall formats. Lazily loaded on first use.

## 5. Files Changed

| File | Change |
|------|--------|
| `src/ai/providers/chat/chatProvider.js` | Added `callWithFailover()` wrapping `generateContent` and `generateStream`. `isRetryable()` for provider-level errors. `getProvider()` dynamic loader. Auto mode via `CHAT_PROVIDER=auto` + `CHAT_PROVIDER_ORDER`. `SERVICE_UNAVAILABLE` when all exhausted. |
| `src/config/aiConfig.js` | Added `chat.providerOrder` export from `CHAT_PROVIDER_ORDER` env. |
| `.env` | Added commented `CHAT_PROVIDER_ORDER` and `CHAT_PROVIDER=auto` hints. |

## 6. Reused (Unchanged)

- `googleChatProvider.js` — key + model rotation inside provider
- `visionProvider.js`, `embeddingProvider.js` — no cross-provider needed
- `aiAssistantService.js` — still calls same interface
- `aiAssistantStreamService.js` — still calls same interface

## 7. Migration Examples

### Enable failover
```diff
- CHAT_PROVIDER=google
+ CHAT_PROVIDER=auto
+ CHAT_PROVIDER_ORDER=google,deepseek,groq,openrouter
```
First available provider is used. On exhaustion, automatically falls through.

### Add a new provider to failover chain
```diff
- CHAT_PROVIDER_ORDER=google,deepseek,groq
+ CHAT_PROVIDER_ORDER=google,deepseek,groq,openrouter,claude
```
No code change. Just add to the comma-separated list.

### Disable failover (single provider)
```env
CHAT_PROVIDER=deepseek
```
Uses only DeepSeek. No failover.

## 8. Verification

| Check | Result |
|-------|--------|
| Single provider mode works | ✅ `generateContent` → `"Hi"` |
| makeFunctionResponsePart works | ✅ `createPartFromFunctionResponse` |
| generateStream works | ✅ yields chunks |
| PROVIDER_EXHAUSTED caught by facade | ✅ `[AI failover] google exhausted → switching` |
| All providers exhausted → SERVICE_UNAVAILABLE | ✅ |
| isAvailable returns true | ✅ resolved per-call |
| Assistant unchanged | ✅ same interface |
