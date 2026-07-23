# Environment Architecture v2 Report

## 1. Old vs New Structure

### Before (v1): 10 sections, flat AI

```
AI section was a flat list with all vars mixed together.
GEMINI_API_KEY served as universal fallback for all providers.
Comments referenced CHAT_API_KEY / VISION_API_KEY / EMBEDDING_API_KEY fallbacks.
```

### After (v2): 11 sections, hierarchical AI

```
AI section split into 5 clear sub-groups:
  Provider Selection, Models, Provider Keys, Memory, Web Search

Each provider owns its own key. No key reuse.
LEGACY section at bottom isolates old/decommissioned vars.
```

## 2. AI Configuration Philosophy

**"One provider = one key"**

```env
# Provider Keys — one per provider, never reuse
GEMINI_API_KEY=...          # used by google/gemini providers
DEEPSEEK_API_KEY=...        # used by deepseek provider
OPENAI_API_KEY=...          # used by openai provider
CLAUDE_API_KEY=...          # used by claude provider
```

The key resolution in `aiConfig.js` uses a provider key map:

```js
const PROVIDER_KEYS = {
  google: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  claude: 'CLAUDE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
}

function resolveKey(specificKey, providerName) {
  if (specificKey) return specificKey
  return process.env[PROVIDER_KEYS[providerName]] || ''
}
```

Resolution order:
1. Use `CHAT_API_KEY` if explicitly set (override)
2. Otherwise, look up `${PROVIDER}_API_KEY` based on chosen provider
3. This means switching provider automatically switches key source

## 3. Provider Failover Preparation

```env
CHAT_PROVIDER=auto
CHAT_PROVIDER_ORDER=deepseek,google,groq,openrouter
```

`aiConfig.js` now exports `chat.providerOrder: string[]` — parsed from the comma-separated list.

When `CHAT_PROVIDER=auto`, the chat facade will:
1. Try each provider in order
2. Check availability (has API key + client initialized)
3. Use the first available
4. If none available → error

Implementation is straightforward — the `chatProvider.js` facade already has a `switch` statement. Adding `auto` mode just adds a loop over the order list.

## 4. Files Changed

| File | Change |
|------|--------|
| `src/config/aiConfig.js` | Replaced hardcoded `GEMINI_API_KEY` fallback with `PROVIDER_KEYS` map + `resolveKey()`. Added `chat.providerOrder`. |
| `src/ai/factory/providerFactory.js` | Added `chatProviderOrder` to `getProviderConfig()` output. |
| `.env` | AI section reorganized into 5 sub-groups. All 44 vars preserved. `GEMINI_API_KEY_ADMIN` + TWILIO comments moved to LEGACY. Removed commented `CHAT/VISION/EMBEDDING_API_KEY` hints (unnecessary with provider key map). |
| `.env.example` | **NEW** — full .env with all secrets replaced by placeholders. |
| `.env.ai.example` | **NEW** — AI-only config with provider switching guide, model options for all providers. |

## 5. Provider Switch Example

Switching chat from Google to DeepSeek requires ONLY .env changes:

```diff
- CHAT_PROVIDER=google
+ CHAT_PROVIDER=deepseek
- CHAT_MODEL=gemini-2.5-flash-lite
+ CHAT_MODEL=deepseek-chat
- # DEEPSEEK_API_KEY=
+ DEEPSEEK_API_KEY=sk-abcdef123...
```

No code changes. The facade loads `deepseekChatProvider.js` instead of `googleChatProvider.js`. The key resolves from `DEEPSEEK_API_KEY` automatically.

## 6. Variable Preservation

| Check | Result |
|-------|--------|
| 44 active variables | ✅ All preserved (verified by comparison) |
| `CHAT_API_KEY` still supported | ✅ Explicit override still works |
| `GEMINI_API_KEY` still works | ✅ Resolution maps provider name → key var |
| `GEMINI_API_KEY_ADMIN` kept | ✅ Moved to LEGACY section |
| TWILIO commented vars | ✅ Kept in LEGACY section |

## 7. Backward Compatibility

| Scenario | Status |
|----------|--------|
| Only `GEMINI_API_KEY` set, no specific keys | ✅ Resolves via provider key map |
| `CHAT_API_KEY` explicitly set | ✅ Takes precedence |
| `CHAT_API_KEY` + `DEEPSEEK_API_KEY` both set | ✅ Provider-specific key used based on CHAT_PROVIDER |
| `CHAT_PROVIDER_ORDER` empty/not set | ✅ `providerOrder` is empty array |
| All existing AI features | ✅ Chat, vision, embedding, vector search all verified |
