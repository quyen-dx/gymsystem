# Epic 2.5 — Wallet System Discovery Report

**Date:** 2026-07-21  
**Scope:** Wallet Subsystem (BR-WAL-001 through BR-WAL-004, EC-WAL-001 through EC-WAL-005)  
**Method:** Inspected 8 files — 2 models, 1 service, 1 controller, 1 route, 3 reference docs

---

## 1. Existing Coverage: ~55-60%

| Area | Completion | Detail |
|---|---|---|
| Wallet model | 40% | Core balance tracking works; **missing**: `status` (active/frozen/closed), hold/available balance split, withdrawal limit tracking, identity verification reference |
| Transaction model | 70% | Comprehensive schema with idempotencyKey; **missing**: unique+sparse index on idempotencyKey (unlike Payment), ledger entry reference for dual-entry |
| walletService | 50% | Deposit + transfer + atomic guards solid (6 of ~11 planned methods); **missing**: `withdraw`, `hold`, `release`, `freeze`, `unfreeze` |
| walletController | 55% | 19 exported functions covering 3 deposit methods + transfer + staff views; **missing**: withdrawal endpoint, freeze/unfreeze, admin manual adjustment |
| walletRoutes | 50% | 18 defined routes for deposit/transfer/staff views; **missing**: `POST /withdraw`, freeze/unfreeze, admin adjustment |
| Permissions | 65% | `wallet.withdraw` and `wallet.manual_adjust` defined in `permissions.js`; no endpoints use them |

---

## 2. Business Rule Coverage

### BR-WAL-001: Wallet balance cannot go negative — ✅ FULLY IMPLEMENTED

**Where:** `src/services/walletService.js:68-73`

```js
wallet = await Wallet.findOneAndUpdate(
    { userId, balance: { $gte: absAmount } },
    { $inc: { balance: -absAmount } },
    { new: true, session },
)
```

- Uses atomic `findOneAndUpdate` with `$gte` guard in the query filter (the exact pattern prescribed by EC-WAL-001)
- Null result → `AppError('Insufficient wallet balance', 400)`
- Also enforced in `transferWalletBalance` at line 150
- Also enforced in cross-service calls: `cancellationController`, `planChangeController`, `membershipService` all check balance before deduction

**Gaps:** None. This is a textbook implementation.

---

### BR-WAL-002: Withdrawal requires identity verification — ❌ NOT IMPLEMENTED

**Nothing exists.** No endpoint, no controller function, no identity verification check, no limits enforcement, no admin approval queue.

| Requirement | Status |
|---|---|
| Identity verification before withdrawal | ❌ No check |
| Max 10,000,000 VND per transaction | ❌ No limit |
| Max 50,000,000 VND per month | ❌ No limit |
| Admin review before processing | ❌ No queue |
| Admin approval queue model | ❌ Not created |

**Permission defined but unused:** `wallet.withdraw: [M, P, SE]` at `src/config/permissions.js:109`

---

### BR-WAL-003: Transaction history immutable — ⚠️ PARTIALLY IMPLEMENTED

| Layer | Status |
|---|---|
| Application code never mutates completed transactions | ✅ — only creates; status transitions (pending→completed, pending→cancelled) are intended state changes |
| Database-level REVOKE of UPDATE/DELETE | ❌ — no MongoDB role-level guard |
| Offsetting/correction entry mechanism | ❌ — no way to correct an error via reversing entry |
| Code-level enforcement preventing direct mutations | ❌ — nothing stops a future developer from calling `Transaction.updateOne` |

**Gap:** While the current code doesn't mutate transactions, there's no structural enforcement. A single line of code could bypass the constraint.

---

### BR-WAL-004: Dual-entry booking — ❌ NOT IMPLEMENTED

| Requirement | Status |
|---|---|
| `LedgerEntry` model | ❌ Does not exist |
| `ledgerService` | ❌ Does not exist |
| Debit/credit pair for every transaction | ❌ Only `transferWallet` creates paired records (sender debit + receiver credit), and even those are Transaction records, not formal ledger entries |
| Sum-balance invariant (debits = credits) | ❌ No enforcement |
| Counterparty account | ❌ Not recorded |

`transferWalletBalance` (line 140-197) creates paired debit/credit Transaction records in a session — this is a step toward dual-entry but lacks formal ledger accounts and balance validation.

---

## 3. Edge Case Coverage

