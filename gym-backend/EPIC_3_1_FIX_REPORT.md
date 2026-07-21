# Epic 3.1 — Fix Report

**Date:** 2026-07-21  
**Audit source:** `FLASH_AUDIT_EPIC_3_1.md` (4 findings: 2 HIGH, 2 MEDIUM)

---

## H-1: TOCTOU race in BR-PT-001/002 guards

**Fix:** Guard functions now accept optional `session` parameter. Pre-checks remain as-is (outside transaction, early bailout). Re-checks with `session` added inside each transaction block — matching the existing conflict re-check pattern.

| Function | File | Change |
|---|---|---|
| `checkPTDailySessionLimit` | `ptService.js:89` | Added `session = null` param; chains `.session(session)` on countDocuments |
| `checkPTMemberCapacity` | `ptService.js:102` | Added `session = null` param; switched from `distinct()` to `aggregate()` (session-compatible); chains `.session(session)` |
| `createBooking` | `bookingController.js:217-228` | Re-checks after `startTransaction`, before Booking.create |
| `createRecurringBooking` | `bookingController.js:358,368` | Re-checks: BR-PT-001 after `startTransaction`, BR-PT-002 per iteration (already inside loop) |
| `scheduleWeeklyBooking` | `bookingController.js:491,507` | Same pattern as createRecurringBooking |

---

## H-2: BR-PT-004 same-day booking lock bypass

**Fix:** `ptController.js:607` — replaced `date: { $gte: now }` with `date: { $gte: midnightNow }` where `midnightNow = new Date(now).setHours(0,0,0,0)`. Same-day bookings whose normalized date is midnight but whose slot is in the future are now correctly matched by the lock query.

---

## M-1: BR-PT-001 status filter mismatch

**Fix:** `ptService.js:107` — changed status filter from `$nin: ['cancelled']` to `status: 'confirmed'`, exactly matching the BUSINESS_RULES.md pseudocode.

---

## M-2: BR-PT-004 per-day vs per-slot lock granularity

**Resolution:** Documented in `ptController.js:626-629`. The `PTSchedule` model stores only `(dayOfWeek, shift)` pairs — no per-slot datetime field exists. Per-slot locking requires a schema change. Current per-day lock is accepted as a practical compromise.

---

## Test Result

```
Test Files  8 passed (8)
     Tests  101 passed (101)
```

## Regression

- Guard function signatures backward-compatible (optional 3rd param with default `null`)
- No API response changes
- No removed or renamed exports
