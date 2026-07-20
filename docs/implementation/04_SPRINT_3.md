# Sprint 3: Scheduling

> **Sprint Duration:** 2 weeks  
> **Sprint Number:** 3 of 5  
> **Target Release:** v1.3.0 — Scheduler Release  
> **Status:** Planning

---

## 1. Sprint Goal

Implement the complete personal-training scheduling system: PT availability management, member booking with confirmation workflow, waitlist with atomic promotion, recurring booking support, and violation tracking with automated booking suspension.

---

## 2. Business Objectives

- Enable members to discover PT availability and book sessions up to 30 days in advance
- Enforce PT capacity limits (max 10 members, max 8 sessions/day) to ensure service quality
- Implement fair cancellation policies with graduated penalties (free before 2h, 50% after)
- Reduce no-shows via a violation point system (3 strikes in 90 days → 30-day block)
- Automate waitlist promotion on slot release to maximise PT utilisation
- Support recurring bookings for consistent training schedules

---

## 3. Modules Included

| Module | Path | Owner |
|--------|------|-------|
| Booking | `docs/modules/booking.md` | PT Team |
| Schedule | `docs/modules/schedule.md` | PT Team |
| Trainer (PT) | `docs/modules/trainer.md` | PT Team |

---

## 4. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 1 — Auth & Membership | Must be complete | User roles, membership cycles, wallet |
| Sprint 2 — Check-in & Payment | Should be complete | Payment processing, wallet balance |
| MongoDB Replica Set | Must be configured | Required for multi-document transactions |
| Socket.io Infrastructure | Must be deployed (ADR-010) | Real-time booking/availability updates |

---

## 5. Prerequisites

- [ ] User module: `member`, `pt`, `staff`, `admin` roles implemented with JWT auth
- [ ] Membership module: `membership_cycles` collection with `active`/`pending_activation` statuses
- [ ] Wallet module: `wallets` and `wallet_transactions` collections with atomic `$inc` operations
- [ ] MongoDB transactions enabled (replica set `rs0`)
- [ ] Socket.io server initialised (ADR-010 compliance) for real-time schedule/booking events
- [ ] Redis available for distributed locks and TTL timers (PT confirmation timeout, inventory TTL)

---

## 6. Documents to Read

| Document | Path |
|----------|------|
| Booking Module | `docs/modules/booking.md` |
| Schedule Module | `docs/modules/schedule.md` |
| Trainer Module | `docs/modules/trainer.md` |
| Business Rules Catalog | `docs/BUSINESS_RULES.md` |
| State Machines | `docs/STATE_MACHINES.md` |
| Permission Matrix | `docs/PERMISSION_MATRIX.md` |
| Database Schema Reference | `docs/DATABASE.md` |
| API Standards | `docs/API_STANDARDS.md` |
| Edge Cases Catalogue | `docs/EDGE_CASES.md` |
| ADR-010 — Socket.io | `docs/adr/ADR-010.md` |
| AI Architecture (calculators/RAG) | `docs/AI_ARCHITECTURE.md` |

---

## 7. Business Rules

| Rule ID | Module | Type | Summary |
|---------|--------|------|---------|
| BR-BKG-001 | Booking | constraint | Booking window max 30 days ahead — no bookings beyond 30 calendar days from today |
| BR-BKG-002 | Booking | constraint | Active membership required — must hold `active` or `pending_activation` membership to book |
| BR-BKG-003 | Booking | constraint | One booking per slot per PT per time — no double-booking; unique compound index enforcement |
| BR-BKG-004 | Booking | calculation | Free cancellation ≥2h before session; 50% penalty if cancelled <2h |
| BR-BKG-005 | Booking | workflow | No-show = 1 violation point; 3 violations within rolling 90-day window → 30-day booking suspension; all future bookings auto-cancelled |
| BR-BKG-006 | Booking | workflow | PT has 1 hour to confirm/reject pending booking; auto-confirm on timeout; rejection = full refund |
| BR-BKG-007 | Booking | constraint | Recurring bookings: max 4-week horizon, same day-of-week and start time, membership must cover all dates |
| BR-PT-001 | Trainer | constraint | Max 10 active member assignments per PT (active = confirmed booking within last 30 days or ongoing recurring series) |
| BR-PT-002 | Trainer | constraint | PT max 8 sessions per calendar day; schedule must be published ≥7 days ahead |
| BR-PT-003 | Trainer | constraint | PT cannot book themselves — `memberId !== ptId` |
| BR-PT-004 | Trainer | constraint | PT schedule changes require ≥24h notice; slots within 24h are locked |

---

## 8. State Machines

### Booking State Machine

> Source: `docs/STATE_MACHINES.md` §2

