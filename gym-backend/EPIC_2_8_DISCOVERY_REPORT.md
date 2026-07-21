# Epic 2.8 — Discovery Report: Booking & PT Management Business Rules

**Date:** 2026-07-21  
**Scope:** BR-BKG-001 through BR-BKG-007, BR-PT-001 through BR-PT-004  
**Status:** Survey Complete  

---

## 1. Scope Definition

Epic 2.8 is the natural successor to Epics 2.1–2.7. All prior epics covered Sprint 2 (Revenue) rules with excursions into Commerce and Audit. Epic 2.8 targets the **Sprint 3: Scheduling** business rules — **Booking (BR-BKG)** and **PT Management (BR-PT)** — which are the next unimplemented rules in `BUSINESS_RULES.md`.

| Rule | Description | Type |
|---|---|---|
| BR-BKG-001 | Booking window max 30 days ahead | constraint |
| BR-BKG-002 | Member must have active membership to book | constraint |
| BR-BKG-003 | Max 1 booking per slot per PT per time | constraint |
| BR-BKG-004 | Cancellation: free up to 2h before; penalty fee after | calculation/constraint |
| BR-BKG-005 | No-show: 1 violation point; auto-cancel after 3 (rolling 90 days) | workflow/constraint |
| BR-BKG-006 | PT can confirm/reject booking within 1 hour (auto-confirm on timeout) | workflow |
| BR-BKG-007 | Recurring booking: max 4 weeks, same day/time, all occurrences available | constraint |
| BR-PT-001 | Max 10 active member assignments per PT | constraint |
| BR-PT-002 | PT availability by schedule; max 8 sessions/day | constraint |
| BR-PT-003 | PT cannot book themselves | constraint |
| BR-PT-004 | PT can modify own schedule min 24h in advance | constraint |

---

## 2. Existing Assets Survey

### 2.1 Booking — What Already Exists

| Asset | File | Lines | Status |
|---|---|---|---|
| Model | `src/models/Booking.js` | 125 | ✅ Complete — 16 fields, 4 indexes, partial unique index on `{ptId, date, slot, status}` |
| Model | `src/models/Waitlist.js` | 28 | ✅ Complete — `{bookingSlotId, memberId}` unique index |
| Service | `src/services/bookingService.js` | 108 | ✅ Lightweight — `getUpcomingBookings`, `createBookingRequest` |
| Controller | `src/controllers/bookingController.js` | 924 | ✅ Feature-rich — 14 exported handlers |
| Routes | `src/routes/bookingRoutes.js` | 52 | ✅ Complete — 14 endpoints |

**Booking controller already handles:**
- Active membership validation (`hasActiveMembershipForDate`, lines 25-54) — partial BR-BKG-002
- Plan feature check (BOOK_PT_PRIVATE, BOOK_PT_GROUP)
- Double-booking prevention with transactional re-check
- `createRecurringBooking` (weekly recurrence, no week limit)
- `scheduleWeeklyBooking` (custom daysOfWeek)
- `cancelBooking` with `isViolation` flag (within 24h, **not** 2h)
- `joinWaitlist` + auto-notify on cancellation
- `confirmBooking` / `rejectBooking` (manual, no timer)
- `completeBooking` + member rating
- Wallet payment flow (`payBooking`)

### 2.2 PT Management — What Already Exists

| Asset | File | Lines | Status |
|---|---|---|---|
| Model | `src/models/PT.js` | 52 | ✅ Complete — specialties, rating, stats |
| Model | `src/models/PTAssignment.js` | 26 | ✅ Complete — member-PT link with status |
| Model | `src/models/PTSchedule.js` | 27 | ✅ Complete — dayOfWeek + shift |
| Model | `src/models/Specialization.js` | 15 | ✅ Complete — catalog |
| Model | `src/models/TrainingClass.js` | — | ✅ Existing |
| Model | `src/models/TrainingAssignment.js` | — | ✅ Existing |
| Service | `src/services/ptService.js` | 86 | ✅ Lightweight — `getAvailablePTs` |
| Service | `src/services/ptAssignmentService.js` | 801 | ✅ Complex — assignment lifecycle |
| Controller | `src/controllers/ptController.js` | 698 | ✅ Feature-rich — 10 exported handlers |
| Controller | `src/controllers/ptAssignmentController.js` | — | ✅ Existing |
| Controller | `src/controllers/ptAssignmentEndController.js` | — | ✅ Existing |
| Routes | `src/routes/ptRoutes.js` | 37 | ✅ Complete — 12 endpoints |
| Routes | `src/routes/ptAssignmentRoutes.js` | — | ✅ Existing |
| Routes | `src/routes/ptAssignmentEndRoutes.js` | — | ✅ Existing |
| Routes | `src/routes/specializationRoutes.js` | — | ✅ Existing |

