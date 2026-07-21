# Epic 2.6 — Shop Module Discovery Report

**Date:** 2026-07-21  
**Module:** Shop (BR-SHP)  
**Objective:** Determine what exists vs. what needs implementation  

---

## 1. Business Rules Reference

| Rule | Description | Type |
|---|---|---|
| **BR-SHP-001** | Inventory reservation on order creation, release on timeout/cancel | Workflow |
| **BR-SHP-002** | Platform fee: 2% of product price | Calculation |
| **BR-SHP-003** | Escrow holds payment until delivery confirmation | Workflow |
| **BR-SHP-004** | Return window: 7 days from delivery | Constraint/Workflow |

Reference: `docs/BUSINESS_RULES.md:705–799`

---

## 2. Existing Coverage Summary

| Feature | Coverage | Assessment |
|---|---|---|
| Product CRUD (create/read/update/delete) | **90%** | Full CRUD + image upload + reviews. Categories are free-text only. |
| Shop CRUD | **95%** | Full CRUD + reviews + admin tools. |
| Order placement (checkout) | **60%** | Wallet payment flow works. Multi-shop order splitting. GHN shipping integration. |
| Order status management | **50%** | 3 statuses (CHỜ XÁC NHẬN → ĐANG GIAO HÀNG → GIAO THÀNH CÔNG). Seller sets status. No transition validation. |
| Platform fee (2%) | **100%** | Calculated at checkout, configurable via `PLATFORM_FEE_RATE` env var. Applied to seller payout. |
| Seller payout | **50%** | Immediate payout (not escrowed). Sent to seller wallet on order placement. |
| Product reviews | **95%** | Embedded reviews on Product + Shop models. API endpoints for both. |
| Shipping integration | **70%** | GHN API integration. Multi-shop shipping calculation. Mock/fallback for dev. |

| Feature | Coverage | Assessment |
|---|---|---|
| Inventory reservation at checkout | **0%** | Stock NOT held at order time. Deduction only at delivery. No overselling protection. |
| Inventory release on cancel/timeout | **0%** | No cancellation flow exists. No reservation release logic. |
| Order cancellation | **0%** | No cancel endpoint. No buyer cancel. No seller cancel. No timeout auto-cancel. |
| Escrow / payment holding | **0%** | Funds paid to seller immediately. No holding during delivery/return window. |
| Buyer delivery confirmation | **0%** | Delivery status set exclusively by seller. No buyer confirmation. |
| Return request | **0%** | No return model, API, or logic. Membership refunds exist but are separate. |
| Return window (7 days) | **0%** | No time-based validation. |
| Return refund processing | **0%** | No refund-to-wallet for shop orders. Transaction type `refund` exists but unused for orders. |
| Dispute handling | **0%** | No dispute model, API, or workflow. |
| Cart | **0%** | Feature flag exists (`shop.cartEnabled`) but no Cart model. |
| Order tracking (buyer-facing) | **40%** | Shipping record exists with GHN data. `GET /api/orders/track/:id` returns shipping info. No event history. |
| Return stock restoration | **0%** | No path to restore inventory on return. |

**Overall Shop Module Coverage: ~42%**

---

## 3. Existing Models

| Model | File | Status | BR-SHP Relevance |
|---|---|---|---|
| `Shop` | `src/models/Shop.js` | ✅ Full | BR-SHP-003 (shop metadata) |
| `Product` | `src/models/Product.js` | ✅ Full | BR-SHP-001 (product data, stock field, weightVariants with stock) |
| `Order` | `src/models/Order.js` | ⚠️ Partial | BR-SHP-001 (basic order + shipping address + items + paymentStatus). Missing: cancel fields, return fields, confirmedBy buyer |
| `Shipping` | `src/models/Shipping.js` | ✅ Full | BR-SHP-001 (GHN tracking, estimatedDelivery) |
| `Transaction` | `src/models/Transaction.js` | ✅ Full | BR-SHP-003 (types: payout, refund. Used for seller payouts.) |
| `Wallet` | `src/models/Wallet.js` | ✅ Full | BR-SHP-003 (heldBalance field ready for escrow, unused by orders) |
| `DiscountCode` | `src/models/DiscountCode.js` | ✅ Full | BR-SHP-001 (order/shipping discount validation) |
| `Address` | `src/models/Address.js` | ✅ Full | BR-SHP-001 (shipping address used at checkout) |

