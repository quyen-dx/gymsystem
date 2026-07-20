# Sprint 2 — Revenue

> **Sprint:** 2 (Revenue)
> **Duration:** 3–4 weeks
> **Phase:** Core
> **Status:** Not Started
> **Depends on:** Sprint 0 (Foundation), Sprint 1 (Identity)

---

## 1. Sprint Goal

Implement the complete revenue engine: membership lifecycle management, dual payment gateway integration (VNPAY + Stripe), and atomic wallet system with dual-entry ledger. This sprint makes the platform financially operational — members can purchase memberships, make payments, and maintain a digital wallet.

---

## 2. Business Objectives

- Enable gyms to sell membership plans with flexible purchase, freeze, renewal, and cancellation flows.
- Process payments through VNPAY (domestic Vietnamese market) and Stripe (international) with production-grade reliability.
- Ensure zero financial data loss or double-charging through idempotency, atomic transactions, and immutable audit trails.
- Provide members with a digital wallet for seamless in-gym payments (shop, penalties, refunds).
- Give finance admins granular visibility into revenue, refunds, and wallet flows.
- Establish the escrow infrastructure that Sprint 5 (Shop) will leverage for seller payouts.

---

## 3. Modules Included

| Module | Module Doc | Role in Sprint 2 |
|---|---|---|
| **Membership** | `docs/modules/membership.md` | Plan CRUD, purchase flow, activation, freeze/unfreeze, cancellation with refund, renewal, expiry notifications, trial enforcement. |
| **Payment** | `docs/modules/payment.md` | VNPAY integration, Stripe integration, idempotency engine, webhook processing, timeout handling, minimum payment enforcement. |
| **Wallet** | `docs/modules/wallet.md` | Balance operations, deposit/withdrawal/transfer flows, dual-entry ledger, immutable transaction log, identity verification for withdrawals. |

---

## 4. Dependencies

| Dependency | Status |
|---|---|
| Sprint 0 (Foundation) | Must be complete. All shared utilities in use. |
| Sprint 1 (Identity) | Must be complete. `protect`, `authorize` middleware in place. `User` model available. JWT auth working. |
| MongoDB replica set | Must be active. Transactions require replica set (ADR-001). |
| `config/passport.js` from Sprint 1 | Not directly used, but `User` model is the actor for membership ownership. |
| `middlewares/auth.js` from Sprint 1 | Used for `protect`, `authorize('admin')`, `authorize('member')`, `superAdminOnly`. |
| `config/logger.js` from Sprint 0 | Used for all financial audit logging (BR-AUD-001 compliance). |

---

## 5. Prerequisites

| Item | Description |
|---|---|
| **VNPAY account** | Merchant account with `vnp_TmnCode`, `vnp_HashSecret`, sandbox URL. |
| **Stripe account** | Publishable key + secret key + webhook signing secret. Test mode for development. |
| **MongoDB transactions** | Replica set operational (`rs.initiate()` run). Tested with a sample transaction. |
| **Scheduling/cron** | `node-cron` or similar package installed for expiry notification cron (BR-MEM-007), payment timeout cron (BR-PAY-004), daily reconciliation cron (BR-AUD-003). |
| **HTTP client** | `axios` installed for gateway API calls (VNPAY IPN verification, Stripe API). |
| **bcrypt** | Already installed from Sprint 1. Used for hash verification (VNPAY secure hash). |
| **Zod** | Already installed from Sprint 0. Used for all input validation. |

---

## 6. Documents to Read

### Mandatory — Read before writing any code

| Document | Sections / Relevance |
|---|---|
| `docs/modules/membership.md` | Complete membership module spec: all models, services, controllers, flows, business rules, error codes. |
| `docs/modules/payment.md` | Complete payment module spec: gateway integration, webhook handling, refunds, business rules. |
| `docs/modules/wallet.md` | Complete wallet module spec: balance operations, transactions, dual-entry ledger, business rules. |
| `docs/BUSINESS_RULES.md` | FULL — BR-MEM-001 through BR-MEM-008, BR-PAY-001 through BR-PAY-005, BR-WAL-001 through BR-WAL-004, BR-AUD-001 through BR-AUD-005. |
| `docs/STATE_MACHINES.md` §1 | Membership Cycle State Machine: PENDING_ACTIVATION → ACTIVE → FROZEN/EXPIRED/CANCELLED → REFUNDED. All transitions with guards and actions. |
| `docs/STATE_MACHINES.md` §4 | Payment State Machine: INITIATED → PROCESSING → COMPLETED/FAILED → REFUNDED/PARTIAL_REFUND. |
| `docs/STATE_MACHINES.md` §5 | Freeze State Machine: REQUESTED → APPROVED → ACTIVE → EXPIRED/CANCELLED. |
| `docs/PERMISSION_MATRIX.md` | Membership, Payment, Wallet rows (3 resource sections). Policy overrides §1–§5. |
| `docs/DATABASE.md` | §2.2 (Membership, 5 collections), §2.7 (Payment, 5 collections), §2.8 (Wallet, 2 collections). Also §2.11 (logs for audit). |
| `docs/API_STANDARDS.md` | All sections — every endpoint in this sprint must conform. |
| `docs/EDGE_CASES.md` | EC-MEM-001 through EC-MEM-010, EC-PAY-001 through EC-PAY-006, EC-WAL-001 through EC-WAL-005. |
| `docs/adr/ADR-001.md` | MongoDB transactions — required for BR-PAY-001 atomicity. |
| `docs/adr/ADR-005.md` | VNPAY + Stripe dual gateway decision. |
| `docs/ERROR_HANDLING.md` | Membership, Payment, Wallet error codes. |

### Reference — Skim for context

| Document | Relevance |
|---|---|
| `docs/MEMBERSHIP_SYSTEM_ARCHITECTURE.md` | Membership domain model, cycle management patterns. |
| `docs/AI_CODING_CONSTITUTION.md` | Financial correctness standards. Zero tolerance for money bugs. |
| `docs/BUSINESS_RULES.md` BR-ADM-001 | Admin approval for refunds > 1,000,000 VND — affects refund service. |
| `docs/EDGE_CASES.md` EC-SYS-* | System-level edge cases (timeouts, crashes during financial ops). |

---

## 7. Business Rules

### Membership (BR-MEM-001 through BR-MEM-008) — 8 rules

| Rule ID | Summary | Implementation |
|---|---|---|
| **BR-MEM-001** | One active membership per member. | `membershipService.getActiveMembership()` queries cycles with `status: { $in: ['pending_activation', 'active', 'frozen'] }`. If one exists, reject purchase. |
| **BR-MEM-002** | Pending activation auto-activates on first check-in or after payment. | `membershipCycleService.activateCycle()` called from check-in handler (Sprint 3) or payment webhook. Sets `status: 'active'`, `activatedAt: now()`, computes `expiresAt`. |
| **BR-MEM-003** | Renewal creates pending cycle up to max 3 pending. | Before renewal, count cycles with `status: 'pending_activation'` for same member and plan. If ≥ 3, return `MEMBERSHIP_MAX_RENEWAL`. |
| **BR-MEM-004** | Freeze max 2 per cycle, max 30 days per freeze, min 7 days between freezes. | `freezeService.requestFreeze()` validates: (a) count freezes for this cycle ≤ 2, (b) requested days ≤ 30, (c) last freeze ended ≥ 7 days ago. |
| **BR-MEM-005** | Cancellation requires admin approval if activated. | `cancellationService.requestCancellation()` checks cycle status: if `pending_activation` → auto-approve. If `active` → create `membership_cancellation_requests` document, notify admin. |
| **BR-MEM-006** | Refund calculation. | `cancellationService.calculateRefund()` implements full logic: (a) unactivated ≤ 7 days = 100%, (b) unactivated > 7 days = 90% (minus 10% fee, capped at configurable max), (c) activated < 50% consumed = prorated, (d) activated ≥ 50% consumed = $0. |
| **BR-MEM-007** | Expiry notification sent 7, 3, and 1 day before. | Cron job runs daily: queries cycles with `status: 'active'` and `endDate` within {7, 3, 1} days. Sends notification via notification service. Also sets `status: 'expired'` for cycles whose `endDate` has passed. |
| **BR-MEM-008** | Trial period rules. | Trial plan: `durationDays: 7`, `maxCheckInsPerDay: 1`, `type: 'trial'`. Check-in service enforces 3 total check-in limit. Booking service blocks trial members from booking. One trial per lifetime (verified by government ID or phone). |

### Payment (BR-PAY-001 through BR-PAY-005) — 5 rules

