# Epic 3.1 — Implementation Report

**Date:** 2026-07-21  
**Approach:** Option 3 — Patch (extract guards + add missing checks)

---

## Files Modified

| File | Lines Changed | What |
|---|---|---|
| `src/services/ptService.js` | +30 | Added `checkPTDailySessionLimit()` (BR-PT-002) and `checkPTMemberCapacity()` (BR-PT-001); added Booking import |
| `src/controllers/bookingController.js` | +25, -15 | Replaced inline BR-PT-001/002 in `createBooking` with extracted functions; added same guards to `createRecurringBooking` and `scheduleWeeklyBooking` |
| `src/controllers/ptController.js` | +20, -10 | Replaced blanket 24h block with granular per-dayOfWeek locking in `updatePTSchedule` |

---

## Business Rules Implemented

| Rule | Status | Enforcement |
|---|---|---|
| **BR-PT-001** | ✅ Full | Max 10 distinct members with non-cancelled bookings in 30 days. Existing member excluded. Enforced in all 3 booking creation paths. |
| **BR-PT-002** | ✅ Full | Max 8 sessions per PT per calendar day (excl. cancelled/rejected). Enforced per-date in all 3 booking creation paths. |
| **BR-PT-003** | Already shipped | `checkSelfBooking` in Epic 2.8. Unchanged. |
| **BR-PT-004** | ✅ Improved | Granular per-dayOfWeek lock instead of blanket block. Days with confirmed bookings in 24h are preserved; other days freely modifiable. PT notified of locked days. |

---

## Test Results

```
Test Files  8 passed (8)
     Tests  101 passed (101)
Duration  1.98s
```

