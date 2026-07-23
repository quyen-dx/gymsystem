# Sprint 3.2 Hotfix Report

## Fix 1 — System prompt: handle all `databaseQuery` errors

**Root cause**: The system prompt only instructed Gemini how to handle `UNSUPPORTED_INTENT`. When `databaseQuery` returned `{ error: 'INTERNAL_ERROR' }` (e.g., DB timeout), Gemini had no instruction for this case — sometimes returning empty content (no `parts`), triggering the generic fallback.

**Fix**: Added a dedicated error handling section to the system prompt (`system-prompt-vi.md:21-28`):

```
XỬ LÝ LỖI:
Khi kết quả từ databaseQuery chứa trường error, hãy xử lý như sau:
- UNSUPPORTED_INTENT: "Tôi chưa thể hỗ trợ câu hỏi này."
- INTERNAL_ERROR: "Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu GymPro của bạn. Vui lòng thử lại sau ít phút."
- NO_DATA: "Hiện tại không có dữ liệu cho yêu cầu này."
- NO_ACTIVE_MEMBERSHIP: "Bạn chưa có gói tập nào đang hoạt động."

KHÔNG BAO GIỜ trả về phản hồi trống. Luôn trả lời bằng tiếng Việt thân thiện.
```

**Supported errors covered**:

| Error | Prompt response |
|---|---|
| `UNSUPPORTED_INTENT` | "Tôi chưa thể hỗ trợ câu hỏi này." |
| `INTERNAL_ERROR` | "Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu GymPro của bạn. Vui lòng thử lại sau ít phút." |
| `NO_DATA` | "Hiện tại không có dữ liệu cho yêu cầu này." |
| `NO_ACTIVE_MEMBERSHIP` | "Bạn chưa có gói tập nào đang hoạt động." |

The final instruction `KHÔNG BAO GIỜ trả về phản hồi trống` acts as a safety net for any edge case not explicitly listed.

**File**: `ai-knowledge/prompts/system-prompt-vi.md:21-28`

---

## Fix 2 — Backend safety: no more greeting fallback on data errors

### Root cause

When the second Gemini call (after function response) returned empty content, the code fell back to:
```
"Xin chào, tôi là Trợ lý GymPro. Tôi có thể giúp gì cho bạn?"
```
This is the **same greeting** returned for "Xin chào" — making data errors indistinguishable from a greeting, and confusing users who asked about their data.

### Changes

**1. `databaseQuery` — DB readyState guard** (`aiAssistantService.js:91-93`):
```js
if (mongoose.connection.readyState !== 1) {
  return { error: 'INTERNAL_ERROR' }
}
```
Immediately returns `INTERNAL_ERROR` if MongoDB is not connected, instead of waiting for a 10-second Mongoose buffer timeout.

**2. `wallet_balance` — return `NO_DATA` for null wallet** (`aiAssistantService.js:99`):
```js
if (!wallet) return { error: 'NO_DATA' }
return { balance: wallet.balance }
```
Previously returned `{ balance: 0 }` even when no wallet existed, which was misleading.

**3. Second-turn fallback text** (`aiAssistantService.js:207`):
```js
return text || 'Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu của bạn. Vui lòng thử lại sau.'
```
When Gemini returns empty content after a function call, the error is clear: DB unavailable, not a greeting.

**4. First-turn fallback preserved** (`aiAssistantService.js:211`):
```js
return text || 'Xin chào, tôi là Trợ lý GymPro. Tôi có thể giúp gì cho bạn?'
```
This fallback is only reached for non-function-call responses (e.g., greeting "Xin chào" with no text) — correct behavior.

**5. Debug logs removed**: All `[AI DEBUG]` lines cleaned up.

**File**: `src/services/aiAssistantService.js`

### Fallback decision matrix

| Scenario | Gemini first call | Gemini second call | Result |
|---|---|---|---|
| Greeting request | Returns text (no function call) | N/A | Greeting response |
| Data request, DB connected | Returns `functionCall` | Returns text with real data | Real data response |
| Data request, DB disconnected | Returns `functionCall` | Returns text (from prompt INTERNAL_ERROR rule) | "Xin lỗi, hiện tại tôi chưa thể truy cập..." |
| Data request, Gemini empty second call (edge case) | Returns `functionCall` | Empty content | "Xin lỗi, hiện tại tôi chưa thể truy cập..." (code fallback) |
| Rate limited (429) | API throws | N/A | "Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau." (catch block) |

---

## Fix 3 — MongoDB connection order

### Root cause

In `server.js`, `httpServer.listen()` was called at line 192 **before** `connectDB()` at line 196. The server could accept requests while MongoDB was still connecting — Mongoose queries would buffer for 10 seconds, then time out with `INTERNAL_ERROR`.

### Change

Moved `httpServer.listen()` into `connectDB().then()`:

**Before** (`server.js:192-199`):
```js
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

connectDB()
  .catch((error) => {
    console.error('Kết nối MongoDB thất bại:', error.message)
  })
```

**After** (`server.js:192-201`):
```js
connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Kết nối MongoDB thất bại:', error.message)
    process.exit(1)
  })
```

Now the HTTP server only starts listening **after** `connectDB()` resolves. If connection fails, the process exits with code 1 instead of running with a dead DB.

**File**: `server.js:192-201`

---

## Verification

### Test 1 — Greeting
```
Q: Xin chào
A: Chào bạn, tôi có thể giúp gì cho bạn hôm nay? 😊
```
✅ Returns greeting, not DB error.

### Test 2 — DB readyState guard
```
DB readyState: 0 (disconnected, expected in test env)
databaseQuery returns: { error: INTERNAL_ERROR }
```
✅ Mongoose connection state checked before queries — fast failure, no 10s timeout.

### Test 3 — Startup ordering
```
connectDB line: 192
listen line: 194
Order correct: true
```
✅ `connectDB()` called before `httpServer.listen()`.

### Test 4 — Error code coverage
| Error code | Returned where | Prompt instruction |
|---|---|---|
| `UNSUPPORTED_INTENT` | `databaseQuery` default case | "Tôi chưa thể hỗ trợ câu hỏi này." |
| `INTERNAL_ERROR` | `databaseQuery` catch block + readyState guard | "Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu GymPro của bạn. Vui lòng thử lại sau ít phút." |
| `NO_DATA` | `wallet_balance` when wallet is null | "Hiện tại không có dữ liệu cho yêu cầu này." |
| `NO_ACTIVE_MEMBERSHIP` | `membership_expiry` when no active membership | "Bạn chưa có gói tập nào đang hoạt động." |

### Test 5 — Fallback safety
```
Empty second response → "Xin lỗi, hiện tại tôi chưa thể truy cập dữ liệu của bạn. Vui lòng thử lại sau."
Greeting fallback → "Xin chào, tôi là Trợ lý GymPro. Tôi có thể giúp gì cho bạn?"
```
✅ Two distinct fallback messages for two distinct scenarios.

---

## Files changed

| File | Changes |
|---|---|
| `ai-knowledge/prompts/system-prompt-vi.md` | Added XỬ LÝ LỖI section with 4 error codes + empty-response prohibition |
| `src/services/aiAssistantService.js` | Added `mongoose` import; added `readyState` guard in `databaseQuery`; wallet_balance returns `NO_DATA` on null wallet; changed second-turn fallback text; removed debug logs |
| `server.js` | Moved `httpServer.listen()` inside `connectDB().then()`; added `process.exit(1)` on connection failure |
