# Epic 2.5 — Wallet System Implementation Report

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services only  
**Test Result:** 101/101 passed ✅  

---

## Business Rules Implemented

| Rule | Description | Implementation |
|---|---|---|
| **BR-WAL-002** | Withdrawal with identity verification + limits | `requestWithdrawal` in walletService: checks `User.isVerified`, 10M/txn limit, 50M/month limit, holds balance, creates pending Transaction for admin review |
| **BR-WAL-003** | Transaction history immutable (append-only) | `correction` type added to Transaction enum. All code creates-only; no UPDATE/DELETE on completed transactions. Offsetting correction entries supported. |
| **BR-WAL-004** | Dual-entry booking for all transactions | `LedgerEntry` model + `ledgerService`. Integrated into `applyWalletTransaction`, `transferWalletBalance`, `holdBalance`, `releaseBalance`, `approveWithdrawal`. |

**BR-WAL-001** (no negative balance) was already fully implemented — untouched.

---

## Files Created

| # | File | Lines | Purpose |
|---|---|---|---|
| 1 | `src/models/LedgerEntry.js` | 41 | Dual-entry accounting record (debit/credit) for BR-WAL-004 |
| 2 | `src/services/ledgerService.js` | 30 | `createLedgerPair`, `createLedgerEntry`, `getLedgerEntries` — debit/credit pair creation for BR-WAL-004 |

---

## Files Modified

| # | File | Change |
|---|---|---|
| 3 | `src/models/Wallet.js` | +2 fields: `heldBalance` (Number, default 0), `status` (enum: active/frozen/closed, default 'active') |
| 4 | `src/models/Transaction.js` | +4 types ('withdrawal', 'hold', 'release', 'correction'), +2 statuses ('approved', 'rejected'), `unique: true, sparse: true` on idempotencyKey, +1 field: `ledgerEntryId` |
| 5 | `src/services/walletService.js` | +7 functions: `holdBalance`, `releaseBalance`, `freezeWallet`, `unfreezeWallet`, `requestWithdrawal`, `approveWithdrawal`, `rejectWithdrawal`. Dual-entry ledger integration into `applyWalletTransaction` and `transferWalletBalance`. Frozen wallet guard on debit + transfer. |
| 6 | `src/controllers/walletController.js` | +5 endpoints: `requestWithdrawalController`, `listMyWithdrawals`, `approveWithdrawalController`, `rejectWithdrawalController`, `listPendingWithdrawals` |
| 7 | `src/routes/walletRoutes.js` | +5 routes: `POST /withdraw`, `GET /withdrawals`, `POST /withdrawals/:txnId/approve`, `POST /withdrawals/:txnId/reject`, `GET /staff/withdrawals` |

---

## New walletService Functions

| Function | BR | Behavior |
|---|---|---|
| `holdBalance` | BR-WAL-002 | Atomic `$inc` (balance down, heldBalance up) with `$gte` guard + dual-entry: debit wallet:available, credit wallet:held |
| `releaseBalance` | BR-WAL-002 | Atomic `$inc` (heldBalance down, balance up) with `$gte` guard + dual-entry: debit wallet:held, credit wallet:available |
| `freezeWallet` | — | Sets status to 'frozen'. All outbound operations blocked. |
| `unfreezeWallet` | — | Sets status to 'active'. |
| `requestWithdrawal` | BR-WAL-002 | Checks `User.isVerified` → 10M/txn limit → 50M/month aggregate → `holdBalance` → creates pending withdrawal Transaction |
| `approveWithdrawal` | BR-WAL-002, 004 | Session-wrapped: deducts heldBalance, marks approved, creates dual-entry (debit wallet:held, credit system:withdrawal) |
| `rejectWithdrawal` | BR-WAL-002 | Session-wrapped: `releaseBalance` (back to available), marks rejected |

**Identity verification:** `User.isVerified: Boolean` field is checked before withdrawal (BR-WAL-002).

**Admin approval queue:** No separate model. Uses Transaction with `type: 'withdrawal'` and `status: 'pending'`. Admin views via `GET /staff/withdrawals`.

---

## New API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/wallet/withdraw` | Member | Submit withdrawal request (body: `amount`, `bankInfo: { bank, accountNumber, holder }`) |
| GET | `/api/wallet/withdrawals` | Member | List own withdrawal history (paginated) |
| POST | `/api/wallet/withdrawals/:txnId/approve` | Admin/Staff | Approve pending withdrawal |
| POST | `/api/wallet/withdrawals/:txnId/reject` | Admin/Staff | Reject pending withdrawal (body: `reason`) |
| GET | `/api/wallet/staff/withdrawals` | Admin/Staff | List all pending withdrawals |

