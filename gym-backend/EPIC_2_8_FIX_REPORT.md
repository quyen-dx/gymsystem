# Epic 2.8 — Fix Report

**Date:** 2026-07-21  
**Source:** FLASH_AUDIT_EPIC_2_8.md  
**Test Result:** 101/101 passed  

---

## Summary

| Finding | Severity | Status | Description |
|---|---|---|---|
| F-8.1 | MEDIUM | Fixed | 30-day booking window now enforced in all 3 booking creation paths |
| F-8.2 | LOW | Fixed | Cancel response message updated from "24h" to "2h" |
| F-8.3 | MEDIUM | Fixed | 30-day booking block implemented via ViolationLog check |
| F-8.4 | LOW | Fixed | `noShowDetectionJob` query now filtered to 90-day window |
| F-8.5 | LOW | Fixed | `autoConfirmBookingJob` no longer sets `paymentStatus: 'paid'` |
| F-8.6 | LOW | Deferred | TOCTOU race — by design, acceptable risk |
| F-8.7 | MEDIUM | Fixed | Self-booking guard now enforced in all 3 booking creation paths |

---

## Changes by File

### 1. `src/controllers/bookingController.js`

**Added import:**
- `ViolationLog` (line 4)

**Added 3 reusable helper functions (lines 57–97):**

| Function | Purpose | Rule |
|---|---|---|
| `checkBookingWindow(date, res)` | Validates date ≤ 30 days from now | BR-BKG-001 |
| `checkSelfBooking(reqUserId, ptId, res)` | Rejects PT self-booking | BR-PT-003 |
| `checkNoShowBlock(memberId, res)` | Queries ViolationLog — if ≥3 violations in 90d AND most recent ≤ 30d old → blocks | BR-BKG-005 |

All three return `true`/`false` and write the error response on failure, following the existing `requireActiveMembershipForDate` pattern.

**Modified `createBooking` (line 166–174):**
- Replaced inline 30-day window logic with `checkBookingWindow(date, res)`
- Replaced inline self-booking check with `checkSelfBooking(req.user._id, ptId, res)`
- Added no-show block call: `checkNoShowBlock(req.user._id, res)`
- Added `const today = new Date()` declaration (was removed when extracting helper, used by PT capacity check at line ~210)

**Modified `createRecurringBooking` (lines 337–341):**
- Added `checkSelfBooking`, `checkBookingWindow`, `checkNoShowBlock` after feature check

**Modified `scheduleWeeklyBooking` (lines 455–469):**
- Added `checkSelfBooking`, `checkNoShowBlock` before session start
- Added `checkBookingWindow` per occurrence inside the loop

**Fixed cancel message (line 813):**
- `'Ghi nhận vi phạm do hủy trong vòng 24h'` → `'Ghi nhận vi phạm do hủy trong vòng 2h'`

### 2. `src/jobs/noShowDetectionJob.js`

**Line 8–12:** Added `ninetyDaysAgo` constant and narrowed query filter:
```js
date: { $gte: ninetyDaysAgo, $lt: twoHoursAgo }
```
Previously fetched all past bookings unfiltered. Now scoped to 90-day rolling window. The in-memory `sessionEnd < twoHoursAgo` filter remains for precision.

### 3. `src/jobs/autoConfirmBookingJob.js`

**Line 12–13:** Removed `paymentStatus: 'paid'` from the `$set`:
```js
$set: { status: 'confirmed' }
```
Previously: `$set: { status: 'confirmed', paymentStatus: 'paid' }`. Auto-confirm now only sets booking status; payment state is preserved.

---

## Verification

### All booking creation paths enforce identical business rules

| Guard | `createBooking` | `createRecurringBooking` | `scheduleWeeklyBooking` |
|---|---|---|---|
| Active membership | ✓ line 166 | ✓ line 329 (last date) | ✓ line 471 (each date) |
| 30-day window | ✓ line 170 | ✓ line 339 (first date) | ✓ line 469 (each date) |
| PT self-booking | ✓ line 172 | ✓ line 337 | ✓ line 455 |
| No-show block | ✓ line 174 | ✓ line 341 | ✓ line 457 |

### No files in exclusion list modified

| Module | Touched? |
|---|---|
| Membership | No |
| Wallet | No |
| Payment | No |
| Notification | No |
| Shop | No |
| Audit | No |
| Auth | No |

### Existing APIs unchanged

All 14 booking routes unchanged. All PT routes unchanged. No new routes.

### Tests

**101/101 passed.** No test changes required.

---

## No-Show Block Logic Detail

`checkNoShowBlock(memberId)` uses ViolationLog to determine if a member is blocked:

```
1. COUNT ViolationLog where memberId, type='no_show', createdAt >= 90 days ago
2. IF count < 3 → NOT blocked (return true)
3. IF count >= 3:
   a. FIND most recent violation within 90 days
   b. IF most recent violation > 30 days ago → NOT blocked (penalty expired)
   c. IF most recent violation ≤ 30 days ago → BLOCKED (return false)
```

This gives a 30-day block window from the most recent violation. A new violation during the block resets the 30-day timer. After 30 days without new violations, the block lifts (even if ≥3 violations still exist in the 90-day window — the most recent one is now >30 days old).
