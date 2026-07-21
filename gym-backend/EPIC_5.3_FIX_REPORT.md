# EPIC_5.3_FIX_REPORT

**Tests:** 101/101 pass

## H-001: GHN webhook body parsing + signature — FIXED

`ghnWebhookHandler.js` rewritten.

- `req.body.toString('utf-8')` converts raw Buffer to UTF-8 string
- HMAC computed on `rawBody.string` (the original raw JSON)
- `JSON.parse(rawBody.string)` extracts `OrderCode` and `Status`
- `timingSafeEqual` guarded by length check; entire block wrapped in try/catch
- Missing header returns `false`; no secret returns `true` (no verification)
- Invalid JSON returns 400; missing `OrderCode` returns 400

## M-001: Cart concurrency — FIXED

`addItemToCart()` in `cartService.js` replaced read-then-write with atomic operations:

1. `findOneAndUpdate` with `$inc` on matching `{ userId, 'items.productId', 'items.variantId' }` — atomically increments quantity if item exists
2. If no match (returns null), `findOneAndUpdate` with `$push` + `upsert: true` — atomically creates cart or adds new item

No more `findOne` → modify → `save` gap. Both paths use atomic MongoDB operations.

## M-002: Cancellation semantics — FIXED

`orderService.js:16` — `CANCELLABLE_STATUSES` restored to `['CHỜ XÁC NHẬN']`. Buyers can no longer cancel in-shipment orders. Matches original semantics.

## Regression

| Module | Status |
|--------|--------|
| All 14 restricted modules | Unchanged |
| Modified tracked files | 7 (unchanged from Epic 5.3 implementation) |
| Tests | 101/101 pass |