**States:** `PENDING` | `CONFIRMED` | `COMPLETED` | `CANCELLED` | `NOSHOW`

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| — | `PENDING` | Member creates booking | BR-BKG-001, BR-BKG-002, BR-BKG-003 pass | Reserve slot; start PT confirmation timer (60 min) |
| `PENDING` | `CONFIRMED` | PT confirms OR auto-confirm timer fires | Slot still available; no scheduling conflicts | Lock slot; notify both parties |
| `PENDING` | `CANCELLED` | Member cancels | ≥2h → free; <2h → 50% penalty (BR-BKG-004) | Release slot; apply penalty if late; notify PT |
| `PENDING` | `CANCELLED` | PT rejects | Any time (BR-BKG-006) | Full refund; release slot; record rejection reason |
| `PENDING` | `CANCELLED` | Admin cancels | Any time | Release slot; full refund; notify both |
| `CONFIRMED` | `COMPLETED` | Session end time reached (cron) | None | Mark attendance; release slot |
| `CONFIRMED` | `NOSHOW` | No check-in within window (cron) | Check-in window elapsed | Record violation (BR-BKG-005); release slot; evaluate 3-strike rule |
| `CONFIRMED` | `CANCELLED` | Member or PT cancels | ≥2h → free; <2h → penalty (BR-BKG-004) | Release slot; apply penalty; notify other party |
| `NOSHOW` | `CANCELLED` | Violation processed (auto) | None | Finalise penalty; archive record |

**Invalid Transitions:**
- `PENDING → COMPLETED` (must be confirmed first)
- `PENDING → NOSHOW` (no-show applies only to confirmed bookings)
- `CONFIRMED → PENDING` (irreversible)
- `COMPLETED → *` (terminal)
- `NOSHOW → CONFIRMED` (irreversible)
- `CANCELLED → *` (terminal)

---

## 9. Permission Matrix

> Source: `docs/PERMISSION_MATRIX.md`

### Booking Resource

| Action | Guest | Member | PT | Staff | Admin | Super Admin |
|--------|-------|--------|----|-------|-------|-------------|
| View own | — | R | R | — | R | R |
| View assigned | — | — | R | — | R | R |
| View all | — | — | — | R | R | R |
| Create | — | C | — | C | C | C |
| Confirm/reject | — | — | U | — | U | U |
| Cancel own | — | C | C | — | C | C |
| Cancel any | — | — | — | U | U | U |
| Mark no-show | — | — | U | — | U | U |

### Schedule Resource

| Action | Guest | Member | PT | Staff | Admin | Super Admin |
|--------|-------|--------|----|-------|-------|-------------|
| View own | — | — | R | — | R | R |
| View all | — | R | R | R | R | R |
| Create own | — | — | C | — | C | C |
| Create any | — | — | — | C | C | C |
| Update own | — | — | U | — | U | U |
| Update any | — | — | — | U | U | U |

---

## 10. Database Collections

> Source: `docs/DATABASE.md` §2.3, §2.6

### Booking (5 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `bookings` | `userId`, `slotId` (unique), `type` (enum: `class`, `pt`, `facility`), `status` (enum: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`), `paymentStatus`, `checkInAt`, `cancelledAt`, `cancelReason`, `notes` | Core booking records for PT sessions |
| `booking_slots` | `scheduleId`, `date`, `startTime`, `endTime`, `capacity`, `bookedCount`, `status` (enum: `available`, `full`, `cancelled`, `completed`), `price` | Time slots generated from PT schedules |
| `booking_recurring_patterns` | `userId`, `scheduleId`, `frequency` (enum: `daily`, `weekly`, `biweekly`, `monthly`), `daysOfWeek`, `startDate`, `endDate`, `maxOccurrences`, `isActive` | Recurring booking definition |
| `booking_waitlist` | `slotId`, `userId`, `position`, `status` (enum: `waiting`, `promoted`, `expired`, `cancelled`), `notifiedAt` | Waitlist entries for full slots |
| `booking_violations` | `userId`, `bookingId`, `type` (enum: `no_show`, `late_cancel`, `abuse`), `severity` (enum: `warning`, `strike`, `ban`), `description`, `actionTaken`, `resolvedAt` | Violation records with rolling 90-day window |

### Schedule (3 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `schedules` | `trainerId`, `type` (enum: `class`, `pt`, `facility`), `name`, `defaultCapacity`, `defaultPrice`, `color`, `isRecurring`, `isActive` | PT schedule definitions |
| `schedule_exceptions` | `scheduleId`, `date`, `type` (enum: `cancelled`, `rescheduled`, `time_change`), `newStartTime`, `newEndTime`, `reason` | Date-specific overrides for holidays/blocks |
| `schedule_templates` | `name` (unique), `scheduleId`, `slots` [{ `dayOfWeek`, `startTime`, `endTime`, `capacity` }], `isActive`, `createdBy` | Reusable weekly schedule templates |

### Indexes

