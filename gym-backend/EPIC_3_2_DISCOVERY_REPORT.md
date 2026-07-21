# Epic 3.2 — Discovery Report

**Date:** 2026-07-21  
**Scope:** BR-BKG-001 through BR-BKG-007 (Booking rules)  
**Method:** Full codebase inspection against Sprint 3 spec + BUSINESS_RULES.md

---

## Coverage: ~95%

| Rule | Status | Evidence |
|---|---|---|
| BR-BKG-001 | ✅ 30-day window | `checkBookingWindow()` — bookingController |
| BR-BKG-002 | ✅ Active membership | `requireActiveMembershipForDate()` — bookingController |
| BR-BKG-003 | ✅ One per slot | Conflict re-checks + unique partial index on `{ptId, date, slot}` |
| BR-BKG-004 | ✅ Cancel penalty | `cancelBooking()` — 2h free / 50% penalty after |
| BR-BKG-005 | ✅ No-show 3-strike | ViolationLog model + `noShowDetectionJob` + `checkNoShowBlock` |
| BR-BKG-006 | ✅ Confirm/reject | `confirmBooking` + `rejectBooking` + `autoConfirmBookingJob` |
| BR-BKG-007 | ✅ Recurring | `createRecurringBooking` + `scheduleWeeklyBooking` |

---

## Existing Assets (already cover Epic 3.2)

| Category | Count | Key Files |
|---|---|---|
| Models | 3 | Booking.js, Waitlist.js, ViolationLog.js |
| Services | 5 | bookingService.js, ptService.js, ptAssignmentService.js, trainerScheduleService.js, socketService.js |
| Controllers | 6 | bookingController.js (1070 lines, 14 endpoints), ptController.js, scheduleController.js, trainerScheduleController.js, ptAssignmentController.js, ptAssignmentEndController.js |
| Routes | 6 | bookingRoutes.js (14 endpoints), ptRoutes.js, scheduleRoutes.js, trainerScheduleRoutes.js, ptAssignmentRoutes.js, ptAssignmentEndRoutes.js |
| Jobs | 3 | autoConfirmBookingJob.js, noShowDetectionJob.js, paymentTimeoutJob.js |

---

## Missing — Business Rules

| # | Gap | Severity |
|---|---|---|
| 1 | `autoConfirmBookingJob.js` does not send notification when auto-confirming | **MEDIUM** |
| 2 | No socket.io events emitted on booking create/confirm/cancel (Socket.io exists as `socketService.js` but no dedicated namespace) | **MEDIUM** |
| 3 | The `date` field `{ $gte: ninetyDaysAgo, $lt: twoHoursAgo }` in noShowDetectionJob uses midnight-normalized dates — same bug pattern as H-2 in Epic 3.1 | **MEDIUM** |

---

## Missing — Models/Services (Sprint 3 plan vs. actual)

None of these are blocking — the current architecture absorbed their logic into existing files:
- **BookingSlot model** — replaced by Booking's unique partial index
- **BookingRecurringPattern model** — logic in bookingController
- **ScheduleException/ScheduleTemplate models** — deferred, not in BUSINESS_RULES
- **waitlistService.js / violationService.js / recurringService.js** — logic embedded in bookingController

---

## Files to Modify

| File | Change |
|---|---|
| `src/jobs/autoConfirmBookingJob.js` | Add notification on auto-confirm |
| `src/jobs/noShowDetectionJob.js` | Fix date comparison (midnight normalization) |

## Files to Create

| File | Purpose |
|---|---|
| None required | — |

---

## Recommended Approach: **Option 3 — Patch**

Epic 3.2 is already 95% implemented. Two targeted patches close the remaining gaps without new files or architectural changes. No models, services, controllers, or routes need to be created. Matches the Epic 3.1 patch approach.
