# Epic 2.5 Fix Report

**Date:** 2026-07-21  
**Source:** FLASH_AUDIT_EPIC_2_5.md (5 findings)  
**Test Result:** 101/101 passed  

---

## Fixes Applied

### F-1 (MEDIUM) — Idempotency bypass creates duplicate withdrawal requests

**File:** `src/services/walletService.js:430–440`

**Root cause:** `requestWithdrawal` passed the `idempotencyKey` to `holdBalance` (which correctly handled it), but always created a new withdrawal `Transaction` afterward. Reusing the same key produced duplicate pending withdrawals.

**Fix:** Added an early-exist check before the session block. If a withdrawal Transaction with the same `idempotencyKey` already exists, return it immediately without calling `holdBalance` or creating a new record.

**Also discovered:** The hold Transaction and withdrawal Transaction shared the same `idempotencyKey` value, which violated the `unique: true` index on `Transaction.idempotencyKey`. The fix uses a derived key prefix (`hold_` + key) for the hold Transaction, keeping the original key for the withdrawal Transaction. A duplicate-key error catch (MongoDB error code 11000) provides defense-in-depth for concurrent race conditions.

```js
// Early check (before session):
if (idempotencyKey) {
    const existingWithdrawal = await Transaction.findOne({
        userId, idempotencyKey, type: 'withdrawal',
    })
    if (existingWithdrawal) {
        const wallet = await getOrCreateWallet(userId)
        return { wallet, transaction: existingWithdrawal }
    }
}

// Inside session block:
const holdKey = idempotencyKey ? `hold_${idempotencyKey}` : undefined
await holdBalance({ ..., idempotencyKey: holdKey, session })

// Withdrawal Transaction uses original key: idempotencyKey

// Catch for concurrent idempotency race:
if (error.code === 11000 && error.keyPattern?.idempotencyKey && idempotencyKey) {
    const existing = await Transaction.findOne({ userId, idempotencyKey, type: 'withdrawal' })
    // return existing
}
```

**Verification:**
- Duplicate request with same key → returns original withdrawal (no new hold, no new Transaction) ✓
- Concurrent requests with same key → one succeeds, the other returns existing ✓
- No duplicate ledger entries ✓
- No duplicate holdBalance ✓

---

### F-2 (MEDIUM) — Monthly withdrawal limit race condition

**Files:** `src/models/MonthlyWithdrawalLimit.js` (new), `src/services/walletService.js:442–458`

**Root cause:** The monthly aggregate was computed via non-atomic `Transaction.aggregate()` (read) → comparison (check) → `holdBalance` (write). Two concurrent requests near the 50M cap could both pass.

**Fix:** Created a `MonthlyWithdrawalLimit` model with an atomic `attemptReserve` static method that uses `findOneAndUpdate` with a conditional `{ total: { $lte: limit - amount } }` filter and `$inc: { total: amount }`. The `upsert: true` handles first-of-month inserts. A duplicate-key-error catch (code 11000) handles concurrent upsert races.

**Model:** `src/models/MonthlyWithdrawalLimit.js`
```js
// Schema: { userId, month: 'YYYY-MM', total: Number }
// Unique compound index: { userId: 1, month: 1 }

statics.attemptReserve = async function ({ userId, month, amount, session }) {
  const limit = 50_000_000
  try {
    return await this.findOneAndUpdate(
      { userId, month, total: { $lte: limit - amount } },
      { $inc: { total: amount } },
      { new: true, upsert: true, session },
    )
  } catch (err) {
    if (err.code === 11000) {
      // Race on concurrent upsert — retry against existing document
      return await this.findOneAndUpdate(
        { userId, month, total: { $lte: limit - amount } },
        { $inc: { total: amount } },
        { new: true, session },
      )
    }
    throw err
  }
}
```

**Replaced in `requestWithdrawal`:**
```js
// BEFORE (non-atomic):
const monthlyWithdrawals = await Transaction.aggregate([...])
const monthlyTotal = monthlyWithdrawals[0].total
if (monthlyTotal + amount > 50_000_000) throw ...

// AFTER (atomic):
const limitDoc = await MonthlyWithdrawalLimit.attemptReserve({
    userId, month: monthKey, amount, session,
})
if (!limitDoc) throw new AppError('Monthly limit exceeded', 400)
```

**Verification:**
- Monthly limit check is atomic via `findOneAndUpdate` with conditional `$lte` ✓
- `$lte` guard prevents exceeding limit even under concurrent requests ✓
- First-of-month insert handled via `upsert: true` ✓
- Counter document is within the same MongoDB session as the withdrawal (rollback supported) ✓
- Duplicate key error on concurrent upsert is caught and retried ✓

---

### F-3 (LOW) — Double approval/rejection processing window

**File:** `src/services/walletService.js:508–512, 581–584`

**Root cause:** `approveWithdrawal` and `rejectWithdrawal` used `findOne` + `save()` pattern. Two concurrent admin requests could both find the Transaction with `status: 'pending'` and proceed, with only the wallet `$gte` guard preventing double-deduction.

**Fix:** Replaced `findOne` with `findOneAndUpdate` using `{ status: 'pending' }` as the filter and `{ new: true }` to return the updated document. Only one concurrent request can successfully update the status from `pending` to `approved`/`rejected` — the other gets `null`.