- `bookings`: unique compound `{ slotId: 1, status: 1 }` where `status != 'cancelled'` (partial index) prevents double-booking (EC-BKG-001)
- `bookings` unique: `slotId`
- `booking_slots`: `{ date: 1, status: 1 }`, `{ startTime: 1, endTime: 1 }`
- `booking_waitlist`: `{ slotId: 1, position: 1 }`
- `booking_violations`: `{ userId: 1, createdAt: -1 }`
- `schedules`: `{ trainerId: 1, isActive: 1 }`
- `schedule_exceptions`: `{ scheduleId: 1, date: 1 }`

---

## 11. API Endpoints

> Source: `docs/API_STANDARDS.md` §14.5, §14.7, §14.8

### Bookings

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/bookings` | Yes | `admin`, `super_admin`, `staff` | List all bookings (paginated, filterable by status/date/PT) |
| `POST` | `/api/v1/bookings` | Yes | `member`, `staff`, `admin` | Create booking (validates BR-BKG-001/002/003) |
| `GET` | `/api/v1/bookings/:id` | Yes | Any (owner or admin) | Get booking by ID |
| `PUT` | `/api/v1/bookings/:id` | Yes | Any (owner or admin) | Update booking details |
| `DELETE` | `/api/v1/bookings/:id` | Yes | Any (owner or admin) | Cancel booking (triggers BR-BKG-004 penalty logic) |
| `PUT` | `/api/v1/bookings/:id/status` | Yes | `pt`, `admin`, `super_admin`, `staff` | Confirm/reject/complete booking |
| `GET` | `/api/v1/bookings/my-bookings` | Yes | `member` | Get current user's bookings |
| `GET` | `/api/v1/bookings/available` | No | — (public) | Get available time slots (supports `?pt=&date=&type=`) |
| `POST` | `/api/v1/bookings/:id/waitlist` | Yes | `member` | Join waitlist for a full slot |
| `DELETE` | `/api/v1/bookings/:id/waitlist` | Yes | `member` | Leave waitlist |

### Recurring Bookings

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `POST` | `/api/v1/bookings/recurring` | Yes | `member` | Create recurring booking pattern (BR-BKG-007) |
| `DELETE` | `/api/v1/bookings/recurring/:id` | Yes | `member`, `admin` | Cancel recurring series |
| `GET` | `/api/v1/bookings/recurring` | Yes | `member`, `pt` | List recurring patterns |

### Schedules

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/schedules` | Yes | `pt`, `admin`, `super_admin`, `staff` | List schedules (filterable by PT/date) |
| `POST` | `/api/v1/schedules` | Yes | `pt`, `admin`, `super_admin` | Create schedule entry |
| `GET` | `/api/v1/schedules/:id` | Yes | Any | Get schedule by ID |
| `PUT` | `/api/v1/schedules/:id` | Yes | `pt`, `admin`, `super_admin` | Update schedule (BR-PT-004: ≥24h guard) |
| `DELETE` | `/api/v1/schedules/:id` | Yes | `pt`, `admin`, `super_admin` | Delete schedule (checks for existing bookings per EC-BKG-002) |
| `GET` | `/api/v1/schedules/available` | No | — (public) | Get available slots (`?pt=&date=&type=`) |
| `POST` | `/api/v1/schedules/exceptions` | Yes | `pt`, `admin` | Add schedule exception (holiday, extra slot) |
| `POST` | `/api/v1/schedules/templates/:id/apply` | Yes | `pt`, `admin` | Apply template to date range |

### Trainers (PT)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/trainers` | No | — (public) | List active trainers with specialisations |
| `GET` | `/api/v1/trainers/:id` | No | — (public) | Get trainer profile + schedule summary |
| `GET` | `/api/v1/trainers/:id/schedule` | No | — (public) | Get trainer's available schedule |
| `GET` | `/api/v1/trainers/:id/members` | Yes | `pt` (own), `admin` | Get assigned members (BR-PT-001 limit) |
| `GET` | `/api/v1/trainers/:id/stats` | Yes | `pt` (own), `admin` | Trainer performance stats |
| `POST` | `/api/v1/admin/trainers` | Yes | `admin`, `super_admin` | Create trainer account |
| `PUT` | `/api/v1/admin/trainers/:id` | Yes | `admin`, `super_admin` | Update trainer profile/specialisations |
| `DELETE` | `/api/v1/admin/trainers/:id` | Yes | `admin`, `super_admin` | Deactivate trainer (cancels future bookings) |

---

## 12. AI Components

| Component | Type | Path Reference | Purpose |
|-----------|------|---------------|---------|
| Booking availability check | Business Tool | `docs/AI_ARCHITECTURE.md` §9 — `check_booking_availability` | AI assistant queries available slots for members |
| Schedule lookup | DB Tool | `docs/AI_ARCHITECTURE.md` §9 — `query_schedules` | AI assistant retrieves PT schedules |
| Booking query | DB Tool | `docs/AI_ARCHITECTURE.md` §9 — `query_bookings` | AI lists/cancels bookings for member |
| Streak calculation | Calculator Tool | `docs/AI_ARCHITECTURE.md` §9 — `calculate_streak` | AI calculates check-in streaks (cross-module with Sprint 2) |