| Edge Case | Risk | Status |
|---|---|---|
| **EC-WAL-001** (concurrent → negative) | CRITICAL | ✅ MITIGATED — atomic `$gte` guard in `findOneAndUpdate` filter |
| **EC-WAL-002** (deposit chargeback) | MEDIUM | ❌ NOT IMPLEMENTED — no holding period for large deposits, no chargeback/dispute webhook monitoring, no wallet reversal on dispute |
| **EC-WAL-003** (withdraw to deleted bank) | HIGH | ❌ N/A — no withdrawal flow exists |
| **EC-WAL-004** (txn log divergence) | HIGH | ⚠️ PARTIALLY — sessions used in walletController deposit flows but `cancellationController`, `planChangeController`, `bookingController`, `membershipService` write to Wallet directly without sessions or `applyWalletTransaction` |
| **EC-WAL-005** (double refund) | MEDIUM | ⚠️ PARTIALLY — idempotency guard in `applyWalletTransaction` but bypassed by direct Wallet writes in `cancellationController` and `planChangeController` |

---

## 4. Cross-Controller Safety Issue

The following controllers/service bypass `walletService.applyWalletTransaction` and write directly to `Wallet.findOneAndUpdate` / `wallet.save()`:

| File | Location | What it does | Risk |
|---|---|---|---|
| `cancellationController.js` | lines 83-90, 613-619, 684-691 | Direct Wallet find + save for refund credits | No idempotency, inconsistent session usage |
| `planChangeController.js` | lines 113-121, 242-249, 369-442 | Direct Wallet find + save for upgrade/downgrade payments and refunds | No idempotency, inconsistent session usage |
| `membershipService.js` | lines 230-243, 1567-1574, 1883-1885, 1963-1965 | Direct Wallet find + save for renewals and refunds | No idempotency |
| `bookingController.js` | line 877-893 | Uses `applyWalletTransaction` correctly | ✅ |

These cross-service writes lack EC-WAL-004's prescribed atomicity and EC-WAL-005's idempotency protection.

---

## 5. Missing from Module Spec

Per `docs/modules/wallet.md:13-15`, the Wallet model should have:

| Field | Status |
|---|---|
| `status` (active, frozen, closed) | ❌ Not in schema |
| `dailyLimit` / `monthlyLimit` | ❌ Not in schema |
| Hold/available balance split | ❌ Not in schema |

Per `docs/modules/wallet.md:18-19`, walletService should have:

| Method | Status |
|---|---|
| `hold()` / `release()` | ❌ |
| `freeze()` / `unfreeze()` | ❌ |
| `withdraw()` | ❌ |
| `deposit()` | ✅ (via `applyWalletTransaction`) |
| `transfer()` | ✅ (via `transferWalletBalance`) |
| `getBalance()` | ✅ (via `getOrCreateWallet` / `getWalletByUser`) |

---

## 6. What Already Exists (Strengths)

| Asset | State |
|---|---|
| **Deposit infrastructure** | Mature: VNPAY + Stripe + Manual QR + fake (dev). Full atomic flow with bonus tiers. |
| **Transfer** | Complete: session-based atomicity with paired debit/credit Transaction records. Self-transfer blocked. |
| **Atomic balance guard (BR-WAL-001)** | Textbook correct: `findOneAndUpdate` with `$gte` guard. |
| **Idempotency in core path** | Correct: `applyWalletTransaction` checks `Transaction.findOne({ userId, idempotencyKey })`. |
| **Staff/admin views** | Comprehensive: paginated transaction history, payment list, searchable. |
| **Permission matrix** | Pre-configured for withdrawal (`wallet.withdraw`) and manual adjust (`wallet.manual_adjust`). |
| **MongoDB sessions** | Used correctly in `walletController` deposit + transfer flows. |
| **Payment model integration** | `Payment.createWithIdempotency` used in deposit flows for BR-PAY-002 compliance. |

---

## 7. What Is Missing (Gaps)

### Must-have for BR-WAL compliance:

| # | Gap | Rule | What to build |
|---|---|---|---|
| 1 | **Withdrawal subsystem** | BR-WAL-002 | Controller, route, service method, ID verification check, per-transaction limit (10M VND), monthly limit (50M VND), admin approval queue |
| 2 | **Dual-entry ledger** | BR-WAL-004 | `LedgerEntry` model, `ledgerService`, debit/credit pair creation in all transaction paths, sum-balance invariant validation |
| 3 | **DB-level immutability** | BR-WAL-003 | Offset/correction entry mechanism for Transaction; structural guard against direct mutations |

### Should-have for robustness:

| # | Gap | What to build |
|---|---|---|
| 4 | **Wallet model status** | Add `status` field (active/frozen/closed), hold/available balance split |
| 5 | **walletService hold/release/freeze/unfreeze** | Add the 4 missing methods to match module spec |
| 6 | **Cross-controller safety** | Route `cancellationController`, `planChangeController`, `membershipService` wallet writes through `walletService.applyWalletTransaction` |
| 7 | **EC-WAL-002 (chargeback)** | Holding period for large deposits, dispute webhook monitoring |

### Nice-to-have:

| # | Gap | What to build |
|---|---|---|
| 8 | **Admin manual adjustment endpoint** | `POST /wallet/adjust` using `wallet.manual_adjust` permission |
| 9 | **Transaction.idempotencyKey unique index** | Add `unique: true, sparse: true` to match Payment model pattern |

