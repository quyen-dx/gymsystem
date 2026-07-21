# FLASH_REAUDIT_EPIC_5_2 — Inventory Management

**Result: PASS**

**Risk:** None remaining. All prior HIGH/MEDIUM findings closed.

**Security:** No auth bypass, data exposure, or injection risk.

**Architecture:** Minimal single-file changes. Existing patterns (session, atomic upsert, Node.js `fs`) reused.

---

## H-001: Over-reservation — ✅ FIXED

`inventoryService.js:49-51` — `reserve()` now computes `physicalStock - reservedQty` (via `getReservedQuantity()`) before the availability gate. If stock=10 and 8 are already reserved, a request for 8 fails because `8 > (10-8=2)`. The `getReservedQuantity` aggregation filters on `status: 'reserved' AND expiresAt > now`, so expired-but-not-yet-cleanup reservations are excluded.

BR-SHP-001 `"IF available < item.quantity THEN REJECT"` is now satisfied.

## M-001: In-memory debounce — ✅ FIXED

`inventoryService.js:176-193` — `checkLowStock()` now persists last-alerted timestamps to `src/data/low_stock_alerts.json` via `readAlertState()`/`writeAlertState()`. Items alerted within the past hour are filtered before return. The file is created with recursive `mkdirSync` and handles corruption gracefully (falls back to `{}`). Survives application restarts.

The job file's residual in-memory `Map` is now a harmless no-op.

## M-002: Non-atomic duplicate check — ✅ FIXED

`inventoryService.js:53-73` — `reserve()` now uses a single `findOneAndUpdate({ userId, productId, variantId, status: 'reserved' }, { $setOnInsert: {...} }, { upsert: true, new: true })` within a Mongoose session. Two concurrent calls for the same user+product+variant cannot produce duplicates — the atomic upsert matches on the compound filter and returns the existing document on conflict.

## Regression

| Check | Status |
|-------|--------|
| Product | ✅ Unchanged |
| ProductVariant | ✅ Unchanged |
| Order | ✅ Unchanged |
| Notification compatibility | ✅ Unchanged (still `NOTIFICATION_TYPES.OTHER`) |
| Tests | ✅ 101/101 pass |
| Tracked files modified | ✅ Zero (`git status --short` shows only untracked epic files) |

## Summary

| Finding | Status |
|---------|--------|
| H-001: Over-reservation | ✅ FIXED |
| M-001: In-memory debounce | ✅ FIXED |
| M-002: Non-atomic reserve | ✅ FIXED |
| Regression | ✅ CLEAN |