---

## Withdrawal Flow

```
1. POST /api/wallet/withdraw { amount, bankInfo }
2. → User.isVerified? → no → 403 "Identity verification required"
3. → amount > 10,000,000? → yes → 400 "Maximum 10,000,000 VND/txn"
4. → monthly aggregate > 50,000,000? → yes → 400 "Monthly limit exceeded"
5. → holdBalance(amount) — balance ↓, heldBalance ↑
6. → Transaction(type='withdrawal', status='pending') created
7. Admin reviews via GET /staff/withdrawals
8. Admin: POST /withdrawals/:txnId/approve → heldBalance ↓, status='approved'
9. OR Admin: POST /withdrawals/:txnId/reject → releaseBalance → status='rejected'
```

---

## Dual-Entry Ledger Integration Points

| Operation | Debit Account | Credit Account |
|---|---|---|
| Deposit (applyWalletTransaction) | `gateway:<provider>` or `system:deposit` | `wallet:<userId>` |
| Payment (applyWalletTransaction) | `wallet:<userId>` | `system:<source>` or `system:payment` |
| Transfer (transferWalletBalance) | `wallet:<fromUserId>` | `wallet:<toUserId>` |
| Hold (holdBalance) | `wallet:available:<userId>` | `wallet:held:<userId>` |
| Release (releaseBalance) | `wallet:held:<userId>` | `wallet:available:<userId>` |
| Approved withdrawal | `wallet:held:<userId>` | `system:withdrawal` |

All ledger entries created within MongoDB sessions for atomicity with the corresponding Transaction.

---

## Modules NOT Modified (Confirmed)

| Module | File | Reason |
|---|---|---|
| Membership | `membershipService.js` | Out of scope per "Do NOT modify Membership" |
| Payment | `Payment.js`, payment controllers | Unchanged |
| Notification | `notificationService.js`, `Notification.js` | Unchanged |
| Refund | `refundRequestService.js` | Out of scope |
| Authentication | Auth controllers, middleware | Unchanged |
| Cancellation | `cancellationController.js` | Out of scope |
| Plan Change | `planChangeController.js` | Out of scope |
| Wallet deposit flows | `walletController.js` (VNPAY, Stripe, Manual) | Unchanged — only new functions added |
| Wallet transfer | `walletService.transferWalletBalance` | Added frozen guard + dual-entry integration; core logic unchanged |

---

## Regression Checklist

| Check | Status | Evidence |
|---|---|---|
| Existing deposit flow unchanged | ✅ | VNPAY/Stripe/Manual QR deposit handler code untouched |
| Existing transfer flow unchanged | ✅ | Transfer logic preserved; added frozen check (new wallets default active) |
| Existing payment gateways unchanged | ✅ | `vnpayService.js` unmodified. Stripe integration unmodified. |
| Existing wallet APIs backward compatible | ✅ | All 18 existing routes preserved. New routes are additive. `GET /wallet` response now includes `heldBalance` and `status` fields (additive). |
| Existing frontend compatibility | ✅ | Response format unchanged. New fields (`heldBalance`, `status`) are additive — frontend can ignore them. |
| Compile | ✅ | All imports resolve, no syntax errors |
| All tests pass | ✅ | 101/101 |

---

## Suggested Git Commit Message

```
feat(epic-2-5): implement BR-WAL-002/003/004 wallet business rules

- BR-WAL-002: withdrawal with ID verification, 10M/50M limits,
  hold/release, admin approval via Transaction-based queue
- BR-WAL-003: correction transaction type, append-only maintained
- BR-WAL-004: LedgerEntry model + ledgerService, dual-entry
  integrated into applyWalletTransaction, transferWalletBalance,
  holdBalance, releaseBalance, approveWithdrawal
- Wallet model: added heldBalance (hold tracking) and status
  (active/frozen/closed) fields
- Frozen wallet guard: outbound operations blocked via status check
- Transaction model: unique+sparse idempotencyKey index
- New API: POST /wallet/withdraw, GET /wallet/withdrawals,
  POST /withdrawals/:id/approve|reject, GET /staff/withdrawals
```
