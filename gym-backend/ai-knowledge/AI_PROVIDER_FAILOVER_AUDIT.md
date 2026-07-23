# AI Provider Failover — Implementation Audit

## Check 1: No API key / ENABLED=false — Skip or Error?

**Answer:** SKIP (for missing loader or missing key). ENABLED flag NOT enforced.

### Code path (chatProvider.js:40-43)
```js
const prov = await getProvider(name)
if (!prov || !prov.isAvailable || !prov.isAvailable()) {
    console.warn(`[AI failover] ${name}: not available, skipping`)
    continue
}
```

### getProvider (chatProvider.js:16-21)
```js
async function getProvider(name) {
    const load = PROVIDER_LOADERS[name]
    if (!load) return null    // ← returns null for unregistered providers
    ...
}
```

### isAvailable (googleChatProvider.js:29-31)
```js
export function isAvailable() {
    return API_KEYS.length > 0 && !!API_KEYS[keyIdx]
}
```

**Key finding:** `PROVIDER_LOADERS` (chatProvider.js:3-5) only contains `google`. Any other provider name returns `null` from `getProvider()`, triggering the skip path.

**Finding:** `ENABLED` flag from aiConfig.js (line 46) is exported as `cfg.enabled` but never read by chatProvider.js or googleChatProvider.js. Setting `GOOGLE_ENABLED=false` has no runtime effect — whether a provider is used depends solely on whether it has API keys and a registered loader.

**Result: PASS** (skips missing providers, with caveat below)

---

## Check 2: PROVIDER_EXHAUSTED → switch provider?

**Answer:** YES.

### googleChatProvider.js:52
```js
throw Object.assign(new Error('PROVIDER_EXHAUSTED'), { code: 'PROVIDER_EXHAUSTED' })
```

### chatProvider.js:7-11 (isRetryable)
```js
function isRetryable(err) {
    return err?.code === 'PROVIDER_EXHAUSTED'    // ← catches this
        || err?.status === 429 || ...
}
```

### chatProvider.js:47-50 (failover catch)
```js
} catch (err) {
    if (isRetryable(err)) {
        console.warn(`[AI failover] ${name} exhausted → switching to next provider`)
        continue                                   // ← continues to next provider
    }
    throw err
}
```

**Result: PASS**

---

## Check 3: 429 / Timeout / 503 / Network Error → switch provider?

**Answer:** YES — but with a redundancy concern.

### chatProvider.js:7-12 (isRetryable)
```js
function isRetryable(err) {
    return err?.code === 'PROVIDER_EXHAUSTED'
        || err?.status === 429 || err?.status === 502 || err?.status === 503 || err?.status === 504
        || /PROVIDER_EXHAUSTED|timeout|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|temporary/i.test(msg)
}
```

### Execution path for 429:
1. `googleChatProvider.generateContent()` called
2. Inner `callWithRotation` catches 429 → rotates keys/models (googleChatProvider.js:44-48)
3. All keys/models exhausted → throws `PROVIDER_EXHAUSTED` (line 52)
4. `isRetryable` catches `PROVIDER_EXHAUSTED` → `continue` to next provider

**429 handled twice:** provider rotates internally first, then facade switches providers. This is correct — the provider tries all internal options before the facade escalates.

### Execution path for 503:
1. `googleChatProvider.generateContent()` called
2. Gemini SDK returns 503 error
3. Inner `isRateLimited` returns `false` (503 ≠ 429) → error thrown directly
4. `chatProvider.isRetryable` matches `err.status === 503` → `continue` to next

**Note:** This means a single 503 immediately triggers a provider switch without any internal retry. No backoff or retry within the provider.

### Regex false-positive risk:
`isRetryable` uses `timeout` as a regex pattern. A 401 error with message "authentication timeout" would match `/timeout/i` and be retried instead of thrown immediately. This is a latent bug.

**Result: PASS** (with noted concerns)

---

## Check 4: 400 / 401 / 403 / 404 → stop immediately?

**Answer:** YES — thrown directly, no retry, no failover.

### chatProvider.js:47-52
```js
} catch (err) {
    if (isRetryable(err)) {
        // ... retryable path
        continue
    }
    throw err    // ← 400/401/403/404 reach here, thrown to caller
}
```

### isRetryable does NOT include:
- 400, 401, 403, 404 — no status code match
- No regex patterns for "bad request", "unauthorized", "forbidden", "not found"

**Result: PASS**

---

## Check 5: All providers unavailable → what is returned?

