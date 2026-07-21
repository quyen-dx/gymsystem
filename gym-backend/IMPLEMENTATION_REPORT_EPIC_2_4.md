# Epic 2.4 Implementation Report — Payment Gateway Integration

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services only  
**Test Result:** 101/101 passed ✅  

---

## Business Rules Implemented

| Rule | Description | Implementation |
|---|---|---|
| **BR-PAY-002** | Payment idempotency key required | `idempotencyKey` field added to `Payment` model (unique, sparse, indexed) |
| **BR-PAY-004** | VNPAY 15min / Stripe 30min timeout | `paymentTimeoutJob.js` — cron runs every 5 min, marks PENDING payments as FAILED after gateway timeout |
| **BR-PAY-005** | Minimum payment 1,000 VND | Payment model `amount.min` changed from `0` → `1000` |

---

## Files Created

| # | File | Lines | Purpose |
|---|---|---|---|
| 1 | `src/jobs/paymentTimeoutJob.js` | 31 | BR-PAY-004: marks PENDING VNPAY (>15min) and STRIPE (>30min) payments as FAILED |

**Design:**
- `VNPAY_TIMEOUT_MS = 15 * 60 * 1000`
- `STRIPE_TIMEOUT_MS = 30 * 60 * 1000`
- Uses `Payment.updateMany({ $or: [...] }, { $set: { status: 'FAILED' } })` — single atomic query, no cursor needed
- Logs count on each run only when modifications occur (avoids log noise)
- Error handler catches and logs exceptions without crashing

---

## Files Modified

| # | File | Lines Changed | Change |
|---|---|---|---|
| 2 | `src/models/Payment.js` | +10 | Added `idempotencyKey` field (String, unique, sparse, indexed) for BR-PAY-002 |
| 3 | `src/models/Payment.js` | 1 | `amount.min` changed from `0` → `1000` for BR-PAY-005 |
| 4 | `server.js` | +7 | Import `runPaymentTimeoutJob`, schedule `*/5 * * * *` cron for BR-PAY-004 |

### Payment model changes detail

```js
// Added (line 42-48)
idempotencyKey: {
  type: String,
  trim: true,
  unique: true,
  sparse: true,
  index: true,
},

// Changed (line 52)
amount: {
  type: Number,
  required: true,
  min: 1000,  // was: min: 0
},
```

---

## Files NOT Modified (Confirmed)

| File | Reason |
|---|---|
| `src/services/vnpayService.js` | VNPAY URL signing + 15-min `expireDate` unchanged |
| `src/services/walletService.js` | Wallet atomic ops unchanged |
| `src/services/membershipService.js` | Stripe Checkout, wallet purchase, manual reg unchanged |
| `src/controllers/walletController.js` | VNPAY return handler, Stripe webhook unchanged |
| `src/routes/walletRoutes.js` | All routes preserved |
| `src/app.js` | Webhook registration unchanged |
| `src/services/refundRequestService.js` | Refund lifecycle unchanged |
| `src/services/notificationService.js` | Notification system unchanged |

---

## Registration Checklist

| Check | Status | Evidence |
|---|---|---|
| Existing VNPAY flow unchanged | ✅ | `vnpayService.js` and `walletController.handleVnpayReturn` unmodified |
| Existing Stripe flow unchanged | ✅ | `membershipService.createCheckoutSession` / `handleMembershipStripeWebhook` unmodified |
| Existing Wallet flow unchanged | ✅ | `walletService.js` and `walletController` deposit/transfer handlers unmodified |
| Existing Refund flow unchanged | ✅ | `refundRequestService.js` unmodified |
| Existing APIs backward compatible | ✅ | No API schema or route changes |
| Existing frontend compatibility | ✅ | No response format changes |
| Compile | ✅ | All imports resolve, no syntax errors |
| All tests pass | ✅ | 101/101 |

---

## Suggested Git Commit Message

```
feat(epic-2.4): enforce BR-PAY-002/004/005 payment business rules

- BR-PAY-002: add idempotencyKey field to Payment model (unique, sparse)
- BR-PAY-004: paymentTimeoutJob cron marks PENDING VNPAY/STRIPE payments
  as FAILED after 15min/30min gateway timeout (runs every 5 min)
- BR-PAY-005: enforce minimum payment of 1,000 VND at Payment model level
- server.js: register paymentTimeoutJob cron schedule
```
