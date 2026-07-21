# Epic 2.6 — Fix Report

**Date:** 2026-07-21  
**Based on:** FLASH_AUDIT_EPIC_2_6.md  
**Audit Verdict:** PASS (6 findings) → All fixed  
**Test Result:** 101/101 passed  

---

## Summary

| Finding | Severity | Rule | Status |
|---|---|---|---|
| F-1 | Low | BR-SHP-001 | **FIXED** — Documented reservation strategy |
| F-2 | Medium | BR-SHP-002 | **FIXED** — Added transition guard |
| F-3 | Low | BR-SHP-004 | **FIXED** — Escrow void on return approval |
| F-4 | Low | BR-SHP-004 | **FIXED** — Removed dead `completed` status |
| F-5 | Low | BR-SHP-001/003/004 | **FIXED** — Corrected notification types |
| F-6 | Low | BR-SHP-004 | **FIXED** — Check stock restoration result |

---

## F-1 [Low] — Reservation Strategy Documented

**File:** `src/services/orderService.js`  
**Change:** Added inline comment at inventory reservation block (line ~213)

```js
// BR-SHP-001: Atomic inventory reservation using direct stock decrement.
// The Product schema uses a single `stock` field (no qty_available / qty_reserved split).
// Reservation is modeled as stock → stock - qty at checkout, stock + qty on cancel/return.
// The atomic $gte guard below prevents negative inventory and concurrent oversell.
```

**Rationale:** The Product model (`weightVariantSchema.stock: { type: Number, default: 0 }`) has no `qty_reserved` field. Adding one would require a schema migration on Product.js, which is outside this epic's scope. The current approach is functionally equivalent: the atomic `$gte` guard prevents oversell, stock release on cancel/return restores availability. The comment makes this design decision explicit for future maintainers.

---

## F-2 [Medium] — State Transition Guard

**File:** `src/services/orderService.js`  
**Change:** Added `VALID_TRANSITIONS` map + validation check in `updateSellerOrderStatus`

```js
// Defined at module scope (line ~19):
const VALID_TRANSITIONS = {
    'CHỜ XÁC NHẬN': ['ĐANG GIAO HÀNG'],
    'ĐANG GIAO HÀNG': ['GIAO THÀNH CÔNG'],
    'GIAO THÀNH CÔNG': [],
    'ĐÃ HỦY': [],
}

// Inserted after order fetch (line ~420):
const allowedTargets = VALID_TRANSITIONS[order.status] || []
if (!allowedTargets.includes(status)) {
    throw new AppError(`Không thể chuyển trạng thái từ ${order.status} sang ${status}`, 400)
}
```

**Enforced transitions:**

| From | To |
|---|---|
| `CHỜ XÁC NHẬN` | `ĐANG GIAO HÀNG` only |
| `ĐANG GIAO HÀNG` | `GIAO THÀNH CÔNG` only |
| `GIAO THÀNH CÔNG` | (none — final) |
| `ĐÃ HỦY` | (none — final) |

**Blocked illegal transitions:** Reactivating cancelled orders, regressing delivery state, skipping workflow stages.

The `cancelOrder` function (`CHỜ XÁC NHẬN` → `ĐÃ HỦY`) and `confirmDelivery` function (no status change, only confirmation fields) are unaffected — they operate on their own paths, not via `updateSellerOrderStatus`.

---

## F-3 [Low] — Escrow Void on Return Approval

**File:** `src/services/returnService.js`  
**Change:** In `approveReturn`, load the associated Order and void unreleased escrow

```js
const order = await Order.findOne({ _id: returnRequest.orderId }).session(session)

// ... stock restoration ...

if (order && !order.escrowReleased) {
    order.sellerEscrowAmount = 0
    order.escrowReleased = true
    await order.save({ session })
}
```

**Rationale:** If a buyer returns before confirming delivery, the seller's escrow remains unreleased. Before this fix, `sellerEscrowAmount` stayed on the order indefinitely as orphaned data. Now:
- `sellerEscrowAmount` is set to 0
- `escrowReleased` is set to `true`
- This signals "escrow was voided, not paid"
- All within the same transaction — if refund fails, escrow void rolls back too

If escrow was already released (buyer confirmed delivery before returning), the order is unchanged — seller keeps their payout, buyer gets refund from system funds (existing behavior).

---