---

## 13. Files Expected Created

| File | Purpose |
|------|---------|
| `src/models/booking.model.js` | Booking Mongoose model |
| `src/models/bookingSlot.model.js` | BookingSlot Mongoose model |
| `src/models/bookingRecurringPattern.model.js` | BookingRecurringPattern Mongoose model |
| `src/models/bookingWaitlist.model.js` | BookingWaitlist Mongoose model |
| `src/models/bookingViolation.model.js` | BookingViolation Mongoose model |
| `src/models/schedule.model.js` | Schedule Mongoose model |
| `src/models/scheduleException.model.js` | ScheduleException Mongoose model |
| `src/models/scheduleTemplate.model.js` | ScheduleTemplate Mongoose model |
| `src/services/bookingService.js` | Core booking logic (create, cancel, confirm, complete, no-show) |
| `src/services/bookingSlotService.js` | Slot availability, reservation, release, generation from schedule |
| `src/services/recurringService.js` | Recurring booking pattern management and occurrence generation |
| `src/services/waitlistService.js` | Waitlist join/leave/promotion with atomic slot claim |
| `src/services/violationService.js` | Violation recording, threshold checking, booking suspension |
| `src/services/scheduleService.js` | Schedule CRUD, availability queries, conflict detection |
| `src/services/scheduleTemplateService.js` | Template CRUD and apply-to-range |
| `src/services/trainerService.js` | Trainer profile, member assignment, performance stats |
| `src/controllers/bookingController.js` | Booking REST endpoints |
| `src/controllers/waitlistController.js` | Waitlist REST endpoints |
| `src/controllers/recurringController.js` | Recurring booking REST endpoints |
| `src/controllers/scheduleController.js` | Schedule REST endpoints |
| `src/controllers/scheduleTemplateController.js` | Schedule template REST endpoints |
| `src/controllers/trainerController.js` | Public trainer listing endpoints |
| `src/controllers/adminTrainerController.js` | Admin trainer management endpoints |
| `src/middleware/bookingAuthorization.js` | Booking ownership + role authorization middleware |
| `src/middleware/scheduleAuthorization.js` | Schedule ownership + role authorization middleware |
| `src/jobs/autoConfirmBookingsJob.js` | Cron: auto-confirm bookings past the 1-hour PT confirmation window |
| `src/jobs/markNoShowJob.js` | Cron: mark confirmed bookings as no-show after check-in window |
| `src/jobs/expireViolationsJob.js` | Cron: expire violation points older than 90 days |
| `src/jobs/generateSlotsJob.js` | Cron: generate booking_slots from active schedules for upcoming period |
| `src/jobs/releaseExpiredWaitlistJob.js` | Cron: expire waitlist entries for past slots |
| `src/routes/booking.routes.js` | Route definitions for booking endpoints |
| `src/routes/schedule.routes.js` | Route definitions for schedule endpoints |
| `src/routes/trainer.routes.js` | Route definitions for trainer endpoints |
| `src/validators/booking.validator.js` | Joi/Zod validation schemas for booking payloads |
| `src/validators/schedule.validator.js` | Joi/Zod validation schemas for schedule payloads |
| `src/constants/bookingStatuses.js` | Status enum constants |
| `src/constants/scheduleTypes.js` | Schedule type enum constants |
| `src/constants/violationTypes.js` | Violation type and severity enum constants |
| `src/socket/bookingSocket.js` | Socket.io handlers: real-time availability updates, booking status notifications |
| `src/socket/scheduleSocket.js` | Socket.io handlers: schedule change notifications |
| `tests/unit/services/bookingService.test.js` | Unit tests — booking creation, cancellation with penalty, no-show logic |
| `tests/unit/services/violationService.test.js` | Unit tests — violation recording, threshold checks, suspension logic |
| `tests/unit/services/waitlistService.test.js` | Unit tests — waitlist join, atomic promotion |
| `tests/unit/services/scheduleService.test.js` | Unit tests — schedule creation, conflict detection, 24h lock |
| `tests/unit/services/trainerService.test.js` | Unit tests — capacity limits, self-booking prevention |
| `tests/integration/bookingWorkflow.test.js` | Integration: full booking flow (create → confirm → complete → violation) |
| `tests/integration/recurringBookingWorkflow.test.js` | Integration: recurring creation, membership coverage, single cancellation |
| `tests/integration/waitlistPromotion.test.js` | Integration: waitlist promotion via atomic cancellation |
| `tests/e2e/booking.e2e.test.js` | E2E: real API tests against test database |

---

## 14. Files Expected Modified