**PT controller already handles:**
- PT CRUD (create, update, soft-delete)
- Availability grid (10-min slots from PTSchedule, marked by existing bookings)
- Schedule management (dayOfWeek + shift: morning/afternoon/evening)
- Weekly attendee counts with auto-notification

---

## 3. Business Rule Coverage Analysis

### BR-BKG — Booking Rules

| Rule | Coverage | What Exists | What's Missing |
|---|---|---|---|
| **BR-BKG-001** | 0% | Nothing — no date-range check | 30-day window validation in `createBooking`, `createRecurringBooking`, `scheduleWeeklyBooking` |
| **BR-BKG-002** | ~80% | `hasActiveMembershipForDate` in controller (lines 25-54) checks `active` or `pending_initial_activation` cycles with `expiresAt >= bookingDate` | Trial membership block is NOT explicit. Frozen/cancelled auto-excluded by status filter (correct). |
| **BR-BKG-003** | ~90% | DB-level unique partial index on `{ptId, date, slot}` for `['pending', 'awaiting_payment', 'confirmed']` statuses. Pre-create conflict check in controller lines 70-82. | Transactional race condition protection exists (lines 157-185). Accepted as matching the spec. |
| **BR-BKG-004** | **0%** | `cancelBooking` flags `isViolation` for <24h (line 684) but no penalty fee is charged | 2-hour window validation. Penalty deduction (50% of session price) from wallet. Refund for >2h cancellations (full). |
| **BR-BKG-005** | **0%** | `mark_noshow` permission defined in RBAC but no implementation | Violation log (model). Rolling 90-day count. Auto-cancel future bookings at 3 violations. 30-day booking block. No-show detection logic. |
| **BR-BKG-006** | **0%** | PT manually confirms via `confirmBooking` endpoint | 1-hour auto-confirm timer (cron or setTimeout). PT reject-with-reason flow (exists partially — `rejectBooking` exists). Refund on rejection. |
| **BR-BKG-007** | ~40% | `createRecurringBooking` (line 244) creates N weekly bookings with per-week conflict checks | Max 4-week horizon limit. Same day/time enforcement (already implicitly true — same slot per week). All-occurrence availability check (currently checks each individually). Membership active for entire period check. |

### BR-PT — PT Management Rules

| Rule | Coverage | What Exists | What's Missing |
|---|---|---|---|
| **BR-PT-001** | **0%** | Nothing — no cap on active assignments | Check on assignment creation: count distinct members with confirmed bookings in last 30 days for this PT. Reject if >= 10. |
| **BR-PT-002** | **0%** | Nothing — no daily session cap | Check on booking creation: count confirmed/pending bookings for this PT on this date. Reject if >= 8. Schedule 7-day-ahead requirement (existing PTSchedule already defined — need enforcement on modification). |
| **BR-PT-003** | **0%** | No explicit check | `if (memberId.toString() === ptId.toString())` check in `createBooking` |
| **BR-PT-004** | **0%** | `updatePTSchedule` replaces schedules without 24h guard | 24h lock on slot modification. Affected bookings detection + PT notification. |

---

## 4. Coverage Summary

| Module | Rules | Implemented | Missing | Coverage |
|---|---|---|---|---|
| BR-BKG | 7 | 2 (partial) | 5 (full) + 2 (partial gaps) | **~35%** |
| BR-PT | 4 | 0 | 4 | **~0%** |
| **Total** | **11** | **2 (partial)** | **9 (full)** + **2 (partial)** | **~22%** |

---

## 5. Existing APIs (Bookings)

All 14 endpoints exist and are functional:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bookings/my` | Member's bookings |
| GET | `/api/bookings/pt` | PT's bookings |
| GET | `/api/bookings/conflicts` | Pre-check slot conflicts |
| POST | `/api/bookings` | Create single booking |
| POST | `/api/bookings/recurring` | Create recurring booking |
| POST | `/api/bookings/schedule-weekly` | Bulk weekly booking |
| PATCH | `/api/bookings/:id/confirm` | PT confirms |
| PATCH | `/api/bookings/:id/reject` | PT rejects |
| PATCH | `/api/bookings/pt/reject-all` | PT bulk reject |
| PATCH | `/api/bookings/:id/cancel` | Member cancels |
| PATCH | `/api/bookings/:id/complete` | PT marks complete |
| POST | `/api/bookings/:id/pay` | Member pays via wallet |
| POST | `/api/bookings/:slotId/waitlist` | Join waitlist |
| POST | `/api/bookings/:id/review` | Rate PT |

## 6. Existing APIs (PTs)

All 12 endpoints exist and are functional:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pts/available` | List available PTs |
| GET | `/api/pts/available/:id` | Single PT detail |
| GET | `/api/pts/my-classes` | PT's training classes |
| GET | `/api/pts/my-week-attendees` | Weekly attendee stats |
| GET | `/api/pts/:id/availability` | 10-min slot grid |
| GET | `/api/pts/` | Admin list PTs |
| GET | `/api/pts/schedule/:id` | Admin view schedule |
| GET | `/api/pts/:id` | Admin view PT |
| POST | `/api/pts/` | Admin create PT |
| PATCH | `/api/pts/:id` | Admin update PT |
| PATCH | `/api/pts/:id/schedule` | Admin update schedule |
| DELETE | `/api/pts/:id` | Admin soft-delete PT |

