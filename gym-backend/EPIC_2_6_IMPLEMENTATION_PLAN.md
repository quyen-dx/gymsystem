# Epic 2.6 — Shop Module Implementation Plan

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services  
**Pre-Epic Coverage:** ~42% → Target: ~80%  

---

## Why Each File Must Be Modified

### src/models/Order.js — MODIFY
**Why:** Current status enum only has 3 states. Need `ĐÃ HỦY` for cancellation. Need `sellerEscrowAmount`, `escrowReleased`, `confirmedByBuyer` to track escrow lifecycle (BR-SHP-003). Need `cancelledAt`, `cancellationReason` for cancellation audit (BR-SHP-001). These are additive fields — no existing field removed or renamed.

**BR:** BR-SHP-001, BR-SHP-003

### src/services/orderService.js — MODIFY
**Why:** The current `createOrder` pays the seller immediately at checkout. BR-SHP-003 requires escrow (hold funds until delivery confirmation). The `createOrder` flow must add stock reservation (BR-SHP-001). The `updateSellerOrderStatus` function currently deducts inventory at delivery — this conflicts with the new reservation-at-checkout flow. New functions for cancellation (BR-SHP-001) and delivery confirmation (BR-SHP-003) must be added alongside existing functions.

**BR:** BR-SHP-001, BR-SHP-002, BR-SHP-003

### src/controllers/orderController.js — MODIFY
**Why:** New endpoints required: cancel order, confirm delivery. Additive — no existing function signature changed.

**BR:** BR-SHP-001, BR-SHP-003

### src/routes/orderRoutes.js — MODIFY
**Why:** Mount new routes for cancel and confirm-delivery. Additive — no existing route removed.

**BR:** BR-SHP-001, BR-SHP-003

### src/app.js — MODIFY (mount return routes)
**Why:** Mount `returnRoutes` at `/api/returns`. Additive — no existing route removed.

---

## Files to Create (new subsystems)

### src/models/OrderReturn.js — NEW
**Why:** No return model exists. BR-SHP-004 requires return request tracking with status lifecycle, refund amount, timestamps, and approver info. Cannot use existing models (order and refund are membership-specific).

**BR:** BR-SHP-004

### src/services/returnService.js — NEW
**Why:** No return logic exists. BR-SHP-004 requires 7-day window validation, seller approval workflow, wallet refund, and stock restoration. This is net-new functionality.

**BR:** BR-SHP-004

### src/controllers/returnController.js — NEW
**Why:** No return API. BR-SHP-004 requires endpoints for request, list, approve, reject.

**BR:** BR-SHP-004

### src/routes/returnRoutes.js — NEW
**Why:** Mount return controller endpoints.

**BR:** BR-SHP-004

---

## Files NOT Modified

| File | Reason |
|---|---|
| `Product.js` | Stock field already exists. Reservation uses atomic `findOneAndUpdate` — no schema change |
| `Shop.js` | Complete, no escrow/payout fields needed |
| `productController.js` | CRUD complete, no new endpoints needed |
| `productRoutes.js` | No new product endpoints |
| `shopController.js` | CRUD complete |
| `shopRoutes.js` | No new shop endpoints |
| `productService.js` | Recommendation engine, no changes |
| `Shipping.js` | Complete |
| `ghnService.js` | Complete |
| `walletService.js` | `applyWalletTransaction` already supports `payout` type |
| `Wallet.js` | No changes |
| `Transaction.js` | Types already include `payout`, `refund` |
| `all auth/middleware files` | No changes |

---

## Detailed Design

### 1. Inventory Reservation (BR-SHP-001)

**Insert into `createOrder`** — after item validation, before wallet deduction:

```js
// NEW: atomic inventory reservation
for (const item of orderItems) {
    const variantWeight = item.variant?.weight || ''
    const product = await Product.findById(item.productId).session(session)
    
    if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0) {
        const result = await Product.findOneAndUpdate(
            {
                _id: item.productId,
                'weightVariants': {
                    $elemMatch: {
                        label: variantWeight,
                        stock: { $gte: item.quantity },
                    },
                },
            },
            { $inc: { 'weightVariants.$.stock': -item.quantity } },
            { new: true, session },
        )
        if (!result) throw new AppError(`Tồn kho không đủ cho ${product.name} (${variantWeight})`, 400)
    } else {
        const result = await Product.findOneAndUpdate(
            { _id: item.productId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { new: true, session },
        )
        if (!result) throw new AppError(`Tồn kho không đủ cho ${product.name}`, 400)
    }
}
```

**Modify `updateSellerOrderStatus`** — at delivery (`GIAO THÀNH CÔNG`):
- REPLACE: the stock deduction block (lines 383-417)
- WITH: just set `order.inventoryDeducted = true` (stock already reserved at checkout)

**Cancellation / return restoration** — use `$inc: { stock: +quantity }` (or variant stock) to release back.

### 2. Escrow (BR-SHP-003)

**Modify `createOrder`** — replace seller payout block (lines 268-285):

```js
// BEFORE: immediate payout
await applyWalletTransaction({
    userId: group.sellerId,
    amount: payoutAmount,
    type: 'payout',
    ...
})

// AFTER: escrow tracking on order
order[0].sellerEscrowAmount = payoutAmount
order[0].escrowReleased = false
await order[0].save({ session })
// Seller NOT paid yet
```