### chatProvider.js:55
```js
throw Object.assign(
    new Error('All AI providers are currently unavailable. Please try again later.'),
    { code: 'SERVICE_UNAVAILABLE' }
)
```

### chatProvider.js:100 (generateStream)
```js
throw Object.assign(
    new Error('All AI providers are currently unavailable. Please try again later.'),
    { code: 'SERVICE_UNAVAILABLE' }
)
```

Error propagates to assistant's try/catch, which returns the generic fallback message to the user. The `code: 'SERVICE_UNAVAILABLE'` is available for programmatic handling.

**Result: PASS**

---

## Check 6: Execution path — DeepSeek no key, Google has key, Groq no key, OpenRouter no key

Order: `deepseek,google,groq,openrouter`

### Execution trace:

| Provider | `getProvider()` | `isAvailable()` | Result |
|----------|----------------|-----------------|--------|
| `deepseek` | Returns `null` (not in `PROVIDER_LOADERS`) | N/A | `!prov` → `true` → skip |
| `google` | Returns `googleChatProvider` | `API_KEYS.length > 0` → `true` | Called → **SUCCESS** |
| `groq` | Not reached | — | — |
| `openrouter` | Not reached | — | — |

### Code path for deepseek (chatProvider.js:16-18, 40-43):
```js
// getProvider('deepseek')
const load = PROVIDER_LOADERS['deepseek']  // undefined
if (!load) return null                       // returns null

// back in callWithFailover
const prov = null
if (!prov) { ... continue }                  // skipped
```

**Request succeeds via Google.** The fact that deepseek/groq/openrouter have no implementation loaders means they are silently skipped — they trigger the `!prov` guard, not the `!prov.isAvailable()` guard.

**Result: PASS** (succeeds, but for the wrong reason; see Check 7)

---

## Check 7: Can CHAT_PROVIDER=auto be a safe default?

**Answer: NO** — two issues.

### Issue A: Only Google has a loader (chatProvider.js:3-5)
```js
const PROVIDER_LOADERS = {
    google: () => import('./googleChatProvider.js'),
}
```
All other providers (deepseek, groq, openrouter, openai, claude) have NO loader. `getProvider()` returns `null` for them. They are silently skipped with a `console.warn`.

### Issue B: ENABLED flag not consumed (aiConfig.js:46)
```js
enabled: process.env[`${prefix}_ENABLED`] !== 'false',
```
This config field is exported but **never read** by `chatProvider.js` or `googleChatProvider.js`. The `isAvailable()` check only verifies API key presence, not the `ENABLED` flag. Setting `GOOGLE_ENABLED=false` has no effect.

### Impact:
- `CHAT_PROVIDER=auto` with only `google` in the order: works normally
- `CHAT_PROVIDER=auto` with `google,deepseek`: deepseek silently skipped, only Google used
- `CHAT_PROVIDER=auto` with `deepseek,openrouter`: all providers skipped, **every request fails with `SERVICE_UNAVAILABLE`** even though the configuration looks valid

**Result: FAIL** — cannot be default configuration until provider loaders are implemented for non-Google providers, and `ENABLED` flag is enforced.

---

## Summary

| Check | Result | Detail |
|-------|--------|--------|
| 1. No key → skip | **PASS** | `isAvailable()` returns false → skipped |
| 1. ENABLED=false → skip | **FAIL** | `ENABLED` never read by any code path |
| 2. PROVIDER_EXHAUSTED → switch | **PASS** | `isRetryable` catches `code === 'PROVIDER_EXHAUSTED'` |
| 3. 429 → switch | **PASS** | Internal rotation first, then `PROVIDER_EXHAUSTED` |
| 3. 503 → switch | **PASS** | `err.status === 503` in `isRetryable` |
| 3. Timeout → switch | **PASS** | Regex `/timeout/` in `isRetryable` |
| 4. 400/401/403/404 → stop | **PASS** | Not in `isRetryable`, thrown to caller |
| 5. All exhausted → SERVICE_UNAVAILABLE | **PASS** | `{ code: 'SERVICE_UNAVAILABLE' }` |
| 6. Mixed availability → succeeds | **PASS** | Falls through to first available |
| 7. Safe as default | **FAIL** | Only Google has loader; ENABLED not enforced |

### Recommendations (not applied)

1. Add loaders for all providers listed in `CHAT_PROVIDER_ORDER`
2. Enforce `ENABLED` flag in `getProvider()` by checking `cfg.enabled` before loading
3. Tighten `isRetryable` regex to avoid false-positive matches on non-retryable errors containing words like "timeout"
