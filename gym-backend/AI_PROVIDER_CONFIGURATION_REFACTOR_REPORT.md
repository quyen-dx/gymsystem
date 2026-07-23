# AI Provider Configuration Refactor Report

## Architecture Before

```
aiConfig.js
  resolve('CHAT_PROVIDER', 'google', ...)
    → reads CHAT_PROVIDER env var
    → resolves keys/models/enabled based on CHAT_PROVIDER value
    → single { provider, models, apiKeys, enabled } object

googleChatProvider.js
  import { chat as cfg } from aiConfig.js
  API_KEYS = cfg.apiKeys  ← DEPENDS on CHAT_PROVIDER value

deepseekChatProvider.js
  const cfg = await import aiConfig.js
  API_KEYS = cfg.chat.apiKeys  ← DEPENDS on CHAT_PROVIDER value

openrouterChatProvider.js
  const cfg = await import aiConfig.js
  API_KEYS = read from env directly  ← partial isolation
```

**Bug path**: `CHAT_PROVIDER=auto` → `resolve()` produces `apiKeys: []` → all providers that read from `cfg.apiKeys` get empty arrays → `isAvailable()` returns `false` → provider skipped.

## Architecture After

```
aiConfig.js
  providers.google   → { enabled, models, apiKeys }  ← ALWAYS resolves Google
  providers.deepseek → { enabled, models, apiKeys }  ← ALWAYS resolves DeepSeek
  providers.openrouter → { enabled, models, apiKeys } ← ALWAYS resolves OpenRouter
  providers.openai   → { enabled, models, apiKeys }
  providers.claude   → { enabled, models, apiKeys }
  
  chat    → { provider, providerOrder }  ← only ordering info
  vision  → { provider }
  embedding → { provider, models }

googleChatProvider.js    → import { providers } → providers.google
deepseekChatProvider.js → import { providers } → providers.deepseek
openrouterChatProvider.js → import { providers } → providers.openrouter
```

## Configuration Tree

```
aiConfig.js
├── providers                  ← Per-provider: self-contained
│   ├── google
│   │   ├── enabled            ← GOOGLE_ENABLED
│   │   ├── models[]           ← GOOGLE_MODELS
│   │   └── apiKeys[]          ← GOOGLE_API_KEYS | GEMINI_API_KEYS (legacy)
│   ├── deepseek
│   │   ├── enabled            ← DEEPSEEK_ENABLED
│   │   ├── models[]           ← DEEPSEEK_MODELS
│   │   └── apiKeys[]          ← DEEPSEEK_API_KEYS
│   ├── openrouter
│   │   ├── enabled            ← OPENROUTER_ENABLED
│   │   ├── models[]           ← OPENROUTER_MODELS
│   │   └── apiKeys[]          ← OPENROUTER_API_KEYS
│   ├── openai
│   │   ├── enabled            ← OPENAI_ENABLED
│   │   ├── models[]           ← OPENAI_MODELS
│   │   └── apiKeys[]          ← OPENAI_API_KEYS
│   └── claude
│       ├── enabled            ← CLAUDE_ENABLED
│       ├── models[]           ← CLAUDE_MODELS
│       └── apiKeys[]          ← CLAUDE_API_KEYS
├── chat                        ← Service: ordering only
│   ├── provider                ← CHAT_PROVIDER
│   └── providerOrder[]         ← CHAT_PROVIDER_ORDER
├── vision                      ← Service: routing only
│   └── provider                ← VISION_PROVIDER
├── embedding                   ← Service: routing + models
│   ├── provider                ← EMBEDDING_PROVIDER
│   └── models[]                ← EMBEDDING_MODELS | EMBEDDING_MODEL
├── vector, memory, context     ← Unchanged
```

## Provider Ownership

| Provider | Reads From | Owns |
|----------|-----------|------|
| `googleChatProvider.js` | `providers.google` | API keys, models, rotation |
| `deepseekChatProvider.js` | `providers.deepseek` | API keys, models, rotation |
| `openrouterChatProvider.js` | `providers.openrouter` | API keys, models, rotation |
| `googleVisionProvider.js` | `providers.google` | API keys, models, rotation |
| `geminiEmbeddingProvider.js` | `providers.google.apiKeys` + `embedding.models` | API keys (Google), models (embedding-specific) |