**New `confirmDelivery` function:**
- Validate order belongs to user
- Validate status is `GIAO THÀNH CÔNG`
- Release escrow to seller via `applyWalletTransaction(type: 'payout')`
- Set `confirmedByBuyer = true`, `escrowReleased = true`

### 3. Order Cancellation (BR-SHP-001/003)

**New `cancelOrder` function:**
- Validate: order belongs to user, status is `CHỜ XÁC NHẬN` (cancellable)
- Release reserved stock back via `$inc`
- If escrowed: return buyer's payment via `applyWalletTransaction(type: 'refund')`
- Set status to `ĐÃ HỦY`, record `cancelledAt`, `cancellationReason`

### 4. Return Workflow (BR-SHP-004)

**OrderReturn model:**
```js
{
    orderId: ObjectId → Order,
    userId: ObjectId → User,
    shopId: ObjectId → Shop,
    items: [{ orderItemIndex, productId, variantWeight, quantity, reason }],
    reason: String,
    status: enum ['requested','approved','rejected','completed'],
    refundAmount: Number,
    requestedAt: Date,
    approvedBy: ObjectId → User,
    approvedAt: Date,
    rejectedBy: ObjectId → User,
    rejectedAt: Date,
    rejectionReason: String,
    timestamps: true
}
```

**returnService functions:**
- `requestReturn({ orderId, userId, items, reason })` — validate 7-day window, create return request
- `approveReturn({ returnId, approverId })` — refund wallet, restore stock, set status=approved
- `rejectReturn({ returnId, approverId, reason })` — set status=rejected
- `getReturns(filter)` — list returns
- `getReturnById(returnId)` — single return

**returnController endpoints:**
- `POST /returns` — create return request
- `GET /returns` — user's returns
- `GET /returns/:id` — single return
- `POST /returns/:id/approve` — seller approve return
- `POST /returns/:id/reject` — seller reject return
- `GET /seller/returns` — seller's pending returns

### 5. Order Model Schema Changes

```js
// Add to status enum:
status: { enum: ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG', 'ĐÃ HỦY'] }

// New fields:
sellerEscrowAmount: { type: Number, default: 0 },
escrowReleased: { type: Boolean, default: false },
confirmedByBuyer: { type: Boolean, default: false },
confirmedAt: { type: Date, default: null },
cancelledAt: { type: Date, default: null },
cancellationReason: { type: String, trim: true, default: '' },

// Fix duplicate fields (bug):
// Remove duplicate discountCode (lines 93-97) and discountAmount (lines 98-102)
```

All new fields are additive and backward-compatible. ✅

---

## New API Endpoints

| Method | Path | Auth | BR |
|---|---|---|---|
| POST | `/api/orders/:id/cancel` | Member | BR-SHP-001 |
| POST | `/api/orders/:id/confirm-delivery` | Member | BR-SHP-003 |
| POST | `/api/returns` | Member | BR-SHP-004 |
| GET | `/api/returns` | Member | BR-SHP-004 |
| GET | `/api/returns/:id` | Member/Seller | BR-SHP-004 |
| POST | `/api/returns/:id/approve` | Seller | BR-SHP-004 |
| POST | `/api/returns/:id/reject` | Seller | BR-SHP-004 |
| GET | `/api/seller/returns` | Seller | BR-SHP-004 |

---

## Risks

| Risk | Mitigation |
|---|---|
| Checkout flow change breaks existing orders | Atomic session wraps reservation + payment. If reservation fails, payment doesn't happen. Existing order structure unchanged. |
| Seller payout delayed (escrow) — UX change | Escrow amount field added to order response so seller can see held funds. Frontend must be informed — field is additive. |
| Stock double-deduction (old delivery code + new reservation code) | `updateSellerOrderStatus` delivery path switches from actual stock decrement to just setting `inventoryDeducted = true`. Old deduction code replaced. |
| Return 7-day window validation | Computed from `GIAO THÀNH CÔNG` status transition date (from `updatedAt` or new `deliveredAt` field). |

## Dependencies

- `walletService.applyWalletTransaction` — already supports `payout`, `refund` types ✅
- `walletService.getOrCreateWallet` — available ✅
- `NOTIFICATION_TYPES` — `PAYMENT_SUCCESS` reused for order notifications ✅
- MongoDB sessions — `createOrder` already uses them ✅
- `Product.weightVariants` — stock field already exists per variant ✅

---

## Implementation Order

1. Fix Order model: add status `ĐÃ HỦY`, escrow fields, delivery confirmation fields, remove duplicate fields
2. Add inventory reservation to `createOrder` (BR-SHP-001)
3. Convert seller payout to escrow tracking in `createOrder` (BR-SHP-003)
4. Modify delivery path in `updateSellerOrderStatus` — skip stock deduction (BR-SHP-001)
5. Add `cancelOrder` function to orderService (BR-SHP-001/003)
6. Add `confirmDelivery` function to orderService (BR-SHP-003)
7. Add cancel + confirm-delivery endpoints to orderController + orderRoutes
8. Create OrderReturn model (BR-SHP-004)
9. Create returnService (BR-SHP-004)
10. Create returnController + returnRoutes (BR-SHP-004)
11. Mount returnRoutes in app.js
12. Run tests, verify regression