| File | Change |
|------|--------|
| `src/models/user.model.js` | Add PT-specific fields: `specializations`, `certifications`, `bio`, `rating`, `maxMembers` |
| `src/models/membership.model.js` | Add `bookingSuspendedUntil` field for violation-based suspension |
| `src/middleware/auth.js` | Ensure PT role is correctly parsed for booking/schedule middleware |
| `src/app.js` | Register booking, schedule, trainer routes; mount Socket.io handlers |
| `src/socket/index.js` | Integrate booking and schedule Socket.io namespaces |
| `src/utils/dateUtils.js` | Add helpers: `isWithin30Days()`, `isWithin2Hours()`, `rolling90Days()` |
| `src/utils/priceCalculator.js` | Add `calculateCancellationPenalty()` per BR-BKG-004 |
| `.env.example` | Add Redis connection string for TTL timers |

---

## 15. Definition of Ready

- [ ] All BR-BKG-xxx and BR-PT-xxx rules reviewed and clarified with product owner
- [ ] Booking and Schedule state machine transitions agreed by architecture team
- [ ] MongoDB replica set verified for transaction support
- [ ] Socket.io infrastructure deployed and tested (ADR-010 compliance)
- [ ] Redis instance provisioned for distributed TTL timers
- [ ] API contracts agreed: request/response schemas for all endpoints listed in §11
- [ ] Edge cases EC-BKG-001 through EC-BKG-008 reviewed and mitigation strategies confirmed
- [ ] Test data seeding scripts prepared (PT users with schedules, members with active memberships)
- [ ] Frontend wireframes available for booking calendar, PT schedule editor, waitlist UI
- [ ] All dependency modules (Auth, Membership, Wallet) passing their test suites

---

## 16. Definition of Done

- [ ] All 44 files listed in §13 created with complete implementations
- [ ] All models have proper Mongoose schemas with indexes, enums, and soft-delete support
- [ ] All services implement transaction safety for critical paths (create booking + reserve slot, cancel + promote waitlist)
- [ ] All cron jobs registered and tested with `node-cron` or `bull` queue
- [ ] Socket.io events emitted for: booking created, confirmed, cancelled; slot availability changed
- [ ] Idempotency keys supported on booking creation (prevent double-booking on retry)
- [ ] Unit test coverage ≥80% across all service files
- [ ] Integration tests pass for all 11 business rules (BR-BKG-001 through BR-PT-004)
- [ ] Edge case regression tests pass: EC-BKG-001, EC-BKG-002, EC-BKG-003, EC-BKG-004, EC-BKG-005, EC-BKG-006, EC-BKG-007, EC-BKG-008
- [ ] API documentation generated (Swagger/OpenAPI) for all endpoints
- [ ] PT confirmation timer (1h auto-confirm) tested with both Redis TTL and cron fallback
- [ ] Atomic waitlist promotion tested: cancel + promote executes in single MongoDB transaction
- [ ] No-show marking cron correctly evaluates check-in window and records violations
- [ ] Violation expiry (90-day rolling window) correctly removes expired points
- [ ] Linting passes (`npm run lint`) with no errors
- [ ] TypeScript type checking passes (`npm run typecheck`) if applicable

---

## 17. Acceptance Criteria

| # | Criteria | Verification |
|---|----------|-------------|
| AC-3.1 | Member can view available PT slots up to 30 days ahead via `GET /bookings/available` | Query with `?pt=&date=today+30` returns slots; `?date=today+31` rejected |
| AC-3.2 | Member with active membership creates booking; `POST /bookings` succeeds with status `PENDING` | Verify booking document; verify slot `bookedCount` incremented |
| AC-3.3 | Member without active membership attempts booking; receives 403 `BOOKING_MEMBERSHIP_REQUIRED` | BR-BKG-002 enforcement test |
| AC-3.4 | Two members simultaneously book the same PT slot; exactly 1 succeeds, 1 receives 409 `BOOKING_SLOT_UNAVAILABLE` | EC-BKG-001 race condition test |
| AC-3.5 | PT receives notification on new pending booking; has 1 hour to confirm/reject | Timer verification; notification delivery via Socket.io |
| AC-3.6 | PT confirms booking within 1 hour; status transitions to `CONFIRMED` | `PUT /bookings/:id/status` with action `confirm` |
| AC-3.7 | PT rejects booking; member receives full refund; booking status `CANCELLED` with rejection reason | BR-BKG-006 enforcement |
| AC-3.8 | PT takes no action for 1 hour; booking auto-transitions to `CONFIRMED` | Cron job or Redis TTL triggers auto-confirm |
| AC-3.9 | Member cancels ≥2h before session; full refund; no penalty | BR-BKG-004 free window |
| AC-3.10 | Member cancels <2h before session; 50% penalty deducted from wallet; status `cancelled_with_penalty` | BR-BKG-004 penalty enforcement |
| AC-3.11 | Member no-shows confirmed booking; 1 violation point recorded | Cron marks booking `NOSHOW`; `booking_violations` document created |
| AC-3.12 | Member accumulates 3 no-show violations within 90 days; booking privileges suspended for 30 days; all future bookings auto-cancelled | BR-BKG-005 full workflow |
| AC-3.13 | Violation point older than 90 days expires; no longer counts toward threshold | `expireViolationsJob` cron test |
| AC-3.14 | Member joins waitlist for full slot; `POST /bookings/:id/waitlist` succeeds | Waitlist entry created with position |
| AC-3.15 | Member cancels confirmed booking; first waitlisted member is atomically promoted and notified | EC-BKG-008 atomic promotion; single transaction |
| AC-3.16 | Member creates recurring booking (weekly, 4 weeks); all occurrences created if membership covers all dates | BR-BKG-007 enforcement |
| AC-3.17 | Recurring booking >4 weeks → rejected with clear message | BR-BKG-007 horizon enforcement |
| AC-3.18 | Recurring booking straddling membership expiry → truncated with notification per EC-BKG-004 | Membership coverage validation |
| AC-3.19 | PT creates weekly schedule template; slots generated automatically | `POST /schedules` → `generateSlotsJob` |
| AC-3.20 | PT attempts to modify schedule within 24h → rejected per BR-PT-004 | 24h lock enforcement |
| AC-3.21 | PT max 8 sessions per day enforced; 9th booking attempt rejected | BR-PT-002 enforcement |
| AC-3.22 | PT max 10 active members enforced; 11th assignment rejected | BR-PT-001 enforcement |
| AC-3.23 | PT attempts to book themselves → rejected (BR-PT-003) | `memberId === ptId` check |
| AC-3.24 | Admin views all bookings, schedules, trainers with full CRUD per permission matrix | Role-based access control verification |
| AC-3.25 | Real-time slot availability updates broadcast via Socket.io when booking created/cancelled | `schedule:availability_changed` event with slot delta |