### Missing Models

| Model | Needed For |
|---|---|
| `OrderReturn` | BR-SHP-004: return requests, tracking, approval |
| `Cart` | BR-SHP-001: holding items before checkout (feature flagged but unbacked) |
| `Category` (dedicated) | Improved product organization (today: free-text string) |

---

## 4. Existing Services

| Service | File | Lines | Functions | BR-SHP Relevance |
|---|---|---|---|---|
| `orderService` | `src/services/orderService.js` | 452 | `buildShippingAddress`, `getShopAddressForItems`, `calculateOrderShipping`, `calculateCheckoutDiscount`, `createOrder`, `getOrderById`, `getOrdersByUser`, `hideOrderForUser`, `getOrdersBySeller`, `getSellerOrderById`, `getShippingByOrder`, `updateSellerOrderStatus`, `deductInventoryOnDelivery` | **Core**. Checkout, shipping, status updates, inventory deduction, seller payout. |
| `productService` | `src/services/productService.js` | 54 | `getRecommendedProducts`, `buildSearchRegex` | Minimal. Recommendation only. CRUD is in controller. |
| `walletService` | `src/services/walletService.js` | 627 | `holdBalance`, `releaseBalance`, `applyWalletTransaction`, `transferWalletBalance`, etc. | **Available but unused by orders**. Hold/release ready for escrow. |
| `ghnService` | `src/services/ghnService.js` | - | GHN shipping API | Shipping calculation. |

### Missing Services

| Service | Needed For |
|---|---|
| `returnService` | BR-SHP-004: create return, approve/reject, process refund, restore stock |
| `escrowService` | BR-SHP-003: hold buyer payment, release to seller on delivery, auto-release after window |
| `inventoryService` (or patching `orderService`) | BR-SHP-001: reserve stock at checkout, release on cancel/timeout |

---

## 5. Existing Controllers & Routes

### Product (10 endpoints)
| Method | Path | Public? |
|---|---|---|
| GET | `/api/products` | Yes* |
| GET | `/api/products/:id` | Yes* |
| GET | `/api/products/categories` | Yes* |
| GET | `/api/products/admin/all` | Admin |
| GET | `/api/products/my-products` | Seller |
| POST | `/api/products` | Seller |
| PUT | `/api/products/:id` | Seller |
| DELETE | `/api/products/:id` | Seller |
| POST | `/api/products/upload` | Seller |
| POST | `/api/products/:id/reviews` | Member |

\*Gated behind `shop.productStoreEnabled` feature flag.

### Order (9 endpoints)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders/checkout` | Place order, wallet payment |
| POST | `/api/orders/calculate-shipping` | Estimate shipping |
| POST | `/api/orders/validate-discount` | Validate discount code |
| GET | `/api/orders/my` | User's orders |
| GET | `/api/orders/:id` | Single order |
| DELETE | `/api/orders/my/:id` | Hide order (soft-delete) |
| GET | `/api/orders/seller` | Seller: list shop orders |
| PATCH | `/api/orders/seller/:id/status` | Seller: update status |
| GET | `/api/orders/track/:id` | Shipping tracking |

### Shop (7 endpoints)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/shops` | Public |
| GET | `/api/shops/:id` | Public |
| GET | `/api/shops/me` | Seller |
| PUT | `/api/shops/me` | Seller |
| GET | `/api/shops/admin/all` | Admin |
| POST | `/api/shops/:id/reviews` | Member |
| DELETE | `/api/shops/:id` | Admin |

### Seller (3 endpoints — duplicates of order routes)
Duplicate of the 3 seller order endpoints above, mounted at `/api/seller/orders/*`.

### Missing Endpoints

| Method | Path | Needed For |
|---|---|---|
| POST | `/api/orders/:id/cancel` | BR-SHP-001: buyer/seller cancel |
| POST | `/api/returns` | BR-SHP-004: initiate return |
| GET | `/api/returns` | BR-SHP-004: list user's returns |
| GET | `/api/returns/:id` | BR-SHP-004: return detail |
| POST | `/api/returns/:id/approve` | BR-SHP-004: seller approve |
| POST | `/api/returns/:id/reject` | BR-SHP-004: seller reject |
| GET | `/api/seller/returns` | BR-SHP-004: seller's pending returns |
| GET | `/api/seller/payouts` | BR-SHP-002: seller payout history |
| POST | `/api/orders/:id/confirm-delivery` | BR-SHP-003: buyer delivery confirmation |

