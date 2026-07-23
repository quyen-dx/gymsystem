# AI Provider Configuration & Key/Model Rotation Report

## 1. New .env Provider Format

Each provider owns its own section with three env vars:

```env
# Provider-specific
{PROVIDER}_ENABLED=true|false
{PROVIDER}_MODELS=model1,model2,model3
{PROVIDER}_API_KEYS=key1,key2,key3   (or GEMINI_API_KEYS for google/gemini)
```

Supported providers: `GOOGLE`, `DEEPSEEK`, `GROQ`, `OPENROUTER`, `OPENAI`, `CLAUDE`

Backward compat: old `GEMINI_API_KEY` (single) still works as fallback.

## 2. aiConfig.js — Provider Configuration

```js
const PREFIX = { google:'GOOGLE', deepseek:'DEEPSEEK', groq:'GROQ', ... }
const LEGACY_KEY_NAMES = { google:'GEMINI_API_KEYS', gemini:'GEMINI_API_KEYS' }

function resolve(providerVar, defaultProvider, defaultModel) → {
  provider,          // 'google' | 'deepseek' | ...
  models: string[],  // parsed from {PREFIX}_MODELS or [defaultModel]
  apiKeys: string[], // parsed from {PREFIX}_API_KEYS or legacy fallback
  enabled: boolean,  // {PREFIX}_ENABLED !== 'false'
}
```

Key resolution order:
1. `{PREFIX}_API_KEYS` (comma-separated)
2. Legacy key env var (e.g., `GEMINI_API_KEYS` for google)
3. `{PREFIX}_API_KEY` (single)
4. `GEMINI_API_KEY` (universal fallback)

## 3. Key Rotation Flow

```js
// Inside each provider (googleChatProvider.js, etc.)
let keyIdx = 0
let modelIdx = 0

async function callWithRotation(fn) {
  while (modelIdx < MODELS.length) {
    const client = makeClient()       // uses API_KEYS[keyIdx]
    try {
      return await fn(client)          // calls Gemini API
    } catch (err) {
      if (isRateLimited(err)) {
        console.warn(`key ${keyIdx+1}/${API_KEYS.length} rate-limited, rotating...`)
        keyIdx++                      // → next key
        if (keyIdx >= API_KEYS.length) {
          keyIdx = 0
          modelIdx++                  // → next model
        }
        continue                      // retry with new key/model
      }
      throw err
    }
  }
  throw PROVIDER_EXHAUSTED
}
```

## 4. Model Rotation Flow

```
deepseek-chat, key-1  →  429  →  rotate key
deepseek-chat, key-2  →  429  →  all keys exhausted, rotate model
deepseek-reasoner, key-1  →  success!
```

- Never switches provider (stays within the configured provider)
- Key rotation resets when moving to next model
- When all keys + all models exhausted → `PROVIDER_EXHAUSTED` error

## 5. Rate Limit Detection

```js
function isRateLimited(err) {
  return err?.status === 429 || err?.code === 429 ||
         /RESOURCE_EXHAUSTED|quota|rate.?\s*limit/i.test(err?.message || '')
}
```

Works with Google Gemini SDK error format: `{ error: { code: 429, message: "...RESOURCE_EXHAUSTED..." } }`

## 6. Files Changed

| File | Change |
|------|--------|
| `src/config/aiConfig.js` | Complete rewrite — `parseList()`, `PREFIX` map, `LEGACY_KEY_NAMES`, `resolve()` for chat/vision, inline config for embedding. All provider configs return `{ provider, models[], apiKeys[], enabled }`. |
| `src/ai/providers/chat/googleChatProvider.js` | Added rotation: `keyIdx`/`modelIdx` counters, `isRateLimited()`, `callWithRotation()`, `generateStream()` with rotation loop, `PROVIDER_EXHAUSTED` error when exhausted. |
| `src/ai/providers/vision/googleVisionProvider.js` | Added identical rotation pattern to `analyzeImage()`. |
| `src/ai/providers/embedding/geminiEmbeddingProvider.js` | Added identical rotation pattern to `embed()`. |
| `.env` | Reorganized AI section: provider selection → per-provider blocks with `ENABLED`/`MODELS`/`API_KEYS` for 6 providers. All 44 legacy vars preserved in LEGACY section. |

## 7. Migration Examples

### Add a second Google API key
```diff
  GEMINI_API_KEYS=AQ-key1
+ GEMINI_API_KEYS=AQ-key1,AQ-key2
```
No code change. Rotation now cycles key1 → key2 on 429.

### Add a new model to Google
```diff
- GOOGLE_MODELS=gemini-2.5-flash-lite
+ GOOGLE_MODELS=gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.5-pro
```
No code change. On key exhaustion, rotate model.

### Switch from Google to DeepSeek
```env
CHAT_PROVIDER=deepseek
DEEPSEEK_ENABLED=true
DEEPSEEK_MODELS=deepseek-chat,deepseek-reasoner
DEEPSEEK_API_KEYS=sk-key1,sk-key2
```
No code change — only .env. The facade loads deepseekChatProvider.js.

## 8. Default Configuration

```
GOOGLE_MODELS=gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_API_KEYS=AQ-key  (1 key)

→ 2 models, 1 key
→ On 429: rotates to gemini-2.5-flash
→ Rotation ready: true
```

## 9. Verification

| Check | Result |
|-------|--------|
| Config resolves models array | ✅ 2 models: gemini-2.5-flash-lite, gemini-2.5-flash |
| Config resolves API keys | ✅ 1 key from GEMINI_API_KEYS |
| Multi-key resolution (2 keys) | ✅ keys=2 when explicitly set |
| Embedding uses correct model | ✅ gemini-embedding-001 (3072 dims) |
| Embedding uses same keys | ✅ Reads GEMINI_API_KEYS |
| Chat provider available | ✅ |
| Vision provider loads | ✅ |
| Backward compat (GEMINI_API_KEY) | ✅ Falls back to single key |
| Rotation capable | ✅ 2 models + configurable keys > 1 |
| Assistant unchanged | ✅ Exports `process` |