---

## 18. Testing Strategy

### Unit Tests

- **bookingService:** Create booking (validates BR-BKG-001/002/003), cancel booking with time-based penalty calculation (BR-BKG-004), confirm/reject booking (BR-BKG-006), mark no-show
- **violationService:** Record violation, check threshold (3 strikes in 90 days), apply suspension, check suspension status, expire old violations
- **waitlistService:** Join waitlist with position assignment, leave waitlist, atomic promotion (cancel + promote in single operation)
- **recurringService:** Generate occurrences with membership coverage validation, handle single-occurrence cancellation vs series cancellation
- **scheduleService:** Create schedule, detect conflicts (overlapping time, capacity), enforce 24h modification lock (BR-PT-004), block holidays via exceptions
- **trainerService:** Get active member count, check 10-member limit (BR-PT-001), check 8-sessions/day limit (BR-PT-002), self-booking prevention (BR-PT-003)

### Integration Tests

- **bookingWorkflow:** Full lifecycle: create → pending → PT confirms → confirmed → session ends → completed
- **cancellationWorkflow:** Create → pending → member cancels (with time-based penalty variations)
- **noShowWorkflow:** Create → confirm → no check-in → cron marks no-show → violation recorded → 3-strike block
- **recurringWorkflow:** Create pattern → 4 occurrences generated → cancel one instance → series continues
- **waitlistPromotion:** Concurrent cancel + promote → exactly one booking created (EC-BKG-008)
- **scheduleConflict:** PT modifies schedule → existing bookings flagged → 24h lock enforced

### E2E Tests

- Real HTTP requests against test database via supertest
- All 25 acceptance criteria enumerated in §17
- Socket.io event emission verified in E2E setup

### Race Condition Tests

- EC-BKG-001: Concurrent booking of same slot → unique index enforcement
- EC-BKG-003: Member cancels while PT confirms → atomic status check (`findOneAndUpdate` with filter)
- EC-BKG-008: Cancel + direct booking + waitlist promotion → exactly 1 winner

---

## 19. Rollback Strategy

| Scenario | Rollback Action |
|----------|----------------|
| Booking creation fails after slot reservation | Transaction rollback: release slot, delete booking document |
| Payment deduction fails mid-booking | No rollback needed — payment is pre-collected; booking stays `pending` |
| PT confirmation timer malfunction (Redis down) | Cron job `autoConfirmBookingsJob` as fallback: scans `PENDING` bookings older than 1h |
| Violation suspension incorrectly blocks user | Admin manual override endpoint: `DELETE /api/v1/bookings/violations/:id` or `PUT /api/v1/members/:id/unblock-bookings` |
| Schedule template applies incorrectly | Delete schedule entries for date range + re-apply template |
| Database migration fails | Run `*.rollback.js` script; restore from most recent backup if needed |

---

## 20. Risks

