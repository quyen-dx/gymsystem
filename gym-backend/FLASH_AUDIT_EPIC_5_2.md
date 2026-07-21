# FLASH_AUDIT_EPIC_5_2 — Inventory Management

**Result: FAIL**

**Risk:** HIGH — Over-reservation vulnerability directly violates BR-SHP-001 stock check.

**Security:** No auth bypass, no data exposure, no injection risk. Reservation lifecycle operates within existing RBAC.

**Architecture:** Greenfield approach is correct. Model, indexes, service structure, and job pattern align with codebase conventions. No modifications to existing modules.

---

## HIGH Findings

### H-001: `reserve()` allows over-reservation (BR-SHP-001 violation)

**File:** `src/services/inventoryService.js:17-21`

**Problem:** `reserve()` checks only `product.stock` (or `ProductVariant.stock`) against requested quantity, **ignoring already-reserved quantities**.

```
stock = Product.findById(productId).select('stock').lean()  // e.g. returns 10
// User A reserves 8 → stock unaffected, reservation created in separate collection
// User B requests 8 → stock (10) > 8 → passes, even though only 2 are truly available
```

**Fix:** Subtract existing active reservations before the availability check:

```javascript
const reservedQty = await getReservedQuantity(productId, variantId)
if (quantity > (availableStock - reservedQty)) return null
```

**Severity:** HIGH — systematic over-reservation; all users can simultaneously reserve more than physical stock. On deduct, there is no stock to deduct.

---

## MEDIUM Findings

### M-001: Low-stock debounce is in-memory, lost on restart

**File:** `src/jobs/inventoryReservationJob.js:7`

**Problem:** `lastLowStockAlert` is a module-scoped `Map`. Process restart clears it, causing all low-stock products to re-trigger alerts. Acceptable for MVP but not production-grade.

**Fix:** Persist last-alert timestamps per product (e.g., add `lastLowStockAlertedAt` field to Product/ProductVariant or use a dedicated collection).

---

### M-002: `reserve()` duplicate check is not atomic

**File:** `src/services/inventoryService.js:23-30`

**Problem:** `findOne` then `create` without a transaction or atomic upsert (`findOneAndUpdate` with upsert + conditions). Two concurrent calls for the same (userId, productId, variantId) can both pass the check and insert duplicates. Self-heals via TTL expiry but wastes DB writes.

**Fix:** Use `findOneAndUpdate` with `upsert` + conditional filter on `status: 'reserved'`, or wrap in a Mongoose session/transaction.

---

## Regression Verification

| Module | Status | Evidence |
|--------|--------|----------|
| Product stock logic | ✅ Unchanged | `git diff` empty; no edits to `Product.js` |
| Order flow | ✅ Unchanged | No edits to `orderService.js`, `Order.js` |
| ProductVariant | ✅ Unchanged | No edits to `ProductVariant.js` |
| Membership | ✅ Unchanged | No edits to `Membership.js` or membership services |
| Wallet | ✅ Unchanged | No edits to `Wallet.js` or wallet services |
| Payment | ✅ Unchanged | No edits to payment models/services |
| Notification | ✅ Unchanged | Uses `NOTIFICATION_TYPES.OTHER` (existing); no edits to `Notification.js` |
| Booking | ✅ Unchanged | No edits |
| PT | ✅ Unchanged | No edits |
| Workout | ✅ Unchanged | No edits |
| Nutrition | ✅ Unchanged | No edits |
| Health | ✅ Unchanged | No edits |
| Audit | ✅ Unchanged | No edits |
| Auth | ✅ Unchanged | No edits |

**Test results:** 101/101 pass — no regression.

---

## Summary

| Check | Verdict |
|-------|---------|
| Model correctness | ✅ PASS |
| Reference integrity | ✅ PASS |
| Reservation lifecycle | ❌ FAIL (H-001: over-reservation) |
| TTL expiration | ✅ PASS |
| Orphan cleanup | ✅ PASS |
| Low-stock alerts | ✅ PASS (M-001: in-memory debounce is acceptable for MVP) |
| Notification compatibility | ✅ PASS |
| Regression (all 14 modules) | ✅ PASS |
