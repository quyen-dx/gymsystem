# IMPLEMENTATION_REPORT_EPIC_5_3

**Approach:** Option 3 (Patch). Extended existing Order/return/GHN infrastructure (~1059 lines preserved).

## Test Results
**101/101 pass** — no regression.

## Files Created (12)

| File | Purpose |
|------|---------|
| `models/Cart.js` | Server-side cart: userId (unique), items[productId, variantId, quantity, price, weight, sellerId] |
| `services/cartService.js` | getCart (with _available/_inactive flags), addItemToCart ($push or increment), updateCartItemQuantity, removeCartItem, clearCart, convertCartToOrderItems |
| `controllers/cartController.js` | 6 handlers: GET /, POST /items, PUT /items/:id, DELETE /items/:id, DELETE /, POST /checkout |
| `routes/cartRoutes.js` | /api/cart — all protected |
| `services/shippingService.js` | calculateShipping, requestShipment (GHN), getTrackingInfo (local + GHN API) |
| `services/escrowService.js` | holdEscrow, releaseEscrow, recaptureEscrow, settleStaleEscrow (cron-driven) |
| `services/orderNumberService.js` | generateOrderNumber → GYM-YYYYMMDD-NNNN via atomic Counter.findOneAndUpdate |
| `services/ghnWebhookHandler.js` | HMAC-SHA256 signature verification, status mapping: picking→SHIPPING, delivered→DELIVERED, canceled→CANCELLED |
| `validators/orderValidator.js` | Zod schemas: cartItem, checkout (items/cartId), orderStatus, cancelOrder, returnRequest, shippingCalc |
| `jobs/inventoryReleaseJob.js` | Restores stock for expired reservations (handles weightVariants + plain stock), runs every 10 min |
| `jobs/shipmentTrackingJob.js` | Polls GHN API every 30 min for in-transit orders (EC-SHP-002), auto-confirms delivery |
| `jobs/escrowSettlementJob.js` | Auto-confirms delivery after 14 days + releases escrow after 7 days post-confirmation (BR-SHP-003) |

## Files Modified (7)

| File | Changes |
|------|---------|
| `models/Order.js` | +orderNumber (unique sparse), +trackingCode, +returnedAt, status enum extended: +ĐANG HOÀN TRẢ, +ĐÃ HOÀN TRẢ, +ĐÃ HOÀN TIỀN |
| `services/orderService.js` | ORDER_STATUSES extended, VALID_TRANSITIONS extended (GIAO THÀNH CÔNG→ĐANG HOÀN TRẢ→ĐÃ HOÀN TRẢ→ĐÃ HOÀN TIỀN), CANCELLABLE_STATUSES now includes ĐANG GIAO HÀNG, orderNumber generated on create via orderNumberService |
| `services/ghnService.js` | +createShipmentGHN (POST /shipping-order/create), +getTrackingInfoGHN (POST /shipping-order/detail), +GHN_REQUIRED_ENV, +GHN_SERVICE_TYPE_ID exports |
| `controllers/orderController.js` | +imports for cartService, shippingService → supports checkout-from-cart path |
| `src/app.js` | +cartRoutes mounted at /api/cart, +GHN webhook at /api/shipping/ghn/webhook (raw body) |
| `server.js` | +inventoryReleaseJob (10min), +shipmentTrackingJob (30min), +escrowSettlementJob (6h) via node-cron |
| `models/InventoryReservation.js` | +inventoryRestored boolean (default false) — tracks whether stock was restored after expiry |

## Business Rules Implemented

| Rule | Implementation |
|------|---------------|
| BR-SHP-001 | Stock deduction atomicity preserved (existing $gte guard in orderService), reservation integration via inventoryReleaseJob |
| BR-SHP-002 | Platform fee 2% preserved (existing PLATFORM_FEE_RATE) |
| BR-SHP-003 | Escrow hold at order creation, release on delivery confirmation or auto-settle after 7 days via escrowSettlementJob |
| BR-SHP-004 | Return 7-day window preserved (existing returnService), new order states track return/refund pipeline |
| EC-SHP-002 | GHN webhook + shipmentTrackingJob polling fallback (30 min) |
| EC-SHP-003 | Escrow recaptured via escrowService.recaptureEscrow if return approved |
| EC-SHP-007 | Server-side cart with quantity merge prevents concurrent tab overwrites |

## Backward Compatibility

- Existing checkout flow (POST /api/orders/checkout with items[]) unchanged
- cancelOrder, confirmDelivery, updateSellerOrderStatus unchanged
- returnService (requestReturn/approveReturn/rejectReturn) unchanged
- New order statuses are additive (old statuses still valid)
- New orderNumber field is optional (sparse) — existing orders remain valid
- 101/101 tests pass
