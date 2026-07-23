# AI Model Rotation 404 Fix Report

## Problem

Google Gemini API returns `404 NOT_FOUND` when a configured model is deprecated. The current `isRateLimited()` function only catches `429`/`RESOURCE_EXHAUSTED`/`quota` errors. A `404` falls through to `throw err`, stopping the request entirely — no rotation, no failover.

## Root Cause

`googleChatProvider.js:10-13` — `isRateLimited()` did not detect `404` as a retryable condition:

```js
function isRateLimited(err) {
  const msg = err?.message || ''
  return err?.status === 429 || err?.code === 429 || /RESOURCE_EXHAUSTED|quota|rate.?\s*limit/i.test(msg)
  // 404 NOT caught → falls through → throw err → request stops
}
```

## Fix

Three changes in `googleChatProvider.js`:

### 1. New `isModelNotFound()` — detects deprecated/removed models

```js
function isModelNotFound(err) {
  const status = err?.status || err?.code
  const msg = err?.message || ''
  return status === 404 || /not.?found|model.*(retired|deprecated|removed)/i.test(msg)
}
```

### 2. Expanded `isRetryable()` — replaces `isRateLimited()` with broader detection

| Status | Action |
|--------|--------|
| `400`, `401`, `403` | **Do NOT retry** — throw immediately |
| `404` | Rotate to next model (via `isModelNotFound`) |
| `429` | Rotate key, then model |
| `500`–`599` | Rotate key, then model |
| timeout/network/ECONNREFUSED | Rotate key, then model |

### 3. New `rotateModel()` — skips to next model directly

```js
function rotateModel() {
  keyIdx = 0    // reset key index
  modelIdx++    // skip to next model
}
```

On `404`, the model is gone — testing remaining API keys against it is pointless. `rotateModel()` skips directly to the next model. On `429`/`5xx`/timeout, the model may be fine but the key is exhausted — `rotate()` tries the next key first.

## Error Flow

### Model Deprecated (404)

```
Model A → 404 → rotateModel() → Model B → 404 → rotateModel() → Model C → Success
                                                                          ↓
All models fail → PROVIDER_EXHAUSTED → chatProvider.js catches → next provider
```

### Rate Limit (429)

```
Model A, Key 1 → 429 → rotate() → Model A, Key 2 → 429 → rotate()
→ Model A, Key 3 → 429 → rotate() → Model B, Key 1 → Success
```

### Server Error (5xx)

```
Model A, Key 1 → 503 → rotate() → Model A, Key 2 → Success
```

### Client Error (400/401/403)

```
Model A → 400 → throw immediately → chatProvider: non-retryable → throw to caller
```

## Failover Chain (unchanged)

`chatProvider.js` already catches `PROVIDER_EXHAUSTED` via `isRetryable()`. When all Google models are exhausted:

```
[AI failover] google exhausted → switching to next provider
 → try deepseek → exhausted / unavailable
 → try openrouter → success
```

## Modified Files

| File | Change |
|------|--------|
| `src/ai/providers/chat/googleChatProvider.js` | Replaced `isRateLimited()` with `isModelNotFound()` + `isRetryable()`. Added `rotateModel()`. Updated `callWithRotation()` and `generateStream()` error handlers |

No other files modified — `chatProvider.js` failover logic already handles `PROVIDER_EXHAUSTED`.
