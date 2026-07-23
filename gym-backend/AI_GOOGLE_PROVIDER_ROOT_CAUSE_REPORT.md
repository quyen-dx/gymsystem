# AI Google Provider Root Cause Report

## Problem

Google provider is always skipped with log: `[AI failover] google: not available, skipping`

## Execution Flow

```
server.js
  → import 'dotenv/config'  (loads .env)
  → import ./src/routes/aiRoutes.js
    → import ../controllers/aiController.js
      → import ../services/aiAssistantService.js
        → import ../ai/assistant/aiAssistantService.js
          → import chatProvider (facade)
          → calls generateContent(opts)
            → callWithFailover('generateContent', opts)
              → for each provider in order:
                → getProvider(name)
                → prov.isAvailable() ← returns FALSE for google
```

## Provider Initialization Flow

### 1. aiConfig.js loads (module init)

```
CHAT_PROVIDER=auto  (from .env line 61)

resolve('CHAT_PROVIDER', 'google', 'gemini-2.5-flash-lite')
  → name = 'auto'                          // because CHAT_PROVIDER=auto, not falsy
  → prefix = PREFIX['auto']                // undefined
  → prefix = 'auto'.toUpperCase()          // 'AUTO'
  → keys = parseList('AUTO_API_KEYS')      // process.env.AUTO_API_KEYS → undefined → ''
  → keys = []                              // EMPTY
  → LEGACY_KEY_NAMES['auto']              // undefined (only maps google/gemini)
  → process.env.AUTO_API_KEY               // undefined
  → process.env.GEMINI_API_KEY             // undefined (only GEMINI_API_KEYS exists)
  → keys remains []                        // EMPTY

chat = {
  provider: 'auto',
  models: ['gemini-2.5-flash-lite'],       // default fallback
  apiKeys: [],                              // EMPTY ← THE PROBLEM
  enabled: true                             // GOOGLE_ENABLED=true, but prefix is 'AUTO'
}
```

### 2. googleChatProvider.js loads (dynamic import)

```js
import { chat as cfg } from '../../../config/aiConfig.js'
const API_KEYS = cfg.apiKeys  // [] ← EMPTY because chat config resolved with 'auto'
```

### 3. isAvailable() check in chatProvider.js

```js
const prov = await getProvider('google')
// GOOGLE_ENABLED !== 'false' → passes, module loads

prov.isAvailable()  // calls googleChatProvider.isAvailable()
  → API_KEYS.length > 0  // 0 > 0 → FALSE
  → returns false

// chatProvider.js:38
if (!prov || !prov.isAvailable || !prov.isAvailable()) {
  // enters here because isAvailable() returned false
  console.warn('[AI failover] google: not available, skipping')
  continue  // SKIPS GOOGLE
}
```

## Resolved Configuration

| Field | Value | Expected | Match? |
|-------|-------|----------|--------|
| `chat.provider` | `'auto'` | — | — |
| `chat.models` | `['gemini-2.5-flash-lite']` | `['gemini-2.5-flash-lite','gemini-2.5-flash']` | No |
| `chat.apiKeys` | `[]` | `['AQ.Ab8RN6KJspw...']` | **No** |
| `chat.enabled` | `true` | `true` | Yes |
| `googleChatProvider.API_KEYS` | `[]` | `['AQ.Ab8RN6KJspw...']` | **No** |

## Root Cause

**`googleChatProvider.js` line 2-5:**

```js
import { chat as cfg } from '../../../config/aiConfig.js'
const API_KEYS = cfg.apiKeys  // ← DEPENDS on chat config
```

The Google provider reads its API keys from the **chat-level config** (`cfg.apiKeys`). When `CHAT_PROVIDER=auto`, the `resolve()` function in `aiConfig.js` does NOT resolve Google's API keys because:

1. The `resolve()` function resolves based on the active `CHAT_PROVIDER` env var (line 20: `process.env[providerVar]`)
2. When `CHAT_PROVIDER=auto`, it tries to resolve keys for `'auto'`, not `'google'`
3. The `LEGACY_KEY_NAMES` map at line 14-17 only has entries for `'google'` and `'gemini'`, not `'auto'`
4. Result: `apiKeys: []` in the chat config
5. `googleChatProvider.js` inherits this empty array → `isAvailable()` returns `false`

**The exact line causing the skip** is `chatProvider.js:38`:

```js
if (!prov || !prov.isAvailable || !prov.isAvailable()) {
```

This evaluates to `true` because `googleChatProvider.isAvailable()` returns `false` (due to empty `API_KEYS`).

**The exact line causing empty API_KEYS** is `googleChatProvider.js:5`:

```js
const API_KEYS = cfg.apiKeys  // cfg.apiKeys === [] when CHAT_PROVIDER=auto
```

## Why OpenRouter works

`openrouterChatProvider.js` (lines 12-17) reads API keys DIRECTLY from env:

```js
const keys = parseList('OPENROUTER_API_KEYS')  // reads env directly, NOT from cfg
```

It does NOT depend on the `chat` config's `apiKeys` — it parses its own env var.

## Affected Files

| File | Issue |
|------|-------|
| `gym-backend/.env` line 61 | `CHAT_PROVIDER=auto` triggers the bug path |
| `gym-backend/src/config/aiConfig.js` lines 19-47 | `resolve()` doesn't produce provider-specific keys when `CHAT_PROVIDER=auto` |
| `gym-backend/src/ai/providers/chat/googleChatProvider.js` line 5 | Reads keys from chat config instead of env directly |
| `gym-backend/src/ai/providers/chat/chatProvider.js` line 38 | Falls through to "not available" log |
| `gym-backend/src/ai/providers/chat/deepseekChatProvider.js` lines 11-13 | Same pattern — reads from chat config (but has env fallback) |

## Minimal Fix

**File: `gym-backend/src/ai/providers/chat/googleChatProvider.js`**

Change from relying on the shared `chat` config to reading API keys and models directly from environment variables, consistent with how `openrouterChatProvider.js` already works:

```js
// BEFORE (lines 1-5):
import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai'
import { chat as cfg } from '../../../config/aiConfig.js'

const MODELS = cfg.models
const API_KEYS = cfg.apiKeys

// AFTER:
import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai'

const MODELS = (process.env.GOOGLE_MODELS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const API_KEYS = (process.env.GEMINI_API_KEYS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
```

This makes `googleChatProvider.js` self-contained like `openrouterChatProvider.js` — it reads its own env vars, independent of what `CHAT_PROVIDER` is set to.

The same fix should be applied to `deepseekChatProvider.js` for consistency, since it also depends on the chat config (though it has an env fallback).