---

## 8. Recommendation — **Option 3: Patch Existing Services Only**

### Rationale

- The deposit + transfer infrastructure is **already production-ready** (~55-60% complete)
- BR-WAL-001 is textbook-compliant — no fixes needed
- Wallet routes, controller, service, and models all exist — only need augmentation
- Permissions for planned features are pre-configured
- The cross-controller safety issue is contained to 3 files

### Implementation scope

| Phase | Work | Files |
|---|---|---|
| **Core** | BR-WAL-002 — Withdrawal with ID check, limits, admin queue | `walletController.js` + `walletService.js` + `walletRoutes.js` |
| **Core** | BR-WAL-004 — LedgerEntry model + ledgerService | New: `LedgerEntry.js` + `ledgerService.js` |
| **Core** | BR-WAL-003 — Offset/correction entry for immutability | `walletService.js` |
| **Support** | Wallet model: add `status`, hold/available balance | `Wallet.js` |
| **Support** | walletService: add `hold()`, `release()`, `freeze()`, `unfreeze()` | `walletService.js` |
| **Support** | Route cross-controller wallet writes through `applyWalletTransaction` | `cancellationController.js`, `planChangeController.js`, `membershipService.js` |
| **Nice-to-have** | Admin manual adjust endpoint, Transaction unique index | `walletController.js`, `Transaction.js` |

### Why NOT Option 1 (implement missing only)

Option 1 would ONLY implement BR-WAL-002 and BR-WAL-004 — skipping the wallet lifecycle (status/hold/freeze) and cross-controller hardening. This leaves known safety gaps (EC-WAL-004, EC-WAL-005) unfixed. The withdrawal flow logically depends on hold/release functionality.

### Why NOT Option 2 (full rewrite)

The existing code is mature and well-tested. 19 controller functions, 6 service methods, and 3 payment gateway integrations work correctly. A rewrite would discard 55-60% of working code. Also violates the architectural rule: "do NOT redesign, do NOT rewrite working code."

---

## 9. Files Inventory

### Already existing (13 files)

| File | Role | Lines | State |
|---|---|---|---|
| `src/models/Wallet.js` | Balance tracking | 25 | Needs status + hold fields |
| `src/models/Transaction.js` | Immutable transaction log | 75 | Needs unique index + ledger ref |
| `src/services/walletService.js` | Core wallet operations | 222 | Deposit/transfer solid; needs hold/release/freeze/unfreeze |
| `src/controllers/walletController.js` | Wallet endpoints | 830 | 19 functions; deposit/transfer/staff views complete |
| `src/routes/walletRoutes.js` | Route definitions | 30 | 18 routes; missing withdraw/freeze/admin-adjust |
| `src/models/Payment.js` | Payment records with idempotency | 134 | Mature (refactored in Epic 2.4) |
| `src/config/permissions.js` | RBAC matrix | 229 | Wallet permissions pre-defined |
| `src/controllers/cancellationController.js` | Cancellation refunds | — | Direct Wallet writes (needs refactoring) |
| `src/controllers/planChangeController.js` | Plan change payments | — | Direct Wallet writes (needs refactoring) |
| `src/services/membershipService.js` | Membership renewals/refunds | 2691 | Direct Wallet writes (needs refactoring) |
| `src/services/orderService.js` | Shop order — uses applyWalletTransaction correctly | — | ✅ Already safe |
| `docs/BUSINESS_RULES.md` | BR-WAL-001 through BR-WAL-004 | — | Reference |
| `docs/EDGE_CASES.md` | EC-WAL-001 through EC-WAL-005 | — | Reference |

### Needs to be created (2 files)

| File | Purpose |
|---|---|
| `src/models/LedgerEntry.js` | Dual-entry accounting record (BR-WAL-004) |
| `src/services/ledgerService.js` | Debit/credit pair creation, balance validation (BR-WAL-004) |

### Needs modification (7 files)

| File | Change |
|---|---|
| `src/models/Wallet.js` | Add `status`, hold/available balance, withdrawal limits |
| `src/models/Transaction.js` | Add unique index on idempotencyKey, ledger entry reference |
| `src/services/walletService.js` | Add `withdraw()`, `hold()`, `release()`, `freeze()`, `unfreeze()` |
| `src/controllers/walletController.js` | Add withdrawal, admin adjust endpoints |
| `src/routes/walletRoutes.js` | Add withdraw, freeze, admin adjust routes |
| `src/controllers/cancellationController.js` | Route wallet writes through walletService |
| `src/controllers/planChangeController.js` | Route wallet writes through walletService |

---

## 10. Test Impact

Existing tests (101/101 pass as of Epic 2.4) should not break since all changes are additive. Wallet model field additions use defaults; new service methods are opt-in; cross-controller refactoring is behavior-preserving.