| # | Risk | Probability | Impact | 
|---|------|------------|--------|
| R-3.1 | Race condition in concurrent booking (EC-BKG-001) slips past unique index | Low | Critical — double-booking breaks trust |
| R-3.2 | PT confirmation timer fails silently (Redis TTL missed); bookings stuck in PENDING | Medium | High — member can't get confirmation, slot not released |
| R-3.3 | Waitlist promotion creates booking for already-taken slot (EC-BKG-008) | Medium | High — double-booking |
| R-3.4 | Violation counter miscounts due to timezone issues in 90-day rolling window | Low | High — incorrect suspension decisions |
| R-3.5 | Recurring booking generates bookings past membership expiry (EC-BKG-004) | Medium | Medium — blocked slots, member confusion |
| R-3.6 | PT schedule delete leaves orphaned confirmed bookings (EC-BKG-002) | Medium | High — PT and member show up for phantom session |
| R-3.7 | Socket.io real-time updates miss delivery (mobile disconnection) | High | Low — stale UI, fixed on next poll |
| R-3.8 | MongoDB transaction timeout on high-contention slots | Low | Medium — degraded booking experience at peak times |
| R-3.9 | Cancellation penalty calculation rounding errors (floating-point) | Low | Medium — over/under-charge by small amounts |
| R-3.10 | GHN dependency (if shipping PT equipment) — out of scope for Sprint 3 | — | None — GHN is Sprint 5 |

---

## 21. Risk Mitigation

| Risk # | Mitigation |
|--------|-----------|
| R-3.1 | Unique compound index `{ slotId: 1, status: 1 }` with partial filter `{ status: { $ne: 'cancelled' } }` at database level; `findOneAndUpdate` with filter guard in application layer; integration test with parallel booking requests |
| R-3.2 | Dual-timer approach: Redis `EXPIRE` TTL (60 min) with `__keyevent` notification; cron job `autoConfirmBookingsJob.js` running every 5 minutes as fallback, scanning for `status: 'pending'` and `createdAt < now - 1h` |
| R-3.3 | Single MongoDB transaction: `cancelBooking()` + `promoteFromWaitlist()` wrapped in `session.withTransaction()`; waitlist promotion uses `findOneAndUpdate` with slot filter; if slot is taken, move to next waitlist entry |
| R-3.4 | Store violation dates in UTC; 90-day window computed server-side using `moment.utc()` or `date-fns-tz`; integration test with mocked system clocks across timezone boundaries |
| R-3.5 | Pre-generation validation: check `membership_cycles` for each occurrence date before creating booking; truncate series with notification; log skipped dates |
| R-3.6 | Before deleting/modifying schedule, query `bookings` with `{ status: 'confirmed', sessionDate: dateInRange }`; if results exist, reject deletion with 409 and list affected bookings; PT must cancel each booking first |
| R-3.7 | Socket.io automatic reconnection with exponential backoff (per ADR-010); stale data refreshed on `GET /bookings/available` pull on reconnect; heartbeat ping/pong every 30s |
| R-3.8 | Set `transactionLifetimeLimitSeconds: 30` on MongoDB session; implement booking retry queue for failed transactions; return `503` with retry-after header if transaction pool exhausted |
| R-3.9 | All monetary amounts stored as integers (VND, no decimals); penalty = `Math.floor(price * 0.5)`; use integer arithmetic only per `docs/DATABASE.md` §3.5 |
| R-3.10 | N/A — not in sprint scope |

---

## 22. Estimated Implementation Order

Tasks are dependency-ordered. Tasks at the same number can be parallelised.

1. **Models & Constants** — `bookingStatuses.js`, `scheduleTypes.js`, `violationTypes.js`, all 8 Mongoose models with indexes
2. **Core Services — Slot Management** — `bookingSlotService.js` (availability, reservation, release, generation)
3. **Core Services — Booking** — `bookingService.js` (create with BR-BKG-001/002/003 validation, cancel with BR-BKG-004 penalty, confirm BR-BKG-006, complete, no-show)
4. **Violation Service** — `violationService.js` (record, check threshold, apply suspension, expire)
5. **Waitlist Service** — `waitlistService.js` (join, leave, atomic promotion)
6. **Recurring Service** — `recurringService.js` (pattern creation with BR-BKG-007 validation, occurrence generation, single vs series cancellation)
7. **Schedule Services** — `scheduleService.js` (CRUD, BR-PT-004 lock, conflict detection, EC-BKG-002 guard), `scheduleTemplateService.js`
8. **Trainer Service** — `trainerService.js` (profile, member count BR-PT-001, session limit BR-PT-002, self-booking prevention BR-PT-003)
9. **Middlewares** — `bookingAuthorization.js`, `scheduleAuthorization.js`
10. **Validators** — `booking.validator.js`, `schedule.validator.js`
11. **Controllers** — Booking, Waitlist, Recurring, Schedule, ScheduleTemplate, Trainer, AdminTrainer
12. **Routes** — `booking.routes.js`, `schedule.routes.js`, `trainer.routes.js`
13. **Cron Jobs** — `autoConfirmBookingsJob.js`, `markNoShowJob.js`, `expireViolationsJob.js`, `generateSlotsJob.js`, `releaseExpiredWaitlistJob.js`
14. **Socket.io Integration** — `bookingSocket.js`, `scheduleSocket.js`; event emission in services
15. **App Registration** — Mount routes in `src/app.js`; integrate Socket.io namespaces in `src/socket/index.js`
16. **Utility Updates** — `dateUtils.js` (30-day, 2h, 90-day helpers), `priceCalculator.js` (penalty calc)
17. **User Model Extension** — PT fields in `user.model.js`
18. **Unit Tests** — All service unit tests (parallel: booking, violation, waitlist, schedule, recurring, trainer)
19. **Integration Tests** — Workflow tests (booking, cancellation, no-show, recurring, waitlist promotion, schedule conflict)
20. **E2E Tests** — Acceptance criteria verification
21. **API Documentation** — OpenAPI/Swagger for all booking, schedule, trainer endpoints
22. **Lint & Typecheck** — `npm run lint`, `npm run typecheck`