---

## 6. BR-SHP Compliance Gaps

### BR-SHP-001: Inventory Reservation

| Aspect | Status | Detail |
|---|---|---|
| `createOrder` checks stock before order | ❌ 0% | No stock validation at checkout. Items added without checking availability. |
| Stock reserved at checkout | ❌ 0% | Product stock decremented only at delivery, not at order time. |
| Concurrent overselling protection | ❌ 0% | No atomic `$gte` guard on stock deduction. |
| Release reservation on cancel | ❌ 0% | No cancellation → no release. |
| Auto-release on 30-min timeout | ❌ 0% | No order expiry timer. |
| Inventory deducted on delivery | ✅ 100% | `updateSellerOrderStatus` → `GIAO THÀNH CÔNG` triggers stock decrement. `inventoryDeducted` field tracks dedup. |

**Gap:** Most operational. Order → delivery gap has no stock protection.

### BR-SHP-002: Platform Fee

| Aspect | Status | Detail |
|---|---|---|
| 2% fee calculated per item | ✅ 100% | `PLATFORM_FEE_RATE = 0.02`. `payoutAmount = payoutBase * (1 - rate)`. |
| Fee displayed on invoice | ⚠️ Partial | Fee deducted from payout but not line-itemed on order response. |
| Configurable rate | ✅ 100% | `process.env.PLATFORM_FEE_RATE`. |
| Floor rounding | ⚠️ Inconsistent | Uses `Math.max(0, ...)` instead of `FLOOR()`. Acceptable. |

**Gap:** Minimal. Fee calculation is correct. Display could be improved.

### BR-SHP-003: Escrow

| Aspect | Status | Detail |
|---|---|---|
| Funds held on payment | ❌ 0% | Seller paid immediately (`applyWalletTransaction` with type `payout`). |
| Funds released on delivery | ❌ 0% | No escrow. No delivery-based release. |
| Auto-release 7 days after delivery | ❌ 0% | No timer. |
| Dispute holds funds | ❌ 0% | No dispute mechanism. |
| walletService holdBalance/releaseBalance | ✅ Available | Infrastructure exists, unused by orders. |
| Wallet.heldBalance field | ✅ Available | Schema supports escrow. |

**Gap:** Architecture gap. Payout model is immediate, not escrowed.

### BR-SHP-004: Returns

| Aspect | Status | Detail |
|---|---|---|
| Return request creation | ❌ 0% | No endpoint. |
| 7-day window validation | ❌ 0% | No date check. |
| Return reason / photos | ❌ 0% | No model schema. |
| Seller approval within 48h | ❌ 0% | No workflow. |
| Refund to wallet on approval | ❌ 0% | Transaction type `refund` exists but not wired. |
| Stock restoration on return | ❌ 0% | No inventory restore path. |
| Return status lifecycle | ❌ 0% | No status enum. |

**Gap:** Entire return subsystem missing.

---

## 7. Existing Infrastructure Already Available

| Infrastructure | Ready? | Detail |
|---|---|---|
| Wallet `heldBalance` field | ✅ | On Wallet model. Supports escrow pattern. |
| `holdBalance()` / `releaseBalance()` | ✅ | On walletService. Atomic with `$gte` guard. Session-aware. |
| `applyWalletTransaction()` | ✅ | On walletService. Supports type `payout`, `refund`. Session-aware. Idempotent. |
| Transaction session support | ✅ | All wallet functions accept `session`. |
| MongoDB transactions | ✅ | Used in `createOrder` and `updateSellerOrderStatus`. |
| GHN shipping integration | ✅ | Live shipping rates, tracking. |
| Notification system | ✅ | `NOTIFICATION_TYPES` exists with `PAYMENT_SUCCESS`, `ORDER_STATUS_CHANGE`. |
| Feature flags | ✅ | `shop.*` toggles in system settings. |
| Cloudinary image upload | ✅ | Product images already use it. |
| Discount code engine | ✅ | DiscountCode model + validation service. |
| Policy consent | ✅ | `assertPolicyConsent` utility available. |

---

## 8. Recommendation

### **Option 3 — Patch existing services** ✅ Recommended

The shop module has significant existing infrastructure (~42% coverage) with production code for products, orders, shipping, and seller payouts. Rebuilding would break working functionality and violate the "do NOT rewrite working code" constraint.

