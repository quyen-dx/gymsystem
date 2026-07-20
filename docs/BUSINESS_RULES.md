# GymPro Gym Management System — Business Rules Catalog

> **Version:** 1.0  
> **Last updated:** 2026-07-20  
> **Scope:** All modules — Membership, Booking, Personal Training, Check-in, Payment, Wallet, Shop

---

## Table of Contents

1. [Membership (BR-MEM)](#1-membership-br-mem)
2. [Booking (BR-BKG)](#2-booking-br-bkg)
3. [Personal Training (BR-PT)](#3-personal-training-br-pt)
4. [Check-in (BR-CHK)](#4-check-in-br-chk)
5. [Payment (BR-PAY)](#5-payment-br-pay)
6. [Wallet (BR-WAL)](#6-wallet-br-wal)
7. [Shop (BR-SHP)](#7-shop-br-shp)
8. [Notification (BR-NTF)](#8-notification-br-ntf)
9. [Staff & Admin (BR-ADM)](#9-staff--admin-br-adm)
10. [Audit & Compliance (BR-AUD)](#10-audit--compliance-br-aud)

---

## 1. Membership (BR-MEM)

**BR-MEM-001: One active membership per member**
- **Type:** constraint
- **Applies to:** System, Member
- **Description:** A member may have at most one membership in an active, pending_activation, or frozen state at any given time. Expired, cancelled, or refunded memberships are excluded from this check.
- **Field mapping:** In pseudocode below, status values are lowercase (e.g. `'pending'`). Actual MongoDB field values use snake_case: `pending_activation`, `active`, `frozen`, `expired`, `cancelled`, `refunded`.
- **Logic:**
  ```
  IF member creates/activates new membership THEN
    countActive = SELECT COUNT(*) FROM memberships
                   WHERE member_id = :member_id
                     AND status IN ('active', 'pending', 'frozen')
    IF countActive >= 1 THEN
      REJECT with error "Member already has an active membership"
    END IF
  END IF
  ```
- **Error message:** "Member already has an active membership. Please cancel or wait for the current membership to expire before purchasing a new one."
- **Related rules:** BR-MEM-002, BR-MEM-005

**BR-MEM-002: Pending activation auto-activates on first check-in or after payment**
- **Type:** workflow
- **Applies to:** System
- **Description:** A membership created with status `pending` transitions to `active` upon the earlier of (a) the member's first successful check-in, or (b) payment settlement (if no check-in occurs first). The activation date is recorded as the trigger date.
- **Logic:**
  ```
  ON check-in success OR payment_confirmed FOR membership IN ('pending') DO
    UPDATE memberships
      SET status = 'active',
          activated_at = NOW(),
          expires_at = DATE_ADD(NOW(), INTERVAL duration_days DAY)
    WHERE id = :membership_id AND status = 'pending'
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-001, BR-CHK-002

**BR-MEM-003: Renewal creates pending cycle up to max 3 pending**
- **Type:** workflow
- **Applies to:** System, Member
- **Description:** When a member renews, a new pending membership cycle is created. A maximum of 3 consecutive pending renewals are allowed per active base membership. Once the current active cycle expires, the oldest pending cycle transitions to active automatically.
- **Logic:**
  ```
  ON renewal_request DO
    pendingCount = SELECT COUNT(*) FROM memberships
                   WHERE root_id = :root_id AND status = 'pending'
    IF pendingCount >= 3 THEN
      REJECT "Maximum renewal limit reached"
    END IF
    INSERT INTO memberships (member_id, status, cycle_number, start_date)
      VALUES (:member_id, 'pending', :next_cycle, NULL)
  ```
- **Error message:** "Maximum renewal limit reached. Please wait for your current cycle to complete before renewing further."
- **Related rules:** BR-MEM-001

**BR-MEM-004: Freeze max 2 per cycle, max 30 days per freeze, min 7 days between freezes**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A membership cycle may be frozen no more than 2 times. Each freeze period must not exceed 30 consecutive days. There must be at least 7 days of active status between the end of one freeze and the start of the next. The membership expiry date is extended by the freeze duration.
- **Logic:**
  ```
  ON freeze_request DO
    freezesThisCycle = SELECT COUNT(*) FROM freeze_log
                       WHERE membership_id = :membership_id
                         AND cycle_number = :current_cycle
    IF freezesThisCycle >= 2 THEN
      REJECT "Maximum 2 freezes per cycle"
    END IF
    IF :requested_days > 30 THEN
      REJECT "Freeze period cannot exceed 30 days"
    END IF
    lastFreezeEnd = SELECT MAX(end_date) FROM freeze_log
                    WHERE membership_id = :membership_id
    IF lastFreezeEnd IS NOT NULL AND DATE_DIFF(NOW(), lastFreezeEnd) < 7 THEN
      REJECT "Minimum 7 days between freezes"
    END IF
    -- Approve freeze and extend expiry
  ```
- **Error message:** "Freeze request denied. You have used all freezes for this cycle, the period exceeds 30 days, or fewer than 7 days have passed since your last freeze ended."
- **Related rules:** BR-MEM-001

**BR-MEM-005: Cancellation requires admin approval if activated**
- **Type:** workflow
- **Applies to:** Admin, Member
- **Description:** A member may cancel an unactivated (pending) membership without approval. Cancellation of an activated membership requires admin review and approval. The cancellation reason must be recorded. Upon approval, the membership status is set to `cancelled`.
- **Logic:**
  ```
  ON cancellation_request(membership_id, reason, requested_by) DO
    membership = SELECT * FROM memberships WHERE id = :membership_id
    IF membership.status = 'pending' THEN
      auto_cancel(membership)
    ELSE IF membership.status = 'active' THEN
      INSERT INTO admin_approval_queue (entity_type, entity_id, action, reason, requested_by)
        VALUES ('membership', :membership_id, 'cancel', :reason, :requested_by)
      NOTIFY admin "Cancellation request awaiting approval"
    END IF
  ```
- **Error message:** "Your membership is active. A cancellation request has been submitted for admin approval. You will be notified once processed."
- **Related rules:** BR-MEM-001, BR-MEM-006

**BR-MEM-006: Refund calculation**
- **Type:** calculation
- **Applies to:** Admin, System
- **Description:** Refund amount is calculated as follows:
  - **Unactivated within 7 days of purchase:** Full refund (100% of amount paid, no deductions).
  - **Unactivated after 7 days:** Full refund minus a processing fee (10% of amount paid, capped at a configurable maximum).
  - **Activated (cancelled with admin approval):** Prorated refund = `(remaining_days / total_days) * amount_paid`, rounded down to the nearest whole currency unit. The remaining days exclude any freeze periods already used.
  - **Activated after 50% of cycle consumed:** No refund.
- **Logic:**
  ```
  FUNCTION calculate_refund(membership, cancel_date):
    IF membership.status = 'pending' AND DATE_DIFF(cancel_date, membership.created_at) <= 7 THEN
      return membership.amount_paid
    ELSE IF membership.status = 'pending' AND DATE_DIFF(cancel_date, membership.created_at) > 7 THEN
      fee = MIN(membership.amount_paid * 0.10, MAX_PROCESSING_FEE)
      return membership.amount_paid - fee
    ELSE IF membership.status = 'active' AND admin_approved THEN
      totalDays = DATEDIFF(membership.expires_at, membership.activated_at)
      usedDays = DATEDIFF(cancel_date, membership.activated_at)
      usedDays = usedDays - total_freeze_days_in_period(membership.id, membership.activated_at, cancel_date)
      IF (usedDays / totalDays) >= 0.50 THEN
        return 0
      END IF
      remainingDays = totalDays - usedDays
      return FLOOR((remainingDays / totalDays) * membership.amount_paid)
    ELSE
      return 0
    END IF
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-005, BR-PAY-003

**BR-MEM-007: Expiry notification sent 7, 3, and 1 day before**
- **Type:** notification
- **Applies to:** System
- **Description:** Automated notifications are sent to the member at three milestones before membership expiry: 7 days (friendly reminder), 3 days (urgent reminder), and 1 day (final reminder). After expiry, a single "membership expired" notification is sent with renewal instructions.
- **Logic:**
  ```
  DAILY_CRON:
    membersExpiringSoon = SELECT * FROM memberships
                          WHERE status = 'active'
                            AND DATEDIFF(expires_at, CURRENT_DATE) IN (7, 3, 1)
    FOR EACH membership IN membersExpiringSoon:
      send_notification(membership.member_id, 'membership_expiring_soon',
                        { days_remaining: DATEDIFF(expires_at, CURRENT_DATE) })
    expiredToday = SELECT * FROM memberships
                   WHERE status = 'active' AND DATE(expires_at) = CURRENT_DATE
    FOR EACH membership IN expiredToday:
      membership.status = 'expired'
      send_notification(membership.member_id, 'membership_expired', {})
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-001

**BR-MEM-008: Trial period rules**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A trial membership has the following restrictions: (a) the member may not book personal training sessions; (b) the member is limited to a configurable number of check-ins (default: 3); (c) the trial duration is fixed (default: 7 days) and cannot be extended or frozen; (d) only one trial period is allowed per lifetime per individual (verified by government ID or phone number).
- **Logic:**
  ```
  ON trial_creation DO
    existingTrial = SELECT COUNT(*) FROM memberships
                    WHERE member_person_id = :person_id AND type = 'trial'
    IF existingTrial > 0 THEN
      REJECT "Trial period already used"
    END IF
    -- trial created with max_check_ins = 3, duration_days = 7, no booking flag = TRUE
  ON check_attempt IF membership.type = 'trial' DO
    IF membership.check_in_count >= membership.max_trial_check_ins THEN
      REJECT "Trial check-in limit reached"
    END IF
  ON booking_attempt IF membership.type = 'trial' DO
    REJECT "Trial members cannot book sessions"
  ```
- **Error message:** "Trial members are limited to 3 check-ins and cannot book personal training sessions. Please purchase a full membership to continue."
- **Related rules:** BR-MEM-001, BR-BKG-002

---

## 2. Booking (BR-BKG)

**BR-BKG-001: Booking window max 30 days ahead**
- **Type:** constraint
- **Applies to:** Member
- **Description:** No booking may be created for a date more than 30 calendar days in the future from the current date. This prevents the schedule from being locked too far in advance.
- **Logic:**
  ```
  ON booking_creation(session_date) DO
    IF DATEDIFF(session_date, CURRENT_DATE) > 30 THEN
      REJECT "Cannot book more than 30 days in advance"
    END IF
  ```
- **Error message:** "Bookings can only be made up to 30 days in advance."
- **Related rules:** BR-BKG-007

**BR-BKG-002: Member must have active membership to book**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A member must hold a membership with status `active` (or `pending` for first booking after payment) to create any booking. Trial, expired, frozen, and cancelled memberships are not eligible.
- **Logic:**
  ```
  ON booking_creation(member_id) DO
    activeMembership = SELECT * FROM memberships
                       WHERE member_id = :member_id
                         AND status IN ('active', 'pending')
                       ORDER BY created_at DESC LIMIT 1
    IF activeMembership IS NULL THEN
      REJECT "Active membership required"
    END IF
  ```
- **Error message:** "An active membership is required to book sessions. Please purchase or renew your membership."
- **Related rules:** BR-MEM-001, BR-MEM-008

**BR-BKG-003: Max 1 booking per slot per PT per time**
- **Type:** constraint
- **Applies to:** System
- **Description:** A given time slot (specific PT + specific start time + specific date) can have at most one booking. This prevents double-booking of a personal trainer.
- **Logic:**
  ```
  ON booking_creation(pt_id, start_time, date) DO
    existing = SELECT COUNT(*) FROM bookings
               WHERE pt_id = :pt_id
                 AND date = :date
                 AND start_time = :start_time
                 AND status NOT IN ('cancelled', 'rejected')
    IF existing > 0 THEN
      REJECT "Time slot already booked"
    END IF
  ```
- **Error message:** "This time slot is already booked. Please select a different time or trainer."
- **Related rules:** BR-PT-002

**BR-BKG-004: Cancellation by member: free up to 2 hours before; penalty fee after**
- **Type:** calculation / constraint
- **Applies to:** Member
- **Description:** A member may cancel a booking free of charge up to 2 hours before the scheduled start time. Cancellations within 2 hours incur a penalty fee equal to 50% of the session price, deducted from the member's wallet or charged to the original payment method.
- **Logic:**
  ```
  ON member_cancellation(booking_id) DO
    booking = SELECT * FROM bookings WHERE id = :booking_id
    minutesUntilStart = DATEDIFF_MINUTE(booking.start_time, NOW())
    IF minutesUntilStart >= 120 THEN
      booking.status = 'cancelled'
      refund_amount = booking.session_price  -- full refund
    ELSE
      booking.status = 'cancelled_with_penalty'
      penalty = booking.session_price * 0.50
      refund_amount = booking.session_price - penalty
      deduct_penalty_from_wallet(member_id, penalty)
    END IF
    process_refund(booking, refund_amount)
  ```
- **Error message:** "Cancellation within 2 hours of the session will incur a 50% penalty fee. Proceed? [Yes/No]"
- **Related rules:** BR-MEM-006, BR-PAY-003, BR-WAL-001

**BR-BKG-005: No-show penalty: 1 violation point, auto-cancellation after 3 violations**
- **Type:** workflow / constraint
- **Applies to:** Member
- **Description:** If a member does not check in for a booked session and does not cancel (no-show), the system records 1 violation point. When the member accumulates 3 violation points within a rolling 90-day window, all future bookings are auto-cancelled and the member is blocked from booking for 30 days. Points expire after 90 days from the date of the no-show.
- **Logic:**
  ```
  ON no_show(booking_id, member_id) DO
    INSERT INTO violation_log (member_id, type, booking_id, created_at)
      VALUES (:member_id, 'no_show', :booking_id, NOW())
    recentViolations = SELECT COUNT(*) FROM violation_log
                       WHERE member_id = :member_id
                         AND type = 'no_show'
                         AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    IF recentViolations >= 3 THEN
      block_bookings(member_id, duration_days = 30)
      cancel_all_future_bookings(member_id)
      NOTIFY member "Booking privileges suspended for 30 days due to repeated no-shows"
    END IF
  ```
- **Error message:** "You have accumulated 3 no-show violations. Your booking privileges have been suspended for 30 days."
- **Related rules:** BR-BKG-004, BR-CHK-001

**BR-BKG-006: PT can confirm/reject booking within 1 hour**
- **Type:** workflow
- **Applies to:** PT
- **Description:** When a member books a session, the assigned PT has 1 hour to confirm or reject the booking. If no action is taken within 1 hour, the booking is auto-confirmed. Rejection requires a reason and triggers a full refund to the member.
- **Logic:**
  ```
  ON booking_created DO
    startReminderTimer(booking_id, 60 minutes)
  ON timer_expired(booking_id) DO
    IF booking.status = 'pending' THEN
      booking.status = 'confirmed'
    END IF
  ON pt_rejection(booking_id, reason) DO
    booking.status = 'rejected'
    booking.rejection_reason = reason
    full_refund(booking)
    notify_member("Your booking was rejected. Reason: " + reason)
  ```
- **Error message:** N/A
- **Related rules:** BR-BKG-003, BR-PT-001

**BR-BKG-007: Recurring booking rules**
- **Type:** constraint
- **Applies to:** Member, PT
- **Description:** Recurring (standing) bookings are subject to: (a) maximum horizon of 4 weeks from the current date; (b) same day-of-week and same start time for all occurrences; (c) the member must have an active membership for the entire recurring period; (d) the PT must have availability for every occurrence at creation time; (e) cancellations apply to individual occurrences (not the entire series) unless the member explicitly cancels the series.
- **Logic:**
  ```
  ON recurring_booking_creation(member_id, pt_id, day_of_week, start_time, num_weeks) DO
    IF num_weeks > 4 THEN
      REJECT "Recurring bookings max 4 weeks"
    END IF
    FOR week_offset IN 0..num_weeks-1:
      date = DATE_ADD(CURRENT_DATE, INTERVAL (week_offset * 7 + day_offset) DAY)
      IF DATEDIFF(date, CURRENT_DATE) > 30 THEN
        REJECT "Booking exceeds 30-day window"
      END IF
      validate_membership_active_for_date(member_id, date)
      validate_slot_available(pt_id, date, start_time)
      -- create individual booking
    END FOR
  ```
- **Error message:** "Recurring booking request exceeds limits. Maximum 4 weeks, same day/time required for all sessions."
- **Related rules:** BR-BKG-001, BR-BKG-002, BR-BKG-003

---

## 3. Personal Training (BR-PT)

**BR-PT-001: Max 10 active member assignments per PT**
- **Type:** constraint
- **Applies to:** PT, Admin
- **Description:** A personal trainer may be assigned to a maximum of 10 active members at any given time. A member is considered "active" for a PT if they have a booking within the last 30 days or a confirmed recurring series.
- **Logic:**
  ```
  ON assign_member_to_pt(pt_id) DO
    activeAssignments = SELECT COUNT(DISTINCT member_id) FROM bookings
                        WHERE pt_id = :pt_id
                          AND status = 'confirmed'
                          AND session_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    IF activeAssignments >= 10 THEN
      REJECT "PT has reached maximum member capacity"
    END IF
  ```
- **Error message:** "This personal trainer is currently at full capacity (10 members). Please select a different trainer or join the waitlist."
- **Related rules:** BR-BKG-003

**BR-PT-002: PT availability defined by schedule, max 8 sessions/day**
- **Type:** constraint
- **Applies to:** PT
- **Description:** Each PT maintains a weekly schedule defining available time slots. A PT may not exceed 8 sessions (bookings) per calendar day. Sessions cannot overlap. The PT schedule must be published at least 7 days ahead.
- **Logic:**
  ```
  ON booking_creation OR schedule_update DO
    dailyCount = SELECT COUNT(*) FROM bookings
                 WHERE pt_id = :pt_id AND session_date = :date
                   AND status NOT IN ('cancelled', 'rejected')
    IF dailyCount >= 8 THEN
      REJECT "PT daily session limit reached"
    END IF
    -- validate no overlap with existing bookings
  ON schedule_publish DO
    IF MIN_DATE(schedule_slots) < DATE_ADD(NOW(), INTERVAL 7 DAY) THEN
      WARN "Schedule must be published at least 7 days ahead"
    END IF
  ```
- **Error message:** "The trainer has reached the maximum of 8 sessions for this day. Please choose another date."
- **Related rules:** BR-BKG-003, BR-PT-001

**BR-PT-003: PT cannot book themselves**
- **Type:** constraint
- **Applies to:** PT
- **Description:** A personal trainer may not create a booking with themselves as the trainer. This prevents self-assignment and ensures that PTs acting as members use the member booking flow with a different trainer.
- **Logic:**
  ```
  ON booking_creation(member_id, pt_id) DO
    IF member_id == pt_id THEN
      REJECT "Trainers cannot book themselves"
    END IF
  ```
- **Error message:** "Trainers cannot book themselves. Please select another trainer or use the member booking flow."
- **Related rules:** BR-BKG-003

**BR-PT-004: PT can modify own schedule min 24h in advance**
- **Type:** constraint
- **Applies to:** PT
- **Description:** A personal trainer may modify their published schedule (add, remove, or edit slots) provided the changes take effect no sooner than 24 hours from the current time. Slots within the next 24 hours are locked. If an existing booking is affected by a schedule change, the PT must contact the member to reschedule.
- **Logic:**
  ```
  ON schedule_modification(pt_id, slot_datetime) DO
    IF DATEDIFF_HOUR(slot_datetime, NOW()) < 24 THEN
      REJECT "Cannot modify slots within 24 hours"
    END IF
    affectedBookings = SELECT * FROM bookings
                       WHERE pt_id = :pt_id
                         AND session_date = DATE(slot_datetime)
                         AND start_time = TIME(slot_datetime)
                         AND status = 'confirmed'
    IF affectedBookings IS NOT EMPTY THEN
      -- Flag for manual reschedule; PT must handle
      NOTIFY pt "Existing bookings affected; manual reschedule required"
    END IF
  ```
- **Error message:** "Schedule changes must be made at least 24 hours in advance."
- **Related rules:** BR-PT-002, BR-BKG-003

---

## 4. Check-in (BR-CHK)

**BR-CHK-001: QR code required for check-in**
- **Type:** validation
- **Applies to:** Member, System
- **Description:** Every check-in requires scanning a valid QR code associated with the member's active (or pending) membership. The QR code is regenerated on membership renewal. QR codes are single-use within a 30-second window to prevent replay attacks.
- **Logic:**
  ```
  ON check_in_attempt(qr_token) DO
    membership = SELECT * FROM memberships WHERE qr_token = :qr_token
    IF membership IS NULL THEN
      REJECT "Invalid QR code"
    END IF
    IF DATEDIFF_SECOND(qr_generated_at, NOW()) > 30 THEN
      REJECT "QR code expired"
    END IF
    IF membership.status NOT IN ('active', 'pending') THEN
      REJECT "Membership not eligible for check-in"
    END IF
    -- proceed with check-in
  ```
- **Error message:** "Invalid or expired QR code. Please refresh your QR code in the app."
- **Related rules:** BR-CHK-002, BR-CHK-004, BR-CHK-005

**BR-CHK-002: Auto-activates pending membership on first check-in**
- **Type:** workflow
- **Applies to:** System
- **Description:** When a member with a `pending` membership checks in for the first time, the membership is automatically activated. The activation date is set to the check-in date and the expiry date is calculated from that point.
- **Logic:**
  ```
  ON check_in_success(membership) DO
    IF membership.status = 'pending' AND membership.activated_at IS NULL THEN
      UPDATE memberships
        SET status = 'active',
            activated_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL duration_days DAY)
      WHERE id = membership.id
    END IF
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-002

**BR-CHK-003: Streak tracking: consecutive days only**
- **Type:** calculation
- **Applies to:** System, Member
- **Description:** A check-in streak counts consecutive calendar days on which the member checks in at least once. If a day is missed (no check-in between 00:00:00 and 23:59:59 local time), the streak resets to 0. The streak is calculated from the most recent check-in backwards.
- **Logic:**
  ```
  FUNCTION calculate_streak(member_id):
    streak = 0
    cursorDate = CURRENT_DATE
    LOOP:
      hasCheckIn = SELECT COUNT(*) FROM check_ins
                   WHERE member_id = :member_id AND DATE(check_in_time) = cursorDate
      IF hasCheckIn > 0 THEN
        streak++
        cursorDate = cursorDate - 1
      ELSE
        BREAK
      END IF
    END LOOP
    RETURN streak
  ```
- **Error message:** N/A
- **Related rules:** BR-CHK-004

**BR-CHK-004: Daily check-in limit: once per membership per day**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A member may check in at most once per calendar day per membership. Multiple check-ins on the same day are rejected. This applies regardless of gym location or check-in method.
- **Logic:**
  ```
  ON check_in_attempt(member_id, membership_id) DO
    todayCheckIns = SELECT COUNT(*) FROM check_ins
                    WHERE membership_id = :membership_id
                      AND DATE(check_in_time) = CURRENT_DATE
    IF todayCheckIns > 0 THEN
      REJECT "Already checked in today"
    END IF
  ```
- **Error message:** "You have already checked in today. Please come back tomorrow!"
- **Related rules:** BR-CHK-001, BR-CHK-003

**BR-CHK-005: Check-in window: gym operating hours only**
- **Type:** validation
- **Applies to:** Member
- **Description:** Check-in is only permitted during the gym's published operating hours for the specific location. The operating hours are configurable per branch and may vary by day of week. Check-ins outside operating hours are rejected with an appropriate message.
- **Logic:**
  ```
  ON check_in_attempt(branch_id) DO
    hours = SELECT open_time, close_time FROM branch_hours
            WHERE branch_id = :branch_id AND day_of_week = DAYOFWEEK(NOW())
    IF CURRENT_TIME < hours.open_time OR CURRENT_TIME > hours.close_time THEN
      REJECT "Gym is closed"
    END IF
  ```
- **Error message:** "The gym is currently closed. Operating hours are {open_time} - {close_time}. Please visit during operating hours."
- **Related rules:** BR-CHK-001

---

## 5. Payment (BR-PAY)

**BR-PAY-001: All financial transactions must be atomic (wallet + order)**
- **Type:** constraint
- **Applies to:** System
- **Description:** Every financial transaction that involves both a wallet operation and an order status change must be executed within a single database transaction. If either operation fails, the entire transaction must roll back. This ensures that money is never deducted without a corresponding order update and vice versa.
- **Logic:**
  ```
  BEGIN TRANSACTION
    UPDATE wallets SET balance = balance - :amount WHERE member_id = :member_id
    IF ROWS_AFFECTED == 0 THEN ROLLBACK
    UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = :order_id
    IF ROWS_AFFECTED == 0 THEN ROLLBACK
    INSERT INTO transaction_log (member_id, order_id, amount, type)
      VALUES (:member_id, :order_id, :amount, 'payment')
  COMMIT
  ON ERROR ROLLBACK
  ```
- **Error message:** "Transaction failed. Your payment method has not been charged. Please try again."
- **Related rules:** BR-WAL-001, BR-WAL-003, BR-WAL-004

**BR-PAY-002: Payment idempotency key required for all transactions**
- **Type:** validation
- **Applies to:** System
- **Description:** Every payment request must include a unique idempotency key (UUID). The system must reject duplicate requests with the same key within 24 hours. This prevents accidental double-charges due to network retries or user re-submission.
- **Logic:**
  ```
  ON payment_request(idempotency_key, ...) DO
    existing = SELECT * FROM payment_idempotency_log
               WHERE key = :idempotency_key
                 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    IF existing IS NOT NULL THEN
      RETURN existing.result  -- return previous response
    END IF
    -- process payment
    INSERT INTO payment_idempotency_log (key, result, created_at)
      VALUES (:idempotency_key, :result, NOW())
  ```
- **Error message:** "This payment request has already been processed. Please check your order status."
- **Related rules:** BR-PAY-001

**BR-PAY-003: Refund must go to original payment method or wallet**
- **Type:** constraint
- **Applies to:** System, Admin
- **Description:** Refunds must be processed to the original payment method used for the transaction. If the original payment method is no longer available (e.g., expired card), the refund may be issued to the member's wallet as a fallback. Partial refunds are supported only if the payment gateway supports them. Cash refunds are not permitted.
- **Logic:**
  ```
  ON refund_process(original_transaction, refund_amount) DO
    IF original_transaction.payment_method IS STILL_VALID THEN
      refund_to_original_method(original_transaction, refund_amount)
    ELSE
      credit_wallet(original_transaction.member_id, refund_amount)
    END IF
  ```
- **Error message:** "Refund failed. The original payment method is no longer valid. Please contact support to receive a wallet credit."
- **Related rules:** BR-MEM-006, BR-WAL-001

**BR-PAY-004: VNPAY timeout: 15 minutes; Stripe: 30 minutes**
- **Type:** constraint
- **Applies to:** System
- **Description:** Payment gateway timeouts are enforced per gateway: VNPAY transactions expire after 15 minutes from creation; Stripe transactions expire after 30 minutes. Expired transactions are marked as `timeout` and associated reservations (inventory, booking slots) are released.
- **Logic:**
  ```
  ON payment_timeout_check DO
    timedOut = SELECT * FROM payment_transactions
               WHERE status = 'pending'
                 AND ((gateway = 'vnpay' AND DATEDIFF_MINUTE(created_at, NOW()) > 15)
                   OR (gateway = 'stripe' AND DATEDIFF_MINUTE(created_at, NOW()) > 30))
    FOR EACH txn IN timedOut:
      txn.status = 'timeout'
      release_reservations(txn.order_id)
      notify_member(txn.member_id, 'Payment timeout')
  ```
- **Error message:** "Payment session has expired. Please start a new payment."
- **Related rules:** BR-PAY-002, BR-SHP-001

**BR-PAY-005: Minimum payment: 1,000 VND (or equivalent)**
- **Type:** validation
- **Applies to:** System
- **Description:** All payment transactions must have a minimum value of 1,000 VND (or the equivalent in the configured currency). Transactions below this threshold are rejected. This prevents zero-value or dust transactions that incur gateway fees exceeding the transaction amount.
- **Logic:**
  ```
  ON payment_creation(amount, currency) DO
    minAmount = convert_to_vnd(1000, currency)
    IF amount < minAmount THEN
      REJECT "Payment amount below minimum"
    END IF
  ```
- **Error message:** "The minimum payment amount is 1,000 VND. Please add more items or increase the amount."
- **Related rules:** BR-PAY-001

---

## 6. Wallet (BR-WAL)

**BR-WAL-001: Wallet balance cannot go negative**
- **Type:** constraint
- **Applies to:** System
- **Description:** A member's wallet balance must never become negative. Any operation that would result in a negative balance (withdrawal, payment, fee deduction) must be rejected before execution. Balance checks occur within the transaction before the deduction.
- **Logic:**
  ```
  ON wallet_debit(member_id, amount) DO
    balance = SELECT balance FROM wallets WHERE member_id = :member_id
    IF balance < amount THEN
      REJECT "Insufficient wallet balance"
    END IF
    UPDATE wallets SET balance = balance - :amount WHERE member_id = :member_id
  ```
- **Error message:** "Insufficient wallet balance. Current balance: {balance}. Required: {amount}."
- **Related rules:** BR-PAY-001, BR-WAL-002, BR-WAL-003

**BR-WAL-002: Withdrawal requires identity verification**
- **Type:** workflow
- **Applies to:** Member, Admin
- **Description:** Wallet withdrawals (converting wallet credits to cash) require the member to complete identity verification (government ID upload + verification). Withdrawals are limited to a maximum of 10,000,000 VND per transaction and 50,000,000 VND per month. Withdrawals are reviewed by an admin before processing.
- **Logic:**
  ```
  ON withdrawal_request(member_id, amount) DO
    IF member_id_verification_status(member_id) != 'verified' THEN
      REJECT "Identity verification required"
    END IF
    IF amount > 10_000_000 THEN
      REJECT "Maximum withdrawal per transaction is 10,000,000 VND"
    END IF
    monthlyTotal = SELECT COALESCE(SUM(amount), 0) FROM withdrawals
                   WHERE member_id = :member_id
                     AND created_at >= DATE_TRUNC('month', NOW())
    IF monthlyTotal + amount > 50_000_000 THEN
      REJECT "Monthly withdrawal limit exceeded"
    END IF
    INSERT INTO admin_approval_queue (entity_type, entity_id, action, amount)
      VALUES ('withdrawal', :member_id, 'approve', amount)
  ```
- **Error message:** "Withdrawal requires identity verification. Please upload your government ID in your profile settings."
- **Related rules:** BR-WAL-001, BR-WAL-003

**BR-WAL-003: Transaction history immutable (append-only)**
- **Type:** constraint
- **Applies to:** System
- **Description:** All wallet transaction records are append-only. No UPDATE or DELETE operations are permitted on the transaction log. Corrections must be made via offsetting transactions (e.g., a reversing entry). This ensures a complete and auditable financial trail.
- **Logic:**
  ```
  -- Database-level: REVOKE UPDATE, DELETE ON transaction_log FROM ALL ROLES
  -- Application-level:
  ON correction_needed(original_txn_id, reason) DO
    INSERT INTO transaction_log (member_id, amount, type, reference_txn_id, note)
      VALUES (:member_id, -:original_amount, 'correction', :original_txn_id, :reason)
    UPDATE wallets SET balance = balance - :original_amount
      WHERE member_id = :member_id
  ```
- **Error message:** N/A
- **Related rules:** BR-WAL-001, BR-WAL-004, BR-AUD-001

**BR-WAL-004: Dual-entry booking required for all transactions**
- **Type:** constraint
- **Applies to:** System
- **Description:** Every wallet transaction must have a corresponding dual entry (debit and credit) recorded in the general ledger. A transaction is not considered complete until both entries are persisted. The sum of all debits must equal the sum of all credits at all times.
- **Logic:**
  ```
  BEGIN TRANSACTION:
    INSERT INTO ledger_entries (account, amount, type, txn_id, description)
      VALUES ('wallet:' + :memberId, :amount, 'debit', :txn_id, :description)
    INSERT INTO ledger_entries (account, :counterparty_account, :amount, 'credit', :txn_id, :description)
    IF NOT (SELECT SUM(amount) FROM ledger_entries WHERE txn_id = :txn_id AND type = 'debit') =
          (SELECT SUM(amount) FROM ledger_entries WHERE txn_id = :txn_id AND type = 'credit') THEN
      ROLLBACK
    END IF
  COMMIT
  ```
- **Error message:** "Transaction failed due to an accounting error. Please contact support."
- **Related rules:** BR-WAL-003, BR-PAY-001, BR-AUD-001

---

## 7. Shop (BR-SHP)

**BR-SHP-001: Inventory reservation on order creation, release on timeout/cancel**
- **Type:** workflow
- **Applies to:** System
- **Description:** When an order is created, inventory is reserved (deducted from available stock and placed into a "reserved" bucket). If the order is cancelled, expires, or payment times out, the reservation is released and stock is returned to available. Reservations automatically expire after 30 minutes for unpaid orders.
- **Logic:**
  ```
  ON order_creation(order_id, items) DO
    FOR EACH item IN items:
      available = SELECT qty_available FROM inventory WHERE product_id = item.product_id
      IF available < item.quantity THEN
        REJECT "Insufficient stock"
      END IF
      UPDATE inventory
        SET qty_available = qty_available - item.quantity,
            qty_reserved = qty_reserved + item.quantity
        WHERE product_id = item.product_id
    ORDER_EXPIRY_TIMER(order_id, 30 minutes)
  ON order_timeout(order_id) OR order_cancellation(order_id) DO
    release_reservation(order_id)
  FUNCTION release_reservation(order_id):
    items = SELECT * FROM order_items WHERE order_id = :order_id
    FOR EACH item IN items:
      UPDATE inventory
        SET qty_available = qty_available + item.quantity,
            qty_reserved = qty_reserved - item.quantity
        WHERE product_id = item.product_id
  ```
- **Error message:** "Sorry, {product_name} is out of stock. The item has been removed from your cart."
- **Related rules:** BR-PAY-004, BR-SHP-002, BR-SHP-003

**BR-SHP-002: Platform fee: 2% of product price**
- **Type:** calculation
- **Applies to:** System
- **Description:** A platform fee of 2% of the product price is added to every shop order. The fee is calculated per item as `FLOOR(item_price * 0.02 * item_quantity)` and summed for the order total. The platform fee is displayed as a separate line item on the invoice.
- **Logic:**
  ```
  FUNCTION calculate_platform_fee(order_id):
    totalFee = 0
    items = SELECT product_id, price, quantity FROM order_items WHERE order_id = :order_id
    FOR EACH item IN items:
      itemFee = FLOOR(item.price * 0.02 * item.quantity)
      totalFee = totalFee + itemFee
    END FOR
    RETURN totalFee
  ```
- **Error message:** N/A
- **Related rules:** BR-SHP-001

**BR-SHP-003: Escrow holds payment until delivery confirmation**
- **Type:** workflow
- **Applies to:** System, Admin
- **Description:** When a customer pays for a shop order, the funds are held in escrow (not released to the seller). The funds are released to the seller only after the customer confirms delivery or 7 days after delivery confirmation if no dispute is raised. If a dispute is raised, funds remain in escrow until admin resolution.
- **Logic:**
  ```
  ON payment_success(order_id) DO
    order.status = 'paid'
    -- funds held in escrow account
    credit_escrow(seller_id, order.total)
  ON delivery_confirmed(order_id) DO
    order.status = 'delivered'
    delivery_acceptance_timer(order_id, 7 days)
  ON timer_expired(order_id) DO
    IF order.status == 'delivered' AND no_dispute_active(order_id) THEN
      release_funds_to_seller(order_id)
      order.status = 'completed'
    END IF
  ON dispute_raised(order_id) DO
    order.status = 'disputed'
    NOTIFY admin "Dispute raised on order " + order_id
  ```
- **Error message:** N/A
- **Related rules:** BR-SHP-001, BR-SHP-004

**BR-SHP-004: Return window: 7 days from delivery**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A member may request a return within 7 calendar days from the delivery confirmation date. Items must be unused and in original packaging. The return request must include photographic evidence. The seller has 48 hours to approve or reject. If approved, the refund is processed within 5 business days.
- **Logic:**
  ```
  ON return_request(order_item_id) DO
    orderItem = SELECT oi.*, o.delivery_confirmed_at
                FROM order_items oi JOIN orders o ON oi.order_id = o.id
                WHERE oi.id = :order_item_id
    daysSinceDelivery = DATEDIFF(NOW(), orderItem.delivery_confirmed_at)
    IF daysSinceDelivery > 7 THEN
      REJECT "Return window has expired"
    END IF
    return_request.status = 'pending'
    seller_approval_timer(return_request.id, 48 hours)
  ON seller_reject(return_request_id) DO
    return_request.status = 'rejected'
    DISPUTE_OPTION member
  ```
- **Error message:** "The return window is 7 days from delivery. Your window has expired. Please contact support for assistance."
- **Related rules:** BR-SHP-003

---

## 8. Notification (BR-NTF)

**BR-NTF-001: In-app notification delivery within 30 seconds**
- **Type:** constraint
- **Applies to:** System
- **Description:** All in-app (push) notifications must be delivered to the recipient within 30 seconds of the triggering event. Notifications are delivered via WebSocket (real-time) with a Firebase Cloud Messaging fallback. Delivery receipt must be acknowledged.
- **Logic:**
  ```
  ON trigger_event DO
    notification = create_notification(event)
    send_realtime(notification)
    IF delivery_acknowledged(notification) == FALSE AFTER 30 SECONDS THEN
      send_fcm_push(notification)
    END IF
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-007

**BR-NTF-002: Email notifications: batched, max 1 per hour per member**
- **Type:** constraint
- **Applies to:** System
- **Description:** Email notifications are batched to avoid spamming. A member may receive at most 1 email notification per hour. Urgent notifications (payment failures, security alerts) bypass this rate limit.
- **Logic:**
  ```
  ON email_notification_trigger(member_id, type) DO
    IF type NOT IN ('payment_failure', 'security_alert', 'password_change') THEN
      lastEmail = SELECT MAX(created_at) FROM notification_queue
                  WHERE member_id = :member_id AND channel = 'email'
      IF lastEmail IS NOT NULL AND DATEDIFF_MINUTE(lastEmail, NOW()) < 60 THEN
        batch_for_later(member_id, notification)
        RETURN
      END IF
    END IF
    send_email(member_id, notification)
  ```
- **Error message:** N/A
- **Related rules:** BR-MEM-007, BR-NTF-001

**BR-NTF-003: Opt-out channels: email and push, never SMS (transactional)**
- **Type:** constraint
- **Applies to:** Member
- **Description:** Members may opt out of marketing/promotional email and push notifications via their profile settings. Transactional notifications (payment receipts, membership expiry, booking confirmations) cannot be opted out of. SMS notifications are reserved exclusively for transactional/urgent messages and cannot be opted out of.
- **Logic:**
  ```
  ON notification_preference_update(member_id, channel, opt_out) DO
    IF channel IN ('email', 'push') AND notification_type == 'promotional' THEN
      UPDATE member_preferences SET opted_out = TRUE WHERE channel = :channel
    ELSE IF channel == 'sms' THEN
      REJECT "SMS notifications are mandatory for transactional messages"
    END IF
  ```
- **Error message:** "SMS notifications are mandatory for account security and transactional purposes and cannot be disabled."
- **Related rules:** BR-NTF-001, BR-NTF-002

---

## 9. Staff & Admin (BR-ADM)

**BR-ADM-001: Admin approval required for refunds above 1,000,000 VND**
- **Type:** workflow
- **Applies to:** Admin
- **Description:** Any refund exceeding 1,000,000 VND (or equivalent) requires approval from a staff member with the `finance_admin` role. The system creates an approval request and the refund is held in `pending_approval` status until resolved.
- **Logic:**
  ```
  ON refund_request(amount) DO
    IF amount > 1_000_000 THEN
      INSERT INTO admin_approval_queue (entity_type, entity_id, action, amount, required_role)
        VALUES ('refund', :refund_id, 'approve', :amount, 'finance_admin')
      RETURN "Pending finance admin approval"
    ELSE
      process_refund(refund_id)
    END IF
  ```
- **Error message:** "Refunds over 1,000,000 VND require finance admin approval. A request has been submitted."
- **Related rules:** BR-MEM-006, BR-PAY-003

**BR-ADM-002: Role-based access control for all admin actions**
- **Type:** constraint
- **Applies to:** Admin
- **Description:** Every admin action is governed by a role-based access control (RBAC) policy. The following roles are defined with minimum permissions:
  - `staff`: View members, process check-ins, manage shop inventory.
  - `pt`: View own schedule, manage own bookings, view assigned members.
  - `finance_admin`: Process refunds, approve withdrawals, view financial reports.
  - `super_admin`: Full access including user management, role assignment, system configuration.
  - `auditor`: Read-only access to all data including financial and audit logs.
- **Logic:**
  ```
  ON admin_action(user, action, resource) DO
    permitted = SELECT COUNT(*) FROM role_permissions
                WHERE role = user.role
                  AND action = :action
                  AND resource = :resource
    IF permitted == 0 THEN
      REJECT "Access denied"
    END IF
  ```
- **Error message:** "Access denied. You do not have permission to perform this action."
- **Related rules:** BR-ADM-001

**BR-ADM-003: All admin actions must be logged with actor identity**
- **Type:** constraint
- **Applies to:** System, Admin
- **Description:** Every action performed by an admin or staff user (including view operations on sensitive data) must be recorded in the admin audit log. The log entry must include: actor ID, timestamp, action type, resource type, resource ID, old value, new value, IP address, and user agent.
- **Logic:**
  ```
  ON admin_action_completed(actor, action, resource, oldValue, newValue) DO
    INSERT INTO admin_audit_log (actor_id, action, resource_type, resource_id,
                                 old_value, new_value, ip_address, user_agent, created_at)
      VALUES (:actor.id, :action, :resource.type, :resource.id,
              :oldValue, :newValue, :ip, :userAgent, NOW())
  ```
- **Error message:** N/A
- **Related rules:** BR-AUD-001, BR-AUD-002

---

## 10. Audit & Compliance (BR-AUD)

**BR-AUD-001: All financial records retained for 5 years**
- **Type:** constraint
- **Applies to:** System
- **Description:** All financial records (transactions, invoices, refunds, wallet logs, payment gateway responses) must be retained in their original form for a minimum of 5 years from the date of creation. Soft-delete is prohibited; hard-delete is blocked at the database level. After 5 years, records may be archived to cold storage but must remain retrievable within 72 hours upon request.
- **Logic:**
  ```
  -- Database triggers prohibit DELETE on financial tables
  CREATE TRIGGER block_financial_delete
    BEFORE DELETE ON transaction_log, payment_transactions, invoices, refunds
    FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Deletion of financial records is prohibited'
  -- Archival job (annual):
  ON ARCHIVAL_CHECK DO
    archiveRecords = SELECT * FROM financial_tables
                     WHERE created_at < DATE_SUB(NOW(), INTERVAL 5 YEAR)
    -- Copy to cold storage, mark as archived in main table
  ```
- **Error message:** N/A
- **Related rules:** BR-WAL-003, BR-AUD-002

**BR-AUD-002: GDPR / data privacy: member data exportable within 72 hours**
- **Type:** constraint
- **Applies to:** System, Admin
- **Description:** Upon request, a member's complete personal data must be exportable in a machine-readable format (JSON) within 72 hours. The export includes: profile, membership history, booking history, payment history, wallet transactions, check-in history, and notification preferences. Data deletion requests must be fulfilled within 30 days, with financial records anonymized (not deleted) per BR-AUD-001.
- **Logic:**
  ```
  ON data_export_request(member_id) DO
    data = {
      profile: get_member_profile(member_id),
      memberships: get_memberships(member_id),
      bookings: get_bookings(member_id),
      payments: get_payments(member_id),
      wallet_transactions: get_wallet_transactions(member_id),
      check_ins: get_check_ins(member_id),
      preferences: get_preferences(member_id)
    }
    export_job = CREATE_EXPORT_JOB(data, format='json')
    schedule_notification(member_id, 'data_export_ready', export_job.download_url)
    -- Job must complete within 72 hours
  ON data_deletion_request(member_id) DO
    anonymize_personal_data(member_id)  -- retain financial records per BR-AUD-001
    delete_pii(member_id)               -- remove name, email, phone, ID docs
  ```
- **Error message:** N/A
- **Related rules:** BR-AUD-001

**BR-AUD-003: Daily reconciliation of payment gateway vs. internal records**
- **Type:** workflow
- **Applies to:** System, Finance Admin
- **Description:** Every day at 03:00 AM (system time), an automated reconciliation job compares all transactions from the previous day between the internal database and each payment gateway (VNPAY, Stripe). Discrepancies are flagged and reported to finance admin. Any unmatched transaction is quarantined for manual review.
- **Logic:**
  ```
  DAILY_CRON 03:00:
    internalTxns = SELECT * FROM payment_transactions
                   WHERE DATE(created_at) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
    FOR EACH gateway IN ['vnpay', 'stripe']:
      gatewayTxns = fetch_gateway_transactions(gateway, yesterday)
      unmatched = symmetric_difference(internalTxns, gatewayTxns)
      IF unmatched IS NOT EMPTY THEN
        INSERT INTO reconciliation_issues (gateway, date, details)
          VALUES (:gateway, CURRENT_DATE, unmatched)
        NOTIFY finance_admin "Reconciliation discrepancy detected for " + gateway
      END IF
  ```
- **Error message:** N/A
- **Related rules:** BR-PAY-001, BR-PAY-002, BR-AUD-001

**BR-AUD-004: Concurrent session limit: max 3 devices per member**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A member may be logged in on a maximum of 3 devices simultaneously. When a fourth device attempts to log in, the oldest session is invalidated. This applies to both mobile app and web sessions.
- **Logic:**
  ```
  ON login(member_id, device_id) DO
    activeSessions = SELECT COUNT(*) FROM sessions
                     WHERE member_id = :member_id AND is_active = TRUE
    IF activeSessions >= 3 THEN
      oldestSession = SELECT * FROM sessions
                      WHERE member_id = :member_id AND is_active = TRUE
                      ORDER BY last_activity_at ASC LIMIT 1
      invalidate_session(oldestSession.id)
    END IF
    create_session(member_id, device_id)
  ```
- **Error message:** "You are logged in on 3 devices. The oldest session has been logged out."
- **Related rules:** BR-AUD-002

**BR-AUD-005: Rate limiting: max 5 failed OTP attempts per 15 minutes**
- **Type:** constraint
- **Applies to:** Member
- **Description:** A member may attempt up to 5 OTP verifications within a rolling 15-minute window. After the 5th failed attempt, the account is temporarily locked for 30 minutes. This applies to login OTP, payment OTP, and any identity verification OTP. The lockout is scoped per action type.
- **Logic:**
  ```
  ON otp_attempt(member_id, action_type) DO
    recentAttempts = SELECT COUNT(*) FROM otp_attempts
                     WHERE member_id = :member_id
                       AND action_type = :action_type
                       AND success = FALSE
                       AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    IF recentAttempts >= 5 THEN
      lock_account_temporarily(member_id, action_type, 30 minutes)
      REJECT "Too many failed attempts. Account locked for 30 minutes."
    END IF
  ```
- **Error message:** "Too many incorrect OTP attempts. Please try again in 30 minutes."
- **Related rules:** BR-AUD-002

---

## Appendix: Rule Index

| ID | Module | Type | Summary |
|---|---|---|---|
| BR-MEM-001 | Membership | constraint | One active membership per member |
| BR-MEM-002 | Membership | workflow | Pending activation auto-activates on first check-in or after payment |
| BR-MEM-003 | Membership | workflow | Renewal creates pending cycle up to max 3 pending |
| BR-MEM-004 | Membership | constraint | Freeze max 2 per cycle, max 30 days per freeze, min 7 days between freezes |
| BR-MEM-005 | Membership | workflow | Cancellation requires admin approval if activated |
| BR-MEM-006 | Membership | calculation | Refund calculation: full refund if unactivated within 7 days; prorated if activated |
| BR-MEM-007 | Membership | notification | Expiry notification sent 7, 3, and 1 day before |
| BR-MEM-008 | Membership | constraint | Trial period rules (no booking, limited check-ins) |
| BR-BKG-001 | Booking | constraint | Booking window max 30 days ahead |
| BR-BKG-002 | Booking | constraint | Member must have active membership to book |
| BR-BKG-003 | Booking | constraint | Max 1 booking per slot per PT per time |
| BR-BKG-004 | Booking | calculation | Cancellation by member: free up to 2 hours before; penalty fee after |
| BR-BKG-005 | Booking | workflow | No-show penalty: 1 violation point, auto-cancellation after 3 violations |
| BR-BKG-006 | Booking | workflow | PT can confirm/reject booking within 1 hour |
| BR-BKG-007 | Booking | constraint | Recurring booking rules (max 4 weeks ahead, same day/time) |
| BR-PT-001 | PT | constraint | Max 10 active member assignments per PT |
| BR-PT-002 | PT | constraint | PT availability defined by schedule, max 8 sessions/day |
| BR-PT-003 | PT | constraint | PT cannot book themselves |
| BR-PT-004 | PT | constraint | PT can modify own schedule min 24h in advance |
| BR-CHK-001 | Check-in | validation | QR code required for check-in |
| BR-CHK-002 | Check-in | workflow | Auto-activates pending membership on first check-in |
| BR-CHK-003 | Check-in | calculation | Streak tracking: consecutive days only |
| BR-CHK-004 | Check-in | constraint | Daily check-in limit: once per membership per day |
| BR-CHK-005 | Check-in | validation | Check-in window: gym operating hours only |
| BR-PAY-001 | Payment | constraint | All financial transactions must be atomic (wallet + order) |
| BR-PAY-002 | Payment | validation | Payment idempotency key required for all transactions |
| BR-PAY-003 | Payment | constraint | Refund must go to original payment method or wallet |
| BR-PAY-004 | Payment | constraint | VNPAY timeout: 15 minutes; Stripe: 30 minutes |
| BR-PAY-005 | Payment | validation | Minimum payment: 1,000 VND (or equivalent) |
| BR-WAL-001 | Wallet | constraint | Wallet balance cannot go negative |
| BR-WAL-002 | Wallet | workflow | Withdrawal requires identity verification |
| BR-WAL-003 | Wallet | constraint | Transaction history immutable (append-only) |
| BR-WAL-004 | Wallet | constraint | Dual-entry booking required for all transactions |
| BR-SHP-001 | Shop | workflow | Inventory reservation on order creation, release on timeout/cancel |
| BR-SHP-002 | Shop | calculation | Platform fee: 2% of product price |
| BR-SHP-003 | Shop | workflow | Escrow holds payment until delivery confirmation |
| BR-SHP-004 | Shop | constraint | Return window: 7 days from delivery |
| BR-NTF-001 | Notification | constraint | In-app notification delivery within 30 seconds |
| BR-NTF-002 | Notification | constraint | Email notifications batched, max 1 per hour per member |
| BR-NTF-003 | Notification | constraint | Opt-out channels: email and push, never SMS (transactional) |
| BR-ADM-001 | Staff & Admin | workflow | Admin approval required for refunds above 1,000,000 VND |
| BR-ADM-002 | Staff & Admin | constraint | Role-based access control for all admin actions |
| BR-ADM-003 | Staff & Admin | constraint | All admin actions must be logged with actor identity |
| BR-AUD-001 | Audit | constraint | All financial records retained for 5 years |
| BR-AUD-002 | Audit | constraint | GDPR / data privacy: member data exportable within 72 hours |
| BR-AUD-003 | Audit | workflow | Daily reconciliation of payment gateway vs. internal records |
| BR-AUD-004 | Audit | constraint | Concurrent session limit: max 3 devices per member |
| BR-AUD-005 | Audit | constraint | Rate limiting: max 5 failed OTP attempts per 15 minutes |

---

*End of Business Rules Catalog — 46 rules across 10 modules.*
