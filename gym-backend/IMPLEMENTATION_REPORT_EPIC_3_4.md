# Epic 3.4 — Implementation Report

**Date:** 2026-07-21
**Approach:** Option 3 — Patch (4 files modified, 0 created)

---

## Files Modified

| File | Change |
|---|---|
| `src/models/Waitlist.js` | +2 fields: `position` (Number, required), `status` (enum: waiting/promoted/expired/cancelled, default 'waiting') |
| `src/controllers/bookingController.js:joinWaitlist` | Auto-compute `position = existingCount + 1` (counts waiting + legacy docs) |
| `src/controllers/bookingController.js:cancelBooking` | Replaced notify-only block with atomic promotion: validates promoted member (membership, no-show, PT limits, slot conflict, overlap), creates Booking + marks waitlist promoted, all inside existing transaction |
| `src/controllers/bookingController.js` | +`leaveWaitlist` — soft-cancels entry via `findOneAndUpdate` |
| `src/routes/bookingRoutes.js` | +`DELETE /:slotId/waitlist` route, `leaveWaitlist` import |

---

## Business Rules Implemented

| Rule | Enforcement |
|---|---|
| **EC-BKG-008**: Cancel + promote atomic | Promotion creates Booking in same MongoDB transaction as cancellation. Slot conflict and overlap are re-checked inside transaction. Unique partial index guards final write |
| **AC-3.15**: First waitlisted member atomically promoted | Queries waitlist by `position: 1` ASC, validates eligibility (membership, no-show block, PT limits, conflicts), creates pending booking, marks promoted. Sends notifications + socket events |

## Gaps Fixed

| Gap | Fix |
|---|---|
| Waitlist notify-only (no auto-book) | Full booking creation for promoted member |
| No `position` field | Added `position` computed on join |
| No `status` lifecycle | Added `status` enum with 4 states |
| No leave waitlist | `DELETE` endpoint with soft-cancel |
| Legacy docs (missing status/position) | `$exists: false` fallback in all queries |

## Test Results

```
Test Files  8 passed (8)
     Tests  101 passed (101)
```
