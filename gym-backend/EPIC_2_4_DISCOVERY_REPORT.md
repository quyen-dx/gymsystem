# Epic 2.4 — Discovery Report: Payment Gateway Integration

**Date:** 2026-07-21  
**Purpose:** Determine what already exists vs. what needs building for payment gateway integration (VNPAY + Stripe).

---

## 1. Epic 2.4 Scope (from docs)

| Source | Definition |
|---|---|
| `IMPLEMENTATION_SEQUENCE.md` §2.4 | Payment gateway integration (VNPAY + Stripe): payment processing, idempotency, webhook handling, timeout management, signature verification, minimum payment enforcement |
| `03_SPRINT_2.md` §12 | Payment + Payment Transaction + Webhook + Refund models, VNPAY + Stripe gateway services, idempotency middleware, payment timeout cron, refund service |
| `BUSINESS_RULES.md` §6 | BR-PAY-001 (atomic transactions), BR-PAY-002 (idempotency keys), BR-PAY-003 (refund to original method), BR-PAY-004 (timeout: VNPAY 15min, Stripe 30min), BR-PAY-005 (min 1,000 VND) |
| `STATE_MACHINES.md` §4 | Payment state machine: INITIATED → PROCESSING → COMPLETED/FAILED → REFUNDED/PARTIAL_REFUND |

---

## 2. What ALREADY EXISTS

### 2.1 Payment Model (`src/models/Payment.js`) ✅

**Coverage:** ~75% of required data model. 95 lines. Supports STRIPE, VNPAY, MANUAL_QR, CASH, POS, BANK_TRANSFER, WALLET methods. Fields: `userId`, `membershipId`, `planId`, `stripeSessionId` (unique/sparse), `txnRef` (unique/sparse), `amount`, `currency`, `status` (PENDING/PAID/FAILED/REFUNDED), `paymentMethod`, `method`, `source` (ONLINE/OFFLINE), `paidAt`, `metadata`.

| Expected (Sprint 2 spec) | Status |
|---|---|
| `amount` (VND, integer) | ✅ |
| `status` (enum: pending/processing/completed/failed/refunded) | ✅ (PENDING/PAID/FAILED/REFUNDED — no PROCESSING state) |
| `gateway` (enum: vnpay/stripe) | ⚠️ Uses `paymentMethod` enum instead (STRIPE/VNPAY/etc) |
| `gatewayTransactionId` | ✅ (`stripeSessionId`, `txnRef` serve this purpose) |
| `idempotencyKey` | ❌ **Missing** — not enforced at Payment model level |
| `fee`, `netAmount` | ❌ **Missing** |
| `deletedAt` (soft-delete) | ❌ **Missing** — no immutable audit compliance |

### 2.2 Wallet Model (`src/models/Wallet.js`) ✅

**Coverage:** ~90%. `userId` (unique), `balance` (min 0, default 0), `currency` (default VND). Lightweight, functional.

### 2.3 Transaction Model (`src/models/Transaction.js`) ✅

**Coverage:** ~60%. Acts as combined wallet-transaction log. Fields: `userId`, `walletId`, `type` (deposit/payment/transfer/refund/payout/REFUND_TO_WALLET), `amount`, `balanceBefore`, `balanceAfter`, `idempotencyKey`, `status`. Missing: immutable guard, dual-entry pairing.

### 2.4 VNPAY Service (`src/services/vnpayService.js`) ✅

**Coverage:** ~60%. 95 lines. Functions:
- `createVnpayPaymentUrl()` — builds signed VNPAY payment URL (HMAC-SHA512), sets 15-min expiry, returns `paymentUrl` + `vnp_TxnRef`
- `verifyVnpayReturn()` — validates callback signature against `vnp_SecureHash`

Used only for wallet deposits via `walletController.js`. **Not used for membership purchases.**

### 2.5 Stripe Integration ✅

**Coverage:** ~50%. Exists in TWO locations, some duplication:
- **Membership purchase via Stripe Checkout** (`membershipService.js` lines ~961-1145): `createCheckoutSession()` creates Stripe Checkout Sessions (VND). Webhook at `/api/memberships/stripe-webhook` listens for `checkout.session.completed`.
- **Wallet top-up via Stripe PaymentIntents** (`walletController.js` line 14+): creates Stripe PaymentIntents (USD). Webhook at `/api/wallet/stripe-webhook` listens for `payment_intent.succeeded`.

No dedicated `stripeService.js` — the Stripe SDK is initialized inline in both files.

### 2.6 Wallet Service (`src/services/walletService.js`) ✅

**Coverage:** ~70%. 222 lines. Functions:
- `getOrCreateWallet()` — auto-creates wallet if none exists
- `applyWalletTransaction()` — atomic balance update with `$inc` and `$gte` guard (prevents negative balance)
- `getWalletTransactions()` — paginated transaction history
- `transferWalletBalance()` — multi-document transfer using MongoDB sessions (atomic)
- Deposit bonus system (3% for ≥ 70M VND, 2% for ≥ 15M VND)

