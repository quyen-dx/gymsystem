# Epic 3.5 — Discovery Report: Recurring Truncation + Realtime Availability

**Date:** 2026-07-21
**Scope:** AC-3.18 (EC-BKG-004) + AC-3.25 — Membership expiry truncation and real-time slot availability

---

## Coverage: ~40%

| Item | Status |
|---|---|
| Recurring membership check | ❌ Rejects entire series on expiry, should truncate (EC-BKG-004) |
| scheduleWeeklyBooking membership check | ❌ Aborts transaction; should skip uncovered days |
| Realtime availability socket | ❌ No `availability:changed` event exists |

## Existing Assets

`hasActiveMembershipForDate` helper, `socketService.js` infra, `createRecurringBooking`/`scheduleWeeklyBooking` loop structures

---

## Missing Rules

| # | Gap | Severity |
|---|---|---|
| 1 | **EC-BKG-004**: Recurring series truncated on membership expiry instead of fully rejected. Currently `createRecurringBooking` rejects all if last date uncovered; `scheduleWeeklyBooking` aborts transaction. Spec says skip uncovered dates + notify. | **HIGH** |
| 2 | **AC-3.25**: No `availability:changed` socket event on booking create/cancel/promote. UI cannot update slot availability in real time. | **MEDIUM** |

---

## Files to Modify

| File | Change |
|---|---|
| `src/controllers/bookingController.js:createRecurringBooking` | Replace reject-all → skip-uncovered with notification of truncated dates |
| `src/controllers/bookingController.js:scheduleWeeklyBooking` | Replace abort-transaction → skip-uncovered with per-day error collection |
| `src/services/socketService.js` | Add `emitAvailabilityChanged` emitter |
| `src/controllers/bookingController.js:createBooking` | Emit availability change after booking creation |
| `src/controllers/bookingController.js:cancelBooking` | Emit availability change after cancellation (and promotion) |

## Files to Create

None — Option 3 pattern.

## Recommendation: **Option 3 — Patch**

Both gaps are behavioral fixes within existing transaction/loop structures. Truncation is switching error paths from reject→skip. Socket is adding emitter calls after existing create/cancel. No new models or endpoints. 5 lines of socket emit + 20 lines of booking loop changes.
