# Flash Re-Audit: Epic 2.6 — Shop Order Lifecycle

**Date:** 2026-07-21  
**Previous Audit:** FLASH_AUDIT_EPIC_2_6.md — PASS (6 findings)  
**Fix Report:** EPIC_2_6_FIX_REPORT.md — All 6 fixed  
**Test Result:** 101/101 passed  

---

## Result

| Verdict | **PASS** |
|---|---|
| **Risk Score** | **1/10 (Very Low)** |
| **Security Score** | **9/10 (Excellent)** |
| **Architecture Score** | **8/10 (Good)** |

**6 findings — 6 RESOLVED (0 remaining).**  
**Epic 2.6 is complete and no remaining findings above LOW severity exist.**

---

## F-1 [Low] — Reservation Strategy Documented

| Check | Result | Evidence |
|---|---|---|
| Comment documents strategy | ✅ | `orderService.js:217-220` — "Atomic inventory reservation using direct stock decrement... The atomic `$gte` guard below prevents negative inventory and concurrent oversell" |
| No overselling | ✅ | `$gte: qty` guard in `findOneAndUpdate` queries (lines 242, 254) |
| No negative inventory | ✅ | `stock: { $gte: quantity }` precondition in atomic update |
| Cancellation restores stock | ✅ | `cancelOrder` lines 490-505: `$inc: { stock: +quantity }` |
| Payment timeout restores stock | ✅ | `session.abortTransaction()` rollback on any failure |

**Verdict: RESOLVED** — Strategy documented. All guarantee mechanisms verified.

---

## F-2 [Medium] — State Transition Guard

| Transition | Via `updateSellerOrderStatus` | Expected | Result |
|---|---|---|---|
| `CHỜ XÁC NHẬN` → `ĐANG GIAO HÀNG` | Allowed | ✅ Valid forward | ✅ ACCEPTED |
| `CHỜ XÁC NHẬN` → `ĐÃ HỦY` | Blocked | ❌ Must use `cancelOrder` | ✅ REJECTED |
| `CHỜ XÁC NHẬN` → `GIAO THÀNH CÔNG` | Blocked | ❌ Skips shipping | ✅ REJECTED |
| `ĐANG GIAO HÀNG` → `GIAO THÀNH CÔNG` | Allowed | ✅ Valid forward | ✅ ACCEPTED |
| `ĐANG GIAO HÀNG` → `CHỜ XÁC NHẬN` | Blocked | ❌ Regresses state | ✅ REJECTED |
| `ĐANG GIAO HÀNG` → `ĐÃ HỦY` | Blocked | ❌ Cannot cancel shipped | ✅ REJECTED |
| `GIAO THÀNH CÔNG` → any | Blocked | ❌ Final state | ✅ REJECTED |
| `ĐÃ HỦY` → any active | Blocked | ❌ Final state | ✅ REJECTED |

### Transition Map

```js
const VALID_TRANSITIONS = {
    'CHỜ XÁC NHẬN': ['ĐANG GIAO HÀNG'],
    'ĐANG GIAO HÀNG': ['GIAO THÀNH CÔNG'],
    'GIAO THÀNH CÔNG': [],
    'ĐÃ HỦY': [],
}
```

