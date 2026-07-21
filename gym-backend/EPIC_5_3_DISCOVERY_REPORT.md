# EPIC_5_3_DISCOVERY_REPORT.md

**Coverage:** ~65%

## Existing (Complete: 7 files)
`Order.js` (4-state machine, escrow), `OrderReturn.js`, `orderService.js` (646L: checkout, state machine, cancel, escrow calc), `returnService.js` (238L: 7-day window), `orderController.js` (180L), `returnController.js` (109L), `orderRoutes.js` / `returnRoutes.js` / `sellerRoutes.js`.

## Existing (Partial: 3 files)
`ghnService.js` (175L: shipping calc only, no tracking/webhook), `inventoryReservationJob.js` (defined but not registered), `orderController.js` (embedded shipping calc).

## Missing
Cart model/service/controller/routes, order number gen, GHN shipment/tracking/webhook, 4 cron jobs (autoConfirmDelivery, releaseEscrow, returnApprovalTimeout, ghnTrackingPoll), validators, standalone shipping/escrow services, `RETURNED`/`REFUNDED` order states.

## Approach: Option 3 (Patch)

Existing orderService (646L) + returnService (238L) + ghnService (175L) = ~1059 lines of working code. Greenfield would discard this.

## Files to Modify (5)
`Order.js` (+states), `orderService.js` (state machine + order numbers + inventory reservation integration), `ghnService.js` (+shipment/tracking), `orderController.js`, `server.js` (register jobs).

## Files to Create (12)
`Cart.js`, `cartService.js`, `cartController.js`, `cartRoutes.js`, `shippingService.js`, `orderNumberService.js`, `escrowService.js`, `orderValidator.js`, `ghnWebhookHandler.js`, `autoConfirmDeliveryJob.js`, `releaseEscrowJob.js`, `ghnTrackingPollJob.js`.

## Missing Business Rules
BR-SHP-001 (inventory reservation on order — Epic 5.2 integrates here), BR-SHP-003 (escrow hold → release on delivery), BR-SHP-004 (48h return approval window auto-reject).

## Edge Cases to Address
EC-SHP-002 (GHN webhook lost → cron poll), EC-SHP-003 (escrow withdrawn before return — hold available balance), EC-SHP-006 (disabled seller → auto-cancel).