**Rationale:**

1. **Products, shops, and reviews are already complete** — zero modifications needed.
2. **Order flow needs patching, not redesign** — `orderService.createOrder` is solid. Add stock validation + reservation + timeout.
3. **Wallet hold/release already exists** — wire `holdBalance` into checkout for escrow; release on delivery/return window expiry.
4. **Returns are missing entirely** — needs new model + service, but no existing code to modify.
5. **All supporting infrastructure exists** — transactions, sessions, notifications, feature flags.

**Why NOT Option 1 (missing only):** Sounds good on paper but "missing only" implies standalone pieces. Inventory reservation, escrow, and returns are intertwined — they all touch the order flow. Patching the existing order service is necessary to connect them.

**Why NOT Option 2 (full rebuild):** 42% exists in production. Rebuilding would break working checkout, shipping, and product management.

### Implementation Scope (Option 3)

| Phase | What | Files |
|---|---|---|
| **Patch orderService** | Stock validation + atomic reservation at checkout (BR-SHP-001) | `orderService.js` |
| **Patch orderService** | Order cancellation with stock release (BR-SHP-001) | `orderService.js` |
| **New: returnService** | Return request, approval, rejection, refund, stock restore (BR-SHP-004) | `returnService.js` (new) |
| **New: OrderReturn model** | Return request records (BR-SHP-004) | `OrderReturn.js` (new) |
| **New: returnController / returnRoutes** | Return API endpoints (BR-SHP-004) | `returnController.js`, `returnRoutes.js` |
| **Patch orderService** | Escrow: hold buyer payment until delivery (BR-SHP-003) | `orderService.js` |
| **Patch orderService** | Escrow: auto-release after return window (BR-SHP-003) | `orderService.js` |
| **Patch orderController** | Cancel order endpoint (BR-SHP-001) | `orderController.js` |
| **Patch orderController** | Buyer delivery confirmation (BR-SHP-003) | `orderController.js` |
| **Patch orderRoutes** | New routes (cancel, confirm-delivery) | `orderRoutes.js` |
| **Patch app.js** | Mount returnRoutes | `app.js` |

### Do NOT Modify

- `src/models/Product.js` — stock field usage but no schema changes (stock is via `$inc`, field already exists)
- `src/models/Shop.js` — complete
- `src/controllers/shopController.js` — complete
- `src/controllers/productController.js` — complete
- `src/services/productService.js` — complete
- `src/services/ghnService.js` — complete
- `src/models/Shipping.js` — complete
- `Payment`, `Membership`, `Notification`, `Refund`, `Authentication` — unchanged

### Files Summary

| Action | Count | Files |
|---|---|---|
| **New files** | 3 | `OrderReturn.js`, `returnService.js`, `returnController.js`, `returnRoutes.js` |
| **Modified files** | 4 | `orderService.js`, `orderController.js`, `orderRoutes.js`, `app.js` |
| **Untouched** | 15+ | Product, Shop, Shipping, Wallet, GHN, Payment, Membership, Notification, Refund, Auth, etc. |

### Expected BR-SHP Coverage After Epic 2.6

| Rule | Before | After |
|---|---|---|
| BR-SHP-001 (Inventory reservation) | 30% | **85%** (reservation + release on cancel/timeout) |
| BR-SHP-002 (Platform fee) | 90% | **95%** (add fee line item to order response) |
| BR-SHP-003 (Escrow) | 0% | **80%** (hold at checkout + release on delivery + auto-release) |
| BR-SHP-004 (Returns) | 0% | **75%** (return request + approval + refund + stock restore) |

**Post-implementation overall module coverage: ~80%** (up from ~42%)

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Existing checkout is production-critical | HIGH | Change MUST be backward-compatible. Stock validation is additive. |
| Wallet hold pattern change may affect withdrawals | LOW | `holdBalance` is already used by withdrawals. Separate idempotency keys. |
| GHN shipping rate changes when stock is reserved | LOW | Shipping calculated before reservation — unaffected. |
| Missing auto-release cron job | MEDIUM | Can be implemented later (BR-SHP-003 mentions 7-day auto-release but no cron infra). Manual release first. |

---

## 10. Next Steps

1. **Approve Option 3** (patch existing services) ✅
2. Proceed to implementation plan (detailed design and task breakdown)
3. Implement, test, audit

