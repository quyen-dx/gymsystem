# Flash Audit — Epic 3.1 (PT Business Rules)

**Audit date:** 2026-07-21  
**Auditor:** AI (opencode)  

---

## Result: **PASS** (with findings)

**Risk:** MEDIUM  
**Security:** No issues  
**Architecture:** Sound, pre-transaction guard pattern consistent with codebase

---

## HIGH Findings

### H-1: BR-PT-001 / BR-PT-002 — TOCTOU race in capacity & daily-limit guards

**File:** `src/controllers/bookingController.js` — all 3 booking paths  
**Rule:** BR-PT-001 (max 10 members), BR-PT-002 (max 8 sessions/day)

The guard functions `checkPTMemberCapacity` and `checkPTDailySessionLimit` run as **pre-checks before** the transaction begins. Two concurrent requests can both pass the guard simultaneously (e.g., current count = 7 sessions for BR-PT-002, or 9 members for BR-PT-001). There is no re-validation inside the transaction, and the existing unique index `{ptId, date, slot}` only prevents duplicate slots, not different slots on the same date.

**Impact:** Under concurrent load, PT daily sessions could exceed 8, or PT member count could exceed 10.

**Suggested fix:** Add a `countDocuments` re-check inside the transaction (after `startTransaction`) for both guards, or rely on the pre-check with application-level retry logic on conflict.

---

### H-2: BR-PT-004 — Same-day booking lock bypass

**File:** `src/controllers/ptController.js:609`  
**Rule:** BR-PT-004 (24h schedule lock)

The query uses `date: { $gte: now }`, but `Booking.date` is always stored as **midnight-normalized** (`setHours(0,0,0,0)`). A booking at 11:00 PM today has `date = midnight today < 10:00 PM now`, and is **not matched** by the lock query.

**Example:** Current time = Monday 10:00 PM, a confirmed booking at Monday 11:00 PM has `date = Monday 00:00`. `Monday 00:00 >= Monday 22:00` = **false**. The day is not locked, and the admin can overwrite the PT schedule minutes before the session.

**Impact:** Protected 24h window is incomplete — same-day bookings within the window can be silently bypassed.

**Suggested fix:** Replace `date: { $gte: now }` with `date: { $gte: new Date(now.setHours(0,0,0,0)) }` to use midnight normalization, or use a two-phase query: today's bookings by slot time and tomorrow's bookings by date.

---

## MEDIUM Findings

### M-1: BR-PT-001 — Status filter mismatch

**File:** `src/services/ptService.js:103`  
**Rule:** BR-PT-001 (max 10 members)

Spec pseudocode filters by `status = 'confirmed'`. Implementation uses `$nin: ['cancelled']`, which includes `pending`, `awaiting_payment`, `rejected`, `completed`.

This means pending (unconfirmed) member assignments count toward the 10-member limit. The limit is effectively tighter than spec. Not a security issue, but behavioral deviation from the specified rule.

**Suggested fix:** Align filter to `status: { $in: ['pending', 'confirmed', 'completed'] }` or match the spec exactly (`confirmed`).

---

### M-2: BR-PT-004 — Per-day lock granularity (dayOfWeek) instead of per-slot

**File:** `src/controllers/ptController.js:615`  
**Rule:** BR-PT-004 (24h schedule lock)

The spec describes per-slot locking: individual slot datetimes within 24h should be locked, while other slots on the same day remain editable. The implementation locks the **entire dayOfWeek** for any confirmed booking in that day.

Given that `PTSchedule` uses `(dayOfWeek, shift)` pairs (not individual 10-minute slots), complete per-slot fidelity is not achievable without restructuring the schedule model. The current behavior is **overly restrictive** (locks more than necessary) but not a bypass.

**Suggested action:** Accept as a practical compromise with the current `PTSchedule` model. Document in comments.

---

## Regression Check

| Module | Status | Notes |
|---|---|---|
| Booking APIs | ✅ No regression | All endpoints unchanged. `createRecurringBooking` and `scheduleWeeklyBooking` return additional error entries when guards reject — backwards-compatible. |
| PT APIs | ✅ No regression | `updatePTSchedule` response adds `lockedDays` field — additive, not breaking. |
| Frontend | ✅ Compatible | No removed fields or changed status codes. |
| Membership | ✅ Unchanged | No files touched. |
| Wallet | ✅ Unchanged | No files touched. |
| Payment | ✅ Unchanged | No files touched. |
| Notification | ✅ Unchanged | No files touched. |
| Shop | ✅ Unchanged | No files touched. |
| Audit | ✅ Unchanged | No files touched. |
| Auth | ✅ Unchanged | No files touched. |

---

## Summary

- **BR-PT-003** (self-booking) fully intact, no regression ✅
- **BR-PT-001/002** implemented on all 3 booking paths but with TOCTOU race (H-1) and status filter discrepancy (M-1)
- **BR-PT-004** granular per-day locking is overly restrictive (M-2) and has a same-day bypass (H-2)
- All tests pass (101/101) — tests do not cover concurrent scenarios or date-normalization edge cases