---

## 7. Recommendation: **Option 3 — Patch Existing Services**

### Rationale

1. **Infrastructure is complete.** Booking and PT models, controllers, routes, and services already exist and are fully functional. 101/101 tests pass. All endpoints work.

2. **Business rules are enforcement-only.** Each BR-BKG/BR-PT rule is a guard condition — a check that either passes (allows the existing flow) or rejects (throws an error). No new data models are required (except BR-BKG-005 violation log).

3. **Option 1 (missing only)** is almost identical to Option 3 since the gaps are all enforcement gaps.

4. **Option 2 (full rewrite)** is wasteful — 924-line booking controller, 698-line PT controller, and 801-line assignment service would need to be rewritten for no benefit.

### What "Patch" Means

| File | Action | Rules |
|---|---|---|
| `src/controllers/bookingController.js` | Add guard checks to `createBooking`, `createRecurringBooking`, `cancelBooking` | BR-BKG-001, BR-BKG-004, BR-BKG-007 |
| `src/controllers/bookingController.js` | Add no-show detection in daily job or after session time | BR-BKG-005 |
| `src/controllers/ptController.js` | Add guard checks to `updatePTSchedule` | BR-PT-004 |
| `src/controllers/bookingController.js` | Add guard checks to `createBooking` | BR-PT-001, BR-PT-002, BR-PT-003 |
| `src/controllers/ptAssignmentController.js` | Add guard to assignment creation | BR-PT-001 |
| **New:** `src/models/ViolationLog.js` | Track no-show events with memberId, bookingId, timestamp | BR-BKG-005 |
| **New:** `src/jobs/autoConfirmBooking.js` | 1-hour timer for PT confirmation using existing MongoDB or setTimeout | BR-BKG-006 |
| **New:** `src/jobs/noShowDetectionJob.js` | Detect bookings past session time without check-in/complete | BR-BKG-005 |

### Files NOT Modified

| Module | Status |
|---|---|
| Wallet | Unchanged — penalty deduction reuses existing `walletService` |
| Payment | Unchanged |
| Membership | Unchanged — `hasActiveMembershipForDate` already used |
| Notification | Unchanged — existing `createNotification` used for violation alerts |
| Auth | Unchanged |
| Shop | Unchanged |
| Order | Unchanged |
| All existing API contracts | Unchanged — only guard additions, no endpoint signature changes |
| All existing models (except new ViolationLog) | Unchanged |

---

## 8. Confidence Level: **HIGH**

All 11 business rules map directly to specific, well-defined insertion points in existing code. The existing infrastructure fully supports all required enforcement. No architectural changes needed. Estimated effort: patching ~6 existing files + creating ~3 new files.

---

## 9. Business Rule to File Mapping

| Rule | Insertion Point | Existing Code Reference |
|---|---|---|
| BR-BKG-001 | `createBooking` (L102), `createRecurringBooking` (L244), `scheduleWeeklyBooking` (L360) | `diffDays > 30` check before any DB write |
| BR-BKG-002 | Already covered (~80%) | `hasActiveMembershipForDate` L25-54 |
| BR-BKG-003 | Already covered (~90%) | Partial unique index + transactional re-check |
| BR-BKG-004 | `cancelBooking` (L659) | Replace `isViolation` with penalty deduction logic |
| BR-BKG-005 | New job + new model | Scheduled after each session time passes |
| BR-BKG-006 | New job | Cron/interval checking `status: 'pending', createdAt < 1h ago` |
| BR-BKG-007 | `createRecurringBooking` (L244) | Add `weeks > 4` and all-occurrence check |
| BR-PT-001 | `createBooking` (L102), `ptAssignmentController` | `countDocuments` before booking/assignment |
| BR-PT-002 | `createBooking` (L102) | `countDocuments` before booking |
| BR-PT-003 | `createBooking` (L102) | `req.user._id.toString() === ptId.toString()` |
| BR-PT-004 | `updatePTSchedule` in ptController.js (L600) | `diffHours < 24` guard before schedule write |
