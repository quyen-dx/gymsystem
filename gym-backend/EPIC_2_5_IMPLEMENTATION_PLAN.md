# Epic 2.5 — Wallet System Implementation Plan

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services only

---

## Files to Create (2)

| # | File | Purpose | Business Rule |
|---|---|---|---|
| 1 | `src/models/LedgerEntry.js` | Dual-entry accounting record (debit/credit) | BR-WAL-004 |
| 2 | `src/services/ledgerService.js` | Create debit/credit pairs, validate sum-balance invariant | BR-WAL-004 |

---

## Files to Modify (5)

### 1. `src/models/Wallet.js` — Add `status` and `heldBalance` fields

**Why required:** BR-WAL-002 withdrawal needs hold/freeze capability. The module spec (`docs/modules/wallet.md:36`) defines wallet statuses: `active`, `frozen`, `closed`.

**Changes:**
- Add `status`: `{ type: String, enum: ['active', 'frozen', 'closed'], default: 'active' }`
- Add `heldBalance`: `{ type: Number, default: 0, min: 0 }`
- `balance` now represents **available** balance. `heldBalance` is the amount on hold (pending withdrawals).
- Total = `balance + heldBalance`. Available = `balance`.

**Backward compatibility:** Existing wallets have `heldBalance=0`, so `balance = available = total`. No data migration needed.

**Risk:** LOW. Field additions with defaults. No existing queries touch these fields.

---

### 2. `src/models/Transaction.js` — Add withdrawal types + unique idempotencyKey index

**Why required:** 
- BR-WAL-002: withdrawal transactions need `'withdrawal'` type.
- BR-WAL-003: `'hold'`, `'release'`, `'correction'` types for hold/release/correction entries.
- BR-WAL-004: `ledgerEntryId` reference for dual-entry traceability.
- Defense-in-depth: add `unique: true, sparse: true` on `idempotencyKey` to match Payment model pattern.

**Changes:**
- `type` enum: add `'withdrawal'`, `'hold'`, `'release'`, `'correction'`
- `status` enum: add `'approved'`, `'rejected'`
- Add `ledgerEntryId`: `{ type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null }` (BR-WAL-004)
- Add `unique: true, sparse: true` to `idempotencyKey` index

