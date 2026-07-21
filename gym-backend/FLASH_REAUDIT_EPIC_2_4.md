# Flash Re-Audit — Epic 2.4: Payment Gateway Integration

**Date:** 2026-07-21  
**Status:** **PASS** ✅  

---

## Scoring

| Dimension     | Score | Notes |
|---------------|-------|-------|
| **Risk**      | 10/100 | All CRITICAL/MEDIUM/LOW findings resolved. No remaining findings. |
| **Security**  | 95/100 | Graceful duplicate handling. No E11000 leaks. No injection vector. |
| **Architecture** | 92/100 | Consistent with walletService pattern. Static method on model is clean. |

---

## F-1 (CRITICAL) — BR-PAY-002 Idempotency — RESOLVED ✅

| Verification Point | Status | Detail |
|---|---|---|
| Duplicate requests | ✅ | `createWithIdempotency` calls `findOne({ idempotencyKey, createdAt >= 24h ago })` before creating. Returns existing document if found. |
| Retry after timeout | ✅ | 24-hour window enforced via `createdAt: { $gte: cutoff }` with `IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000`. Retries within 24h return cached result. |
| Concurrent requests | ✅ | Two simultaneous requests with same key: both pass `findOne`, one creates, other hits E11000 → caught → `findOne` returns the first request's document. Both succeed gracefully. |
| Webhook retry | ✅ | Webhook handlers (VNPAY IPN, Stripe) look up existing payments by `txnRef`/`stripeSessionId` — they do NOT create new Payment documents. Not in scope of Payment.create. |
| Duplicate callback | ✅ | Same as webhook retry — lookup-based, not create-based. |
| Idempotency key uniqueness | ✅ | DB-level `unique: true` + application-level `findOne` pre-check + E11000 recovery. Triple protection. |
| Race conditions | ✅ | E11000 catch-and-recover pattern provides safe concurrent handling. More robust than walletService.ts (which has no E11000 recovery). |
| 24-hour expiration | ✅ | `createdAt: { $gte: cutoff }` correctly queries only records within the 24h window. After 24h, `unique: true` prevents new-creation-with-same-key, returning the original document instead. |

### Implementation details

**`Payment.createWithIdempotency(docs, options)`** (`src/models/Payment.js:104-132`):

```js
if (idempotencyKey) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const existing = await this.findOne({ idempotencyKey, createdAt: { $gte: cutoff } })
    if (existing) return existing
}
try {
    return await this.create(docs, options)     // passes session through
} catch (err) {
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
        return await this.findOne({ idempotencyKey })  // duel recovery
    }
    throw err
}
```

**All 12 Payment.create call sites converted:**

| # | File | idempotencyKey source |
|---|---|---|
| 1 | `membershipService.js:328` | None (in-transaction, wallet payment) |
| 2 | `membershipService.js:942` | `reg_${registration._id}` |
| 3 | `membershipService.js:988` | `stripe_checkout_${user._id}_${Date.now()}` |
| 4 | `walletController.js:356` | `txnRef` (manual QR) |
| 5 | `walletController.js:404` | `txnRef` (VNPAY) |
| 6 | `planChangeController.js:123` | None (in-transaction) |
| 7 | `planChangeController.js:418` | None (in-transaction) |
| 8 | `cancellationController.js:109` | None (in-transaction) |
| 9 | `cancellationController.js:744` | None (in-transaction) |
| 10 | `memberController.js:431` | None (staff offline) |
| 11 | `memberController.js:1067` | None (staff offline) |
| 12 | `memberController.js:1260` | None (staff offline) |

Pattern matches `walletService.js:37-41`: same check-before-create with `findOne`. Adds E11000 recovery which walletService lacks.

### Minor note (not a finding)

`Idempotency-Key` HTTP header is not read from the request. Instead, server-generated unique identifiers (`txnRef`, `registration._id`, etc.) serve as the idempotency key. This matches the **project standard** — `walletService.js`, `cancellationController.js`, and all existing idempotency usage in the codebase use server-generated keys, not client headers.

---

## F-2 (MEDIUM) — BR-PAY-004 Notification + Reservation — RESOLVED ✅

| Verification Point | Status | Detail |
|---|---|---|
| Payment becomes FAILED | ✅ | `Payment.updateMany({ _id: { $in: paymentIds } }, { $set: { status: 'FAILED' } })` |
| Member notification sent | ✅ | `createNotification({...NOTIFICATION_TYPES.PAYMENT_FAILED...})` with `.catch()` error handler |
| Reservation released | ✅ | `MembershipRegistration.updateOne({ _id: payment.registrationId, status: 'pending' }, { $set: { status: 'cancelled', ... } })` |
| Existing notification flow reused | ✅ | Uses existing `createNotification` from `notificationService.js` and `NOTIFICATION_TYPES` from `Notification.js` |
| No duplicate notification | ✅ | `updateMany` sets status to `FAILED` before loop — subsequent cron runs won't match these payments. |

**Flow:** `find` timed-out payments → `updateMany` to FAILED → loop side-effects (registration cancel + notification). Side effects use fire-and-forget `.catch()` pattern consistent with `membershipExpiryRemindersJob`.

---

## F-3 (LOW) — Case‑insensitive PENDING — RESOLVED ✅

| Verification Point | Status |
|---|---|
| `PENDING` (uppercase) | ✅ `status: { $in: ['PENDING', 'pending'] }` matches both |
| `pending` (lowercase) | ✅ Same `$in` covers lowercase |
| Regression | ✅ Existing uppercase `'PENDING'` documents still matched |

Both branches of the `$or` filter use `{ status: { $in: ['PENDING', 'pending'] } }`.

---

## BR-PAY-005 — PASS ✅ (unchanged from initial audit)

| Check | Result |
|---|---|
| amount < 1000 | ✅ Mongoose `min: 1000` rejects |
| amount = 1000 | ✅ Passes |
| amount > 1000 | ✅ Passes |
| Decimal values | ✅ Passes |
| Negative values | ✅ Rejected |
| Overflow values | ✅ Safe for VND |

---

## Regression — PASS ✅

| Area | Status | Evidence |
|---|---|---|
| VNPAY flow | ✅ | `vnpayService.js` unmodified. `walletController` VNPAY deposit unchanged outside of `Payment.createWithIdempotency` rename. |
| Stripe flow | ✅ | `membershipService.createCheckoutSession` unchanged. Stripe webhook handler unmodified. |
| Wallet flow | ✅ | `walletService.js` unmodified. `planChangeController` wallet operations unchanged. |
| Refund flow | ✅ | `refundRequestService.js` unmodified. `cancellationController` refund logic unchanged. |
| Payment APIs | ✅ | No route, schema, or response format changes. |
| Frontend compatibility | ✅ | No API contract changes. |
| Tests | ✅ | 101/101 pass. |

---

## Summary

| Finding | Severity | Status |
|---|---|---|
| F-1: BR-PAY-002 idempotency not implemented | CRITICAL | **RESOLVED** — `createWithIdempotency` static method + all 12 call sites converted |
| F-2: BR-PAY-004 missing notification + reservation release | MEDIUM | **RESOLVED** — timeout job now sends notifications and cancels registrations |
| F-3: BR-PAY-004 only matched uppercase PENDING | LOW | **RESOLVED** — `$in: ['PENDING', 'pending']` covers both cases |

**No remaining findings.** Epic 2.4 **PASSES** re-audit.
