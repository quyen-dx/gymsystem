# Flash Re-Audit — Epic 3.4

**Date:** 2026-07-21
**Scope:** M-1, M-2 regression check

---

## Result: PASS

**Remaining HIGH/MEDIUM findings: NONE**

---

## M-1 — Response backward compat

- `notifiedWaitlistMember: firstWaitlist || null` restored at `bookingController.js:1030` ✅
- `promotedBooking: promotedBooking || null` added alongside at `bookingController.js:1031` ✅
- Existing frontend contract unchanged (old field name returns the same type) ✅

## M-2 — Single source of truth

- `isBlockedByNoShow(memberId, opts)` at `bookingController.js:89-108` is the only implementation ✅
- `checkNoShowBlock` delegates to it at `bookingController.js:111` ✅
- Promotion flow calls it at `bookingController.js:925` with `{ session }` ✅
- Zero duplication of no-show business rule ✅

## Regression

| Module | Status |
|---|---|
| Waitlist | Unchanged ✅ |
| Booking | Unchanged ✅ |
| PT | Unchanged ✅ |
| Membership | Unchanged ✅ |
| Wallet | Unchanged ✅ |
| Payment | Unchanged ✅ |
| Notification | Unchanged ✅ |