### 2.7 Refund System ⚠️

**Coverage:** ~40%.
- `RefundRequest` model (127 lines): tracks member, membership, plan, reason, refund amount, status (PENDING/APPROVED/REJECTED/CANCELLED/REFUNDED), eligibility flags
- `refundRequestService.js` (708 lines): full refund lifecycle — creation, approval, rejection, eligibility (7-day window, benefit usage), refund calculation, wallet credit
- `refundRequestController.js` (85 lines): CRUD endpoints
- Cancellation controller also handles wallet refunds

### 2.8 Plan Model (`src/models/Plan.js`) ✅

Full plan CRUD via `planService.js` + `planController.js` + `planRoutes.js` + `planFeatureRoutes.js`.

### 2.9 Membership Models ✅

`Membership.js`, `MembershipCycle.js`, `MembershipRegistration.js`, `MembershipRenewal.js`, `MembershipPeriod.js`, `MembershipFreeze.js`, `MembershipCancellationRequest.js` — all exist. Purchase flow (`membershipService.js`) handles wallet, Stripe, and manual payment paths.

### 2.10 Webhook Registration (`src/app.js`) ✅

Two raw-body webhook endpoints registered before `express.json()`:
- `POST /api/wallet/stripe-webhook` — wallet top-ups
- `POST /api/memberships/stripe-webhook` — membership Checkout completions

---

## 3. Business Rules Coverage

| Rule | Status | Gap |
|---|---|---|
| **BR-PAY-001** (atomic payment + membership) | ⚠️ Partial | Wallet service uses MongoDB sessions. Payment + membership atomicity across gateways not unified. |
| **BR-PAY-002** (idempotency key) | ⚠️ Partial | Transaction model has `idempotencyKey`. Payment model does NOT enforce it for payment creation. No duplicate-key rejection. |
| **BR-PAY-003** (refund to original method) | ⚠️ Partial | `refundRequestService` handles wallet credit. Gateway refund (VNPAY/Stripe API) not implemented. |
| **BR-PAY-004** (VNPAY 15min / Stripe 30min timeout) | ❌ Not implemented | VNPAY URL has `expireDate` but no server-side cron to mark timed-out payments. Stripe has no timeout handling. |
| **BR-PAY-005** (minimum 1,000 VND) | ❌ Not implemented | No validation found for minimum payment amount. |

---

## 4. API Coverage

| Method | Endpoint | Status | Location |
|---|---|---|---|
| `POST` | `/api/payment/create` | ❌ Missing | — |
| `GET` | `/api/payment/vnpay-return` | ✅ | `walletRoutes.js` → `walletController.handleVnpayReturn` |
| `POST` | `/api/payment/stripe/webhook` | ✅ | `app.js` → `walletController.handleStripeWebhook` |
| `POST` | `/api/payment/vnpay/webhook` (IPN) | ❌ Missing | No VNPAY IPN handler |
| `POST` | `/api/payment/refund` | ⚠️ Partial | `refundRequestController` — approval-based, not direct |
| `GET` | `/api/payment/refunds` | ⚠️ Partial | `refundRequestController` lists requests |
| `GET` | `/api/payment/history` | ⚠️ Partial | `walletController` has transaction history |
| `GET` | `/api/payment/:id` | ❌ Missing | No single-payment detail endpoint |

---

## 5. What is MISSING

### HIGH severity

| Gap | BR Mapping | Build Effort |
|---|---|---|
| Dedicated `paymentService.js` to consolidate scattered logic | — | 2 days |
| BR-PAY-002: Idempotency key enforcement (24h cache, payload hash mismatch detection) | BR-PAY-002 | 1 day |
| BR-PAY-004: Payment timeout cron (mark PENDING → FAILED after gateway timeout) | BR-PAY-004 | 0.5 day |
| BR-PAY-005: Minimum payment validation (1,000 VND) | BR-PAY-005 | 0.5 day |
| Dedicated `stripeService.js` (extract from membershipService + walletController) | — | 1 day |
| VNPAY IPN handler | BR-PAY-001 | 1 day |

### MEDIUM severity

| Gap | BR Mapping | Build Effort |
|---|---|---|
| Payment state machine enforcement (INITIATED → PROCESSING → COMPLETED/FAILED) | STATE_MACHINES §4 | 1 day |
| Dedicated payment routes (`routes/paymentRoutes.js`) | — | 0.5 day |
| Dedicated payment controller (`controllers/paymentController.js`) | — | 0.5 day |
| `PaymentWebhook` model for audit trail | BR-AUD-001 | 0.5 day |
| Webhook signature verification middleware | — | 0.5 day |
| Payment model: add `idempotencyKey`, `fee`, `netAmount`, `deletedAt` fields | — | 0.5 day |

