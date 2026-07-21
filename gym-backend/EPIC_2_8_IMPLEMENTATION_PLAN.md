# Epic 2.8 — Implementation Plan: Booking & PT Business Rules

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services  
**Pre-Epic Coverage:** ~22%  

---

## Files to Create

| # | File | Lines (est.) | Reason | Rule |
|---|---|---|---|---|
| 1 | `src/models/ViolationLog.js` | ~30 | Track no-show events. memberId, bookingId, type, createdAt. Index on {memberId, createdAt} for 90-day rolling query. | BR-BKG-005 |
| 2 | `src/jobs/autoConfirmBookingJob.js` | ~25 | Query `Booking.find({status:'pending', createdAt:{$lt: 1h ago}})` and bulk-confirm. Idempotent via status check. | BR-BKG-006 |
| 3 | `src/jobs/noShowDetectionJob.js` | ~35 | Query bookings where session time passed but status is still pending/confirmed and no check-in. Insert ViolationLog. Count 90-day violations. Block at 3. | BR-BKG-005 |

---

## Files to Modify

### 1. `src/controllers/bookingController.js` — Multiple insertion points

| # | Insertion | Lines | Rule | What Changes |
|---|---|---|---|---|
| A | `createBooking` L117-123 | After param validation, before feature check | BR-BKG-001 | `diffDays > 30` → 400 reject. Only for new checks, not existing flow. |
| B | `createBooking` L117-123 | After param validation, before feature check | BR-PT-003 | `req.user._id.toString() === ptId` → 400 reject |
| C | `createBooking` L141 | After PT lookup, before transaction | BR-PT-002 | `Booking.countDocuments({ptId, date, status:{$in:['pending','conf','awaiting','confirmed']}}) >= 8` → 400 reject |
| D | `createBooking` L141 | After PT lookup, before transaction | BR-PT-001 | `Booking.distinct('memberId', {ptId, status:{$ne:'cancelled'}, date:{$gte:30daysAgo}})` length >= 10 → 400 reject |
| E | `createRecurringBooking` L246-256 | After param validation | BR-BKG-007 | `weeks > 4` → 400 reject |
| F | `createRecurringBooking` L271 | Inside loop, after per-occurrence booking creation | BR-BKG-001 | Each bookingDate already checked via conflict check; add explicit 30-day check |
| G | `cancelBooking` L678-684 | Replace violation logic | BR-BKG-004 | `diffHours >= 2` → cancel free. `diffHours < 2` → penalty = priceAtBooking * 0.50, deduct from wallet via `applyWalletTransaction` |

**Why modifications are required:**
- BR-BKG-001/BKG-007: Guards that prevent invalid booking creation. Code must reject before DB writes.
- BR-BKG-004: Replaces the existing <24h isViolation flag with actual 2h penalty deduction.
- BR-PT-001/PT-002/PT-003: Capacity and self-booking guards before DB writes.
- All are additive — no existing behavior is removed. Existing flow continues unchanged when guards pass.

### 2. `src/services/ptAssignmentService.js` — createAssignment guard

| # | Insertion | Lines | Rule | What Changes |
|---|---|---|---|---|
| H | `createAssignment` L438-447 | Before reuse check | BR-PT-001 | Count distinct memberIds with confirmed bookings in last 30 days for this PT. If >= 10 AND this memberId is not already one of them → reject. |

**Why modification is required:** `createAssignment` is called from `confirmBooking` in bookingController. It's the canonical assignment creation path. The guard here prevents assignment over capacity. Also called from other controllers (admin assignment flows). All paths benefit from the same guard.

### 3. `src/controllers/ptController.js` — updatePTSchedule guard

| # | Insertion | Lines | Rule | What Changes |
|---|---|---|---|---|
| I | `updatePTSchedule` L600-605 | After user validation, before schedule write | BR-PT-004 | For each schedule being modified, check if there are confirmed bookings within 24h. If yes → 400 reject. |

**Why modification is required:** PT schedule modifications can affect confirmed bookings. The 24h lock prevents last-minute changes that would strand members. Also need to check if the schedule's dayOfWeek maps to a date within 24h (the current/upcoming week instance of that day).

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Race condition on PT capacity (BR-PT-001) | Medium | Existing transactional session in `createBooking` covers the create path. `createAssignment` uses existing session from `confirmBooking`. |
| Penalty deduction failure (BR-BKG-004) | Low | `applyWalletTransaction` already has retry/error handling. If wallet insufficient, reject with clear message. |
| Auto-confirm timer misses bookings (BR-BKG-006) | Low | Cron job idempotent — checks `status:'pending'` before confirming. If network partition, recovers next tick. |
| No-show detection false positives (BR-BKG-005) | Low | Only detect for confirmed bookings where session time + buffer (>2h past) and no check-in record. |
| Schedule 24h check incorrectly blocks | Low | Only check for days within 24h from now, not all schedule revisions. |

---

## Dependencies

| Dependency | Status |
|---|---|
| `Booking` model (ptId, date, slot indexes) | ✅ Exist |
| `PT` model | ✅ Exists |
| `PTSchedule` model | ✅ Exists |
| `PTAssignment` model | ✅ Exists |
| `walletService.applyWalletTransaction` | ✅ Exists (used in `payBooking`) |
| `bookingController` existing flow | ✅ Stable, 101/101 tests pass |
| `ptController.updatePTSchedule` | ✅ Exists |
| `ptAssignmentService.createAssignment` | ✅ Exists |

---

## Files NOT Modified

| Module | Reason |
|---|---|
| Wallet | Unchanged — `applyWalletTransaction` called as existing API |
| Payment | Unchanged |
| Membership | Unchanged — `hasActiveMembershipForDate` already used |
| Notification | Unchanged — `createNotification` called as existing API |
| Shop | Unchanged |
| Audit | Unchanged |
| Auth | Unchanged |
| All Booking routes | Unchanged — endpoints, paths, method signatures preserved |
| All PT routes | Unchanged |
| Existing frontend behavior | Unchanged — all changes are guard rejections that return 400/403 errors |