## Failover Flow

```
generateContent(opts)
  → callWithFailover('generateContent', opts)
    → resolveOrder()
      → if chat.provider === 'auto': return chat.providerOrder (fallback ['google','deepseek','openrouter'])
      → else: return [chat.provider]
    → for each provider name:
      → getProvider(name)
        → check PROVIDER_LOADERS[name] exists
        → check providers[name].enabled !== false
        → dynamic import provider module
      → check prov.isAvailable()
        → google: providers.google.apiKeys.length > 0
        → deepseek: providers.deepseek.apiKeys.length > 0
        → openrouter: providers.openrouter.apiKeys.length > 0
      → call prov.generateContent(opts)
        → provider uses own key/model rotation internally
      → on retryable error: continue to next provider
      → on non-retryable error: throw immediately
    → all exhausted: throw SERVICE_UNAVAILABLE
```

## Naming: GEMINI_API_KEYS → GOOGLE_API_KEYS

Resolution order in `aiConfig.js:resolveApiKeys()`:

1. `GOOGLE_API_KEYS` (new — preferred)
2. `GEMINI_API_KEYS` (legacy — logs deprecation warning)
3. `GOOGLE_API_KEY` (single key)
4. `GEMINI_API_KEY` (legacy single — logs deprecation warning)

No `.env` file changes needed. Existing `GEMINI_API_KEYS` entries continue working with a deprecation warning.

## Backward Compatibility

| Concern | Status |
|---------|--------|
| `GEMINI_API_KEYS` env var | Supported via legacy fallback, deprecation warning logged |
| `GEMINI_API_KEY` env var | Supported via legacy fallback, deprecation warning logged |
| `CHAT_PROVIDER=auto` with `CHAT_PROVIDER_ORDER` | Works — providers resolve independently |
| `CHAT_PROVIDER=google` (single provider mode) | Works |
| `chat.providerOrder` on config | Preserved — moved to `chat.providerOrder[]` |
| `vision` config shape | Preserved — `{ provider }` |
| `embedding` config shape | Preserved — `{ provider, models }` |
| `providerFactory.getProviderConfig()` | Updated — models derived from provider configs |
| `vector`, `memory`, `context` configs | Unchanged |
| `isAvailable()` API on chatProvider facade | Unchanged — always returns `true` |

## Modified Files

| File | Change |
|------|--------|
| `src/config/aiConfig.js` | **Refactored** — new `providers` object per provider, `chat`/`vision`/`embedding` simplified, backward compat for legacy env vars |
| `src/ai/providers/chat/chatProvider.js` | **Refactored** — no env parsing, reads `providers[name].enabled`, uses `resolveOrder()` abstraction |
| `src/ai/providers/chat/googleChatProvider.js` | **Fixed** — reads from `providers.google` instead of `cfg` (chat) |
| `src/ai/providers/chat/deepseekChatProvider.js` | **Fixed** — static import, reads from `providers.deepseek`, removed `parseKeys()` and top-level await |
| `src/ai/providers/chat/openrouterChatProvider.js` | **Fixed** — static import, reads from `providers.openrouter`, removed `parseList()` and top-level await |
| `src/ai/providers/vision/googleVisionProvider.js` | **Fixed** — reads from `providers.google` instead of `cfg` (vision) |
| `src/ai/providers/embedding/geminiEmbeddingProvider.js` | **Fixed** — reads keys from `providers.google`, reads models from `embedding.models` |
| `src/ai/factory/providerFactory.js` | **Updated** — model fields derived from `providers` tree |

### Unchanged Files

- `src/ai/providers/vision/visionProvider.js` — facade still reads `vision.provider` (unchanged shape)
- `src/ai/providers/embedding/embeddingProvider.js` — facade still reads `embedding.provider` (unchanged shape)
- `src/ai/providers/chat/openaiFormat.js`
- `src/ai/providers/vector/*.js`
- `src/ai/memory/*.js`
- `src/ai/context/*.js`
- `src/ai/assistant/*.js`
- `src/ai/tools/*.js`
- `src/routes/aiRoutes.js`
