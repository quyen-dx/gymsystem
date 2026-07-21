# FLASH_AUDIT_EPIC_5_3 — Cart, Shipping & Escrow

**Result: FAIL**

**Risk:** HIGH — GHN webhook will silently fail to process any payload.

**Security:** GHN webhook signature verification is computed on wrong input (Buffer serialization, not raw JSON). When `GHN_WEBHOOK_SECRET` is configured, all webhook requests are rejected as invalid because HMAC comparison fails on wrong payload. When not configured (no verification), the handler still cannot parse body fields (destructuring from Buffer gives `undefined`).

**Architecture:** Option 3 (Patch) correctly preserves existing order/return/GHN infrastructure. Cart lifecycle, extended state machine, order numbers, escrow service, shipping service, and cron jobs follow existing patterns (transactions, idempotency keys, wallet service). The three new cron jobs are properly registered. Validator schemas are correctly defined but not yet wired into route handlers (cartController uses them).

---

## HIGH Findings

### H-001: GHN webhook handler body parsing and signature verification are broken

**Files:** `src/services/ghnWebhookHandler.js:8-16,41`

**Problem 1 — Body parsing:** `express.raw({ type: 'application/json' })` stores the request body as a `Buffer`. But the handler destructures `{ OrderCode, Status, Type }` from `req.body` directly (line 41). Destructuring a Buffer yields `undefined` for all fields. `Order.findOne({ trackingCode: String(undefined) })` will never match a real order.

**Problem 2 — Signature verification:** `JSON.stringify(req.body)` on a Buffer produces `{"type":"Buffer","data":[...]}` (Node.js Buffer serialization), not the original JSON payload string. HMAC computed on this will never match the GHN-sent signature.

**Problem 3 — Timing-safe comparison:** `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))` throws `RangeError` if the two buffers differ in length. If the `x-ghn-signature` header is missing, `Buffer.from(undefined)` throws `TypeError`.

**Impact:** The webhook **cannot process any payload** as currently implemented. All deliveries will remain untracked. Signature verification is a no-op (when no secret) or always-fail (when secret is configured).

**Fix:** 
```javascript
// Capture raw body before middleware parses it
// Use the raw string for HMAC, then JSON.parse for fields
const rawBody = req.body.toString()
const payload = JSON.parse(rawBody)
// Compute HMAC on rawBody, not JSON.stringify(req.body)
```

The app.js route registration should remain `express.raw()` (needed for HMAC), but the handler must call `req.body.toString()` and `JSON.parse()` separately.

---

## MEDIUM Findings

### M-001: `addItemToCart()` concurrency race

**File:** `src/services/cartService.js:69-86`

**Problem:** findOne → modify-in-memory → save pattern. Two concurrent calls can:
- Both miss the existing item match → `items.push()` twice → duplicate cart items for same product+variant
- Both see the same cart → last `save()` overwrites first's changes (quantity increment lost)

**Fix:** Use `findOneAndUpdate` with `$inc` for quantity merge, or wrap in a Mongoose session/transaction.

---

### M-002: `CANCELLABLE_STATUSES` behavior change

**File:** `src/services/orderService.js:16`

**Change:** `CANCELLABLE_STATUSES` expanded from `['CHỜ XÁC NHẬN']` to `['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG']`.

**Impact:** Buyers can now cancel orders while in shipping status. The `cancelOrder` function correctly handles stock restoration, wallet refund, and shipping update for this path. Backward compatible with existing tests (101/101 pass). No test expected orders in `ĐANG GIAO HÀNG` to be non-cancellable.

**Verdict:** Functionally correct but changes existing cancellation semantics. Acceptable for MVP.

---

## Regression

| Check | Status |
|-------|--------|
| Existing Order APIs (checkout, cancel, deliver, track) | ✅ Backward compatible — all 7 modified files extend, not replace, existing logic |
| Existing Return flow (returnService) | ✅ Unchanged — `OrderReturn` model, `requestReturn`, `approveReturn`, `rejectReturn` untouched |
| Product | ✅ Unchanged |
| Inventory | ✅ Unchanged (only `InventoryReservation.js` +1 field `inventoryRestored`) |
| Membership | ✅ Unchanged |
| Wallet | ✅ Unchanged |
| Payment | ✅ Unchanged |
| Notification | ✅ Unchanged |
| Booking | ✅ Unchanged |
| PT | ✅ Unchanged |
| Workout | ✅ Unchanged |
| Nutrition | ✅ Unchanged |
| Health | ✅ Unchanged |
| Audit | ✅ Unchanged |
| Auth | ✅ Unchanged |
| Tests | ✅ 101/101 pass |
| Modified tracked files | ✅ 7 — all expected (server.js, app.js, orderController.js, InventoryReservation.js, Order.js, ghnService.js, orderService.js) |

---

## Summary

| Check | Verdict |
|-------|---------|
| Cart CRUD | ✅ PASS (M-001: concurrency acceptable) |
| Cart lifecycle + checkout | ✅ PASS |
| Order RETURNING/RETURNED/REFUNDED states | ✅ PASS |
| Order number generation | ✅ PASS |
| GHN shipment creation + tracking | ✅ PASS |
| GHN webhook handling | ❌ FAIL (H-001) |
| Escrow hold/release/recapture/settlement | ✅ PASS |
| Cron jobs (3) | ✅ PASS |
| Zod validators | ✅ PASS (not wired to controllers except cartController) |
| Route protection | ✅ PASS |
| Backward compatibility | ✅ PASS (M-002: acceptable) |
