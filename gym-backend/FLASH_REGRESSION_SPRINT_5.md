# Flash Regression Audit: Sprint 5 (Commerce)

**Scope:** Epics 5.1 (Product Catalog), 5.2 (Inventory), 5.3 (Shop/Orders), 5.4 (Seller System)
**Tests:** 101/101 pass

---

**PASS** — No HIGH or MEDIUM cross-epic regressions.

---

## Cross-Epic Verification

| Check | Status | Notes |
|-------|--------|-------|
| **Order lifecycle** | ✅ | Status enum consistent across Order.js, orderService.js, VALID_TRANSITIONS; CANCELLABLE_STATUSES = `['CHỜ XÁC NHẬN']` |
| **Inventory** | ✅ | `inventoryReleaseJob.js` (5.3, registered 10min) supersedes `inventoryReservationJob.js` (5.2, not registered). Stock expiry + restoration complete. Low-stock alerts unregistered but LOW. |
| **Escrow** | ✅ | `settleStaleEscrow` extended with platform fee (2%) + SellerPayout record in same transaction. hold/release/recapture untouched. |
| **Seller payout** | ✅ | Unique index `{orderId:1}` on SellerPayout prevents duplicates. Payout created atomically in escrow release transaction. |
| **Cart → Order** | ✅ | `convertCartToOrderItems` output fields match `createOrder` input fields exactly. |
| **RBAC** | ✅ | `protect` + `sellerOnly` on all seller routes. Product ownership middleware intact. |
| **Validation** | ✅ | Zod schemas in productValidator.js (5.1) and orderValidator.js (5.3) cover all new endpoints. |
| **API compatibility** | ✅ | All 11 original product endpoints preserved. Checkout flow unchanged. New endpoints are additive. |
| **Cron interactions** | ✅ | 9 cron jobs registered in server.js — no duplicate processing, no conflicting schedules. |
| **Webhook** | ✅ | GHN webhook handler (5.3) processes delivery status updates independently of cron polling. |

## Detailed Cron Analysis

| Cron | Registered | Purpose | Epic |
|------|-----------|---------|------|
| `inventoryReleaseJob` | `*/10 * * * *` | Restore stock for expired reservations + call expireStaleReservations | 5.3 |
| `shipmentTrackingJob` | `*/30 * * * *` | Poll GHN for tracking updates (webhook fallback) | 5.3 |
| `escrowSettlementJob` | `0 */6 * * *` | Auto-confirm delivery (14d) + release escrow (7d) | 5.3 |
| `returnApprovalTimeoutJob` | `0 * * * *` | Auto-reject returns after 48h seller timeout | 5.4 |
| `inventoryReservationJob` | _(not registered)_ | Superseded by `inventoryReleaseJob`. Low-stock alert gap is LOW. | 5.2 |

## Inventory Job Interaction

`inventoryReleaseJob.js` (registered, 10min):
1. Restore stock for `{status:'expired', inventoryRestored:{$ne:true}}` reservations
2. Call `expireStaleReservations()` → marks `{status:'reserved', expiresAt:{$lt:now}}` → `status:'expired'`

No race conditions: getReservedQuantity filters on `status:'reserved'` + `expiresAt:{$gt:now}`, so expired reservations are excluded before stock restoration completes.

## Regression Modules

| Module | Status |
|--------|--------|
| Order | ✅ Unchanged from Epic 5.3 |
| Return | ✅ Unchanged from Epic 5.3 |
| Product/ProductVariant | ✅ Unchanged from Epic 5.1 |
| InventoryReservation | ✅ Unchanged from Epic 5.3 |
| GHN Service | ✅ Unchanged from Epic 5.3 |
| Wallet | ✅ Not modified |
| Payment | ✅ Not modified |
| Membership/PT/Workout/Nutrition/Health/Audit/Auth | ✅ Not modified |
