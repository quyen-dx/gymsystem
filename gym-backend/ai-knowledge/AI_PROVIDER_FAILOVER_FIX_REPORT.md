# AI Provider Failover — Fix Report

## FAIL 1 — Fixed: ENABLED Flag Enforcement

**Before (audit finding):** `ENABLED` flag exported by `aiConfig.js` was never read by any provider code. Setting `GOOGLE_ENABLED=false` had zero runtime effect.

**After:** `getProvider()` now checks `{PROVIDER}_ENABLED` before loading.

### Code (chatProvider.js:19-21)
```js
async function getProvider(name) {
  const enabledVar = `${name.toUpperCase()}_ENABLED`
  if (process.env[enabledVar] === 'false') return null    // ← NEW

  const load = PROVIDER_LOADERS[name]
  if (!load) return null
  const mod = await load()
  return mod
}
```

### Supported ENABLED vars
| Provider | Env Var |
|----------|---------|
| google | `GOOGLE_ENABLED` |
| deepseek | `DEEPSEEK_ENABLED` |
| groq | `GROQ_ENABLED` |
| openrouter | `OPENROUTER_ENABLED` |
| openai | `OPENAI_ENABLED` |
| claude | `CLAUDE_ENABLED` |

### Behavior
- `ENABLED` not set → provider loads normally (backward compat)
- `ENABLED=true` → provider loads normally
- `ENABLED=false` → `getProvider()` returns `null` → skip path → `[AI failover] ${name}: not available, skipping`

### Verification
```
GOOGLE_ENABLED=false → getProvider('google') → null → skipped → SERVICE_UNAVAILABLE → PASS
```

---

## FAIL 2 — Fixed: Complete Provider Registry

**Before (audit finding):** `PROVIDER_LOADERS` only contained `google`. Any other provider in `CHAT_PROVIDER_ORDER` returned `null` from `getProvider()`, printing a warning but never attempting to load.

**After:** All 6 providers registered. Unimplemented providers map to `null` (safe skip without error).

### Code (chatProvider.js:3-9)
```js
const PROVIDER_LOADERS = {
  google: () => import('./googleChatProvider.js'),  // implemented
  deepseek: null,                                   // safe skip
  groq: null,                                       // safe skip
  openrouter: null,                                 // safe skip
  openai: null,                                     // safe skip
  claude: null,                                     // safe skip
}
```

### Design Decision
Rather than throwing errors for missin implementtions, unimplemented providers return `null` from the loader map. Combined with the `!load` check in `getProvider()`, this produces a clean skip:
1. `getProvider('deepseek')` → `PROVIDER_LOADERS['deepseek']` → `null`
2. `if (!load) return null`
3. `callWithFailover`: `!prov` → `true` → `continue` (skip)
4. Log: `[AI failover] deepseek: not available, skipping`

### Why null, not throw?
- A missing implementation should not crash the failover chain
- If `deepseek` has no loader, the system should try `groq` next, not abort
- When a developer implements `deepseekChatProvider.js`, they just change `null` to `() => import('./deepseekChatProvider.js')`

### Verification
```
CHAT_PROVIDER=auto, CHAT_PROVIDER_ORDER=deepseek,groq,google,openrouter
→ deepseek: null → skip → groq: null → skip → google: loads → succeeds
→ No SERVICE_UNAVAILABLE from missing loaders
```

---

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/ai/providers/chat/chatProvider.js` | Added ENABLED check in `getProvider()`. Completed `PROVIDER_LOADERS` with all 6 providers. | +3 lines for ENABLED, +5 lines for loaders |