Single reusable constant — no duplication of transition logic. `cancelOrder` and `confirmDelivery` paths are independent (they don't use `updateSellerOrderStatus`).

**Verdict: RESOLVED** — Every invalid transition is rejected with a clear error message. Final states are immutable via this path.

---

## F-3 [Low] — Escrow Lifecycle

| Check | Result | Evidence |
|---|---|---|
| Order loaded in `approveReturn` | ✅ | `returnService.js:111` — `Order.findOne({ _id: returnRequest.orderId }).session(session)` |
| Unreleased escrow voided | ✅ | `returnService.js:142-146` — `if (order && !order.escrowReleased)` → `sellerEscrowAmount = 0`, `escrowReleased = true` |
| Atomic with refund transaction | ✅ | Same MongoDB session — void commits only if refund succeeds |
| Escrow released exactly once | ✅ | `escrowReleased` guard prevents double-processing |
| Already-released escrow preserved | ✅ | Condition `!order.escrowReleased` skips void if already paid |

**Verdict: RESOLVED** — No orphaned escrow. Transaction-atomic void.

---

## F-4 [Low] — Return Status Lifecycle

| Check | Result | Evidence |
|---|---|---|
| No dead statuses | ✅ | `OrderReturn.js:61` — `enum: ['requested', 'approved', 'rejected']`, `completed` removed |
| `requested` reachable | ✅ | `returnService.js:73-80` — `OrderReturn.create()` defaults to `requested` |
| `approved` reachable | ✅ | `returnService.js:167` — `approveReturn` sets `status = 'approved'` |
| `rejected` reachable | ✅ | `returnService.js:205` — `rejectReturn` sets `status = 'rejected'` |
| No invalid transitions | ✅ | `approveReturn` requires `status: 'requested'`; `rejectReturn` requires `status: 'requested'` |

**Verdict: RESOLVED** — Clean 3-state lifecycle matching BR-SHP-004.

---

## F-5 [Low] — Notification Events

| Event | Type | Receiver | Location | Correct? |
|---|---|---|---|---|
| Order cancelled | `REFUND_APPROVED` | Buyer | `orderService.js:540` | ✅ Cancel includes wallet refund |
| Delivery confirmed | `PAYMENT_SUCCESS` | Seller | `orderService.js:614` | ✅ Payout notification |
| Delivery confirmed | `PAYMENT_SUCCESS` | Buyer | `orderService.js:626` | ✅ Confirmation notification |
| Return requested | `REFUND_REQUEST` | Seller | `returnService.js:85` | ✅ New return request alert |
| Return approved | `REFUND_APPROVED` | Buyer | `returnService.js:177` | ✅ Refund confirmed |
| Return rejected | `REFUND_REQUEST` | Buyer | `returnService.js:214` | ✅ Rejection alert |

All use existing `NOTIFICATION_TYPES` — no modifications to `Notification.js` or `notificationService.js`.

**Verdict: RESOLVED** — Semantically correct notifications for all 6 events.

---

## F-6 [Low] — Stock Restoration Safety

| Check | Result | Evidence |
|---|---|---|
| Variant updates checked | ✅ | `returnService.js:127-129` — `if (!result) console.warn(...)` |
| Regular product updates checked | ✅ | `returnService.js:136-138` — `if (!result) console.warn(...)` |
| Refund proceeds on missing product | ✅ | No throw — buyer not penalized for data integrity issue |
| Warning provides audit trail | ✅ | Logs product ID, variant weight, and source function |

**Verdict: RESOLVED** — Explicit handling with logged warning. No silent failures.

---

## Regression

| Check | Result | Evidence |
|---|---|---|
| Existing checkout unchanged | ✅ | No changes to `checkoutOrder`, `createOrder` except documentation comment |
| Existing payment unchanged | ✅ | `applyWalletTransaction(type: 'payment')` parameters unchanged |
| Existing wallet unchanged | ✅ | `Wallet.js`, `walletService.js` — zero modifications |
| Existing membership unchanged | ✅ | Zero modifications to membership module |
| Existing notification infrastructure unchanged | ✅ | `Notification.js` — zero modifications. Only existing enum values reused |
| Existing product CRUD unchanged | ✅ | `Product.js`, `productController.js`, `productRoutes.js` — zero modifications |
| Existing APIs unchanged | ✅ | No routes or controllers modified — only service/model internals |
| Existing frontend compatibility | ✅ | No API response format changes. Notification types are client-readable strings |
| Tests pass | ✅ | 101/101 |

---

## Final Assessment

| Dimension | Score | Trend |
|---|---|---|
| Risk | **1/10** (Very Low) | ↓ improved from 2/10 |
| Security | **9/10** (Excellent) | ↑ improved from 8/10 |
| Architecture | **8/10** (Good) | ↑ improved from 7/10 |
| Findings | **6/6 resolved** | ↓ 6 → 0 |

**Epic 2.6 is complete and no remaining findings above LOW severity exist.**