### LOW severity

| Gap | BR Mapping | Build Effort |
|---|---|---|
| `PaymentTransaction` model (separate from wallet Transaction) | — | 0.5 day |
| `PaymentMethod` model (saved methods) | — | 0.5 day |
| `LedgerEntry` model + `ledgerService.js` (dual-entry) | BR-WAL-004 | 1 day |
| Daily reconciliation cron (BR-AUD-003) | BR-AUD-003 | 1 day |
| Gateway refund API integration (VNPAY refund, Stripe refund) | BR-PAY-003 | 1 day |

---

## 6. Existing File Inventory

| File | Lines | Status | Needs Change? |
|---|---|---|---|
| `src/models/Payment.js` | 95 | Production | **Yes** — add `idempotencyKey`, `fee`, `netAmount`, `deletedAt` |
| `src/models/Wallet.js` | 25 | Production | **No** |
| `src/models/Transaction.js` | 75 | Production | **No** — already has `idempotencyKey` |
| `src/models/RefundRequest.js` | 127 | Production | **No** |
| `src/services/vnpayService.js` | 95 | Production | **No** — extend with IPN verification |
| `src/services/walletService.js` | 222 | Production | **No** |
| `src/services/membershipService.js` | ~1200 | Production | **Yes** — extract Stripe logic to stripeService |
| `src/controllers/walletController.js` | 828 | Production | **Yes** — extract payment logic to paymentController, Stripe to stripeService |
| `src/controllers/membershipController.js` | ~300 | Production | **Yes** — stripp `stripeMembershipWebhook` export after extraction |
| `src/routes/walletRoutes.js` | 30 | Production | **No** |
| `src/app.js` | ~130 | Production | **Yes** — mount new payment routes |
| `src/config/env.js` | ~100 | Production | **No** — VNPAY and Stripe config already present |

---

## 7. Architecture Notes

- **Payment model is dual-purpose**: tracks both membership purchases and wallet deposits (distinguished by `metadata.purpose`).
- **Stripe used in two modes**: Checkout Sessions (membership, VND) and PaymentIntents (wallet top-ups, USD).
- **No idempotency middleware**: webhook idempotency is not enforced at a framework level — vulnerable to duplicate webhook processing.
- **Upstream dependencies are solid**: membership purchase flow already works end-to-end with Stripe, VNPAY wallet deposits are functional.
- **80+ createNotification call sites** may need payment-success/failure notifications — but notification system is already Epic 2.3-complete.

---

## 8. Recommendation

### Option 3: Patch existing services only (Recommended ✅)

The payment infrastructure is already **substantially built**. The core gateway integrations (Stripe Checkout, VNPAY URL generation, Stripe PaymentIntents) are working and in production. The gaps are:

1. **Business rule enforcement** (idempotency, timeouts, min payment) — missing validators/guards
2. **Architecture cleanup** (dedicated `paymentService.js`, `stripeService.js`) — logic extraction, not new logic
3. **Missing models** (PaymentWebhook, LedgerEntry) — new additive files

**Rationale for Option 3:**
- Existing gateway code is battle-tested (VNPAY URL signing, Stripe webhook signature verification, wallet atomicity)
- Membership purchase via Stripe Checkout already works end-to-end
- Rebuilding gateway integrations from scratch (Option 2) risks breaking existing purchase/revenue flows
- The ~80+ createNotification call sites are unaffected by payment changes
- Route structure changes are additive (new `paymentRoutes.js` mounted alongside existing wallet routes)

**Estimated build:** ~8 person-days for HIGH/MEDIUM gaps. All changes are additive — zero existing code paths need rework.

**Why NOT Option 1 or 2:**
- Option 1 (missing only): Would leave critical business rules (idempotency, timeouts) unaddressed.
- Option 2 (full rebuild): Unnecessary. Gateway integrations already work. Refactoring Stripe from membershipService into a dedicated stripeService is extraction, not rebuilding.

---

## 9. What MUST NOT Be Modified

Per AI_CODING_CONSTITUTION:
- **Membership purchase flow** (`membershipService.createCheckoutSession`, `createManualRegistration`, `subscribeWithWallet`) — business rules are frozen per Epic 2.2
- **Wallet balance operations** — atomic `$inc` with `$gte` guard is proven and must not change
- **VNPAY URL signing logic** — hash algorithm (`vnp_SecureHash`, HMAC-SHA512) is per VNPAY spec
- **Stripe webhook signature verification** — must remain unchanged
- **Notification system** — Epic 2.3 complete, untouched
- **Existing APIs** — all wallet endpoints preserved, all membership purchase endpoints preserved
- **Unrelated modules** — Auth, Booking, PT, Workout, Check-in, Shop — no changes
