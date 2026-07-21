# Flash Audit — Epic 3.4 (Waitlist Promotion)

**Date:** 2026-07-21
**Scope:** EC-BKG-008 — Atomic waitlist promotion, ordering, leave waitlist, regression

---

## Result: PASS

| Dimension | Verdict | Notes |
|---|---|---|
| **Risk** | **ACCEPTABLE** | No HIGH findings. 2 MEDIUM — both manageable. |
| **Security** | **SATISFACTORY** | Promotion runs inside existing transaction; all validations re-checked with session isolation. |
| **Architecture** | **SATISFACTORY** | Option-3 patch fits existing patterns. Minimal surface area. |

---

## Findings — MEDIUM

| # | Area | Severity | Detail |
|---|---|---|---|
| M-1 | API contract | **MEDIUM** | `cancelBooking` response field renamed from `notifiedWaitlistMember` (old — raw Waitlist doc) to `promotedBooking` (new — Booking doc or null). Frontend consuming the old field name needs updating. |
| M-2 | Maintainability | **MEDIUM** | No-show block logic (lines 917–931) duplicates the `checkNoShowBlock` helper (lines 89–109). Could diverge if the business rule changes. Refactoring into a shared helper was avoided because the helper sends `res` directly. |

---

## Verification Results

### EC-BKG-008: Atomic Promotion

- **Inside transaction**: All promotion ops (Waitlist query, Booking.create, markBenefitUsed, waitlist status update) share the same `session`. Single `commitTransaction` at line 999. ✅
- **Cancel + promote atomic**: Booking.save (cancel) + promotion ops are in the same session. ✅
- **No orphaned bookings**: `markBenefitUsed` runs BEFORE `Booking.create` (line 970 vs 971). If it throws, no booking is created. If `Booking.create` throws (11000), `createFailed` is set. Only when both succeed is promotion marked. ✅
- **Rollback**: Outer catch at line 1038 calls `session.abortTransaction()`. All session writes undone. ✅
- **Promotion failure does NOT rollback cancel**: `createFailed` path marks waitlist as `expired` but doesn't abort — cancellation commits regardless. ✅

### Waitlist Ordering

- `position` computed as `existingCount + 1` in `joinWaitlist`. ✅
- Promotion queries `sort({ position: 1 })` for FIFO. ✅
- Legacy documents without `status`/`position` handled via `$exists: false` fallback in all queries. ✅

### Validation Re-checks (promoted member)

All inside transaction with `.session(session)`:
- Membership eligibility (`hasActiveMembershipForDate`) ✅
- Self-booking prevention ✅
- No-show block (same logic as `checkNoShowBlock`) ✅
- PT daily session limit ✅
- PT member capacity ✅
- Slot conflict (exact match, both member and PT) ✅
- Time overlap (`slotsOverlap` with same-day sessions) ✅

### Leave Waitlist

- Soft-cancel via `findOneAndUpdate` — sets `status: 'cancelled'`. No delete. ✅
- Matches only waiting + legacy entries. Position/status lifecycle consistent. ✅

### Regression

| Module | Status |
|---|---|
| **Booking APIs** | 13/14 endpoints untouched. `cancelBooking` gains promotion (additive). `joinWaitlist` gains position (additive). ✅ |
| **Membership** | Unchanged ✅ |
| **Wallet** | Unchanged ✅ |
| **Payment** | Unchanged ✅ |
| **Notification** | Promotion notifications follow existing fire-and-forget pattern ✅ |
| **Shop** | Unchanged ✅ |
| **Audit** | Unchanged ✅ |
| **Auth** | Unchanged ✅ |
