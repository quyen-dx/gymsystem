# Sprint 3.1 Hotfix Report

## Issue 1 — Switch Gemini model

**Current**: `gemini-2.5-flash`
**New**: `gemini-2.5-flash-lite`

**Root cause**: Hardcoded default on line 20 of `aiAssistantService.js`.

**Fix**: Changed `'gemini-2.5-flash'` to `'gemini-2.5-flash-lite'`. The `process.env.GEMINI_MODEL` override is preserved — if the env var is set, it takes priority; otherwise the new default applies.

**File**: `src/services/aiAssistantService.js:20`

---

## Issue 2 — Membership status misinterpretation

### Root cause
`getMembershipInfo` returns `currentMembership.status` always hardcoded as `'ACTIVE'` regardless of the actual MembershipCycle status. The only signal Gemini had was `hasActiveMembership: true/false`. When `hasActiveMembership: false`, Gemini had no way to distinguish:
- **PENDING** (pending_initial_activation — waiting for first check-in)
- **EXPIRED** (duration ended)
- **CANCELLED** (membership cancelled)
- **NONE** (never had membership)

Gemini would see `hasActiveMembership: false`, check dates or remainingDays, and incorrectly guess "đã hết hạn" even when the true status was PENDING.

### Fix applied

**Backend** (`aiAssistantService.js`):
1. Added `getMyMembership` to imports from `membershipService.js`
2. Added `determineStatus(info, myMembership)` function that computes the correct business status from the actual MembershipCycle status:
   - `pending_initial_activation` → **PENDING**
   - `active` + no pending renewals → **ACTIVE**
   - `active` + pending renewals → **RENEWING**
   - `pending_renewal_activation` → **PENDING**
   - No cycle + `cancelRequests` → **CANCELLED**
   - No cycle + `completedMemberships` → **EXPIRED**
   - No cycle, no history → **NONE**
3. Both `membership_status` and `membership_expiry` intents now return `statusType` in the response data.

**Prompt** (`system-prompt-vi.md`):
1. Added explicit `statusType` documentation for each status with the exact response text Gemini must use.
2. Added strict instruction: `CHỈ DỰA VÀO statusType để xác định trạng thái. KHÔNG tự suy luận từ ngày tháng.`
3. Added negative instruction: `KHÔNG BAO GIỜ nói "hết hạn" cho trạng thái PENDING.`
4. Removed the generic `NO_ACTIVE_MEMBERSHIP` error text since status-specific handling replaces it.

### Business status mapping

| Cycle Status | Pending Renewals? | Business Status | Gemini Output |
|---|---|---|---|
| `active` | No | ACTIVE | "đang hoạt động bình thường" |
| `active` | Yes | RENEWING | "gia hạn đã được đăng ký" |
| `pending_initial_activation` | — | PENDING | "chưa được kích hoạt" |
| `pending_renewal_activation` | — | PENDING | "chưa được kích hoạt" |
| No cycle + cancelRequests | — | CANCELLED | "đã được hủy" |
| No cycle + completed | — | EXPIRED | "đã hết hạn" |
| No cycle, no history | — | NONE | "chưa có gói tập" |

### Verification results

**Status logic tests (8/8 passed)**:
- PENDING from `pending_initial_activation` ✅
- ACTIVE from `active` + no renewals ✅
- RENEWING from `active` + renewals ✅
- RENEWING from `active` + `pendingCycles` ✅
- CANCELLED from `cancelRequests` ✅
- EXPIRED from `completedMemberships` ✅
- NONE from no data ✅
- PENDING from `pending_renewal_activation` ✅

**System prompt tests (15/15 passed)**:
- All 6 status types mentioned ✅
- `statusType` mentioned ✅
- Each status has correct response template ✅
- Strict no-inference instruction present ✅
- `NO_ACTIVE_MEMBERSHIP` removed ✅

**Module integrity (3/3 passed)**:
- `process()` exported ✅
- Model defaults to `gemini-2.5-flash-lite` ✅
- Env override preserved ✅

**Real DB (4/4 passed)**:
- `getMembershipInfo` returns correct data for fake user ✅
- `getMyMembership` returns `cycle: null` for fake user ✅
- All arrays present and valid ✅

**Total: 30/30 tests passed**