**Risk:** MEDIUM. Enum additions are backward compatible (new values don't affect existing records). Unique index on idempotencyKey: existing data has no idempotencyKey set (field is new in most records), so `sparse: true` prevents conflicts. However, if any two existing records share the same non-null idempotencyKey, index creation will fail. Check before applying.

---

### 3. `src/services/walletService.js` — Add withdrawal, hold/release, freeze/unfreeze, correction

**Why required:** BR-WAL-002 needs withdrawal with hold → admin approval → release flow. BR-WAL-003 needs correction type. Wallet lifecycle needs freeze/unfreeze.

**New exported functions:**

| Function | Purpose | BR |
|---|---|---|
| `holdBalance({ userId, amount, reason, idempotencyKey, session })` | Move `amount` from balance to heldBalance. Creates 'hold' Transaction. | BR-WAL-002 |
| `releaseBalance({ userId, amount, reason, session })` | Move `amount` from heldBalance back to balance. Creates 'release' Transaction. | BR-WAL-002 |
| `freezeWallet({ userId, reason })` | Set status to 'frozen'. All outbound ops blocked. | — |
| `unfreezeWallet({ userId })` | Set status to 'active'. | — |
| `requestWithdrawal({ userId, amount, bankInfo, idempotencyKey })` | Validate ID verification + limits → hold balance → create pending withdrawal Transaction. | BR-WAL-002 |
| `approveWithdrawal({ transactionId, adminId })` | Admin approves: release heldBalance → set Transaction to 'approved' → deduct from balance → create dual-entry ledger. | BR-WAL-002, BR-WAL-004 |
| `rejectWithdrawal({ transactionId, adminId, reason })` | Admin rejects: release hold back to balance → set Transaction to 'rejected'. | BR-WAL-002 |

**Modified existing functions:**

| Function | Change | BR |
|---|---|---|
| `applyWalletTransaction` | Integrate dual-entry ledger creation after Transaction creation. | BR-WAL-004 |
| `transferWalletBalance` | Integrate dual-entry ledger creation. Add frozen wallet check. | BR-WAL-004 |

**Implementation details:**

**holdBalance flow:**
```
check balance >= amount (BR-WAL-001)
atomic: balance -= amount, heldBalance += amount
create hold transaction
create dual-entry ledger (debit: wallet available, credit: wallet held)
return wallet + transaction
```

**releaseBalance flow:**
```
check heldBalance >= amount
atomic: heldBalance -= amount, balance += amount
create release transaction
create dual-entry ledger (debit: wallet held, credit: wallet available)
return wallet + transaction
```

**requestWithdrawal flow:**
```
1. Check User.isVerified (BR-WAL-002 identity verification)
2. Check amount <= 10,000,000 (BR-WAL-002 per-transaction limit)
3. Query monthly total from Transaction collection where
   type='withdrawal' AND status!='rejected' AND createdAt >= start of month
4. If monthlyTotal + amount > 50,000,000 → reject (BR-WAL-002 monthly limit)
5. holdBalance(amount, reason='withdrawal')
6. Create withdrawal Transaction: type='withdrawal', status='pending', amount=-takeAmount
7. Metadata stores bankInfo for admin review
8. Return transaction (admin queue item)
```

**approveWithdrawal flow:**
```
1. Find withdrawal transaction (must be type='withdrawal', status='pending')
2. releaseBalance(amount) // move from heldBalance back to available
3. applyWalletTransaction with negative amount // actual deduction
4. Update withdrawal transaction: status='approved', completedAt=now, metadata.adminId
5. Create dual-entry ledger for the actual withdrawal
```

Wait, this is wrong. The hold already moved balance → heldBalance. To complete the withdrawal:
- heldBalance already contains the amount
- We need to remove from heldBalance (this is the actual deduction)
- No need to releaseBalance back first

Let me redesign:

**approveWithdrawal flow:**
```
1. Find withdrawal transaction (type='withdrawal', status='pending')
2. Check wallet.heldBalance >= amount
3. Atomic: heldBalance -= amount (funds permanently deducted)
4. Update transaction: status='approved', completedAt=now
5. Create dual-entry ledger
```

**rejectWithdrawal flow:**
```
1. Find withdrawal transaction (type='withdrawal', status='pending')
2. releaseBalance(amount) // back to balance
3. Update transaction: status='rejected', metadata.rejectionReason
4. Create dual-entry ledger for the release
```

Actually, let me simplify even further. The withdrawal request already holds the funds. Approval just confirms and deducts from heldBalance. Rejection releases back.

**Risk:** MEDIUM. Balances are sensitive. But all operations use existing atomic patterns (`findOneAndUpdate` with `$inc`).

---

### 4. `src/controllers/walletController.js` — Add withdrawal endpoints

**Why required:** BR-WAL-002 requires user-facing withdrawal endpoints and admin review endpoints.

**New controller functions:**

| Function | Route | Role | Description |
|---|---|---|---|
| `requestWithdrawal` | `POST /withdraw` | Member | Submit withdrawal request with bankInfo |
| `listMyWithdrawals` | `GET /withdrawals` | Member | List own withdrawal requests |
| `approveWithdrawal` | `POST /withdrawals/:txnId/approve` | Admin/Staff | Admin approves pending withdrawal |
| `rejectWithdrawal` | `POST /withdrawals/:txnId/reject` | Admin/Staff | Admin rejects pending withdrawal |
| `listPendingWithdrawals` | `GET /staff/withdrawals` | Admin/Staff | Staff view of all pending withdrawal requests |

**Risk:** LOW. Follows existing controller patterns (same error handling, same response format).

---

### 5. `src/routes/walletRoutes.js` — Add withdrawal routes

**Why required:** BR-WAL-002 needs routes.

**New routes:**

| Method | Path | Auth | Handler |
|---|---|---|---|
| POST | `/withdraw` | `protect` | `requestWithdrawal` |
| GET | `/withdrawals` | `protect` | `listMyWithdrawals` |
| POST | `/withdrawals/:txnId/approve` | `adminOrStaff` | `approveWithdrawalWithCheck` |
| POST | `/withdrawals/:txnId/reject` | `adminOrStaff` | `rejectWithdrawalWithCheck` |
| GET | `/staff/withdrawals` | `adminOrStaff` | `listPendingWithdrawalsWithCheck` |

**Risk:** LOW. Route addition only. Existing routes unchanged.

---

## Cross-Controller Safety — Deferred

The Discovery Report identified 3 controllers that bypass `walletService` and write directly to `Wallet`:
- `cancellationController.js` — refund credits
- `planChangeController.js` — upgrade/downgrade payments and refunds
- `membershipService.js` — renewals and refunds

**These are NOT modified** per the constraint: "Do NOT modify Membership, Refund." The direct writes are existing code and out of scope for Epic 2.5. A future Epic should route these through `walletService.applyWalletTransaction` for idempotency and dual-entry coverage.

---

## LedgerEntry Model Design

```js
{
    transactionId: ObjectId → Transaction (required, indexed),
    direction: 'debit' | 'credit' (required),
    amount: Number (required, positive),
    account: String (required, e.g. 'wallet:available:<userId>', 'wallet:held:<userId>', 'system:fee'),
    counterpartyAccount: String (required),
    description: String,
}
```

Indexes: `{ transactionId: 1 }`, `{ account: 1, createdAt: -1 }`

---

## ledgerService Design

```js
export const createLedgerPair = async ({
    transactionId, amount, debitAccount, creditAccount, description, session
}) => {
    // Creates debit + credit entries in a session
    // Debit: direction='debit', account=debitAccount, counterpartyAccount=creditAccount
    // Credit: direction='credit', account=creditAccount, counterpartyAccount=debitAccount
    // Both with same amount
    // If session provided, uses it for atomicity
}

export const validateLedgerBalance = async () => {
    // Aggregate: SUM(debit amounts) - SUM(credit amounts) should equal 0
    // Returns { balanced: boolean, discrepancy: number }
}
```

---

## Business Rules Coverage

| Rule | Implementation |
|---|---|
| **BR-WAL-001** | ✅ Already implemented — atomic `$gte` guard |
| **BR-WAL-002** | ✅ New — `requestWithdrawal` checks `User.isVerified`, 10M/50M limits, holds balance, creates pending Transaction |
| **BR-WAL-003** | ✅ New — `correction` type added to Transaction. Append-only maintained. |
| **BR-WAL-004** | ✅ New — LedgerEntry model + ledgerService integrated into all walletService paths |

---

## Dependencies

- `User.isVerified` field (exists) — used for identity verification check (BR-WAL-002)
- `Transaction` model (exists) — used for admin approval queue (BR-WAL-002)
- `walletService.applyWalletTransaction` (exists) — reused for actual withdrawal deduction
- `Wallet` model (exists) — augmented with heldBalance + status fields

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unique index on Transaction.idempotencyKey conflicts with existing data | LOW | `sparse: true` — only indexes non-null values. Existing records have null/absent idempotencyKey |
| holdBalance/releaseBalance race with concurrent operations | LOW | Uses same `findOneAndUpdate` + `$inc` atomic pattern as BR-WAL-001 |
| Balance semantics change (available vs total) | LOW | `balance` was always treated as available by the `$gte` guard. No semantic change. |
| Cross-controller direct Wallet writes bypass dual-entry | MEDIUM | Documented as known gap. Out of scope per constraints. |
