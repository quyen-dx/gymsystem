# EPIC_5.2_FIX_REPORT.md

**File modified:** `src/services/inventoryService.js`
**Tests:** 101/101 pass

## H-001: Over-reservation — FIXED

**Change:** `reserve()` now subtracts active reserved quantity from physical stock before the availability check.

```javascript
const reservedQty = await getReservedQuantity(productId, variantId || null)
if (quantity > physicalStock - reservedQty) return null
```

`getReservedQuantity` aggregates only non-expired `status: 'reserved'` records (`expiresAt: { $gt: new Date() }`), so expired-but-not-yet-marked reservations are already excluded.

## M-001: In-memory debounce — FIXED

**Change:** `checkLowStock()` now persists last-alerted timestamps to `src/data/low_stock_alerts.json`. Items alerted within the past hour are filtered before return. The JSON file is created in `src/data/` (auto-created if missing), survives restarts, and is resilient to corruption (falls back to `{}`).

Job file **not modified** — its in-memory `Map` becomes a harmless no-op since `checkLowStock()` already filters.

## M-002: Non-atomic duplicate check — FIXED

**Change:** Replaced the `findOne` → `create` pair with a single `findOneAndUpdate` + `upsert: true` + `$setOnInsert` on the filter `{ userId, productId, variantId, status: 'reserved' }`.

If a `reserved` record already exists for that user+product+variant, the existing document is returned. If a previous reservation was `released`/`deducted`/`expired`, a fresh one is created. Uses a Mongoose session for session-scoped atomicity.

## Regression

| Module | Status |
|--------|--------|
| Product | Unchanged |
| ProductVariant | Unchanged |
| Order | Unchanged |
| Membership | Unchanged |
| Wallet | Unchanged |
| Payment | Unchanged |
| Notification | Unchanged |
| Booking | Unchanged |
| PT | Unchanged |
| Workout | Unchanged |
| Nutrition | Unchanged |
| Health | Unchanged |
| Audit | Unchanged |
| Auth | Unchanged |
