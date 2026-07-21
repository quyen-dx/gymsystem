# Flash Re-Audit: Epic 5.3 (Cart, Checkout, Orders, GHN Shipping, Return/Refund)

**Date:** 2026-07-21  
**Auditor:** AI  
**Scope:** Fixes for H-001, M-001, M-002  

---

## H-001: GHN webhook body parsing + signature — PASS

| Check | Status | Evidence |
|-------|--------|----------|
| Raw Buffer converted to UTF-8 string before parsing | ✅ | `req.body.toString('utf-8')` → `rawBody.string` (`ghnWebhookHandler.js:48`) |
| HMAC computed from original raw request body | ✅ | `crypto.createHmac('sha256', secret).update(rawBody.string)` (`ghnWebhookHandler.js:16`) |
| Signature validated before `JSON.parse()` | ✅ | `verifySignature(rawBody)` at line 57; `JSON.parse` at line 65 |
| `timingSafeEqual` protected against length mismatch | ✅ | `sigBuf.length !== expBuf.length` guard at line 21 |
| Missing/invalid signatures rejected safely | ✅ | Empty header → returns false; try/catch wraps all crypto → returns false on error |
| Valid webhooks processed correctly | ✅ | Parses OrderCode/Status → finds by trackingCode → updates order + Shipping, returns 200 |

## M-001: Cart concurrency — PASS

| Check | Status | Evidence |
|-------|--------|----------|
| `addItemToCart()` uses atomic operations | ✅ | `findOneAndUpdate` replaces old `findOne`→modify→`save` pattern |
| Existing item uses `$inc` | ✅ | `$inc: { 'items.$.quantity': quantity }` (`cartService.js:68`) |
| New item insertion via `$push` is atomic | ✅ | `$push` + `upsert: true` in separate `findOneAndUpdate` (`cartService.js:82-99`) |
| Quantity merge preserved | ✅ | Existing items: `$inc` adds quantity; new items: `$push` with full object |

## M-002: Cancellation semantics — PASS

| Check | Status | Evidence |
|-------|--------|----------|
| `CANCELLABLE_STATUSES` matches original (`CHỜ XÁC NHẬN` only) | ✅ | `orderService.js:16` — `['CHỜ XÁC NHẬN']` |
| Buyers cannot cancel in-shipment orders | ✅ | `ĐANG GIAO HÀNG` not in `CANCELLABLE_STATUSES` |
| State machine valid | ✅ | `VALID_TRANSITIONS` unchanged; `CHỜ XÁC NHẬN`→`ĐANG GIAO HÀNG`→`GIAO THÀNH CÔNG`→... |

## Regression — PASS

| Module | Status | Notes |
|--------|--------|-------|
| Cart | ✅ | Only `addItemToCart` changed; `getCart`, `updateCartItemQuantity`, `removeCartItem`, `clearCart`, `convertCartToOrderItems` untouched |
| Order | ✅ | Only `CANCELLABLE_STATUSES` line changed; all state machine, escrow, shipping logic untouched |
| GHN | ✅ | `ghnService.js` untouched in fix round; `ghnWebhookHandler.js` rewritten but functional contract preserved |
| Escrow | ✅ | `escrowService.js` untouched |
| Tests | ✅ | 101/101 pass |

---

**Result: PASS — No remaining HIGH or MEDIUM findings.**
