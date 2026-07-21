# EPIC_5_2_DISCOVERY_REPORT

## Coverage: ~25%

**What exists:** Embedded `stock` on Product + ProductVariant; `reserved` field on ProductVariant (unused); `inventoryDeducted` flag on Order; atomic `$gte` guard + `$inc` deduction inline in `orderService.js:221-261` with transaction support.

**What's missing:**

| Component | Status |
|-----------|--------|
| Inventory model | None — stock/reserved embedded in Product/ProductVariant |
| inventoryService | None — atomic logic inline in orderService |
| Reservation TTL | None — no cart-level reserve or 30-min expiry |
| inventoryReleaseCron | None |
| Low-stock alerts | None |
| EC-SHP-001 (oversell) | Enforced at checkout only, no cart-level guard |

## Files to Create (3)

- `src/models/Inventory.js` — per-product/variant stock + reserved tracking
- `src/services/inventoryService.js` — atomic `reserve`/`release`/`deduct` operations, low-stock queries
- `src/jobs/inventoryReleaseCron.js` — TTL-based reservation expiry (30-min window)

## Files to Modify (0)

Epic 5.3 (Shop/Orders) will integrate orderService + cart with inventoryService. For 5.2, the service is standalone.

## Approach: Option 1 (Greenfield)

No existing inventory service to patch. Self-contained module with Product/ProductVariant references. Atomic operations use `findOneAndUpdate` with `$gte` guard (same pattern as existing orderService). Cron job uses `reservedExpiresAt` TTL field.