## F-4 [Low] — Dead Status Removed

**File:** `src/models/OrderReturn.js`  
**Change:** Removed `'completed'` from status enum

```js
// Before:
enum: ['requested', 'approved', 'rejected', 'completed']
// After:
enum: ['requested', 'approved', 'rejected']
```

**Rationale:** No code path ever set `completed`. The business rules (BR-SHP-004) define only `pending` → `approved`/`rejected`. A `completed` state would require additional workflow (e.g., refund settlement verification), which is not in scope. The status lifecycle is now accurately `requested` → `approved` | `rejected`.

---

## F-5 [Low] — Notification Types Corrected

**Files:** `src/services/orderService.js`, `src/services/returnService.js`

### Changes

| Event | Before | After | Receiver |
|---|---|---|---|
| Order created | `PAYMENT_SUCCESS` | `PAYMENT_SUCCESS` *(unchanged)* | Buyer |
| Order cancelled | `PAYMENT_SUCCESS` | **`REFUND_APPROVED`** | Buyer |
| Delivery confirmed | *(none)* | **`PAYMENT_SUCCESS`** | Seller |
| Delivery confirmed | *(none)* | **`PAYMENT_SUCCESS`** | Buyer |
| Return requested | *(none)* | **`REFUND_REQUEST`** | Seller |
| Return approved | *(none)* | **`REFUND_APPROVED`** | Buyer |
| Return rejected | *(none)* | **`REFUND_REQUEST`** | Buyer |

### Details

**`cancelOrder`** → `REFUND_APPROVED`: Cancellation refunds the buyer's wallet, making `REFUND_APPROVED` the semantically correct type. Content updated to mention hoàn tiền (refund).

**`confirmDelivery`** → `PAYMENT_SUCCESS` for both buyer and seller:
- Seller: "Người mua đã xác nhận nhận hàng. Tiền đã được chuyển vào ví của bạn." (buyer confirmed receipt, funds transferred to your wallet)
- Buyer: "Bạn đã xác nhận nhận hàng thành công." (delivery confirmed successfully)

**`requestReturn`** → `REFUND_REQUEST` for seller: "Khách hàng yêu cầu hoàn trả đơn hàng #..." with refund amount.

**`approveReturn`** → `REFUND_APPROVED` for buyer: Refund confirmed with amount.

**`rejectReturn`** → `REFUND_REQUEST` for buyer: Return rejected with reason.

All notifications use existing `NOTIFICATION_TYPES` enum values — no modifications to `Notification.js`.

---

## F-6 [Low] — Stock Restoration Result Checked

**File:** `src/services/returnService.js`  
**Change:** In `approveReturn`, check `findOneAndUpdate`/`findByIdAndUpdate` return values

```js
const result = await Product.findOneAndUpdate(
    { _id: productId, 'weightVariants.label': variantWeight },
    { $inc: { 'weightVariants.$.stock': quantity } },
    { session },
)
if (!result) {
    console.warn(`returnService.approveReturn: variant product ${productId}/${variantWeight} not found during stock restoration`)
}
```

Same pattern for non-variant products. If the product has been hard-deleted between order and return approval, the warning is logged but the refund still proceeds — the buyer shouldn't be penalized for data integrity issues. The console warning creates an audit trail for ops investigation.

---

## Files Modified

| File | Finding |
|---|---|
| `src/services/orderService.js` | F-1, F-2, F-5 |
| `src/models/OrderReturn.js` | F-4 |
| `src/services/returnService.js` | F-3, F-5, F-6 |

## Files NOT Modified

| Module | Status |
|---|---|
| Payment | Untouched |
| Wallet | Untouched |
| Membership | Untouched |
| Notification (`Notification.js`, `notificationService.js`) | Untouched — reused existing types only |
| Authentication / Middleware | Untouched |
| Product.js | Untouched |
| All controllers | Untouched |
| All routes | Untouched |
| `app.js` | Untouched |

---

## Regression Verification

| Check | Result |
|---|---|
| All tests pass | ✅ 101/101 |
| Existing checkout unchanged | ✅ |
| Existing payment flow unchanged | ✅ |
| Existing wallet unchanged | ✅ |
| Existing notification system unchanged | ✅ |
| Existing product CRUD unchanged | ✅ |
| Existing APIs backward compatible | ✅ |
| No forbidden module modified | ✅ |
