# Flash Audit — Epic 2.4: Payment Gateway Integration

**Date:** 2026-07-21  
**Status:** **FAIL** ❌  

---

## Scoring

| Dimension     | Score  | Notes                                     |
|---------------|--------|-------------------------------------------|
| **Risk**      | 75/100 | CRITICAL finding — direct financial risk  |
| **Security**  | 70/100 | No injection/SSRF, but undetected double-charge possible |
| **Architecture** | 75/100 | Clean additive changes; behavioral half left unimplemented |

---

## Finding F-1 — CRITICAL

**BR-PAY-002 idempotency not functionally implemented**

The `idempotencyKey` field was added to the Payment model (`src/models/Payment.js:42-48`) with `unique: true, sparse: true`. This provides schema-level support only.

**What is missing (every single verification point):**

| Verification Point | Status | Detail |
|---|---|---|
| Duplicate requests | ❌ | No code checks `Payment.findOne({ idempotencyKey })` before creating. Wallet's `Transaction.idempotencyKey` already has this pattern at `walletService.js:37-41` — the same pattern was not replicated for Payment. |
| Retry after timeout | ❌ | No controller/middleware reads `Idempotency-Key` HTTP header. A client retrying after timeout would create a brand new payment record — no dedup. |
| Concurrent requests | ❌ | Request A and B with same key arrive simultaneously → both pass the (absent) check → one succeeds, the other hits unhandled E11000 MongoDB unique index error. No graceful `return existing.result` as BR-PAY-002 specifies. |
| Webhook retry | ❌ | Stripe/VNPAY webhook retries would each create a new Payment document — no dedup at the webhook handler level. |
| Duplicate callback | ❌ | Same as webhook retry. |
| Idempotency key uniqueness | ✅ | DB-level `unique: true` on field. But enforced via exception only — no application-level graceful handling. |
| Race conditions | ❌ | No atomic `findOneAndUpdate` or `findOne+check+insert` pattern. The existing `walletService.js:69-71` demonstrates the correct atomic pattern. |
| 24-hour expiration window | ❌ | No TTL index, no cleanup job, no timestamp check on lookup. BR-PAY-002 requires `created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`. |

**Evidence:** 11 call sites create `Payment` documents (`membershipService.js:328`, `walletController.js:356,403`, `planChangeController.js:123,418`, `cancellationController.js:109,744`, `memberController.js:431,1067,1260`). **Zero** of them check `idempotencyKey` before creating. The existing correct pattern in `walletService.js:37-41` was not replicated.

**Severity:** CRITICAL — direct risk of double-charges. Core business rule not implemented.

---

## Finding F-2 — MEDIUM

**BR-PAY-004 incomplete: no notification, no reservation release**

The timeout job (`src/jobs/paymentTimeoutJob.js`) correctly sets timed-out payments to `FAILED`, but the BR-PAY-004 spec requires two additional actions:

```
txn.status = 'timeout'           ← set to FAILED (acceptable, no 'timeout' in enum)
release_reservations(txn.order_id)  ← NOT implemented ❌
notify_member(txn.member_id, 'Payment timeout')  ← NOT implemented ❌
```

**Verification:** The job performs only `Payment.updateMany(filter, { $set: { status: 'FAILED' } })`. No notification is sent, no reservations released.

**Severity:** MEDIUM — reservations on inventory/booking slots may remain dangling indefinitely.

---

## Finding F-3 — LOW

**paymentTimeoutJob only matches uppercase 'PENDING'**

The Payment model enum includes both `'PENDING'` and `'pending'` (line 67):
```js
enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'pending', 'paid', 'failed', 'refunded']
```

The timeout job only queries `status: 'PENDING'` (uppercase). Any document with lowercase `status: 'pending'` would silently never time out.

**Severity:** LOW — default is `'PENDING'` (uppercase), so only edge-case/manually-created records would be affected.

---

## BR-PAY-005 — PASS ✅

| Check | Result | Detail |
|---|---|---|
| amount < 1000 | ✅ | Mongoose `min: 1000` rejects with `ValidationError` on `save()`/`create()` |
| amount = 1000 | ✅ | Passes validation |
| amount > 1000 | ✅ | Passes validation |
| Decimal values | ✅ | Passes (Mongoose Number accepts decimals) |
| Negative values | ✅ | `min: 1000` rejects negative |
| Overflow values | ✅ | Double-precision safe for VND amounts |
| Bypass via update | ⚠️ | `findByIdAndUpdate`/`updateMany` skip Mongoose validation by default — general Mongoose concern, applies to all model fields |

---

## Regression — PASS ✅

| Area | Status | Evidence |
|---|---|---|
| Existing VNPAY flow | ✅ | `vnpayService.js`, `walletController.handleVnpayReturn` unmodified |
| Existing Stripe flow | ✅ | `membershipService.createCheckoutSession`, Stripe webhook unmodified |
| Existing Wallet flow | ✅ | `walletService.js` operations unchanged |
| Existing Refund flow | ✅ | `refundRequestService.js` unmodified |
| Existing Payment APIs | ✅ | No route or schema changes |
| Existing frontend compatibility | ✅ | No response format changes |
| Tests | ✅ | 101/101 pass |

---

## Summary of Findings

| ID | Severity | Rule | Issue |
|---|---|---|---|
| F-1 | **CRITICAL** | BR-PAY-002 | Idempotency field added but behavioral logic not implemented — no duplicate detection, no header reading, no graceful retry, no 24h window |
| F-2 | MEDIUM | BR-PAY-004 | Timeout job does not notify member or release reservations |
| F-3 | LOW | BR-PAY-004 | Only matches uppercase 'PENDING' status |

**2 out of 3 business rules are incomplete.** Epic 2.4 **FAILS** audit.