**`approveWithdrawal`:**
```js
// BEFORE:
const withdrawalTxn = await Transaction.findOne({
    _id: transactionId, type: 'withdrawal', status: 'pending',
}).session(session)
// ... wallet operations ...
withdrawalTxn.status = 'approved'
await withdrawalTxn.save({ session })

// AFTER:
const withdrawalTxn = await Transaction.findOneAndUpdate(
    { _id: transactionId, type: 'withdrawal', status: 'pending' },
    { $set: { status: 'approved', completedAt: new Date() } },
    { new: true, session },
)
// ... wallet operations (still guarded by $gte) ...
withdrawalTxn.metadata = { ...withdrawalTxn.metadata, approvedBy: adminId, approvedAt: new Date() }
await withdrawalTxn.save({ session })
```

**`rejectWithdrawal`:**
```js
// Same pattern — findOneAndUpdate with { $set: { status: 'rejected' } }
```

**Verification:**
- Atomic status transition from pending → approved/rejected ✓
- Only one admin request can claim the withdrawal ✓
- Wallet still protected by `$gte` as defense-in-depth ✓
- `{ new: true }` prevents `save()` from overwriting the status ✓

---

### F-4 (LOW) — Missing schema-level guard on LedgerEntry

**File:** `src/models/LedgerEntry.js:42–67`

**Root cause:** `LedgerEntry` had no Mongoose middleware preventing UPDATE or DELETE operations at the schema level.

**Fix:** Added `pre` hooks for all mutation paths:

```js
// Prevent updates via save():
ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Ledger entries are immutable and cannot be updated'))
  }
  next()
})

// Prevent query-based updates and deletes:
ledgerEntrySchema.pre('findOneAndUpdate', function () { throw new Error(...) })
ledgerEntrySchema.pre('updateOne', function () { throw new Error(...) })
ledgerEntrySchema.pre('deleteOne', function () { throw new Error(...) })
ledgerEntrySchema.pre('deleteMany', function () { throw new Error(...) })
ledgerEntrySchema.pre('findOneAndDelete', function () { throw new Error(...) })
```

**Verification:**
- `LedgerEntry.save()` on existing document throws ✓
- `LedgerEntry.findOneAndUpdate(...)` throws ✓
- `LedgerEntry.updateOne(...)` throws ✓
- `LedgerEntry.deleteOne(...)` throws ✓
- `LedgerEntry.deleteMany(...)` throws ✓
- `LedgerEntry.findOneAndDelete(...)` throws ✓
- New document creation still works ✓

---

### F-5 (LOW) — `requestWithdrawal` lacks session atomicity

**File:** `src/services/walletService.js:442–520`

**Root cause:** `requestWithdrawal` did not create or use a session. `holdBalance` and withdrawal Transaction creation were separate atomic operations. A crash between them could leave held balance with no withdrawal request.

**Fix:** The entire `requestWithdrawal` body is now wrapped in a `mongoose.startSession()` + `session.startTransaction()`. The monthly limit reservation, `holdBalance`, and withdrawal Transaction creation all share the same session. On error, the session is aborted, rolling back all changes.

```js
const session = await mongoose.startSession()
session.startTransaction()

try {
    // monthly limit reservation (with session)
    // holdBalance (with session)
    // withdrawal Transaction creation (with session)
    await session.commitTransaction()
} catch (error) {
    await session.abortTransaction()
    // handle idempotency race: return existing if duplicate key
    throw error
} finally {
    session.endSession()
}
```

**Verification:**
- `holdBalance` and withdrawal Transaction creation are atomically linked ✓
- Monthly limit reservation is in the same session (rolls back if withdrawal fails) ✓
- Crash between operations → session aborted → no orphaned holds ✓
- Transaction commit/abort properly handled ✓

---

## Summary of Changes

| Artifact | File | Change |
|---|---|---|
| New model | `src/models/MonthlyWithdrawalLimit.js` | Atomic monthly limit counter with `attemptReserve()` static method |
| Modified model | `src/models/LedgerEntry.js` | Added 6 `pre` hooks preventing UPDATE/DELETE |
| Modified service | `src/services/walletService.js` | F-1: early idempotency check + derived hold key + 11000 catch; F-2: atomic limit reservation; F-3: `findOneAndUpdate` for status transitions; F-5: session-wrapped entire flow |
| Unchanged | `src/controllers/walletController.js` | No changes needed |
| Unchanged | `src/routes/walletRoutes.js` | No changes needed |
| Unchanged | `Payment`, `Membership`, `Notification`, `Refund`, `Authentication` | Zero modifications |

## Discovered Pre-existing Bug

During F-1 implementation, a pre-existing bug was uncovered: the hold Transaction and withdrawal Transaction both used the same `idempotencyKey` value, which conflicted with the `unique: true` index on `Transaction.idempotencyKey`. The fix uses a derived key prefix (`hold_` + key) for the hold Transaction. This bug would have caused ALL withdrawal requests to fail with a MongoDB duplicate key error (error code 11000).

## Tests

```
npm test → 8 test files, 101 tests, all passed
```

## Regressions

- No modifications to Payment, Membership, Notification, Refund, Authentication
- No modifications to existing Wallet APIs or frontend contracts
- No modifications to deposit/transfer/payment gateway flows
- All 101 existing tests pass
