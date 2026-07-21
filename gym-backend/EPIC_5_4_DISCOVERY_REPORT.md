# Epic 5.4 Discovery: Seller System

**Coverage: ~60%** — Foundational pieces exist (Seller role, Shop, Product CRUD, Order state machine, Escrow, Return model, 3 seller order endpoints, escrowSettlementJob). Missing seller dashboard + payout records.

## Existing (Reuse)
| Piece | File |
|-------|------|
| Seller role + isSeller + shopId | `User.js:90,93,114` |
| Shop CRUD | `shopController.js`, `Shop.js` |
| Product CRUD + ownership guard | `productService.js`, `productOwnershipMiddleware.js` |
| Variant CRUD | `ProductVariant.js`, `productService.js` |
| Order state machine + escrow fields | `Order.js:146-162` (`sellerEscrowAmount`, `escrowReleased`, `confirmedByBuyer`) |
| Escrow hold/release/recapture/settle | `escrowService.js` (100 lines) |
| Return model (requested/approved/rejected) | `OrderReturn.js` |
| Seller order list/get/status | `sellerRoutes.js` (3 endpoints) |
| GHN shipping + tracking | `ghnService.js`, `shippingService.js` |
| escrowSettlementJob cron | `jobs/escrowSettlementJob.js` (runs every 6h) |

## Missing
| Gap | Action |
|-----|--------|
| Wallet `escrowBalance` field | Modify `Wallet.js` |
| Escrow wallet helpers | Modify `walletService.js` |
| Platform fee calc (BR-SHP-002) | Add to `escrowService.js` |
| Payout records | Create `SellerPayout.js` |
| Seller dashboard (revenue/stats/payouts) | Create `sellerService.js` + `sellerController.js`; extend `sellerRoutes.js` |
| 48h return approval timeout cron | Create `returnApprovalTimeoutJob.js` |
| `ShopSetting.js` (platform fee rate, escrow duration) | Create (optional, can use env) |

## Recommendation: **Option 3 (Patch)** — Preserve existing order/escrow/return infrastructure. Add wallet escrow field, seller dashboard service/controller/routes, payout model, and return timeout cron.