| Rule ID | Summary | Implementation |
|---|---|---|
| **BR-PAY-001** | All financial transactions must be atomic (wallet + order). | All payment flows wrapped in `session.withTransaction()`. If any step fails, MongoDB rolls back. |
| **BR-PAY-002** | Payment idempotency key required for all transactions. | `paymentService.createPayment()` requires `idempotencyKey`. Creates `Payment` document with key. On duplicate within 24h, returns existing result. Key stored with payload hash for mismatch detection. |
| **BR-PAY-003** | Refund must go to original payment method or wallet. | `refundService.processRefund()` reads `payment.method` and `payment.gateway`. Calls gateway refund API. If original method unavailable, credits wallet. |
| **BR-PAY-004** | VNPAY timeout: 15 minutes; Stripe: 30 minutes. | Cron job runs every 5 minutes: queries `payments` with `status: 'processing'` where `createdAt` exceeds gateway-specific timeout. Marks as `timeout`, releases holds. |
| **BR-PAY-005** | Minimum payment: 1,000 VND. | `paymentService.validateAmount()` rejects if `amount < 1000`. |

### Wallet (BR-WAL-001 through BR-WAL-004) — 4 rules

| Rule ID | Summary | Implementation |
|---|---|---|
| **BR-WAL-001** | Wallet balance cannot go negative. | `walletService.debit()` uses `findOneAndUpdate({ userId, balance: { $gte: amount } }, { $inc: { balance: -amount } })`. Returns null if insufficient → throws `WALLET_INSUFFICIENT_BALANCE`. |
| **BR-WAL-002** | Withdrawal requires identity verification. | `walletService.withdraw()` checks `user.identityVerified === true`. Enforces max 10M VND per tx, 50M VND per month. Creates admin approval request. |
| **BR-WAL-003** | Transaction history immutable (append-only). | No UPDATE/DELETE operations on `wallet_transactions`. Corrections via offsetting entries. Mongoose schema sets `immutable: true` and `writeConcern: 'majority'`. |
| **BR-WAL-004** | Dual-entry booking required for all transactions. | Every `wallet_transactions` insert is paired with a `ledger_entries` insert (debit + credit). Sum of debits must equal sum of credits. Validated in transaction. |

### Audit (BR-AUD-001, BR-AUD-003) — 2 additional rules active

| Rule ID | Summary | Implementation |
|---|---|---|
| **BR-AUD-001** | All financial records retained for 5 years. | No hard-delete on `payments`, `payment_transactions`, `refunds`, `wallets`, `wallet_transactions`, `ledger_entries`. Soft-delete via `deletedAt` only. |
| **BR-AUD-003** | Daily reconciliation of payment gateway vs internal records. | Cron job (daily, 03:00): fetches gateway transactions for previous day, diffs against internal records, flags discrepancies. Notifies finance admin. |

---

## 8. State Machines

### Membership Cycle State Machine (STATE_MACHINES.md §1)

**States:** `PENDING_ACTIVATION`, `ACTIVE`, `FROZEN`, `EXPIRED`, `CANCELLED`, `REFUNDED`

| From | To | Trigger | Guard | Action |
|---|---|---|---|---|
| `PENDING_ACTIVATION` | `ACTIVE` | First check-in or admin manually activates | Payment must be received (`payment_status = PAID`) | Start membership period; record activation date |
| `ACTIVE` | `FROZEN` | Member requests freeze | Max 2 freezes per cycle; max 30 days per freeze; min 7 days between freezes | Record freeze request; pause membership clock |
| `FROZEN` | `ACTIVE` | Freeze period expires (automatic) | None | Resume membership clock; extend end date by freeze days |
| `ACTIVE` | `EXPIRED` | End date reached (cron job) | None | Revoke access; send expiry notification |
| `ACTIVE` | `CANCELLED` | Member requests + admin approves | Refund policy determines amount (if any) | Calculate refund; revoke access; notify member |
| `PENDING_ACTIVATION` | `CANCELLED` | Member requests cancellation | Within 7 days of purchase (no admin needed) | Full refund (if paid); void membership |
| `CANCELLED` | `REFUNDED` | Admin processes refund | Refund policy applies; payment was collected | Issue payment via gateway; record refund date |
| `EXPIRED` | `ACTIVE` | Member purchases a renewal | New payment received | Create new membership period; reactivate access |

**Invalid transitions:**
- `FROZEN → EXPIRED`, `FROZEN → CANCELLED`, `EXPIRED → FROZEN`, `EXPIRED → CANCELLED`
- `CANCELLED → ACTIVE`, `REFUNDED → *` (terminal)

### Payment State Machine (STATE_MACHINES.md §4)

