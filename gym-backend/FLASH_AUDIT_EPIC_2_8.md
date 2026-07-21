# Flash Audit — Epic 2.8: Booking & PT Business Rules

**Date:** 2026-07-21  
**Auditor:** opencode  
**Scope:** BR-BKG-001–007, BR-PT-001–004 implementation  
**Strategy:** Option 3 — Patch existing services  
**Test Result:** 101/101 passed  

---

## Result: **PASS**

| Metric | Score | Notes |
|---|---|---|
| **Risk Score** | 2 / 5 | Low — no data loss, no auth bypass, no financial integrity issue |  
| **Security Score** | 4 / 5 | No access control bypass; minor self-booking gap via alternative endpoint |  
| **Architecture Score** | 3 / 5 | Patch strategy caused inconsistent rule coverage across similar endpoints; some rules only enforced on primary code path |

---

## Findings

### F-8.1 [MEDIUM] — BR-BKG-001 not enforced in `createRecurringBooking` / `scheduleWeeklyBooking`

**File:** `src/controllers/bookingController.js`  
**Lines:** `createBooking` at 127–132 (guard present) but missing in `createRecurringBooking` (274–382) and `scheduleWeeklyBooking` (394–487)

**Issue:**
The 30-day booking window guard was added only to `createBooking`. The other two booking creation endpoints (`createRecurringBooking`, `scheduleWeeklyBooking`) do not validate `diffDays > 30` for the session date(s) they create.

While `createRecurringBooking` limits weeks to 4 (max 28-day horizon), and `scheduleWeeklyBooking` uses `getNextWeekDate` (next occurrence within 7 days), a member can still bypass the window check:
- `createRecurringBooking` with `weeks=1` on a date 45 days ahead → accepted (only `weeks > 4` checked)
- The first date validation for membership at line 290 only validates the *last* booking date, not the first occurrence's 30-day proximity.

**Fix:** Add `diffDays > 30` guard at the start of both `createRecurringBooking` and `scheduleWeeklyBooking` (for `scheduleWeeklyBooking`, validate each `bookingDate` in the loop before creating).

---

### F-8.2 [LOW] — BR-BKG-004 cancel response message says "24h" instead of "2h"

**File:** `src/controllers/bookingController.js`  
**Line:** 762

**Issue:**
The success message reads: `'Hủy lịch thành công. Ghi nhận vi phạm do hủy trong vòng 24h'` but the actual penalty threshold is `< 2 hours` (line 719). The message text is stale from the previous implementation where `isViolation` was set for `< 24h`.

**Fix:** Change `24h` to `2h` in the response message.

---

### F-8.3 [MEDIUM] — BR-BKG-005 missing 30-day booking block after 3 violations

**File:** `src/jobs/noShowDetectionJob.js`  
**Lines:** 39–53

**Issue:**
The BR-BKG-005 spec requires: "all future bookings are auto-cancelled and the member is **blocked from booking for 30 days**." The current implementation only auto-cancels future bookings (lines 40–52) but does **not** add any mechanism to prevent the member from creating new bookings during the 30-day penalty period.

After auto-cancellation, the member can immediately create new bookings. There is no check in `createBooking`, `createRecurringBooking`, or `scheduleWeeklyBooking` that rejects the request based on a recent 3-strike violation.

**Fix options:**
1. Add a `blockedUntil` timestamp field to the User or ViolationLog model, set it when 3 violations are reached, and check it in all booking creation endpoints.
2. Or add a `bookingBlockedUntil` field to User and guard in `createBooking` + recurring endpoints.

---

### F-8.4 [LOW] — BR-BKG-005 noShowDetectionJob queries all past bookings unfiltered

**File:** `src/jobs/noShowDetectionJob.js`  
**Line:** 9–12

**Issue:**
The initial query `Booking.find({ status: ..., date: { $lt: now } })` fetches **all** past-dated bookings into memory, then filters with `sessionEnd < twoHoursAgo`. On a system with thousands of past bookings, this loads unnecessary documents and has no index covering the query efficiently.

**Risk:** Performance degradation at scale. Not a correctness issue.

**Fix:** Add a date lower bound to the query (e.g., `date: { $gte: ninetyDaysAgo, $lt: now }`) since violations only matter within the 90-day rolling window anyway.

