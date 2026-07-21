# Epic 3.4 — Discovery Report: Waitlist Promotion

**Date:** 2026-07-21  
**Scope:** Sprint 3 AC-3.15 / EC-BKG-008 — Waitlist atomic promotion on booking cancellation  

---

## Coverage: ~35%

| Item | Status |
|---|---|
| Waitlist model | ✅ No `position` or `status` fields |
| Join waitlist | ✅ |
| Notify on cancel | ✅ Sets `notifiedAt` |
| Atomic promote (cancel → auto-book) | ❌ Only notifies, no booking created |
| Leave waitlist | ❌ No endpoint |

---

## Existing Assets

`Waitlist.js` (28 lines), `cancelBooking` (txn exists), `joinWaitlist`, `bookingRoutes.js` (join only)

---

## Missing Rules

| # | Gap | Severity |
|---|---|---|
| 1 | EC-BKG-008: cancel+promote not atomic; first waitlisted member is notified but must manually re-book | **HIGH** |
| 2 | No `position` field — ordering relies on implicit `createdAt` | **MEDIUM** |
| 3 | No leave waitlist endpoint | **LOW** |

---

## Files to Modify

| File | Change |
|---|---|
| `src/models/Waitlist.js` | +`position` (Number), +`status` enum |
| `src/controllers/bookingController.js:cancelBooking` | Replace notify with atomic promote: validate + create Booking inside existing transaction |
| `src/controllers/bookingController.js:joinWaitlist` | Auto-compute position |
| `src/routes/bookingRoutes.js` | +`DELETE /leave` route |

## Files to Create

None.

## Recommendation: **Option 3 — Patch**

cancelBooking already runs in a transaction. Promotion is a block replacement inside it — validate + create Booking for the waitlisted member, all within the same session. No new models/services/controllers.