**States:** `INITIATED`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`, `PARTIAL_REFUND`

| From | To | Trigger | Guard | Action |
|---|---|---|---|---|
| `INITIATED` | `PROCESSING` | Gateway API called | None | Lock amount; record gateway request ID |
| `PROCESSING` | `COMPLETED` | Gateway success webhook | Signature valid; idempotency key not replayed | Release funds; trigger order/membership activation |
| `PROCESSING` | `FAILED` | Gateway failure or timeout | None | Release hold; notify user; increment retry counter |
| `COMPLETED` | `REFUNDED` | Full refund processed | Refund policy allows | Issue full refund via gateway; notify user |
| `COMPLETED` | `PARTIAL_REFUND` | Partial refund processed | Refund policy allows | Issue partial refund; update ledgers; notify user |

**Invalid transitions:**
- `INITIATED → COMPLETED`, `INITIATED → FAILED`, `FAILED → COMPLETED`, `FAILED → REFUNDED`
- `REFUNDED → *` (terminal), `PROCESSING → PARTIAL_REFUND`
- `PARTIAL_REFUND → REFUNDED` (allowed — follow-up full refund of remainder)

### Freeze State Machine (STATE_MACHINES.md §5)

**States:** `REQUESTED`, `APPROVED`, `ACTIVE`, `EXPIRED`, `CANCELLED`

| From | To | Trigger | Guard | Action |
|---|---|---|---|---|
| `REQUESTED` | `APPROVED` | Admin or system auto-approves | Freeze policy valid | Schedule freeze period; notify member |
| `APPROVED` | `ACTIVE` | Freeze start date reached (automatic) | None | Pause membership clock; notify member |
| `ACTIVE` | `EXPIRED` | Freeze end date reached (automatic) | None | Resume membership clock; extend end date |
| `ACTIVE` | `CANCELLED` | Member cancels freeze early | Min 1 day already frozen | Resume membership clock; adjust end date |

---

## 9. Permission Matrix

### Resource: Membership (from `docs/PERMISSION_MATRIX.md`)

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View own | - | R | R | - | - | R | R |
| View any | - | - | - | R | - | R | R |
| Create | - | - | - | C | - | C | C |
| Update any | - | - | - | - | - | U | U |
| Delete | - | - | - | - | - | - | D |
| Cancel own | - | C | - | - | - | C | C |
| Cancel any | - | - | - | - | - | C | C |
| Freeze own | - | C | - | - | - | C | C |
| Approve freeze | - | - | - | - | - | U | U |
| Process refund | - | - | - | - | - | U | U |

### Resource: Payment (from `docs/PERMISSION_MATRIX.md`)

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View own | - | R | R | - | R | R | R |
| View all | - | - | - | - | - | R | R |
| Create payment | - | C | - | - | - | - | - |
| Process refund | - | - | - | - | - | U | U |
| View revenue | - | - | R | - | R | R | R |
| Export financials | - | - | - | - | - | R | R |

### Resource: Wallet (from `docs/PERMISSION_MATRIX.md`)

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View own | - | R | R | - | R | R | R |
| View all | - | - | - | - | - | R | R |
| Deposit | - | C | C | - | C | C | C |
| Withdraw | - | C | C | - | C | - | - |
| Transfer | - | C | C | - | C | - | - |
| Manual adjust | - | - | - | - | - | U | U |

Policy overrides from PERMISSION_MATRIX.md apply. Super Admin override (§2) is especially relevant for `Manual adjust` on wallet.

---

## 10. Database Collections

### Membership (DATABASE.md §2.2) — 5 collections

#### `membership_plans`
| Key Fields | Indexes |
|---|---|
| `name` (unique), `description`, `durationDays`, `price` (VND, integer), `maxFreezes`, `maxCheckInsPerDay`, `features` ([String]), `isActive` (default true), `deletedAt`, `createdBy` (ref: User) | `name` (unique), `{ isActive: 1, price: 1 }` |

#### `membership_cycles`
| Key Fields | Indexes |
|---|---|
| `userId` (ref: User), `planId` (ref: MembershipPlan), `startDate`, `endDate`, `status` (enum: pending_activation, active, frozen, expired, cancelled, refunded), `price` (snapshot), `discountCode`, `discountAmount`, `autoRenew`, `pausedDays`, `activatedAt`, `expiredAt`, `deletedAt` | `{ userId: 1, status: 1, endDate: 1 }`, `{ status: 1, endDate: 1 }` |

#### `membership_freezes`
| Key Fields | Indexes |
|---|---|
| `cycleId` (ref: MembershipCycle), `userId` (ref: User), `startDate`, `endDate`, `reason`, `status` (enum: pending, approved, rejected, active, completed), `approvedBy` (ref: User), `deletedAt` | `{ cycleId: 1, status: 1 }`, `{ userId: 1, startDate: 1 }` |

#### `membership_cancellation_requests`
| Key Fields | Indexes |
|---|---|
| `cycleId` (ref: MembershipCycle), `userId` (ref: User), `reason` (required), `status` (enum: pending, approved, rejected), `processedBy` (ref: User), `processedAt`, `deletedAt` | `{ cycleId: 1 }`, `{ userId: 1, status: 1 }` |

#### `membership_discounts`
| Key Fields | Indexes |
|---|---|
| `code` (unique), `description`, `type` (enum: percentage, fixed), `value`, `maxUsage`, `usedCount`, `minPlanPrice`, `validFrom`, `validUntil`, `isActive`, `createdBy` (ref: User), `deletedAt` | `code` (unique), `{ isActive: 1, validFrom: 1, validUntil: 1 }` |

### Payment (DATABASE.md §2.7) — 5 collections

#### `payments`
| Key Fields | Indexes |
|---|---|
| `userId` (ref: User), `bookingId` (ref: Booking, optional), `orderId` (ref: Order, optional), `membershipCycleId` (ref: MembershipCycle, optional), `amount` (VND), `fee`, `netAmount`, `currency` (default VND), `status` (enum: pending, processing, completed, failed, refunded, partially_refunded), `method`, `gateway` (enum: vnpay, momo, stripe, internal), `gatewayTransactionId`, `paidAt`, `refundedAt`, `metadata`, `deletedAt` | `{ userId: 1, status: 1, createdAt: -1 }`, `{ bookingId: 1 }` (unique sparse), `{ orderId: 1 }` (unique sparse), `{ status: 1, createdAt: -1 }`, `{ gatewayTransactionId: 1 }` (sparse unique) |

#### `payment_transactions`
| Key Fields | Indexes |
|---|---|
| `paymentId` (ref: Payment), `type` (enum: charge, refund, reversal, settlement), `amount` (VND), `status` (enum: initiated, success, failed), `gatewayResponse`, `reference`, `deletedAt` | `{ paymentId: 1, createdAt: 1 }`, `{ type: 1, status: 1 }` |

#### `payment_webhooks`
| Key Fields | Indexes |
|---|---|
| `gateway` (enum: vnpay, momo, stripe), `eventType`, `payload`, `headers`, `ip`, `status` (enum: received, processing, processed, failed), `processedAt`, `errorMessage`, `deletedAt` | `{ gateway: 1, status: 1, createdAt: -1 }`, `{ eventType: 1 }` |

#### `refunds`
| Key Fields | Indexes |
|---|---|
| `paymentId` (ref: Payment), `userId` (ref: User), `amount` (VND), `reason` (required), `status` (enum: pending, approved, processed, rejected, failed), `approvedBy` (ref: User), `processedAt`, `gatewayRefundId`, `deletedAt` | `{ paymentId: 1 }`, `{ userId: 1, status: 1 }` |

#### `payment_methods`
| Key Fields | Indexes |
|---|---|
| `userId` (ref: User), `type` (enum: card, wallet, bank_account), `provider`, `token` (masked), `last4`, `isDefault`, `isExpired`, `metadata`, `deletedAt` | `{ userId: 1, isDefault: 1 }`, `{ token: 1 }` (unique sparse) |

### Wallet (DATABASE.md §2.8) — 2 collections

#### `wallets`
| Key Fields | Indexes |
|---|---|
| `userId` (ref: User, unique), `balance` (VND, default 0), `totalDeposited` (VND, lifetime), `totalSpent` (VND, lifetime), `status` (enum: active, frozen, closed), `frozenAt`, `closedAt` | `userId` (unique) |

#### `wallet_transactions`
| Key Fields | Indexes |
|---|---|
| `walletId` (ref: Wallet), `userId` (ref: User), `type` (enum: deposit, withdrawal, payment, refund, bonus, adjustment), `amount` (signed integer), `balanceBefore`, `balanceAfter`, `referenceType` (enum: payment, order, refund, adjustment), `referenceId` (polymorphic ref), `description`, `deletedAt`, `createdAt` | `{ walletId: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`, `{ referenceType: 1, referenceId: 1 }` |

#### `ledger_entries` (from BR-WAL-004 dual-entry requirement)
| Key Fields | Indexes |
|---|---|
| `transactionId` (ref: WalletTransaction), `account` (String), `type` (enum: debit, credit), `amount` (Number, positive), `description` (String), `createdAt` | `{ transactionId: 1 }`, `{ account: 1, createdAt: -1 }` |

Note: `ledger_entries` is not explicitly listed as a separate collection in DATABASE.md but is implied by BR-WAL-004's dual-entry requirement. If the team decides to embed ledger entries within `wallet_transactions` instead, that decision must be documented in an ADR.

---

## 11. API Endpoints

### Membership Endpoints (from `docs/modules/membership.md`)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/memberships` | Required | All | List available membership plans (active plans only). |
| `POST` | `/api/v1/memberships/buy-plan` | Required | Member | Purchase a plan. Creates cycle in `pending_activation`. Initiates payment. Applies discount code if provided. Validates BR-MEM-001. |
| `GET` | `/api/v1/memberships/my-cycles` | Required | Member | Get own membership cycle history. Returns all cycles with status, dates, payments. |
| `POST` | `/api/v1/memberships/cancel/:cycleId` | Required | Member | Request cancellation. If `pending_activation` → auto-cancel. If `active` → creates cancellation request per BR-MEM-005. |
| `POST` | `/api/v1/memberships/freeze` | Required | Member | Request membership freeze. Validates BR-MEM-004 limits. Creates `membership_freezes` document. |
| `POST` | `/api/v1/memberships/renew` | Required | Member | Renew membership. Creates renewal cycle in `pending_activation`. Validates BR-MEM-003 (max 3 pending). |

### Plan Management Endpoints (admin)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/plans` | Public | — | List active plans (public). |
| `GET` | `/api/v1/admin/plans` | Required | Admin, Super Admin | List all plans (including inactive). |
| `POST` | `/api/v1/admin/plans` | Required | Admin, Super Admin | Create new membership plan. |
| `PUT` | `/api/v1/admin/plans/:id` | Required | Admin, Super Admin | Update plan. Check for active cycles referencing plan before destructive changes (EC-MEM-009). |
| `DELETE` | `/api/v1/admin/plans/:id` | Required | Super Admin | Soft-delete plan. Block if active cycles reference it. |

### Freeze Management Endpoints

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/memberships/freeze-history` | Required | Member | Get own freeze history. |
| `PUT` | `/api/v1/admin/freezes/:id/approve` | Required | Admin, Super Admin | Approve a freeze request. |
| `PUT` | `/api/v1/admin/freezes/:id/reject` | Required | Admin, Super Admin | Reject a freeze request. |

### Cancellation Management Endpoints

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/admin/cancellations` | Required | Admin, Super Admin | List pending cancellation requests. |
| `PUT` | `/api/v1/admin/cancellations/:id/approve` | Required | Admin, Super Admin | Approve cancellation. Calculates refund per BR-MEM-006, processes refund via Payment module. |
| `PUT` | `/api/v1/admin/cancellations/:id/reject` | Required | Admin, Super Admin | Reject cancellation with reason. |

### Payment Endpoints (from `docs/modules/payment.md`)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/payment/create` | Required | Member | Create payment request. Requires `idempotencyKey` (BR-PAY-002). Validates minimum amount (BR-PAY-005). Returns gateway URL for redirect. |
| `GET` | `/api/v1/payment/vnpay-return` | Public | — | VNPAY return URL handler. Verifies `vnp_SecureHash`, queries VNPAY for confirmation, processes payment. |
| `POST` | `/api/v1/payment/stripe/webhook` | Public* | — | Stripe webhook handler. Verifies `stripe-signature` header. Processes `payment_intent.succeeded`, `payment_intent.payment_failed` events. Idempotent. |
| `POST` | `/api/v1/payment/vnpay/webhook` | Public* | — | VNPAY IPN handler. Verifies hash. Processes payment confirmation. Idempotent. |
| `POST` | `/api/v1/payment/refund` | Required | Admin, Super Admin | Process a refund. If amount > 1,000,000 VND, creates admin approval (BR-ADM-001). |
| `GET` | `/api/v1/payment/refunds` | Required | Admin, Super Admin | List all refunds with filters (status, date range, user). |
| `GET` | `/api/v1/payment/history` | Required | Member | Get own payment history. |
| `GET` | `/api/v1/payment/:id` | Required | Member | Get single payment details. |

*Webhook endpoints validated via gateway signature, not JWT.

### Wallet Endpoints (from `docs/modules/wallet.md`)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/wallet` | Required | Member | Get wallet balance, status, lifetime stats. Wallet auto-created on first access if not exists. |
| `POST` | `/api/v1/wallet/deposit` | Required | Member | Initiate deposit. Creates payment via Payment module. Wallet credited on payment success webhook. |
| `POST` | `/api/v1/wallet/withdraw` | Required | Member | Request withdrawal. Validates BR-WAL-001 (balance), BR-WAL-002 (identity + limits). Creates admin approval. |
| `POST` | `/api/v1/wallet/transfer` | Required | Member | Transfer to another member. Validates sender balance. Atomic dual-entry. |
| `GET` | `/api/v1/wallet/transactions` | Required | Member | List transaction history (paginated, filterable by type, date range). |
| `GET` | `/api/v1/admin/wallets` | Required | Admin, Super Admin | List all wallets with filters (balance range, status). |
| `POST` | `/api/v1/admin/wallets/:id/adjust` | Required | Super Admin | Manual wallet adjustment (correction). Creates dual-entry transaction. Audit logged. |

---

## 12. AI Components

No AI components are directly implemented in Sprint 2. However, the following AI subsystems gain foundations:

| Component | Sprint 2 Relevance |
|---|---|
| **Tool Router** | Future AI chat will use tools like `getMembershipStatus`, `getWalletBalance`, `getPaymentHistory`. The tool registry from Sprint 0 is extended with tool stubs for membership/wallet/payment queries. |
| **Permission Engine** | Future AI permission checks will consult the same RBAC middleware built here for membership/wallet access. |

Formal AI module integration is in Sprint 5+.

---

## 13. Files Expected to be Created

### Models (`gym-backend/src/models/`)

| File | Description |
|---|---|
| `models/MembershipPlan.js` | Mongoose schema for `membership_plans` collection. |
| `models/MembershipCycle.js` | Mongoose schema for `membership_cycles` with state transition validation hooks. |
| `models/MembershipFreeze.js` | Mongoose schema for `membership_freezes`. |
| `models/MembershipCancellationRequest.js` | Mongoose schema for `membership_cancellation_requests`. |
| `models/MembershipDiscount.js` | Mongoose schema for `membership_discounts`. |
| `models/Payment.js` | Mongoose schema for `payments` with idempotency key. |
| `models/PaymentTransaction.js` | Mongoose schema for `payment_transactions`. |
| `models/PaymentWebhook.js` | Mongoose schema for `payment_webhooks`. |
| `models/Refund.js` | Mongoose schema for `refunds`. |
| `models/PaymentMethod.js` | Mongoose schema for `payment_methods`. |
| `models/Wallet.js` | Mongoose schema for `wallets`. |
| `models/WalletTransaction.js` | Mongoose schema for `wallet_transactions` — immutable, append-only. |
| `models/LedgerEntry.js` | Mongoose schema for dual-entry `ledger_entries` (BR-WAL-004). |

### Services (`gym-backend/src/services/`)

| File | Description |
|---|---|
| `services/membershipService.js` | `buyPlan()`, `renew()`, `getActiveMembership()`, `validateMembership()`. |
| `services/membershipCycleService.js` | `createCycle()`, `activateCycle()`, `expireCycle()`, `getCycleHistory()`, `getCyclesExpiringSoon()`. |
| `services/membershipPlanService.js` | `listPlans()`, `getPlan()`, `createPlan()`, `updatePlan()`, `toggleActive()`, `validatePlanForDeletion()`. |
| `services/freezeService.js` | `requestFreeze()`, `approveFreeze()`, `rejectFreeze()`, `cancelFreeze()`, `getFreezeHistory()`, `validateFreezeLimits()`. |
| `services/cancellationService.js` | `requestCancellation()`, `approveCancellation()`, `rejectCancellation()`, `calculateRefund()`, `processRefund()`. |
| `services/discountService.js` | `validateDiscount()`, `applyDiscount()`, `getActiveDiscounts()`. |
| `services/paymentService.js` | `createPayment()`, `processPayment()`, `handleWebhook()`, `getPaymentStatus()`, `resolveTimedOutPayments()`. |
| `services/vnpayService.js` | `createPaymentUrl()`, `verifyReturn()`, `verifyIpn()`, `queryTransaction()`, `verifySecureHash()`. |
| `services/stripeService.js` | `createPaymentIntent()`, `confirmPayment()`, `handleWebhook()`, `createCustomer()`, `verifySignature()`. |
| `services/refundService.js` | `requestRefund()`, `processRefund()`, `calculateRefund()`, `approveRefund()`, `getRefundHistory()`. |
| `services/walletService.js` | `getOrCreateWallet()`, `getBalance()`, `deposit()`, `withdraw()`, `transfer()`, `hold()`, `release()`, `freeze()`, `adjust()`. |
| `services/transactionService.js` | `createTransaction()`, `listTransactions()`, `getTransaction()`, `exportStatement()`, `reconcile()`. |
| `services/ledgerService.js` | `createEntry()`, `validateBalance()`, `getAccountEntries()`. |

### Controllers (`gym-backend/src/controllers/`)

| File | Description |
|---|---|
| `controllers/membershipController.js` | Member-facing membership endpoints. |
| `controllers/membershipPlanController.js` | Admin plan CRUD endpoints. |
| `controllers/freezeController.js` | Freeze request/approval endpoints. |
| `controllers/cancellationController.js` | Cancellation request/approval endpoints. |
| `controllers/paymentController.js` | Payment creation, VNPAY return handler. |
| `controllers/webhookController.js` | VNPAY IPN, Stripe webhook handlers. |
| `controllers/refundController.js` | Refund processing endpoints. |
| `controllers/walletController.js` | Wallet balance, deposit, withdraw, transfer endpoints. |
| `controllers/transactionController.js` | Transaction history/statement endpoints. |

### Routes (`gym-backend/src/routes/`)

| File | Description |
|---|---|
| `routes/membershipRoutes.js` | Member + admin membership endpoints. |
| `routes/planRoutes.js` | Public plan listing + admin plan CRUD. |
| `routes/paymentRoutes.js` | Payment creation + gateway return/webhook routes. |
| `routes/refundRoutes.js` | Refund processing routes. |
| `routes/walletRoutes.js` | Wallet operations routes. |

### Middleware (`gym-backend/src/middlewares/`)

| File | Description |
|---|---|
| `middlewares/idempotency.js` | Idempotency key middleware — checks cache for duplicate keys, stores result on success (BR-PAY-002). |
| `middlewares/webhookSecurity.js` | Webhook signature verification (Stripe `stripe-signature`, VNPAY `vnp_SecureHash`). |

### Jobs / Cron (`gym-backend/src/jobs/`)

| File | Description |
|---|---|
| `jobs/expiryNotifications.js` | Daily cron: sends notifications at 7, 3, 1 days before cycle expiry (BR-MEM-007). Marks cycles as `expired` when endDate passes. |
| `jobs/paymentTimeoutResolver.js` | Every 5 min: resolves `processing` payments past gateway timeout (BR-PAY-004). |
| `jobs/freezeExpiryResolver.js` | Daily cron: activates/deactivates freezes based on startDate/endDate. |
| `jobs/dailyReconciliation.js` | Daily cron at 03:00: reconciles payment gateway records vs internal records (BR-AUD-003). |
| `jobs/freezeScheduler.js` | Handles automatic start/end of scheduled freezes. |

### Config (`gym-backend/src/config/`)

| File | Description |
|---|---|
| `config/vnpay.js` | VNPAY configuration: `tmnCode`, `hashSecret`, sandbox URL, return URL. |
| `config/stripe.js` | Stripe configuration: secret key, webhook secret, API version. |

### Utils

| File | Description |
|---|---|
| `utils/vnpayHash.js` | VNPAY secure hash generation and verification (SHA-512). |
| `utils/idempotencyStore.js` | In-memory or Redis-based idempotency cache with 24h TTL. |
| `utils/moneyUtils.js` | Integer arithmetic helpers (no float operations on currency). |

### Tests

| File | Description |
|---|---|
| `tests/unit/membershipService.test.js` | Plan purchase, BR-MEM-001 through BR-MEM-008 rule enforcement. |
| `tests/unit/paymentService.test.js` | Payment creation, idempotency, gateway integration mocks. |
| `tests/unit/walletService.test.js` | Balance operations, BR-WAL-001 through BR-WAL-004. |
| `tests/unit/refundService.test.js` | BR-MEM-006 refund calculation scenarios. |
| `tests/unit/vnpayService.test.js` | Hash verification, payment URL generation, IPN validation. |
| `tests/unit/stripeService.test.js` | Payment intent creation, webhook verification. |
| `tests/unit/freezeService.test.js` | BR-MEM-004 freeze limit validation. |
| `tests/unit/cancellationService.test.js` | BR-MEM-005 cancellation paths, refund calculation. |
| `tests/unit/ledgerService.test.js` | Dual-entry validation, debit-credit equality. |
| `tests/integration/membership.test.js` | Purchase → activate → freeze → unfreeze → expire flow. |
| `tests/integration/payment.test.js` | Payment creation → gateway mock → webhook → completion. |
| `tests/integration/wallet.test.js` | Deposit → withdraw → transfer flows. |
| `tests/integration/cancellationRefund.test.js` | Cancel + refund flow with BR-MEM-006 scenarios. |
| `tests/integration/vnpay.test.js` | Mocked VNPAY: payment URL → return → IPN race condition (EC-PAY-001). |
| `tests/integration/stripe.test.js` | Mocked Stripe: payment intent → webhook → atomicity. |

---

## 14. Files Expected to be Modified

| File | Change |
|---|---|
| `gym-backend/server.js` | Mount membership, plan, payment, refund, wallet routes. Register cron jobs. |
| `gym-backend/src/routes/index.js` | Import and mount all new route files. |
| `gym-backend/src/config/env.js` | Add VNPAY and Stripe config vars. |
| `gym-backend/src/config/logger.js` | Add financial audit log transport (separate log file for financial events). |

---

## 15. Definition of Ready

- [ ] Sprint 0 and Sprint 1 are complete and verified.
- [ ] MongoDB replica set is active and transactions are tested.
- [ ] VNPAY sandbox account is provisioned with test credentials.
- [ ] Stripe test account is set up with webhook endpoint registered (ngrok for local dev).
- [ ] VNPAY hash secret and Stripe webhook secret are stored securely.
- [ ] Cron job package (`node-cron`) is installed and confirmed working.
- [ ] Idempotency store (Redis or in-memory) is configured.
- [ ] All edge cases in §6 have been read and understood — especially EC-PAY-001 (race), EC-WAL-001 (concurrent), EC-MEM-003 (orphan payment).
- [ ] Test helper to mock payment gateway responses is created.

---

## 16. Definition of Done

- [ ] All 13 Mongoose models compile and match DATABASE.md exactly.
- [ ] All state machines in §8 are enforced at the service layer (invalid transitions return errors).
- [ ] All 17 business rules in §7 pass automated tests.
- [ ] All 28 edge cases (EC-MEM-* × 10, EC-PAY-* × 6, EC-WAL-* × 5, plus the remaining risk ones) are handled or explicitly documented as future work.
- [ ] Membership purchase flow works: select plan → pay → cycle created → pending → first check-in activates.
- [ ] Freeze flow works: request → validate limits → auto-approve → clock pauses → auto-resume.
- [ ] Cancellation flow works: request → pending cycle → auto-cancel. Active cycle → admin approval → refund calculation → refund processed.
- [ ] VNPAY integration: `createPaymentUrl()` generates valid URL → user pays → return URL verified → IPN processed. Race condition between return and IPN handled idempotently.
- [ ] Stripe integration: `createPaymentIntent()` → webhook `payment_intent.succeeded` → payment completed → membership activated atomically.
- [ ] Idempotency: same key within 24h returns original result. Different payload with same key returns 409.
- [ ] Payment timeout: VNPAY > 15min → marked `timeout`; Stripe > 30min → marked `timeout`. Holds released.
- [ ] Wallet deposit: payment → webhook → wallet credited → dual-entry ledger created.
- [ ] Wallet withdrawal: identity verified → balance check → admin approval → amount transferred.
- [ ] Wallet transfer: sender balance validated → atomic debit/credit → both entries in ledger.
- [ ] Wallet balance cannot go negative (BR-WAL-001): concurrent withdrawals cannot overspend.
- [ ] Transaction log immutable: attempted UPDATE/DELETE on `wallet_transactions` blocked.
- [ ] Dual-entry ledger: every transaction has matching debit and credit entries.
- [ ] Minimum payment 1,000 VND enforced (BR-PAY-005).
- [ ] Refund to original payment method (BR-PAY-003); fallback to wallet if unavailable.
- [ ] Expiry notifications sent at 7, 3, 1 days (BR-MEM-007 cron verified).
- [ ] Daily reconciliation job runs and detects discrepancies (BR-AUD-003).
- [ ] Financial records cannot be hard-deleted (BR-AUD-001).
- [ ] All unit tests pass with >80% coverage on membership, payment, wallet services.
- [ ] All integration tests pass including payment gateway mocks.
- [ ] All edge case tests pass (race conditions, state conflicts, data integrity).
- [ ] Code review completed and approved by Tech Lead + Finance domain reviewer.
- [ ] Documentation update checklist (§24) is complete.

---

## 17. Acceptance Criteria

### Membership Plans

| ID | Criterion |
|---|---|
| AC-2.1 | `POST /api/v1/admin/plans` creates a membership plan with all fields from `membership_plans` schema. |
| AC-2.2 | `GET /api/v1/plans` returns only active plans (`isActive: true`). |
| AC-2.3 | `PUT /api/v1/admin/plans/:id` updates plan. Price change does not affect existing active cycles (price snapshot already stored in `membership_cycles.price`). |
| AC-2.4 | Attempting to `DELETE /api/v1/admin/plans/:id` while active cycles reference it returns 409 (EC-MEM-009). |

### Membership Purchase & Activation

| ID | Criterion |
|---|---|
| AC-2.5 | `POST /api/v1/memberships/buy-plan` with `planId` creates cycle with `status: 'pending_activation'`. Initiates payment via selected gateway. |
| AC-2.6 | BR-MEM-001: Attempting to purchase while holding an active/pending/frozen cycle returns 409 `MEMBERSHIP_ALREADY_ACTIVE`. |
| AC-2.7 | BR-MEM-003: Attempting to renew when 3 pending cycles exist returns 422 `MEMBERSHIP_MAX_RENEWAL`. |
| AC-2.8 | BR-MEM-008: Trial plan: only one trial per user lifetime. Booking is blocked for trial members. Max 3 check-ins enforced. |

### Freeze Management

| ID | Criterion |
|---|---|
| AC-2.9 | `POST /api/v1/memberships/freeze` creates freeze request. BR-MEM-004 validated: max 2 per cycle, max 30 days, min 7 days gap. |
| AC-2.10 | Freeze request transitions: `REQUESTED` → `APPROVED` (auto) → `ACTIVE` (on start date) → `EXPIRED` (on end date). Clock pauses during `ACTIVE`. |
| AC-2.11 | Attempting to freeze a non-active cycle (`pending_activation`, `expired`, `cancelled`) returns 409 `MEMBERSHIP_INVALID_STATE` (EC-MEM-006). |

### Cancellation & Refund

| ID | Criterion |
|---|---|
| AC-2.12 | `POST /api/v1/memberships/cancel/:cycleId` on `pending_activation` cycle (≤ 7 days old) auto-cancels and refunds 100% (BR-MEM-006). |
| AC-2.13 | Cancellation on `active` cycle creates admin approval request (BR-MEM-005). Admin approves → refund calculated per BR-MEM-006. |
| AC-2.14 | BR-MEM-006 scenario 1 (unactivated ≤ 7 days): 100% refund. Scenario 2 (unactivated > 7 days): 90% refund (10% processing fee, capped). Scenario 3 (activated < 50% consumed): prorated refund. Scenario 4 (activated ≥ 50% consumed): $0 refund. |
| AC-2.15 | Two concurrent approvals for same cancellation → only one proceeds (EC-MEM-001): `findOneAndUpdate({ status: 'pending' })`. Second returns 409. |

### Payment Gateway Integration

| ID | Criterion |
|---|---|
| AC-2.16 | `POST /api/v1/payment/create` with `idempotencyKey` creates payment with status `INITIATED`. Returns `{ paymentUrl }` for redirect. |
| AC-2.17 | VNPAY payment URL includes all required params (`vnp_Version`, `vnp_TmnCode`, `vnp_Amount`, `vnp_CreateDate`, `vnp_IpAddr`, `vnp_OrderInfo`, `vnp_SecureHash`). |
| AC-2.18 | VNPAY return URL handler verifies `vnp_SecureHash`, queries IPN, marks payment `COMPLETED`, activates membership. |
| AC-2.19 | Stripe webhook `payment_intent.succeeded` verifies signature, marks payment `COMPLETED`, activates membership atomically (BR-PAY-001: in MongoDB transaction). |
| AC-2.20 | Duplicate idempotency key within 24 hours returns the original payment result (BR-PAY-002). Different payload with same key returns 409. |
| AC-2.21 | Payment timeout cron: VNPAY payments in `PROCESSING` > 15 min → `FAILED`. Stripe > 30 min → `FAILED`. Holds/reservations released. |
| AC-2.22 | Minimum payment 1,000 VND: amounts below threshold rejected with 400 (BR-PAY-005). |
| AC-2.23 | Webhook signature verification: invalid signature → 401. Valid signature → processed (EC-PAY-005). |
| AC-2.24 | VNPAY IPN and return URL race handled: both call same idempotent processing function. Only one completes (EC-PAY-001). |

### Wallet Operations

| ID | Criterion |
|---|---|
| AC-2.25 | `GET /api/v1/wallet` auto-creates wallet on first access if not exists (`balance: 0`, `status: 'active'`). |
| AC-2.26 | `POST /api/v1/wallet/deposit` → payment processed → webhook → wallet credited in single transaction (BR-PAY-001). |
| AC-2.27 | `POST /api/v1/wallet/withdraw` validates: identity verified, balance sufficient (BR-WAL-001), per-tx limit ≤ 10M VND, monthly limit ≤ 50M VND (BR-WAL-002). Creates admin approval. |
| AC-2.28 | `POST /api/v1/wallet/transfer` atomically debits sender and credits receiver in a single MongoDB transaction. Both records have dual entries (BR-WAL-004). |
| AC-2.29 | Two concurrent withdrawals from same wallet with limited balance: only one succeeds. Second returns `WALLET_INSUFFICIENT_BALANCE` (EC-WAL-001). |
| AC-2.30 | Wallet transaction log is append-only: direct UPDATE/DELETE on `wallet_transactions` collection is blocked at the DB and application level (BR-WAL-003). |
| AC-2.31 | Every `wallet_transactions` entry has exactly 2 `ledger_entries` (debit + credit). Sum of debits equals sum of credits within each transaction (BR-WAL-004). |
| AC-2.32 | Suspected theft detection: duplicate refund for same cycle returns 409 (EC-WAL-005). |

### Audit & Compliance

| ID | Criterion |
|---|---|
| AC-2.33 | Attempting to hard-delete any financial collection (`payments`, `refunds`, `wallet_transactions`, `ledger_entries`) is blocked (BR-AUD-001). |
| AC-2.34 | Daily reconciliation cron runs at 03:00, diffs internal payments against gateway records, logs discrepancies (BR-AUD-003). |

---

## 18. Testing Strategy

### Unit Tests

| Module | Key Test Cases |
|---|---|
| `membershipService.buyPlan()` | Valid plan → cycle created + payment initiated. BR-MEM-001 violation → 409. Invalid plan ID → 404. |
| `membershipCycleService.activateCycle()` | `pending_activation` → `active`. Sets `activatedAt` and `expiresAt`. Already `active` → 409. |
| `freezeService.requestFreeze()` | Valid → `REQUESTED`. 3rd freeze in cycle → 422 (BR-MEM-004). 31 days → 422. < 7 day gap → 422. |
| `cancellationService.calculateRefund()` | All 4 BR-MEM-006 scenarios with mock dates and amounts. |
| `paymentService.createPayment()` | Valid → `INITIATED`. Amount < 1000 → 400. Missing idempotency key → 400. |
| `paymentService.handleWebhook()` | Idempotent: duplicate webhook returns existing result. Signature invalid → 401. Gateway success → membership activation triggered. |
| `vnpayService.createPaymentUrl()` | URL contains all required params. Hash is correctly computed. |
| `stripeService.handleWebhook()` | Signature verification passes → event processed. Signature fails → 401. |
| `walletService.debit()` | Sufficient balance → balance decremented. Insufficient balance → null returned → 422. |
| `walletService.deposit()` | Funds added to balance. `totalDeposited` incremented. Transaction + ledger entries created. |
| `walletService.transfer()` | Sender debited, receiver credited. Both transaction entries have matching ledger entries. Insufficient sender balance → 422. |
| `ledgerService.validateBalance()` | Debits = credits → true. Mismatch → throws. |
| `refundService.processRefund()` | Original gateway available → refund to gateway. Unavailable → credit wallet. Amount mismatch → 409. |

### Integration Tests

| Flow | Test |
|---|---|
| Membership lifecycle | Create plan → buy plan → payment success webhook → cycle created `pending_activation` → activate → freeze → unfreeze → expiry notification cron → expire. |
| Payment (VNPAY) | Create payment → redirect to mock VNPAY → IPN webhook received → payment `COMPLETED` → membership activated. Simulate IPN before return URL (EC-PAY-001). |
| Payment (Stripe) | Create payment intent → webhook `payment_intent.succeeded` → payment `COMPLETED`. Simulate `payment_intent.payment_failed` → payment `FAILED`. |
| Payment timeout | Create payment → wait > 15 min (VNPAY) / > 30 min (Stripe) → cron marks `timeout` → holds released. |
| Cancellation refund | Cancel pending cycle (day 3) → 100% refund. Cancel pending cycle (day 10) → 90% refund. Cancel active cycle (30% consumed) → prorated. Cancel active cycle (60% consumed) → $0. |
| Wallet deposit | Deposit via Stripe → webhook → wallet credited → verify dual-entry ledger. |
| Wallet withdrawal | Withdraw with valid balance + ID verified → admin approves → funds debited. Withdraw without ID verification → 422. |
| Wallet transfer | Transfer 500,000 VND from A to B → A balance -500k, B balance +500k, 4 ledger entries (2 debit + 2 credit). |
| Concurrent wallet ops | 2 withdrawals of 100,000 from balance 150,000 → 1 succeeds, 1 fails. Balance = 50,000. |
| Double refund guard | Process refund for cycle → wallet credited. Attempt duplicate → 409 (EC-WAL-005). |
| Orphan payment prevention | Simulate membership creation failure after payment success → transaction rolls back → no orphan payment (EC-MEM-003). |
| Expiry notification | Create cycle expiring in 7 days → run cron → notification sent. Advance 4 days → run cron → notification for 3 days. Advance 2 days → run cron → notification for 1 day. Expire → notification + status updated. |

### Edge Case Tests (Critical)

| Edge Case | Test |
|---|---|
| EC-MEM-001 (double approval) | Fire 2 concurrent `approveCancellation` → exactly 1 succeeds, 1 returns 409. |
| EC-MEM-003 (orphan payment) | Stub membership creation to fail after payment → assert full transaction rollback + auto-refund. |
| EC-MEM-004 (max pending) | Create 3 pending cycles → attempt 4th purchase → 422 rejection. |
| EC-PAY-001 (VNPAY race) | Fire IPN and return-URL simultaneously → exactly 1 transaction created. |
| EC-PAY-002 (key reuse fraud) | Send payment with same idempotency key but different amount → 409 conflict. |
| EC-PAY-005 (fake webhook) | POST to stripe webhook with random signature → 401. |
| EC-WAL-001 (concurrent withdrawal) | 2 concurrent withdrawals with insufficient combined balance → exactly 1 succeeds. |
| EC-WAL-003 (deleted bank acc) | Withdraw to bank → delete bank account → batch job → skip withdrawal, release hold. |
| EC-WAL-005 (double refund) | Refund cycle once → succeed. Refund same cycle again → 409. |

### Business Rule Tests (All 17 rules)

| Rule ID | Test |
|---|---|
| BR-MEM-001 | Purchase while active cycle exists → 409 `MEMBERSHIP_ALREADY_ACTIVE`. |
| BR-MEM-002 | Check-in with `pending_activation` cycle → cycle activates, dates set. |
| BR-MEM-003 | 3 pending cycles exist → renewal rejected. 2 pending → renewal accepted (3rd). |
| BR-MEM-004 | 3rd freeze → 422. 31-day freeze → 422. Back-to-back freeze (3 days gap) → 422. |
| BR-MEM-005 | Cancel `pending_activation` → auto-approve. Cancel `active` → admin approval created. |
| BR-MEM-006 | 4 refund scenarios: 100%, 90%, prorated, $0. |
| BR-MEM-007 | Cron at 7/3/1 days triggers notifications. Expired cycles marked daily. |
| BR-MEM-008 | Trial: no booking → blocked. Max 3 check-ins → enforced. Second trial → blocked. |
| BR-PAY-001 | Payment + membership activation in single MongoDB transaction. One fails → both roll back. |
| BR-PAY-002 | Duplicate key within 24h → same result. Same key, different payload → 409. |
| BR-PAY-003 | Refund to original method (gateway → refund API). Fallback to wallet if method unavailable. |
| BR-PAY-004 | VNPAY > 15 min → timeout. Stripe > 30 min → timeout. |
| BR-PAY-005 | Amount < 1000 VND → 400. Amount = 1000 → accepted. |
| BR-WAL-001 | Withdraw more than balance → 422 `WALLET_INSUFFICIENT_BALANCE`. |
| BR-WAL-002 | No ID verification → 422. > 10M per tx → 422. > 50M per month → 422. |
| BR-WAL-003 | Attempted delete on `wallet_transactions` → blocked. Correction via offsetting entry → accepted. |
| BR-WAL-004 | Every transaction has matching pair. Debits != credits → rollback. |

### Permission Tests

| Test | Expected |
|---|---|
| Guest accesses `GET /api/v1/plans` (public) | 200 (Guest can browse per matrix) |
| Guest accesses `POST /api/v1/memberships/buy-plan` | 401 (no token) |
| Member accesses `POST /api/v1/memberships/buy-plan` | 200 (Member can Create — purchase) |
| PT accesses `GET /api/v1/memberships/my-cycles` | 200 (PT can View own per matrix) |
| Member accesses `GET /api/v1/admin/cancellations` | 403 (only Admin+) |
| Admin accesses `PUT /api/v1/admin/cancellations/:id/approve` | 200 (Admin can Cancel any + Process refund) |
| Member accesses `PUT /api/v1/users/:id/role` | 403 (role assignment is Super Admin only) |
| Staff accesses `POST /api/v1/wallet/withdraw` (own) | 200 (Staff can Withdraw per matrix) |
| Seller accesses `GET /api/v1/admin/wallets` | 403 (Seller cannot View all wallets per matrix) |

---

## 19. Rollback Strategy

| Change Type | Rollback Method |
|---|---|
| **New Mongoose models** | Drop new collections. Restore from pre-sprint backup if data was seeded. |
| **Membership flows** | Existing cycles remain in DB; revert code to Sprint 1. Members cannot purchase new plans until re-deployed. |
| **Payment gateway config** | Disable payment endpoints. Any in-flight payments must be manually reconciled with gateway admin panels. |
| **Wallet balances** | **CRITICAL:** Do not roll back wallet data. If a bug caused incorrect balances, apply correction transactions (per BR-WAL-003). Never directly modify `balance` field. |
| **Cron jobs** | Disable cron scheduler (`node-cron`). No running jobs = no side effects. |
| **Ledger entries** | Same as wallet — append correction entries, never delete. |
| **Financial data** | Per BR-AUD-001, no hard-delete of financial records. Soft-delete + migration script if schema changes needed. |

**Critical rollback note:** Financial sprints have high rollback risk. A rollback should only occur if a critical bug is discovered within hours of deployment and no financial transactions have been processed. If transactions exist, the preferred approach is a **hotfix forward** (fix the bug, deploy, run reconciliation).

---

## 20. Risks

| ID | Risk | Probability | Impact |
|---|---|---|---|
| R-2.1 | VNPAY sandbox behaves differently from production → integration tests pass but production fails. | MEDIUM | CRITICAL |
| R-2.2 | Stripe webhook delivery delay > MongoDB transaction timeout → transaction rolls back, payment succeeded on Stripe but membership not created. | MEDIUM | CRITICAL |
| R-2.3 | Wrong refund calculation (BR-MEM-006) → gym loses revenue or members are under-refunded. | MEDIUM | CRITICAL |
| R-2.4 | Concurrent wallet operations with `$inc` but without balance guard → negative balances possible despite BR-WAL-001. | LOW | CRITICAL |
| R-2.5 | Idempotency store (in-memory) lost on server restart → duplicate charges possible during restart window. | MEDIUM | HIGH |
| R-2.6 | VNPAY hash algorithm mismatch → all VNPAY payments fail verification. | LOW | HIGH |
| R-2.7 | Freeze date arithmetic off by one day (DST, timezone, leap year) → membership expiry calculated incorrectly. | MEDIUM | MEDIUM |
| R-2.8 | Cron jobs double-fire (multiple server instances without leader election) → duplicate notifications, double expiration. | MEDIUM | MEDIUM |
| R-2.9 | Payment gateway downtime → members cannot purchase memberships, revenue blocked. | LOW | HIGH |
| R-2.10 | Cloud environment network restrictions block VNPAY/Stripe outbound calls. | LOW | MEDIUM |

---

## 21. Risk Mitigation

| Risk ID | Mitigation |
|---|---|
| R-2.1 | Test with VNPAY production credentials in a staging environment with a real 10,000 VND test payment. Keep sandbox tests as primary but run a single production smoke test post-deploy. |
| R-2.2 | Implement an **outbox pattern**: when Stripe webhook is received, first persist the event as `pending` in the database, then process it. If processing fails, a recovery job retries. Never rely on webhook delivery being synchronous with processing. |
| R-2.3 | **Mandatory:** 100% unit test coverage on `calculateRefund()`. Parameterized tests for every edge case (0 days remaining, exactly 50% consumed, leap years, etc.). Code review by domain expert (finance). |
| R-2.4 | Use `findOneAndUpdate({ userId, balance: { $gte: amount } }, { $inc: { balance: -amount } })` — the balance guard is in the query filter, not a separate read. Null result → insufficient balance. This is the only correct pattern per EC-WAL-001. **Code review must verify this exact pattern is used everywhere.** |
| R-2.5 | Use Redis for idempotency store in production (with persistence enabled). In-memory is dev only. In CI, use a mock Redis. Add a startup check that warns if Redis is not configured. |
| R-2.6 | Implement VNPAY hash verification against their published algorithm spec. Use a known-good test vector (a sample VNPAY response with known inputs and expected hash) as a unit test. |
| R-2.7 | Standardize all date arithmetic on `date-fns` with explicit `Asia/Ho_Chi_Minh` timezone. Unit test with boundary dates (Feb 29, Dec 31, DST transitions). Test EC-MEM-010 (leap year). |
| R-2.8 | Use a database-based lock for cron jobs: before executing, attempt `findOneAndUpdate({ jobName, status: 'idle' }, { status: 'running' })`. Only the instance that succeeds runs the job. After completion, set status back to `idle`. |
| R-2.9 | Implement grace period: if gateway is unreachable, store payment as `INITIATED` and allow member to retry. Retry with exponential backoff (3 attempts, max 2 min total). After max retries, mark as `FAILED` and notify. |
| R-2.10 | Verify outbound connectivity from the deployment environment to VNPAY and Stripe API endpoints during infrastructure setup. Add connectivity health check to `/api/v1/health`. |

---

## 22. Estimated Implementation Order

1. **Mongoose models**: All 13 models (MembershipPlan, MembershipCycle, MembershipFreeze, MembershipCancellationRequest, MembershipDiscount, Payment, PaymentTransaction, PaymentWebhook, Refund, PaymentMethod, Wallet, WalletTransaction, LedgerEntry). State transition validation hooks on MembershipCycle.
2. **Membership plan service + controller + routes**: Plan CRUD (admin) + public listing.
3. **Payment gateway configs**: `config/vnpay.js`, `config/stripe.js`.
4. **VNPAY service**: `createPaymentUrl()`, `verifyReturn()`, `verifyIpn()`, `queryTransaction()`, hash utilities.
5. **Stripe service**: `createPaymentIntent()`, `handleWebhook()`, `verifySignature()`.
6. **Payment service**: `createPayment()` (with idempotency), `processPayment()`, `handleWebhook()` (routes to gateway service).
7. **Idempotency middleware + store**: `middlewares/idempotency.js` + Redis/in-memory store.
8. **Webhook security middleware**: `middlewares/webhookSecurity.js`.
9. **Payment routes + controller**: `POST /payment/create`, `GET /payment/vnpay-return`, webhook endpoints.
10. **Membership service**: `buyPlan()`, `renew()`, `getActiveMembership()`.
11. **Membership cycle service**: `createCycle()`, `activateCycle()`, `expireCycle()`, `getCyclesExpiringSoon()`.
12. **Membership routes + controller**: Member purchase, renew, my-cycles endpoints.
13. **Freeze service**: `requestFreeze()`, `approveFreeze()`, `validateFreezeLimits()`.
14. **Cancellation service**: `requestCancellation()`, `calculateRefund()` (all BR-MEM-006 scenarios), `processRefund()`.
15. **Refund service**: `requestRefund()`, `processRefund()` (BR-PAY-003 logic).
16. **Cron jobs**: Expiry notifications (BR-MEM-007), payment timeout resolver (BR-PAY-004), freeze expiry resolver, daily reconciliation (BR-AUD-003).
17. **Wallet service**: `getOrCreateWallet()`, `deposit()`, `withdraw()` (BR-WAL-001, BR-WAL-002), `transfer()`, `adjust()`.
18. **Ledger service**: `createEntry()`, `validateBalance()` (BR-WAL-004).
19. **Transaction service**: `createTransaction()` (immutable BR-WAL-003), `listTransactions()`.
20. **Wallet routes + controller**: All wallet endpoints.
21. **Unit tests**: All services (membership, payment, wallet, freeze, cancellation, refund, ledger).
22. **Integration tests**: Full purchase → pay → activate flow. Cancel → refund flow. Wallet deposit → withdraw → transfer flow.
23. **Edge case tests**: All critical edge cases (concurrent ops, race conditions, state conflicts).
24. **Business rule tests**: All 17 rules verified.
25. **Permission tests**: All matrix rows verified.
26. **Route mounting**: Update `server.js` and `routes/index.js`.
27. **Documentation update**: §24 checklist.
28. **Production smoke test**: 10,000 VND real payment on VNPAY + Stripe.
29. **Review & merge**.

---

## 23. Review Checklist

Before marking Sprint 2 complete, verify each item:

- [ ] All 13 Mongoose models match DATABASE.md exactly (fields, types, indexes).
- [ ] `npm run lint` passes for all new files.
- [ ] `npm run build` compiles all TypeScript without errors.
- [ ] `npm run test:unit` passes all service tests with >80% coverage.
- [ ] `npm run test:integration` passes all flow tests.
- [ ] Membership plan CRUD works for admin. Public listing works.
- [ ] Membership purchase flow: select plan → payment URL generated → pay → cycle created.
- [ ] BR-MEM-001 enforced: no duplicate active memberships.
- [ ] BR-MEM-003 enforced: max 3 pending renewals.
- [ ] BR-MEM-004 enforced: freeze limits validated correctly.
- [ ] BR-MEM-005 enforced: pending cycles auto-cancel, active cycles need admin.
- [ ] BR-MEM-006 verified: all 4 refund scenarios produce correct amounts (parameterized tests pass).
- [ ] BR-MEM-007 verified: cron sends notifications at 7, 3, 1 days.
- [ ] BR-MEM-008 enforced: trial member cannot book, max 3 check-ins, one trial per lifetime.
- [ ] VNPAY: payment URL generated with correct params + hash. Return URL verified. IPN processed idempotently.
- [ ] Stripe: payment intent created. Webhook verified with signature. Payment completed atomically.
- [ ] BR-PAY-002 enforced: idempotency key validated, duplicates returned, mismatches rejected.
- [ ] BR-PAY-004 enforced: VNPAY > 15 min timeout, Stripe > 30 min timeout.
- [ ] BR-PAY-005 enforced: < 1000 VND rejected.
- [ ] BR-PAY-003 enforced: refund to original method, wallet fallback.
- [ ] Wallet deposit credited by webhook in atomic transaction.
- [ ] BR-WAL-001 enforced: balance never negative (concurrent test passes).
- [ ] BR-WAL-002 enforced: ID verification, per-tx limit, monthly limit.
- [ ] BR-WAL-003 enforced: no UPDATE/DELETE on `wallet_transactions`.
- [ ] BR-WAL-004 enforced: every transaction has matching debit/credit in ledger.
- [ ] BR-AUD-001 enforced: no hard-delete on financial collections.
- [ ] BR-AUD-003 verified: reconciliation cron runs and detects mismatches.
- [ ] All edge cases in §18 (EC-MEM-* × 10, EC-PAY-* × 6, EC-WAL-* × 5) pass or are documented.
- [ ] All permission tests in §18 pass.
- [ ] No float operations on currency (all integers, verified by lint rule).
- [ ] All financial operations logged to audit log.
- [ ] No secrets in logs or code (API keys, hash secrets).
- [ ] Code review completed by Tech Lead + Finance domain reviewer.
- [ ] 10,000 VND real payment smoke test passed on both VNPAY and Stripe (production mode, immediately refunded).

---

## 24. Documentation Update Checklist

After Sprint 2 code is complete, update these documents:

- [ ] `docs/modules/membership.md` — Update API Endpoints table with actual route paths + implemented status. Add notes on discount code validation. Update flow descriptions with actual implementation details.
- [ ] `docs/modules/payment.md` — Update with actual gateway integration details. Add VNPAY IPN handler specifics. Add Stripe webhook event handling details.
- [ ] `docs/modules/wallet.md` — Update with dual-entry ledger implementation. Add withdrawal approval flow details.
- [ ] `docs/BUSINESS_RULES.md` — Add implementation notes to every BR-MEM-*, BR-PAY-*, BR-WAL-* rule (which file + function implements each rule). Add edge case cross-references.
- [ ] `docs/STATE_MACHINES.md` — Add implementation notes to Membership Cycle, Payment, Freeze state machines (which service methods enforce which transitions).
- [ ] `docs/PERMISSION_MATRIX.md` — Verify all Membership, Payment, Wallet rows match implementation. Add notes on any discovered gaps.
- [ ] `docs/DATABASE.md` — Add `ledger_entries` collection if created. Verify indexes match actual production indexes. Add note on transaction support requirements.
- [ ] `docs/EDGE_CASES.md` — Update resolved edge cases with "Resolved in Sprint 2" and implementation notes. Add any new edge cases discovered.
- [ ] `docs/ERROR_HANDLING.md` — Add any new error codes discovered during implementation. Verify all existing codes map correctly.
- [ ] `docs/SYSTEM_ARCHITECTURE.md` — Update service layer description to include payment gateway abstraction. Add cron job infrastructure to architecture diagram.
- [ ] `docs/adr/ADR-001.md` — Add note on MongoDB transaction usage in Sprint 2 (membership activation + payment confirmation atomicity).
- [ ] `docs/adr/ADR-005.md` — Add implementation notes (VNPAY sandbox config, Stripe webhook registration, idempotency approach).
- [ ] `docs/API_STANDARDS.md` — Add idempotency key header convention (`Idempotency-Key`). Add webhook security section.
- [ ] `docs/README_FOR_AI.md` — Update "Payments" section with implemented gateways. Add "Wallet" section.
- [ ] `docs/AI_CODING_CONSTITUTION.md` — Add any financial-specific conventions discovered (integer-only money, never float, always atomic transactions for multi-collection writes).
- [ ] `docs/CURRENT_PHASE.md` — Update to indicate Sprint 2 completion.
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 2 as completed.
- [ ] `CHANGELOG.md` (root) — Add entry for Sprint 2 with all key deliverables.

---

## 25. Deliverables

| # | Deliverable | Verification |
|---|---|---|
| 1 | Membership plan CRUD (admin) + public listing | `POST/PUT/DELETE /api/v1/admin/plans` + `GET /api/v1/plans` all functional. |
| 2 | Membership purchase flow | `POST /api/v1/memberships/buy-plan` creates cycle + initiates payment. |
| 3 | Membership freeze/unfreeze with date extension | `POST /api/v1/memberships/freeze` → clock pauses → auto-resume → expiry extended. |
| 4 | Membership cancellation with BR-MEM-006 refund | All 4 refund scenarios verified: 100%, 90%, prorated, $0. |
| 5 | Membership renewal (BR-MEM-003) | Max 3 pending cycles enforced. |
| 6 | Trial membership enforcement (BR-MEM-008) | No booking, max 3 check-ins, one trial per lifetime. |
| 7 | VNPAY integration | Payment URL generation, return URL verification, IPN processing, hash verification. |
| 8 | Stripe integration | Payment intent creation, webhook signature verification, event processing. |
| 9 | Idempotency engine (BR-PAY-002) | Key required, duplicates returned, mismatches rejected, 24h TTL. |
| 10 | Payment timeout handling (BR-PAY-004) | VNPAY 15 min, Stripe 30 min → auto-timeout + release holds. |
| 11 | Minimum payment enforcement (BR-PAY-005) | < 1,000 VND rejected. |
| 12 | Refund engine (BR-PAY-003) | Refund to original method; wallet fallback. Admin approval for > 1M VND (BR-ADM-001). |
| 13 | Wallet balance operations (BR-WAL-001) | Atomic `$inc` with balance guard. Negative balances impossible. |
| 14 | Wallet withdrawal flow (BR-WAL-002) | ID verification, per-tx/monthly limits, admin approval. |
| 15 | Wallet transfer flow | Atomic dual-entry transfer between members. |
| 16 | Dual-entry ledger (BR-WAL-004) | Every transaction has matching debit + credit entries. |
| 17 | Immutable transaction log (BR-WAL-003) | No UPDATE/DELETE on `wallet_transactions`. Corrections via offsetting entries. |
| 18 | Expiry notifications cron (BR-MEM-007) | Notifications at 7, 3, 1 days. Daily expiry marking. |
| 19 | Payment timeout resolution cron (BR-PAY-004) | Every 5 min: timeout stale processing payments. |
| 20 | Freeze expiry resolution cron | Auto-activate/deactivate freezes on schedule. |
| 21 | Daily reconciliation cron (BR-AUD-003) | 03:00 daily: diff gateway vs internal records, flag discrepancies. |
| 22 | Webhook security middleware | Stripe signature + VNPAY hash verification. Invalid → 401. |
| 23 | Unit tests | >80% coverage on membership, payment, wallet, freeze, cancellation, refund, ledger services. |
| 24 | Integration tests | Full membership lifecycle, payment flows (both gateways), wallet flows. |
| 25 | Edge case tests | All 21 critical edge cases verified. |
| 26 | Business rule tests | All 17 rules verified + 2 audit rules. |
| 27 | Permission tests | All matrix rows for Membership, Payment, Wallet verified. |
| 28 | Production smoke test | 10,000 VND real payment → immediate refund on both VNPAY and Stripe. |

---

*Sprint 2 document generated from `docs/modules/membership.md`, `docs/modules/payment.md`, `docs/modules/wallet.md`, `docs/BUSINESS_RULES.md`, `docs/STATE_MACHINES.md`, `docs/PERMISSION_MATRIX.md`, `docs/DATABASE.md`, `docs/API_STANDARDS.md`, `docs/EDGE_CASES.md`, `docs/ERROR_HANDLING.md`, `docs/adr/ADR-001.md`, `docs/adr/ADR-005.md`, and `docs/AI_CODING_CONSTITUTION.md`.*