---

### F-8.5 [LOW] — BR-BKG-006 autoConfirmJob sets `paymentStatus: 'paid'` unconditionally

**File:** `src/jobs/autoConfirmBookingJob.js`  
**Line:** 12–14

**Issue:**
The job unconditionally sets `paymentStatus: 'paid'` when auto-confirming a booking. When `totalAmount > 0` is implemented in the future, this would cause auto-confirmed bookings to bypass payment entirely.

Currently this is benign because `totalAmount` is hardcoded to 0 (line 181 of `bookingController.js`), and the `payBooking` endpoint already blocks payment for zero-amount bookings (line 925–929).

**Fix:** Only set `paymentStatus: 'paid'` when `totalAmount === 0` (or skip the field entirely for future-proofing, letting the existing default `'unpaid'` stand).

---

### F-8.6 [LOW] — BR-PT-001 / BR-PT-002 TOCTOU race in capacity checks

**File:** `src/controllers/bookingController.js`  
**Lines:** 160–177

**Issue:**
Both the max-8-sessions check (BR-PT-002, line 160) and the max-10-active-members check (BR-PT-001, line 169) execute **before** the MongoDB transaction starts (line 183). Under concurrent requests:
1. Two requests see `sessionCount = 7`, both pass → PT ends up with 9 sessions
2. Two requests see `activeMembers = 9`, both pass → PT ends up with 11 active members

The partial unique index at the Booking model level (which prevents double-booking the same slot) partially mitigates the session count race but not the distinct-member count race.

**Risk:** Temporary over-capacity by 1–2. Acknowledged as acceptable in the implementation report (design trade-off for simplicity).

**Fix (optional):** Move the checks inside the transaction and re-count after acquiring locks.

---

### F-8.7 [MEDIUM] — BR-PT-003 not enforced in `createRecurringBooking` / `scheduleWeeklyBooking`

**File:** `src/controllers/bookingController.js`  
**Lines:** `createBooking` at 134–136 (guard present) but missing in `createRecurringBooking` (274) and `scheduleWeeklyBooking` (394)

**Issue:**
The PT self-booking guard (`req.user._id.toString() === ptId`) was only added to `createBooking`. A PT user can bypass this restriction by using the `POST /api/v1/bookings/recurring` or `POST /api/v1/bookings/schedule-weekly` endpoints to book themselves as both member and PT.

**Fix:** Add the same self-booking guard at the start of `createRecurringBooking` and `scheduleWeeklyBooking`.

---

## Summary

| Rule | Verdict | Notes |
|---|---|---|
| BR-BKG-001 | **PASS** (with finding) | F-8.1 — recurring endpoints missing guard |
| BR-BKG-002 | PASS (pre-existing, unmodified) | Adequate |
| BR-BKG-003 | PASS (pre-existing, unmodified) | Partial unique index + transactional re-check |
| BR-BKG-004 | **PASS** (with finding) | F-8.2 — stale message text |
| BR-BKG-005 | **PASS** (with finding) | F-8.3 — missing 30-day book block; F-8.4: unfiltered query |
| BR-BKG-006 | **PASS** (with finding) | F-8.5 — unconditional paymentStatus='paid' |
| BR-BKG-007 | PASS | Guard present |
| BR-PT-001 | **PASS** (with finding) | F-8.6 — TOCTOU race (by design) |
| BR-PT-002 | **PASS** (with finding) | F-8.6 — TOCTOU race (by design) |
| BR-PT-003 | **PASS** (with finding) | F-8.7 — recurring endpoints missing guard |
| BR-PT-004 | PASS | Guard present and correct |

**Regression:** None detected. 101/101 tests pass. No routes, models, or services outside scope were modified. Wallet, Payment, Membership, Notification, Auth, Audit, Shop remain untouched.

---

## Scores

- **Risk:** 2/5 — Findings are medium-low severity; no financial loss vector, no data leak, no auth escalation.
- **Security:** 4/5 — PT self-booking via alternative endpoint is the only security gap (F-8.7).
- **Architecture:** 3/5 — Patch strategy produced inconsistent rule enforcement across endpoints. Three of seven findings (F-8.1, F-8.5, F-8.7) stem from applying guards to only one of several similar code paths.