---

## 23. Review Checklist

- [ ] All business rules (BR-BKG-001 through BR-PT-004) have service-layer enforcement
- [ ] All state machine transitions (PENDING → CONFIRMED → COMPLETED / CANCELLED / NOSHOW) have atomic guards
- [ ] All edge cases (EC-BKG-001 through EC-BKG-008) have mitigation code in place
- [ ] Unique indexes at database level for double-booking prevention
- [ ] Soft-delete pattern (`deletedAt`) on all collections per `docs/DATABASE.md` §3.2
- [ ] Timestamp fields (`createdAt`, `updatedAt`) on all collections per `docs/DATABASE.md` §3.1
- [ ] All monetary operations use integer arithmetic (VND) per `docs/DATABASE.md` §3.5
- [ ] Socket.io connections authenticated via JWT on handshake per ADR-010
- [ ] Socket.io events follow `namespace:action` naming convention per ADR-010
- [ ] All API endpoints return standardised response format per `docs/API_STANDARDS.md` §5
- [ ] All API endpoints use kebab-case URL paths per `docs/API_STANDARDS.md` §2.3
- [ ] Pagination uses offset-based with `page`/`limit` query params per `docs/API_STANDARDS.md` §6
- [ ] Authorization middleware checks role against `docs/PERMISSION_MATRIX.md` before every endpoint
- [ ] CRON jobs use persistent scheduler (`bull` or database-backed `node-cron`) per EC-SYS-002 mitigation
- [ ] MongoDB transactions used for all multi-document atomic operations per BR-PAY-001 pattern
- [ ] Idempotency key supported on booking creation to prevent double-submit on retry
- [ ] Error codes follow catalogue: `BOOKING_SLOT_UNAVAILABLE`, `BOOKING_TIME_CONFLICT`, `BOOKING_PAST_CANCELLATION`, `BOOKING_MEMBERSHIP_REQUIRED`
- [ ] Membership `bookingSuspendedUntil` field evaluated before allowing booking creation
- [ ] PT deletions check for existing confirmed bookings before allowing (EC-BKG-002)
- [ ] Recurring booking endpoint validates BR-BKG-001, BR-BKG-002, BR-BKG-003 for every occurrence

---

## 24. Documentation Update Checklist

- [ ] `docs/modules/booking.md` — Update with actual API paths, add waitlist promotion details
- [ ] `docs/modules/schedule.md` — Add template application flow diagram
- [ ] `docs/modules/trainer.md` — Add performance stats endpoint response schema
- [ ] `docs/BUSINESS_RULES.md` — No changes needed (rules defined pre-sprint)
- [ ] `docs/STATE_MACHINES.md` — No changes needed (state machine defined pre-sprint)
- [ ] `docs/PERMISSION_MATRIX.md` — No changes needed
- [ ] `docs/DATABASE.md` — Add any missing indexes discovered during implementation
- [ ] `docs/API_STANDARDS.md` — Add recurring booking and waitlist endpoints to catalog §14
- [ ] `docs/EDGE_CASES.md` — Update EC-BKG entries with actual mitigation implementations
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 3 as complete
- [ ] `CHANGELOG.md` — Add v1.3.0 entry with all new features

---

## 25. Deliverables

| # | Deliverable | Format | Recipient |
|---|-------------|--------|-----------|
| 1 | Booking CRUD API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 2 | Waitlist API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 3 | Recurring Booking API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 4 | Schedule Management API | REST endpoints + OpenAPI spec | Frontend team, Admin team |
| 5 | Trainer Management API | REST endpoints + OpenAPI spec | Frontend team, Admin team |
| 6 | Real-time booking/schedule events | Socket.io events documentation | Frontend team |
| 7 | Violation tracking system | Cron jobs + admin dashboard endpoints | Admin team, Ops team |
| 8 | Auto-confirm + No-show cron jobs | Job schedule documentation | Ops team |
| 9 | Unit test suite | `tests/unit/` | QA team |
| 10 | Integration test suite | `tests/integration/` | QA team |
| 11 | E2E test suite | `tests/e2e/` | QA team |
| 12 | API documentation | Swagger UI hosted at `/api-docs` | All teams |
| 13 | Database migration scripts | `src/scripts/` | Ops team |
| 14 | Sprint report | Sprint retrospective doc | Project Manager |
