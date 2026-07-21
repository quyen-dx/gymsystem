# Epic 3.4 — Fix Report

**Date:** 2026-07-21
**Scope:** M-1 (response backward compat), M-2 (no-show logic dedup)

---

## Fixes Applied

| Finding | Fix | File |
|---|---|---|
| **M-1** | Restored `notifiedWaitlistMember` field in `cancelBooking` response. Now returns both `notifiedWaitlistMember` (raw Waitlist doc, backward compat) and `promotedBooking` (new Booking doc). | `bookingController.js:1031` |
| **M-2** | Extracted `isBlockedByNoShow(memberId, opts)` pure helper. `checkNoShowBlock` delegates to it. Promotion flow calls it directly with `{ session }`. Single source of truth. | `bookingController.js:89-118` + `bookingController.js:924` |

---

## Test Results

```
Test Files  8 passed (8)
     Tests  101 passed (101)
```
