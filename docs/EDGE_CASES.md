# Edge Cases Catalogue — GymPro Gym Management System

> **Document Status:** Active  
> **Last Updated:** 2026-07-20  
> **Scope:** All modules — membership, booking, check-in, payment, wallet, shop, system  
> **Purpose:** Central register of known edge cases, race conditions, failure modes, and tricky business logic.

---

## Table of Contents

1. [Membership (EC-MEM-*)](#1-membership-ec-mem-)
2. [Booking (EC-BKG-*)](#2-booking-ec-bkg-)
3. [Check-in (EC-CHK-*)](#3-check-in-ec-chk-)
4. [Payment (EC-PAY-*)](#4-payment-ec-pay-)
5. [Wallet (EC-WAL-*)](#5-wallet-ec-wal-)
6. [Shop (EC-SHP-*)](#6-shop-ec-shp-)
7. [System (EC-SYS-*)](#7-system-ec-sys-)

---

## 1. Membership (EC-MEM-*)

### EC-MEM-001: Two admins approve same cancellation concurrently → double refund

- **Category:** race_condition
- **Risk:** high
- **Description:** Two staff/admin users open the same cancellation request simultaneously and both click "Approve". Without pessimistic locking or status guard on the `CancellationRequest`, both requests pass validation, triggering two separate refund transactions for the same membership cycle.
- **Impact:** Double refund paid to the member; financial loss equal to the membership price. Revenue leakage, audit trail contaminated with duplicate refund records.
- **Mitigation:** Use atomic `findOneAndUpdate` with a status filter (`{ status: 'pending' }`) so only the first approval wins. The second call updates zero documents and is rejected. Wrap the entire approval + refund pipeline in a Mongoose transaction. Add a unique index on `(membershipCycleId, type)` in the Transaction collection where `type: 'refund'`.
- **Test scenario:** Fire two concurrent `POST /api/cancellation-requests/:id/approve` requests with the same `id`. Assert exactly one refund transaction is created and the second request receives a 409 Conflict.

### EC-MEM-002: Membership expires during a freeze → ambiguous state

- **Category:** state_transition
- **Risk:** high
- **Description:** A member freezes their 30-day membership on day 25. On day 30 the membership naturally expires while still frozen. Two conflicting truths coexist: the cycle says `status: 'frozen'` but the computed `expiresAt` is in the past. The system must decide which state takes precedence.
- **Impact:** The member may be incorrectly allowed to resume (unfreeze) an already-expired membership. Alternatively the freeze may be displayed indefinitely with no expiry enforcement. Check-in and booking services may produce inconsistent results depending on which field they evaluate.
- **Mitigation:** Define a deterministic state resolution: `expired` always overrides `frozen`. When a cycle's `expiresAt` passes, transition status to `expired` even if frozen. Implement a cron job (`resolveFrozenExpiredJob.js`) that runs daily and marks expired-frozen cycles as `expired`. Add a database constraint or application-level invariant check.
- **Test scenario:** Create a cycle expiring in 2 days, freeze it, advance system clock past expiry. Assert cycle status is `expired`, not `frozen`. Attempt to unfreeze → must fail with `400 Membership has expired`.

### EC-MEM-003: Payment succeeds but membership creation fails → orphan payment

- **Category:** data_integrity
- **Risk:** critical
- **Description:** During membership purchase, Stripe/VNPAY charge succeeds and a `Payment` record is created, but the `Membership` and `MembershipCycle` document creation fails (e.g., MongoDB write concern timeout, validation error, plan deleted mid-request). The member has been charged but has no active membership.
- **Impact:** Member loses money with no service. Support must manually refund. If undiscovered, becomes a permanent accounting discrepancy.
- **Mitigation:** Wrap the entire purchase flow (charge → create Membership → create MembershipCycle → create PlanChangeHistory) in a Mongoose transaction with `readConcern: 'majority'` and `writeConcern: 'majority'`. If any step fails, abort the transaction and issue an automatic reversal/refund to the payment gateway. For idempotency, use an idempotency key that is created before the charge and only marked "completed" after the full transaction succeeds.
- **Test scenario:** Stub the Membership creation to throw a `ValidationError` after Stripe `paymentIntent.confirm()` succeeds. Assert that a `RefundRequest` is auto-created or a Stripe refund is issued. Assert no orphan `Payment` record with no linked membership exists.

### EC-MEM-004: Max pending cycles reached, member tries to buy again

- **Category:** business_logic
- **Risk:** medium
- **Description:** A member has 3 pending renewal cycles (cycles awaiting activation). The business rule caps pending cycles at 3. The member triggers another purchase via the "buy again" flow. The system must detect and reject this before creating a payment.
- **Impact:** Creates a 4th pending cycle that cannot be activated. Payment is taken but the cycle will always stay in `pending_renewal_activation`. Wastes money and confuses the member.
- **Mitigation:** Before any purchase, count cycles with `status: { $in: ['pending_initial_activation', 'pending_renewal_activation'] }` for the same plan. If >= 3, reject with a clear message. Enforce this check at the service layer and add a database pre-save hook on `MembershipCycle`.
- **Test scenario:** Create 3 pending cycles for member A. Call purchase API for the same plan. Assert 400 error. Assert no new `MembershipCycle` or `Payment` document is created.

### EC-MEM-005: Member checks in on last day of membership → streak starts but can't continue

- **Category:** business_logic
- **Risk:** low
- **Description:** A member checks in on the final day of their active cycle. The streak counter increments. The next day the membership is expired. The member has a streak of 1 that can never be extended because they have no active membership. This may permanently display a streak of 1 until they repurchase.
- **Impact:** Minor UX confusion. The streak display shows a non-zero value that is misleading because the member cannot maintain it. If streak-based rewards exist, the member may feel entitled to benefits they cannot access.
- **Mitigation:** Streak computation should exclude check-ins made on or after the membership expiry date. Alternatively, display streak membership status as "locked — renew to continue". Define a business rule: streak requires contiguous days within an active membership period, and a gap of >1 day due to expiry resets it.
- **Test scenario:** Check in on day 30 (last day of membership). Assert streak = 1. Let membership expire. Assert displayed streak = 0 or streak shows as "inactive/locked". Check in after expiry → must fail at check-in gate.

### EC-MEM-006: Freeze requested during pending activation → should be rejected

- **Category:** state_transition
- **Risk:** medium
- **Description:** A member purchases a new plan but has not yet checked in (cycle is `pending_initial_activation`). The member submits a freeze request. Freeze logic only checks if cycle is `active`, but `pending_initial_activation` is not in the allowed transition map. Depending on implementation, this could silently succeed, setting a freeze on a cycle that has never started.
- **Impact:** The freeze dates (start/end) are meaningless because the cycle has no `activatedAt`. When the member later activates via check-in, the cycle may immediately jump to a frozen state or have incorrect date arithmetic.
- **Mitigation:** Validate that a freeze can only be applied when `cycle.status === 'active'`. Reject freeze requests for `pending_initial_activation`, `completed`, `cancelled`, `refunded`, or `expired`. Add an explicit guard at the start of the freeze service method.
- **Test scenario:** Create a cycle with status `pending_initial_activation`. Call freeze API. Assert 400 error with message "Cannot freeze a cycle that has not been activated". Assert cycle status unchanged.

### EC-MEM-007: Refund initiated after membership already expired

- **Category:** business_logic
- **Risk:** medium
- **Description:** A member has a 12-month membership that expired 6 months ago. They submit a cancellation with a refund request for the unused portion. Since the membership is already expired and all benefits were theoretically available, no refund is due by business rules. However, the system may not check the cycle status before creating the refund.
- **Impact:** Illegal refund paid. Member receives money for a service they already consumed (or had the opportunity to consume). P&L impact if not caught.
- **Mitigation:** Check `cycle.status` before creating a `RefundRequest`. Only allow refunds for `active` or `pending_*_activation` cycles. Expired cycles have $0 refund value regardless of remaining days. Add an explicit gate: `if (['completed', 'expired', 'cancelled', 'refunded'].includes(cycle.status)) { throw new AppError('Cannot refund an expired/completed cycle', 400) }`.
- **Test scenario:** Create an expired cycle (expiresAt in the past). Submit refund request. Assert 400 error. Assert no `RefundRequest` or `Transaction` documents created.

### EC-MEM-008: Payment gateway timeout during membership purchase (payment taken but pending forever)

- **Category:** timeout
- **Risk:** critical
- **Description:** The server calls Stripe `paymentIntent.confirm()` or VNPAY IPN processing. The gateway responds with a success but the response is delayed beyond the Express timeout (e.g., 30s). The server sends a `504 Gateway Timeout` to the frontend. The member sees a failure and may retry. Meanwhile, the payment succeeded on the gateway side. The `Payment` document status is `pending` because the webhook or return URL hasn't been processed yet, and if the callback also times out, the payment remains pending permanently.
- **Impact:** Member is charged twice (original + retry) or the original payment is lost in a pending state. Manual reconciliation required. If the retry creates a second membership, the member gets double service.
- **Mitigation:** Implement a webhook-first architecture for all payment gateways. The frontend should poll a payment status endpoint after timeout. Add a cron job (`resolvePendingPaymentsJob.js`) that queries payments with `status: 'pending'` older than 15 minutes and reconciles them against the gateway. All purchase endpoints must be idempotent via idempotency keys. The frontend must disable the submit button on purchase and provide a "Check payment status" action instead of allowing retry.
- **Test scenario:** Simulate a Stripe response delay > 30s. Assert frontend shows "Payment processing — check back later" not "Failed". Call the payment status endpoint. Assert payment resolves to `completed` after webhook arrives. Assert no duplicate membership created if member retries with same idempotency key.

### EC-MEM-009: Plan deleted while active memberships reference it

- **Category:** data_integrity
- **Risk:** high
- **Description:** An admin deletes a `Plan` document from the database. Active `Membership` and `MembershipCycle` records still reference `planId`. Any code that populates the plan reference will receive `null`, causing crashes in membership display, renewal calculation, and check-in validation.
- **Impact:** Member dashboard shows "Unknown Plan". Renewal endpoint throws `TypeError` when accessing plan properties. Check-in may be blocked because plan lookup fails. Cascade deletion could orphan hundreds of records.
- **Mitigation:** Plans should never be hard-deleted. Use a soft-delete pattern: `isActive: false` or `deletedAt: Date`. Before soft-deleting, check for active memberships referencing the plan and block deletion with a conflict error. All queries for plan prices, durations, and features should explicitly filter `{ isActive: true }` for new purchases only, but respect existing references.
- **Test scenario:** Attempt to delete a plan that has 5 active memberships. Assert 409 Conflict error. Assert `isActive` set to false when no active memberships exist. Assert member with existing membership still sees plan name on their dashboard.

### EC-MEM-010: Membership renewed on leap day → next year's expiry is ambiguous

- **Category:** boundary
- **Risk:** low
- **Description:** A 365-day membership purchased on 2024-02-29 (leap year) expires on 2025-03-01 if calculated by adding 365 days, but some implementations use anniversary-based arithmetic (`setFullYear(getFullYear() + 1)` which would produce 2025-02-28, an invalid date). This inconsistency causes the UI to show two different expiry dates depending on which calculation the backend uses.
- **Impact:** Confusing expiry display. If an anniversary-based renewal fires on 2025-02-28, the member's membership appears to expire one day early, triggering premature renewal reminders and possible double-charging.
- **Mitigation:** Standardize all date arithmetic to use an explicit day-count approach: `new Date(purchasedAt.getTime() + durationDays * 86400000)`. Avoid `setFullYear` for duration calculations. Document that duration is always calendar days, not anniversary-based. Add a unit test for leap-year edge cases.
- **Test scenario:** Create a plan with `durationDays: 365`. Purchase on 2024-02-29. Assert `expiresAt` is 2025-03-01. Purchase on 2024-03-01 with `durationDays: 365`. Assert `expiresAt` is 2025-03-01 (same expiry due to 366-day leap year). Both should expire on the same calendar date.

---

## 2. Booking (EC-BKG-*)

### EC-BKG-001: Two members book same slot simultaneously → double booking

- **Category:** race_condition
- **Risk:** critical
- **Description:** Two members simultaneously request the same PT time slot (same `ptId`, `date`, `slot`). Both requests pass the existence check (`findOne` returns null for both because neither has committed yet). Both inserts succeed, creating two bookings for the same PT slot.
- **Impact:** PT arrives to find two members expecting a 1-on-1 session. Schedule conflict meaning one member must be turned away. Member dissatisfaction, support overhead. If booking carries a fee, double revenue for the same slot (or one member is refunded).
- **Mitigation:** Use a unique compound index on `(ptId, date, slot)` with a partial filter expression `{ status: { $ne: 'cancelled' } }` to prevent duplicate non-cancelled bookings at the database level. In the service, use `findOneAndUpdate` with `upsert` and a filter that excludes existing bookings, or use `insertMany` with `ordered: true` and catch duplicate key errors. Wrap in a transaction for atomicity.
- **Test scenario:** Fire two concurrent `POST /api/bookings` with identical `{ ptId, date, slot }`. Assert exactly one booking is created. Assert the second request receives a 409 Conflict with a clear message. Assert no duplicate documents in the `Booking` collection.

### EC-BKG-002: PT deletes schedule after member already booked

- **Category:** data_integrity
- **Risk:** high
- **Description:** A PT deletes or modifies their availability schedule (e.g., marks a day as "off") after members have already booked sessions on that day. The booking records still exist with `status: 'confirmed'`. The PT may not know they have conflicting bookings, and members are not notified.
- **Impact:** PT and member both show up at the gym expecting a session that cannot happen. Last-minute cancellation and member frustration. If the system auto-assigns based on schedule, new members may also see available slots that conflict with existing bookings.
- **Mitigation:** Before deleting/modifying a schedule entry, query for confirmed bookings on that date/slot. If bookings exist, reject the deletion with a conflict error and instruct the PT to cancel or reschedule each booking first. Implement a referential integrity check at the service layer and a pre-save hook on `PTSchedule`.
- **Test scenario:** PT has a confirmed booking for Monday 10:00. PT tries to delete Monday availability. Assert 409 error. PT must cancel the booking first, then delete. Assert after deletion, the booking status is updated to `cancelled` with reason "PT schedule removed".

### EC-BKG-003: Member cancels booking while PT is confirming → state conflict

- **Category:** race_condition
- **Risk:** medium
- **Description:** A member clicks "Cancel Booking" milliseconds before a PT clicks "Confirm Booking". Both operations read the booking's current status (`pending`) and proceed with their respective transitions. Depending on execution order, either the cancel succeeds (PT sees a cancelled booking and their confirm fails) or the confirm succeeds (member gets an error on cancel). Worst case: both succeed because status checks are not atomic.
- **Impact:** Inconsistent state — booking is both `cancelled` and `confirmed` in different views. PT may prepare for a session that the member believes is cancelled. System notifications may contradict each other.
- **Mitigation:** Use atomic status transitions: `findOneAndUpdate({ _id, status: 'pending' }, { status: 'cancelled' })` and `findOneAndUpdate({ _id, status: 'pending' }, { status: 'confirmed' })`. Only the first operation wins; the second finds zero matching documents and returns null/fails. Notify the loser via WebSocket and email.
- **Test scenario:** Fire two concurrent requests: `PATCH /api/bookings/:id/cancel` and `PATCH /api/bookings/:id/confirm`. Assert only one operation succeeds. Assert the booking's final status is either `cancelled` or `confirmed` (not both). Assert the failed caller receives a `409 Conflict` with a descriptive message.

### EC-BKG-004: Recurring booking straddles membership expiry

- **Category:** business_logic
- **Risk:** high
- **Description:** A member sets up a recurring booking (e.g., every Monday for 8 weeks). Their membership expires in 2 weeks. The recurring booking engine continues creating new booking instances for weeks 3–8, all of which fall outside the member's active membership period.
- **Impact:** The member accrues bookings they cannot attend. PT slots are held by a member without active membership, blocking paying members. When the member attempts to check in for a session after expiry, the check-in fails, creating a no-show penalty.
- **Mitigation:** Before creating each recurring booking instance, validate that the member has an active membership covering the booking date. Skip (do not create) instances that fall after `cycle.expiresAt`. Notify the member and PT that the recurring series has been truncated due to membership expiry. Add a scheduling check in the recurring booking cron job.
- **Test scenario:** Create a membership expiring in 14 days. Create a recurring booking for 8 weeks. Assert only the first 2 instances are created. Assert the remaining 6 weeks are skipped with a log entry. Assert the member is notified about truncation.

### EC-BKG-005: Booking payment fails but slot is temporarily held

- **Category:** state_transition
- **Risk:** medium
- **Description:** A booking flow requires payment at the time of booking (e.g., PT session fee). The system creates a booking with status `pending_payment` and holds the slot. The payment call (wallet deduction or gateway charge) fails. The slot remains held indefinitely, blocking other members from booking it.
- **Impact:** Slot inventory leak — no one can book a held slot, but the hold is never released. If the member retries, they may get a "slot already booked" error because the hold exists.
- **Mitigation:** Implement a TTL (time-to-live) on `pending_payment` bookings. Use a MongoDB TTL index on `createdAt` (e.g., 15 minutes). If payment is not confirmed within the TTL, the booking is auto-cancelled and the slot released. Alternatively, use a separate "lock" collection with a TTL. Notify the member via WebSocket when the hold expires.
- **Test scenario:** Create a booking with `status: 'pending_payment'`. Do not complete payment. Wait 15 minutes (or mock the TTL). Assert the booking is auto-cancelled. Assert the slot is available for another member to book. Assert the member receives a notification about the expired hold.

### EC-BKG-006: PT marked as no-show but was actually present (admin override needed)

- **Category:** business_logic
- **Risk:** medium
- **Description:** A PT is automatically marked as no-show after the system detects the booking was not started within the grace period. However, the PT was present and the session occurred, but the check-in was not recorded due to a QR scanning error, network outage, or staff oversight.
- **Impact:** PT receives an undeserved no-show penalty (fee deduction, performance score drop). The no-show record affects their rating and scheduling priority. Member may be incorrectly credited with a refund or compensation.
- **Mitigation:** Implement a manual admin override: `POST /api/bookings/:id/override-no-show` with required reason and evidence (e.g., CCTV timestamp, staff attestation). The override removes the no-show flag, restores the PT's penalty points, and adjusts any auto-generated refunds. Log the override in the audit trail. Do not allow automatic reversion — only admin can fix.
- **Test scenario:** System auto-marks a PT as no-show. Admin calls the override endpoint with a valid reason. Assert the booking status reverts to `completed`. Assert PT penalty score is restored. Assert the audit log contains the override entry with admin ID and reason.

### EC-BKG-007: Member books recurring then cancels one occurrence

- **Category:** business_logic
- **Risk:** low
- **Description:** A member has a recurring booking series (every Tuesday at 18:00). They need to cancel only next Tuesday's occurrence but keep the rest of the series. The cancellation flow must distinguish between cancelling one instance versus cancelling the entire recurring series.
- **Impact:** If the cancel button defaults to cancelling all, the member loses their entire recurring schedule. If it cancels only one, the recurring engine may recreate the cancelled instance on the next sync cycle.
- **Mitigation:** Provide explicit options: "Cancel this session only" vs "Cancel all future sessions". The recurring booking model must store a `recurringGroupId` and a list of `excludedDates` or a `cancelledUntil` date. When generating future instances, skip dates in `excludedDates`. The single-cancellation instance gets status `cancelled_by_member` while the parent recurring series remains active.
- **Test scenario:** Create a recurring series of 10 weekly bookings. Cancel 1 instance (the 4th). Assert the 4th instance is `cancelled` but the 3rd and 5th remain `confirmed`. Cancel the entire series. Assert all future instances (5th–10th) become `cancelled`. Assert the first 3 instances remain `confirmed`.

### EC-BKG-008: Booking waitlist promoted to slot that is no longer available

- **Category:** race_condition
- **Risk:** medium
- **Description:** A member cancels their booking, triggering auto-promotion of the first waitlisted member. Between the cancellation and the promotion, another member directly books the now-vacant slot via a separate request. The promotion creates a booking for a slot that is already taken.
- **Impact:** Double booking of the same slot. The promoted member has a confirmed booking that conflicts with the direct booker. Only one can attend.
- **Mitigation:** Use a single atomic operation for cancellation + promotion. Instead of "cancel then promote", use a script that atomically updates the cancelled booking to `cancelled` and the waitlist entry to `confirmed` (or creates a new booking from the waitlist) in one `findOneAndUpdate` with the slot filter as a guard. Alternatively, the promotion creates the booking with `findOneAndUpdate` using upsert with the unique compound index `(ptId, date, slot)` so a duplicate key error prevents double-booking.
- **Test scenario:** Have 1 confirmed booking and 1 waitlist entry for the same slot. Cancel the confirmed booking while simultaneously sending a direct booking request for the same slot. Assert exactly 1 booking exists for the slot. Assert either the waitlist member or the direct booker gets the slot (the other receives a failure).

---

## 3. Check-in (EC-CHK-*)

### EC-CHK-001: QR code scanned twice rapidly → double check-in

- **Category:** race_condition
- **Risk:** high
- **Description:** A member presents their QR code at the entrance. The staff scanner sends two nearly simultaneous `POST /api/check-in` requests (e.g., scanner double-trigger, network retry, or the frontend button is tapped twice). Both requests pass the "already checked in today?" check at approximately the same time because neither has committed yet.
- **Impact:** Duplicate check-in record for the same day. Streak counter may incorrectly count two days. Membership activation may fire twice, creating two activation timestamps. Check-in statistics are inflated.
- **Mitigation:** Use an idempotency key based on `(memberId, date)` — a unique compound index on `(memberId, checkinDate)` where `checkinDate` is `YYYY-MM-DD`. The second insert hits a duplicate key error and is silently ignored (or returns the existing check-in). For the API, the frontend must disable the scan button on first click until the response returns. Backend should also deduplicate: if a check-in for today exists, return the existing record with a `200 OK` (idempotent success).
- **Test scenario:** Send two `POST /api/check-in` requests with the same `memberId` simultaneously. Assert only one `CheckIn` document is created. Assert the second response returns the same check-in data (idempotent). Assert no duplicate entries.

### EC-CHK-002: Check-in at exact midnight → which day?

- **Category:** boundary
- **Risk:** low
- **Description:** A member scans their QR code at exactly 00:00:00.000. The system uses `new Date()` to record the check-in time. Depending on timezone handling, this could be assigned to the previous day (if using UTC date truncation) or the current day (if using local timezone). The streak computation and daily check-in limit may produce inconsistent results.
- **Impact:** If the check-in is bucketed to the wrong day, the member loses a day of streak or gains an extra check-in. The "checked in today?" gate may incorrectly allow or deny entry.
- **Mitigation:** Normalize all date comparisons to the gym's local timezone (Asia/Ho_Chi_Minh). Store `checkinDate` as a string `YYYY-MM-DD` in the local timezone at the time of check-in, separate from the `checkinTime` timestamp. Use the `checkinDate` field for all daily bucketing and deduplication, not the raw timestamp.
- **Test scenario:** Mock system time to 2024-01-01 23:59:59.500 local and send a check-in. Then advance to 2024-01-02 00:00:00.500 and send another. Assert the first has `checkinDate: '2024-01-01'` and the second has `checkinDate: '2024-01-02'`. Assert both are allowed (different days) and streak increments correctly.

### EC-CHK-003: Member with expired membership tries to check in

- **Category:** permission
- **Risk:** high
- **Description:** A member whose last membership cycle has expired (status: `expired` or `completed`) attempts to check in. The check-in endpoint must determine whether the member has any active cycle covering the current date. If the validation only checks `membership.status === 'active'` instead of evaluating cycle dates, the check-in may be incorrectly allowed for a member whose cycle `expiresAt` has passed but the parent `Membership` status hasn't been updated.
- **Impact:** Member gains unauthorized gym access. If check-in triggers membership activation, it may create a new activation on an expired cycle. Security and revenue leakage.
- **Mitigation:** Check-in must query `MembershipCycle` for a cycle where `status === 'active' AND expiresAt >= now`. Do not rely on the parent `Membership.status` field. Reject check-in with a clear message and offer to purchase/renew. If the cycle's `status` is `active` but `expiresAt` is in the past, treat it as a data inconsistency and log an alert.
- **Test scenario:** Member has a cycle with `expiresAt` in the past but `status: 'active'` (inconsistency). Attempt check-in. Assert rejection with `403 Expired`. If cycle `status` is `expired` and `expiresAt` is in the past, same rejection. Renew the membership, then check in — assert success.

### EC-CHK-004: Gym closed for holiday but system allows check-in

- **Category:** business_logic
- **Risk:** medium
- **Description:** The gym is closed for a public holiday (e.g., Tết Nguyên Đán). The system settings have a `holidaySchedule` configuration or a `ScheduleOverride` document covering the closure. However, the check-in endpoint does not consult the schedule override, so members can scan the QR code at the closed gym's door. Since no staff is present, the QR scan would fail physically, but the API would return success if called remotely or if a kiosk is left on.
- **Impact:** Member's streak is incremented for a day they didn't actually work out. If check-in is used for access control, the door may unlock when the gym is closed (security risk). Inflated attendance metrics.
- **Mitigation:** Before processing check-in, query `ScheduleOverride` or `SystemSettings` for the current date. If the gym is marked as closed, reject all check-ins with a 403 and a message indicating the closure. For known closure dates, also block QR code generation for that day.
- **Test scenario:** Create a `ScheduleOverride` marking tomorrow as "closed". Attempt to check in tomorrow. Assert 403 error with "Gym closed for holiday". Remove the override. Assert check-in succeeds.

### EC-CHK-005: First check-in activates the wrong cycle (multiple pending cycles)

- **Category:** state_transition
- **Risk:** high
- **Description:** A member has multiple pending cycles (e.g., main membership + a renewal cycle purchased early). The first check-in triggers activation logic that must select which cycle to activate. If the logic simply activates the oldest `pending_initial_activation` cycle, it might activate a renewal cycle instead of the main one, or activate a cycle that was meant to start later.
- **Impact:** Wrong cycle gets activated, causing incorrect expiry dates. The member may have less time than they paid for, or a future-dated cycle consumes its duration early. Discrepancy in `PlanChangeHistory`.
- **Mitigation:** Define a deterministic activation order: always activate `pending_initial_activation` before `pending_renewal_activation`. If multiple cycles of the same type exist, activate the one with the earliest `purchasedAt`. Activate exactly one cycle per check-in. Log which cycle was activated for audit. Reject check-in if no eligible cycle exists.
- **Test scenario:** Create 2 pending cycles: 1 initial (`purchasedAt: T+0`) and 1 renewal (`purchasedAt: T+30`). Check in. Assert only the initial cycle is activated. Assert the renewal cycle remains `pending_renewal_activation`. Assert `activatedAt` and `expiresAt` are set on the initial cycle only.

### EC-CHK-006: QR code replayed across days

- **Category:** security
- **Risk:** high
- **Description:** A member takes a screenshot of their daily QR code on Monday and tries to scan the same image on Tuesday. If the QR code does not incorporate the date as a signed claim, the system may accept Tuesday's check-in with Monday's QR code.
- **Impact:** Unauthorized entry using a replayed credential. The check-in occurs on the wrong date, and the member bypasses the daily-unique QR security. Streak may be incorrectly awarded.
- **Mitigation:** The QR code payload must include an expiration timestamp or date string (e.g., `{ memberId, date: '2024-07-20', signature }` with an HMAC signature using a server secret). The check-in endpoint verifies the signature and that the `date` matches today's date. Old QR codes are rejected even if the signature is valid.
- **Test scenario:** Generate a QR code for Monday. On Tuesday, submit the same QR payload. Assert 403 error with "QR code expired". Assert no check-in record is created.

---

## 4. Payment (EC-PAY-*)

### EC-PAY-001: VNPAY webhook arrives before payment page redirect → double processing

- **Category:** race_condition
- **Risk:** critical
- **Description:** VNPAY sends its IPN (Instant Payment Notification) webhook to the backend at the same time as (or before) the browser redirects to the `vnpay-return` URL. Both requests try to process the same successful payment. Without idempotency guarding, both create wallet transactions and update the order/membership status.
- **Impact:** Double credit to the member's wallet. Membership activated twice. Two `Transaction` records for one payment. Accounting nightmare.
- **Mitigation:** All payment processing handlers must be idempotent. Before applying any side effects, check if a `Transaction` with `referenceId: payment._id` and `source: 'vnpay'` already exists. If so, return the existing result (idempotent response). Use a unique index on `(referenceId, source)` in the `Transaction` collection to enforce this at the database level. The IPN handler and the return URL handler should call the same idempotent processing function.
- **Test scenario:** Simulate VNPAY IPN arriving before the return URL redirect. Send both requests simultaneously. Assert exactly 1 transaction is created. Assert the wallet balance is incremented exactly once. Assert both endpoints return `200 OK` with the same data.

### EC-PAY-002: Idempotency key reused with different amount → fraud

- **Category:** security
- **Risk:** critical
- **Description:** A client sends a payment request with `idempotencyKey: 'abc-123'` and `amount: 500,000 VND`. The first request succeeds. An attacker (or buggy client) sends a second request with the same `idempotencyKey` but `amount: 50,000,000 VND`. If the idempotency check only looks at the key and returns the cached success without verifying the amount matches, the second request appears to succeed for a much larger amount without actually charging the gateway.
- **Impact:** The frontend shows a success for 50M VND, but the backend only processed 500K VND. The user believes they deposited 50M. If the frontend updates the wallet balance optimistically, the displayed balance diverges from the actual balance. Repudiation risk.
- **Mitigation:** The idempotency cache/guard must store the full request payload hash (including `amount`, `currency`, and `userId`) alongside the idempotency key. On repeat requests, compare all significant fields. If any field differs, return `409 Conflict` with message "Idempotency key already used with different parameters". Never return cached success for a mismatched request.
- **Test scenario:** Send `POST /api/payments/deposit` with `{ amount: 100, idempotencyKey: 'key1' }`. Assert success. Send same request with `{ amount: 999999, idempotencyKey: 'key1' }`. Assert 409 error. Assert only 100 was charged and deposited.

### EC-PAY-003: Wallet balance exactly equals price → insufficient funds due to rounding

- **Category:** boundary
- **Risk:** medium
- **Description:** A member has a wallet balance of 100,000 VND. They attempt to purchase a membership priced at exactly 100,000 VND. The withdrawal logic uses `balance >= amount` as the guard, but due to floating-point arithmetic in JavaScript (`0.1 + 0.2 !== 0.3`), the comparison `100000 >= 100000` may fail if previous transactions introduced floating-point rounding errors. Alternatively, a small platform fee or tax is added after the initial quote, making the final amount 100,001 VND.
- **Impact:** Member with seemingly sufficient funds cannot complete the purchase. Confusing "insufficient balance" error. Support inquiries increase. If the rounding goes the other way, the balance may allow a purchase that results in a negative balance.
- **Mitigation:** Use integer arithmetic for all monetary values (store amounts in the smallest denomination — VND is already integer, but for fractional currencies use cents/satoshis). Never use `Number` (float64) for money. Compare with `>=` using integers. For the fee scenario, compute the total (price + fee) upfront and display it before the member confirms, then use the exact total for the single withdrawal. Add an `assert(balanceAfter >= 0)` invariant after every transaction.
- **Test scenario:** Set wallet balance to exactly 100,000. Purchase an item priced at 100,000 with 0 fee. Assert success and final balance 0. Purchase an item priced at 99,900 with a 100 fee (total 100,000). Assert success and final balance 0. Attempt purchase of 100,001. Assert 400 insufficient balance.

### EC-PAY-004: Stripe refund processed but system failure before wallet credit

- **Category:** data_integrity
- **Risk:** critical
- **Description:** An admin approves a cancellation refund. The system calls Stripe to issue a refund. Stripe confirms the refund (returns `succeeded`). Before the wallet credit transaction is committed to MongoDB, the database connection drops or the server crashes. The refund exists on Stripe's side but the member's wallet is not credited, and the `Transaction` record is not created.
- **Impact:** Member loses their refund. The money is returned to the gym's Stripe account but never reaches the member. Support must manually credit the wallet. If undiscovered, it becomes an accounting discrepancy and a compliance issue.
- **Mitigation:** Use the transaction outbox pattern. Instead of writing to the database directly after Stripe confirms, first write a `{ status: 'pending', type: 'refund_credit' }` transaction to MongoDB (in the same transaction as the status update of the cancellation request). Then process the Stripe refund. After Stripe confirms, update the transaction to `completed`. A cron job (`resolvePendingRefundCreditsJob.js`) periodically scans for `pending` refund credits and reconciles them with Stripe. Alternatively, use a two-phase approach: credit the wallet first (as a pending hold), then refund on Stripe, then release the hold.
- **Test scenario:** Stub the wallet credit to throw after Stripe refund succeeds. Assert the `CancellationRequest` status is set to `approved`. Assert a `Transaction` with `status: 'pending'` exists. Run the reconciliation cron. Assert the transaction becomes `completed` and balance is updated.

### EC-PAY-005: Payment webhook from unknown source → security

- **Category:** security
- **Risk:** critical
- **Description:** An attacker sends a crafted POST request to the VNPAY IPN endpoint or Stripe webhook endpoint with fake payment success data. If the webhook signature verification is missing or flawed, the attacker can create fake payments, credit their wallet, or activate memberships without paying.
- **Impact:** Total loss of financial integrity. Unlimited free money. Membership granted without payment. Potential for large-scale theft before detection.
- **Mitigation:** Verify webhook signatures for every incoming event:
  - **Stripe:** Verify the `stripe-signature` header using `stripe.webhooks.constructEvent()` with the webhook secret.
  - **VNPAY:** Verify the `vnp_SecureHash` parameter using the configured hash secret.
  - **GHN:** Verify the webhook token/secret if available.
  Reject requests with missing or invalid signatures with `401 Unauthorized`. Log all rejected webhooks with source IP and payload for security monitoring. Do not expose raw request bodies in logs (may contain secrets).
- **Test scenario:** Send a POST to `/api/wallet/vnpay-ipn` with a fabricated payload and no signature. Assert 401. Send with an invalid signature. Assert 401. Send with a valid signature but mismatched amount. Assert 400 or 422 (validation error). Assert no transaction is created.

### EC-PAY-006: Payment amount mismatches between quote and charge

- **Category:** data_integrity
- **Risk:** high
- **Description:** A member proceeds to checkout for a 500,000 VND membership. Between the quote and the actual charge, a concurrent admin action changes the plan price to 600,000 VND. The charge succeeds for 500,000 (using the old price the frontend displayed), but the system tries to reconcile with the current plan price of 600,000. The amounts don't match.
- **Impact:** If the system rejects the payment due to mismatch, the member is charged but receives nothing. If it accepts, the revenue is 100,000 VND short. Either way, manual intervention is required.
- **Mitigation:** Lock the price at the time of checkout initialization. Store the `lockedPrice` in the `Payment` document or a temporary cart/quote record. The charge must use the locked price, not the current plan price. After charge success, verify: if the current plan price differs from the locked price, log a warning but do not reject — use the locked price for revenue accounting. Display a clear "price may change" disclaimer. Use a short-lived quote (e.g., 15-minute TTL) so prices cannot drift too far.
- **Test scenario:** Create a plan priced at 500,000. Initialize checkout (price locked at 500,000). Admin changes plan price to 600,000. Complete payment for 500,000. Assert the membership is created with price = 500,000. Assert a warning is logged about price drift.

---

## 5. Wallet (EC-WAL-*)

### EC-WAL-001: Concurrent wallet operations cause negative balance

- **Category:** race_condition
- **Risk:** critical
- **Description:** Two concurrent withdrawal requests for a wallet with a balance of 100,000 VND. Both requests read the balance as 100,000, both check `balance >= amount`, and both proceed to decrement. If using `findOneAndUpdate` without a guard, the second withdrawal succeeds even though the balance after the first is less than the second withdrawal amount.
- **Impact:** Negative wallet balance. Member effectively gets an interest-free loan. The gym loses the unbacked withdrawal amount. Accounting breaks.
- **Mitigation:** Use an atomic `findOneAndUpdate` with a `$inc` and a balance guard: `Wallet.findOneAndUpdate({ userId, balance: { $gte: amount } }, { $inc: { balance: -amount } })`. If the balance is insufficient, `findOneAndUpdate` returns `null` and the operation is rejected. This prevents negative balances entirely. The `walletService.js` already implements this pattern correctly.
- **Test scenario:** Wallet balance = 100,000. Fire 3 concurrent withdrawal requests for 50,000 each. Assert exactly 2 succeed and 1 fails with "Insufficient wallet balance". Assert final balance = 0.

### EC-WAL-002: Deposit via transfer but source account insufficient

- **Category:** external_failure
- **Risk:** medium
- **Description:** A member initiates a deposit via VNPAY/Stripe. The payment gateway confirms the transaction (status: `completed`). The webhook arrives, and the wallet is credited. Days later, the bank processes a reversal/chargeback because the source account had insufficient funds. The gym has already credited the wallet, and the member may have already spent the funds.
- **Impact:** The gym loses the credited amount if the member's wallet balance has already been spent elsewhere. If the member withdraws the deposited funds before the chargeback, the gym cannot recover the money.
- **Mitigation:** Implement a holding period for large deposits (e.g., amounts > 5,000,000 VND are held as `pending` for 24 hours before they become available for withdrawal). Monitor Stripe/VNPAY for `charge.dispute.created` or `payment.refunded` events. When a chargeback/dispute is received, immediately reverse the wallet credit by creating a deduction transaction. If the member's available balance is insufficient, mark the wallet as `negative` and trigger collections. Log all chargebacks for manual review.
- **Test scenario:** Simulate a Stripe `charge.dispute.created` webhook for a previously completed deposit. Assert the wallet is debited by the disputed amount. If the wallet balance is insufficient, assert `wallet.negativeSince` is set and the member is notified.

### EC-WAL-003: Withdrawal to deleted bank account

- **Category:** data_integrity
- **Risk:** high
- **Description:** A member initiates a withdrawal (wallet → external bank account). The withdrawal is processed in batch via a cron job. Between the withdrawal request and the batch execution, the member deletes their linked bank account or updates the account details. The cron job attempts to send funds to a stale or deleted bank account.
- **Impact:** Funds sent to the wrong account (if updated) or transfer fails (if deleted). If the transfer succeeds to a deleted account, recovery is extremely difficult. If it fails, the member's wallet is not debited, but the accounting system may show a debit.
- **Mitigation:** Validate the bank account reference immediately before executing the transfer in the batch job. If the account no longer exists or has changed, skip the withdrawal, mark it as `failed`, and notify the member. Use a two-phase approach: create a `pending` hold on the wallet when the withdrawal is requested, and only finalize the hold when the transfer succeeds. If the transfer fails, release the hold.
- **Test scenario:** Request a withdrawal. Delete the bank account. Run the withdrawal batch job. Assert the withdrawal status is `failed` with reason "Bank account not found". Assert the wallet balance is not debited (or the hold is released if two-phase).

### EC-WAL-004: Transaction log divergence between Wallet and Order records

- **Category:** data_integrity
- **Risk:** high
- **Description:** A shop order is placed using wallet payment. The `Order` document shows `paymentStatus: 'paid'` and the order total is deducted from the wallet. However, the `Transaction` record in the wallet's history is missing due to a database write failure during the deduction step. The wallet balance reflects the deduction, but there is no audit trail.
- **Impact:** Audit trail is incomplete. During reconciliation, the missing transaction appears as an unexplained balance decrease. The member cannot see the transaction in their wallet history, leading to trust issues. Accounting cannot trace the payment.
- **Mitigation:** Use a single MongoDB transaction to atomically create the `Transaction` record and update the wallet balance. If either fails, both roll back. Additionally, after the transaction commits, update the `Order` with the `transactionId`. If the order's `paymentStatus` is `paid` but no `transactionId` exists, flag it for reconciliation. Create a nightly reconciliation job that cross-references wallet balances + transaction logs against order payments.
- **Test scenario:** Simulate a write failure after `$inc` but before `Transaction.create`. Assert the wallet balance is unchanged (rolled back). Assert no orphan `Transaction` exists. Assert the `Order` remains `pending_payment`.

### EC-WAL-005: Wallet credit after membership cycle refunded to cancelled plan

- **Category:** business_logic
- **Risk:** medium
- **Description:** A member cancels their membership and is refunded 2,000,000 VND to the wallet. Later, an admin manually processes a refund for the same membership (due to a support request, unaware the first refund was already processed). The wallet receives a second credit of 2,000,000 VND.
- **Impact:** Double refund to the same member for the same membership cycle. Financial loss.
- **Mitigation:** Before processing any refund-linked wallet credit, query for existing `Transaction` records where `referenceId = membershipCycleId` and `type = 'refund'`. If found, reject the duplicate. Implement this check even for admin-initiated manual refunds. All refund flows must go through the same `RefundRequest` pipeline with status tracking, not ad-hoc wallet adjustments.
- **Test scenario:** Process a refund for a cycle. Wallet is credited 2,000,000. Admin attempts to issue another refund for the same cycle via the admin panel. Assert 409 Conflict. Assert no second transaction.

---

## 6. Shop (EC-SHP-*)

### EC-SHP-001: Inventory goes negative due to concurrent checkout

- **Category:** race_condition
- **Risk:** critical
- **Description:** Two members add the last unit of the same product to their carts and check out simultaneously. Both requests decrement `stock` from 1 to 0 (or 1 to -1). Without atomic decrement with a guard, both succeed, resulting in overselling.
- **Impact:** Oversold product. One member cannot fulfill their order. Refund or backorder required. Customer dissatisfaction. Inventory record shows negative stock.
- **Mitigation:** Use atomic `findOneAndUpdate` with a stock guard: `Product.findOneAndUpdate({ _id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })`. If the stock is insufficient, `findOneAndUpdate` returns null and the checkout is rejected. This must happen within the checkout transaction, not at cart-add time. Redis distributed locks can also help but are not strictly necessary if atomic DB ops are used.
- **Test scenario:** Product stock = 1. Fire 2 concurrent checkout requests for quantity 1. Assert exactly 1 succeeds. Assert the second receives an error. Assert product stock = 0.

### EC-SHP-002: GHN tracking update lost → order stuck in SHIPPING

- **Category:** external_failure
- **Risk:** medium
- **Description:** An order is shipped via GHN. The status is `ĐANG GIAO HÀNG`. GHN delivers the package and sends a webhook to update the tracking status to `GIAO THÀNH CÔNG`. The webhook delivery fails (network error, server restart, rate limiting). The order remains stuck in `ĐANG GIAO HÀNG` indefinitely.
- **Impact:** Order never completes. The seller's escrow is not released. The buyer cannot leave a review. Auto-confirmation logic (e.g., "auto-complete after 7 days if no update") is needed but may release escrow prematurely if the order is actually lost. Manual support intervention required.
- **Mitigation:** Implement a fallback polling mechanism: a cron job that periodically queries the GHN API for orders with status `ĐANG GIAO HÀNG` that are older than 3 days and updates their status locally. Also implement auto-confirmation: if an order has been in `ĐANG GIAO HÀNG` for 14 days without a delivery webhook, mark it as `GIAO THÀNH CÔNG` (after checking with GHN API) and release the escrow. Log all auto-confirmations for audit.
- **Test scenario:** Create an order with status `ĐANG GIAO HÀNG`. Do not send a delivery webhook. Run the GHN polling cron job (mocked). Assert the order status is updated to `GIAO THÀNH CÔNG`. Assert the seller's escrow is released.

### EC-SHP-003: Buyer returns item but seller already withdrew escrow

- **Category:** state_transition
- **Risk:** high
- **Description:** A buyer requests a return for a delivered product. The seller's escrow (payment held by the platform) has already been released to the seller because the system automatically releases escrow after the delivery confirmation + a 3-day grace period. The seller has already withdrawn the funds from their wallet. The buyer's return is approved, but there is no money left in escrow to refund.
- **Impact:** The platform must refund the buyer from its own pocket, or force the seller to return the funds (which they may refuse or be unable to do). Financial risk for the platform.
- **Mitigation:** Implement a longer escrow holding period for categories with high return rates. Alternatively, implement a "rolling reserve" — withhold a percentage of each escrow release to cover potential returns. When a return is initiated, immediately place a hold on the seller's available wallet balance for the order amount. If the seller has insufficient balance, block the return approval until the seller tops up. Clearly communicate the escrow release policy to sellers.
- **Test scenario:** Seller has wallet balance = 0. Escrow for a 500,000 VND order is released and withdrawn. Buyer initiates a return. Assert the system creates a "debt" record for the seller. Assert the return is approved but a negative balance or receivable is created for the seller. Assert the seller is notified about the debt.

### EC-SHP-004: Product deleted while in someone's cart

- **Category:** data_integrity
- **Risk:** low
- **Description:** An admin or seller deletes a product (or sets `isActive: false`). A member has the same product in their cart. When they proceed to checkout, the product lookup returns `null` or throws an error. The checkout fails with a confusing error message. Alternatively, if the cart uses a cached snapshot, the member may complete checkout for a deleted product.
- **Impact:** Member cannot complete checkout. If they can complete it, they purchase a product that no longer exists — fulfillment is impossible. Cart may become stuck with unresolvable items.
- **Mitigation:** During checkout, validate that every item in the cart references an active (`isActive: true`) product. If a product is inactive, remove it from the cart, notify the member, and proceed with the remaining items (or block checkout entirely depending on business rules). The cart API should periodically (on cart read) check for deleted/inactive products and flag them. Store a `priceSnapshot` in the cart item so price changes do not affect the checkout.
- **Test scenario:** Add product A to cart. Admin deactivates product A. Load cart. Assert product A is shown as "unavailable" with a remove option. Attempt checkout. Assert 400 error listing unavailable items. Remove the item and proceed. Assert checkout succeeds.

### EC-SHP-005: Shipping cost exceeds product price → negative margin

- **Category:** business_logic
- **Risk:** low
- **Description:** A product is priced at 50,000 VND. The GHN shipping cost to the buyer's remote location is 100,000 VND. The system allows checkout, and the seller receives 50,000 VND revenue minus a 2% platform fee = 49,000 VND, but must pay 100,000 VND for shipping. The seller loses money on the transaction.
- **Impact:** Seller incurs a loss. If this happens at scale, sellers leave the platform. If the platform offers free shipping promotions, the platform itself may bleed money.
- **Mitigation:** During checkout, display the shipping cost prominently before the buyer confirms. Allow sellers to set a minimum order amount for free shipping, or set a shipping subsidy policy. For very low-priced items, warn the seller at listing time. Optionally, set a "free shipping threshold" (e.g., order > 300,000 VND). Do not block the transaction — let the market decide, but provide transparency.
- **Test scenario:** Create a product priced at 50,000 with shipping cost of 100,000. Assert the checkout page shows both amounts clearly. Assert the seller dashboard shows the net margin (negative). Assert the order is still placed successfully if the buyer confirms.

### EC-SHP-006: Seller account disabled while orders in transit

- **Category:** state_transition
- **Risk:** high
- **Description:** A seller is banned or their account is disabled (e.g., policy violation, fraudulent activity). The seller has unfulfilled orders that are in `ĐANG GIAO HÀNG` or `CHỜ XÁC NHẬN` status. Orders cannot be confirmed, shipped, or cancelled. The system has no automatic handling for this state change.
- **Impact:** Orders are stuck in limbo. Buyers have paid but will not receive their items. Support team must manually process cancellations and refunds for all affected orders. If the seller was fraudulent, they may already have withdrawn the funds.
- **Mitigation:** When a seller is disabled, trigger a workflow: identify all active orders for that seller. For orders in `CHỜ XÁC NHẬN`, auto-cancel and refund. For orders in `ĐANG GIAO HÀNG`, attempt contact with the carrier (GHN) to return the package. For orders `GIAO THÀNH CÔNG`, release escrow to the buyer (reverse) if the seller was fraudulent. Send bulk notifications to affected buyers. Create a support ticket for each order.
- **Test scenario:** Disable a seller account that has 2 pending orders and 1 in-transit order. Assert the pending orders are auto-cancelled with refunds. Assert the in-transit order is flagged for manual review. Assert affected buyers receive notifications.

### EC-SHP-007: Concurrent cart operations on same product

- **Category:** race_condition
- **Risk:** medium
- **Description:** A member opens the shop in two browser tabs. In tab A, they add product X to cart. In tab B, they also add product X. Both tabs synchronize with the server-side cart and overwrite each other's state. The final cart may have quantity 1 instead of 2, or duplicate entries.
- **Impact:** Lost cart updates. Member adds 2 items but only 1 is in the final cart. Checkout has wrong quantity. Trust in the system erodes.
- **Mitigation:** Use server-side cart with versioning or last-write-wins with merge semantics. The cart should be stored as a single server-side document with `items[]`. Each add-to-cart operation is an upsert on `(cartId, productId)`, incrementing quantity. Use `$inc` for quantity updates rather than setting the whole array. If using a client-side cart, implement a conflict resolution strategy: compare timestamps and merge line items.
- **Test scenario:** From two concurrent requests, add product X (qty 1 each) to the same cart. Assert the cart shows quantity 2. Remove from tab A, add from tab B simultaneously. Assert the final state is consistent (either quantity 1 or 0, depending on execution order, but no crash or duplication).

---

## 7. System (EC-SYS-*)

### EC-SYS-001: Database connection lost mid-transaction

- **Category:** external_failure
- **Risk:** critical
- **Description:** The MongoDB primary node goes down or a network partition occurs during the execution of a multi-document transaction (e.g., membership purchase with Payment + Membership + MembershipCycle). Mongoose's default behavior is to retry the transaction, but if the retry also fails, the transaction aborts partially applied writes (automatic rollback). However, if the connection loss is not detected by the driver for several seconds, the HTTP request hangs indefinitely.
- **Impact:** HTTP request timeout. The client sees a 502/504. The member does not know if the payment succeeded. Idempotency key may or may not have been committed. Worst case: the gateway was charged but the transaction record was not committed, creating an orphan payment.
- **Mitigation:** Implement a robust connection pool with health checks (`mongoose.connection.readyState`). Set `serverSelectionTimeoutMS` and `socketTimeoutMS` to fail fast (e.g., 5 seconds). Use a global Express error handler that catches disconnection errors and returns `503 Service Unavailable`. Use a circuit breaker pattern for database-dependent routes. Implement automatic retry with exponential backoff for critical payment flows. The frontend should use optimistic UI with status polling rather than blocking on the payment response.
- **Test scenario:** Disconnect the MongoDB server. Send a membership purchase request. Assert the response is a 503 within 5 seconds (not a hang). Reconnect MongoDB. Assert no orphan documents exist (the transaction was rolled back).

### EC-SYS-002: Cron job missed window due to server restart

- **Category:** race_condition
- **Risk:** medium
- **Description:** A server restart (deployment, crash, scaling event) occurs during the scheduled execution window of an important cron job (e.g., midnight membership expiry check, daily wallet reconciliation, auto-renewal processing). The cron job runs once per day at 00:00. The server is down from 23:55 to 00:10. The cron job never fires.
- **Impact:** Memberships that expired today are not marked as `expired`. Auto-renewals are not processed. Wallet reconciliation is skipped. Streak resets happen 24 hours late. Revenue is delayed. Some time-sensitive operations (like membership expiry) may have cascading effects on check-in and booking.
- **Mitigation:** Use a persistent cron scheduler (e.g., `node-cron` with state persistence, or a database-backed job queue like `bull`). On server startup, implement a "catch-up" routine: scan for missed job executions by checking the last run timestamp in a `CronJobLog` collection. If the gap exceeds `scheduledInterval * 1.5`, rerun the job. For critical jobs, use a heartbeat mechanism that alerts if a job hasn't run in the expected window. Consider running jobs on a separate, redundant instance.
- **Test scenario:** Set the `lastRunAt` of a cron job to 25 hours ago. Start the server. Assert the "catch-up" routine detects the gap and executes the job immediately. Assert all expired memberships are processed. Assert a `CronJobLog` entry records the unscheduled execution.

### EC-SYS-003: Memory leak from unclosed SSE connections

- **Category:** external_failure
- **Risk:** medium
- **Description:** The system uses Server-Sent Events (SSE) or WebSocket (Socket.io) for real-time notifications. When a member closes their browser tab or navigates away, the WebSocket/Socket.io connection is not always properly closed (e.g., if the browser tab was killed, or a mobile app goes to background without clean disconnect). Each unclosed connection holds a reference in memory, consuming Node.js event loop resources and socket file descriptors.
- **Impact:** Memory grows monotonically over time. After days of operation, the Node.js process runs out of memory (OOM) and crashes. All connected clients are disconnected. The health check detects the crash and the orchestrator restarts the container, but the cycle repeats.
- **Mitigation:** Implement a connection heartbeat mechanism: Socket.io supports `pingTimeout` and `pingInterval`. Set aggressive timeouts (e.g., 30s ping interval, 10s timeout). Close connections that do not respond to pings. Use the `connectionCount` metric to monitor for leaks. Set a maximum concurrent connections limit and reject new connections if exceeded. Periodically sweep stale connections. For SSE, use `res.on('close', cleanup)` to release resources.
- **Test scenario:** Open 1000 WebSocket connections from test clients. Close the browser processes abruptly (kill -9). Assert that all connections are cleaned up within 60 seconds (ping timeout). Assert the process RSS memory returns to baseline after cleanup. Assert the connection count drops to 0.

### EC-SYS-004: Token refresh race condition (two simultaneous refresh requests)

- **Category:** race_condition
- **Risk:** high
- **Description:** The frontend detects that the access token is about to expire and fires two simultaneous `POST /api/auth/refresh` requests (e.g., due to two concurrent API calls triggering the 401 interceptor). Both requests use the same refresh token. The first refresh succeeds and issues a new access token + new refresh token (rotation). The second refresh attempt uses the now-stale refresh token and fails.
- **Impact:** The second request fails with a 401. The member is logged out unexpectedly. If the frontend's token refresh logic is not synchronized, the user sees a flash logout and must re-authenticate. In the worst case, both requests succeed (if the server does not invalidate old refresh tokens), giving the attacker/member two valid refresh tokens.
- **Mitigation:** Implement refresh token rotation: every time a refresh token is used, issue a new one and invalidate the old one. Synchronize refresh requests on the frontend: use a promise-based lock (a shared pending refresh promise) so only one refresh request is in-flight at a time. Queue or retry the second request after the first completes. On the backend, if a stale refresh token is presented, do not immediately reject — check if it was recently rotated (within a short window) and allow it if the new token hasn't been used yet (grace period).
- **Test scenario:** Fire two `POST /api/auth/refresh` requests simultaneously with the same refresh token. Assert exactly one succeeds. Assert the second receives an error (or is served via grace period). Assert the old refresh token is invalidated. Assert both callers receive usable access tokens (one from the direct response, the other from the queued retry).

### EC-SYS-005: Unauthorized access to admin API via direct URL manipulation

- **Category:** security
- **Risk:** critical
- **Description:** A member (role: `member`) discovers or guesses an admin API endpoint (e.g., `GET /api/admin/memberships`, `POST /api/admin/system-settings`). They craft a direct HTTP request with their own JWT token. If the middleware only checks that the token is valid (not that the role permits the action), the member can access admin-only functionality.
- **Impact:** Full data breach — member can view all other members' data, modify system settings, create/delete plans, process refunds, etc. Complete compromise of the system's access control.
- **Mitigation:** Implement role-based access control (RBAC) middleware on every admin route. The middleware must check `req.user.role` against the allowed roles for the endpoint. Do not rely on frontend-only hiding of UI elements. Use a declarative permission map: `{ 'GET /api/admin/memberships': ['admin', 'super_admin'], 'POST /api/admin/system-settings': ['super_admin'] }`. Include a default-deny policy: if no permission entry exists for a route, reject by default. Test all admin routes in integration tests.
- **Test scenario:** Login as a member, extract the JWT. Send `GET /api/admin/memberships` with the member's token. Assert 403 Forbidden. Assert the response body does not contain any membership data. Send `GET /api/member/memberships` with the same token. Assert 200 OK (member can access their own data).

### EC-SYS-006: Rate limiting bypass via IP spoofing or proxy chains

- **Category:** security
- **Risk:** medium
- **Description:** The API rate limiter is configured to throttle requests per IP address. An attacker uses a rotating proxy or VPN to cycle through hundreds of IP addresses, bypassing the per-IP rate limit. They can brute-force login endpoints, scrape member data, or perform a DDoS attack that appears to come from many distinct IPs.
- **Impact:** Brute-force login attacks succeed if password policies are weak. Member data is scraped. API availability degrades due to high request volume. Rate limiting is rendered ineffective.
- **Mitigation:** Combine IP-based rate limiting with user-based rate limiting (per JWT or API key). Use a sliding window counter in Redis for global rate limiting (e.g., max 10,000 requests per minute across all IPs). Implement CAPTCHA after N failed login attempts regardless of IP. Use a Web Application Firewall (WAF) to detect and block proxy/VPN traffic. Consider using the `X-Forwarded-For` header securely by trusting only the first proxy in the chain (configure `trust proxy` in Express).
- **Test scenario:** Send 200 requests from 200 distinct IPs (simulated via `X-Forwarded-For` header manipulation) to the login endpoint within 1 minute. Assert that after 10 failed attempts per user, CAPTCHA is triggered. Assert that after 10,000 total requests globally, all further requests receive 429. Assert that the server does not crash or degrade.

### EC-SYS-007: Concurrent request toggles the same system setting

- **Category:** race_condition
- **Risk:** low
- **Description:** Two admin users simultaneously toggle the same system setting (e.g., "Maintenance Mode"). Admin A sets it to `enabled: true`. Admin B, unaware of A's change, sets it to `enabled: false`. Depending on the order of writes, the final state may be unpredictable. If they are toggling from different initial states, the system may end up in a contradictory configuration.
- **Impact:** Maintenance mode state is inconsistent. Some services may read `true` (from a read replica with stale data) while others read `false`. Users may experience partial downtime or confusion.
- **Mitigation:** Use optimistic concurrency control: include a `version` or `updatedAt` field in the `SystemSettings` document. Before writing, verify that the document has not been modified since the admin last read it (compare `updatedAt`). If a conflict is detected, return `409 Conflict` with a message like "Settings were modified by another admin. Please reload and try again." All setting changes should be logged in the `AuditLog` with the before/after values.
- **Test scenario:** Admin A reads settings (version 1). Admin B reads settings (version 1). Admin A enables maintenance mode and writes (version 2). Admin B disables maintenance mode with `updatedAt = version 1`. Assert the write is rejected with 409. Assert the final state is maintenance mode enabled (Admin A's change). Assert the audit log contains both attempts.

---

## Appendix A: Cross-Module Impact Matrix

| Edge Case | MEM | BKG | CHK | PAY | WAL | SHP | SYS |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| EC-MEM-001 | ● |   |   | ● | ● |   |   |
| EC-MEM-003 | ● |   |   | ● |   |   |   |
| EC-MEM-008 | ● |   |   | ● |   |   |   |
| EC-BKG-001 |   | ● |   |   |   |   |   |
| EC-BKG-004 | ● | ● |   |   |   |   |   |
| EC-CHK-001 |   |   | ● |   |   |   |   |
| EC-CHK-003 | ● |   | ● |   |   |   |   |
| EC-PAY-001 |   |   |   | ● | ● |   |   |
| EC-PAY-004 | ● |   |   | ● | ● |   |   |
| EC-WAL-001 |   |   |   |   | ● |   |   |
| EC-WAL-004 |   |   |   | ● | ● | ● |   |
| EC-SHP-001 |   |   |   |   |   | ● |   |
| EC-SHP-003 |   |   |   | ● | ● | ● |   |
| EC-SYS-001 | ● | ● | ● | ● | ● | ● | ● |

---

## Appendix B: Test Coverage Summary

| Module | Edge Cases | Critical | High | Medium | Low |
|--------|:----------:|:--------:|:----:|:------:|:---:|
| Membership | 10 | 2 | 4 | 3 | 1 |
| Booking | 8 | 1 | 2 | 4 | 1 |
| Check-in | 6 | 0 | 4 | 1 | 1 |
| Payment | 6 | 4 | 1 | 1 | 0 |
| Wallet | 5 | 1 | 2 | 2 | 0 |
| Shop | 7 | 1 | 2 | 3 | 1 |
| System | 7 | 2 | 2 | 2 | 1 |
| **Total** | **49** | **11** | **17** | **16** | **5** |

---

*End of document. When a new edge case is discovered, add it to the appropriate section with a unique EC-[MODULE]-[NNN] identifier and update the appendices.*
