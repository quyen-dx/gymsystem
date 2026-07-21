# Flash Audit: Epic 2.6 — Shop Order Lifecycle

**Date:** 2026-07-21  
**Scope:** BR-SHP-001, BR-SHP-002, BR-SHP-003, BR-SHP-004  
**Files Audited:** 10 implementation files | **Referenced:** BUSINESS_RULES.md, DATABASE.md, API_STANDARDS.md

---

## Result

| Verdict | **PASS** |
|---|---|
| **Risk Score** | **2/10 (Low)** |
| **Security Score** | **8/10 (Good)** |
| **Architecture Score** | **7/10 (Good)** |

6 findings (2 Medium, 4 Low). No critical or high-severity issues.

---

## BR-SHP-001: Inventory Reservation

| Check | Result | Notes |
|---|---|---|
| Inventory reserved at checkout | ✅ | Atomic `findOneAndUpdate` with `$gte` guard inside session |
| Duplicate checkout | ⚠️ | No idempotency key enforcement (pre-existing, not an Epic 2.6 finding) |
| Concurrent checkout | ✅ | `$gte` guard + snapshot isolation prevents oversell |
| Insufficient inventory | ✅ | `findOneAndUpdate` returns null → error thrown |
| Negative inventory prevention | ✅ | `$gte: qty` guard in query |
| Reservation release on cancellation | ✅ | `$inc` stock restoration in `cancelOrder` |
| Reservation release on payment timeout | ✅ | `session.abortTransaction()` rolls back on failure |
| Reservation release on failed payment | ✅ | Transaction rollback catches all errors |

### Finding F-1 [Low] — No reserved stock bucket

BR-SHP-001 specifies separate `qty_available` / `qty_reserved` fields. The implementation decrements `stock` directly (`Product.stock`, `weightVariants.$.stock`). On cancel/return, stock is incremented back.

| Location | `src/services/orderService.js:210-251`, `Product.js` schema |
|---|---|
| **Impact** | Functionally equivalent but lacks visibility into reserved vs. sold inventory. Cannot distinguish "reserved for unpaid order" from "actually sold." |
| **Fix** | Either accept functional equivalence (existing schema has no reserved field) or add `reserved` counter to `Product` + `weightVariantSchema`. |

---

## BR-SHP-002: Order Lifecycle

| Check | Result | Notes |
|---|---|---|
| Valid status transitions | ❌ | See F-2 below |
| Invalid transitions rejected | ❌ | See F-2 below |
| Cancellation rules enforced | ✅ | `CANCELLABLE_STATUSES = ['CHỜ XÁC NHẬN']` in `cancelOrder` |
| Shipped orders cannot be cancelled | ✅ | `cancelOrder` rejects non-`CHỜ XÁC NHẬN` |
| Completed orders immutable | ❌ | See F-2 below — `updateSellerOrderStatus` has no transition guard |

### Finding F-2 [Medium] — No status transition validation

`updateSellerOrderStatus` (`orderService.js:397-453`) accepts any valid status string without enforcing business-logic transitions. The only check is `ORDER_STATUSES.includes(status)` — it does not validate that the **source** status permits the **target** status.

**Illegal transitions permitted:**
| Transition | Risk |
|---|---|
| `ĐÃ HỦY` → any active status | Reactivates cancelled orders (data integrity) |
| `GIAO THÀNH CÔNG` → `ĐANG GIAO HÀNG` / `CHỜ XÁC NHẬN` | Regresses delivery state |
| `CHỜ XÁC NHẬN` → `ĐÃ HỦY` directly | Bypasses `cancelOrder` (no refund/stock release) |

| Location | `src/services/orderService.js:416-420` |
|---|---|
| **Impact** | Data integrity — order statuses can be arbitrarily overwritten by seller. No direct financial exploit since wallet operations are separate, but undermines audit trail. |
| **Fix** | Add a transition map: `{ 'CHỜ XÁC NHẬN': ['ĐANG GIAO HÀNG'], 'ĐANG GIAO HÀNG': ['GIAO THÀNH CÔNG'], 'GIAO THÀNH CÔNG': [] }`. Reject disallowed transitions. |

---

## BR-SHP-003: Escrow

| Check | Result | Notes |
|---|---|---|
| Seller not paid before delivery confirmation | ✅ | `sellerEscrowAmount` set, no payout in `createOrder` |
| Escrow released exactly once | ✅ | `confirmedByBuyer: false` guard in query |
| Duplicate delivery confirmation | ✅ | Second call returns 404 (no matching doc) |
| Concurrent confirmation | ✅ | Session snapshot isolation prevents double-payout |
| Cancellation correctly handles escrow | ✅ | Checks `!order.escrowReleased`, refunds `totalAmount` |
| Payout race conditions | ✅ | Wrapped in session with atomic commit |

No findings for BR-SHP-003.

---

## BR-SHP-004: Return Workflow

| Check | Result | Notes |
|---|---|---|
| Return request lifecycle | ✅ | `requested` → `approved` / `rejected` |
| Duplicate return requests | ✅ | Rejects if non-rejected return exists for same `(orderId, userId)` |
| Return after 7-day expiry | ✅ | `daysSinceDelivery > RETURN_WINDOW_DAYS` → error |
| Inventory restoration on approve | ✅ | `$inc: { stock: +quantity }` for variant and regular |
| Escrow handling after return | ❌ | See F-3 below |
| Invalid state transitions | ❌ | See F-4 below |
| Stock restoration verifies match | ❌ | See F-6 below |

### Finding F-3 [Low] — Return doesn't handle unreleased escrow

When a return is **approved** without delivery confirmation (buyer returned before confirming delivery), `approveReturn` refunds the buyer and restores stock, but does **not** touch the order's `sellerEscrowAmount`. The escrow remains `escrowReleased = false` on the order indefinitely — an orphaned escrow record.

Additionally, `approveReturn` does not load the associated Order document at all.

| Location | `src/services/returnService.js:83-152` |
|---|---|
| **Impact** | Orphaned data. `sellerEscrowAmount` appears as pending/owed but will never be paid. |
| **Fix** | In `approveReturn`, load the order. If `!order.escrowReleased`, void the escrow: `sellerEscrowAmount = 0`. |

### Finding F-4 [Low] — `completed` return status unreachable

The `OrderReturn` model defines `status: ['requested', 'approved', 'rejected', 'completed']`. No code path ever sets `status = 'completed'`. After approval, returns remain in `approved` forever.

| Location | `src/models/OrderReturn.js:61` |
|---|---|
| **Impact** | Dead enum value. No lifecycle completion. |
| **Fix** | Either remove `'completed'` from the enum or implement a transition: e.g., auto-set `completed` when refunded stock is verified. |

### Finding F-5 [Low] — Incorrect notification types

In `cancelOrder` (`orderService.js:521-530`), the notification uses `NOTIFICATION_TYPES.PAYMENT_SUCCESS` for a cancellation. This semantically incorrect type could cause the frontend to render a green success icon for a cancellation event.

`confirmDelivery` sends **no notification** to either the buyer or seller.

Return endpoints (`requestReturn`, `approveReturn`, `rejectReturn`) send **no notifications**.

| Location | `src/services/orderService.js:521-530` |
|---|---|
| **Impact** | UX — incorrect/missing notifications. |
| **Fix** | Introduce a dedicated cancellation notification type. Add notifications for delivery confirmation and return lifecycle events. |

### Finding F-6 [Low] — Stock restoration result unchecked

In `approveReturn` (`returnService.js:97-118`), `Product.findOneAndUpdate` and `Product.findByIdAndUpdate` results are not checked. If the product was hard-deleted or the variant label no longer exists, stock restoration silently fails while the refund still proceeds.

| Location | `src/services/returnService.js:97-118` |
|---|---|
| **Impact** | Lost inventory tracking only in edge case (product removed from DB between order and return approval). |
| **Fix** | Check return value and log a warning or throw if product not found. |

---

## Regression

| Check | Result | Evidence |
|---|---|---|
| Existing checkout unchanged | ✅ | `checkoutOrder` signature preserved. All pre-existing validation, grouping, shipping, discount logic untouched. |
| Existing payment flow unchanged | ✅ | `applyWalletTransaction(type: 'payment')` called identically. Buyer wallet deduction unchanged. |
| Existing wallet unchanged | ✅ | `Wallet.js` / `walletService.js` — zero modifications. |
| Existing notification unchanged | ✅ | `createNotification` pattern preserved. Existing notification routes unchanged. |
| Existing product CRUD unchanged | ✅ | `productController.js`, `productRoutes.js`, `productService.js`, `Product.js` — zero modifications. |
| Existing APIs backward compatible | ✅ | All existing route paths preserved. New routes are new paths. New Order fields are additive. |
| Existing frontend compatibility | ✅ | No fields removed. Duplicate `discountCode`/`discountAmount` fix preserves one copy of each with identical field name. Response format unchanged. |
| Tests pass | ✅ | 101/101 |
| No forbidden module modified | ✅ | Payment, Membership, Notification, Refund, Auth — zero changes. |

---

## Summary of Findings

| ID | Severity | Rule | Description | Fix |
|---|---|---|---|---|
| F-1 | **Low** | BR-SHP-001 | No reserved stock bucket — `stock` decremented directly instead of `qty_available`/`qty_reserved` split | Accept or add `reserved` field to Product |
| F-2 | **Medium** | BR-SHP-002 | No status transition validation — `updateSellerOrderStatus` accepts any valid status regardless of current state | Define & enforce transition map |
| F-3 | **Low** | BR-SHP-004 | Return approval orphans unreleased escrow — `sellerEscrowAmount` left dangling if buyer returned before confirming delivery | Void escrow in `approveReturn` |
| F-4 | **Low** | BR-SHP-004 | `completed` return status unreachable — dead enum value never set by any code path | Remove or implement `completed` transition |
| F-5 | **Low** | BR-SHP-001/003 | Incorrect notification types — `PAYMENT_SUCCESS` used for cancellation; missing notifications for delivery confirmation and returns | Add dedicated notification types |
| F-6 | **Low** | BR-SHP-004 | Stock restoration result unchecked — product deletion causes silent restore failure in `approveReturn` | Check update result and warn/throw |

---

## Risk Assessment

| Category | Score | Rationale |
|---|---|---|
| **Business Risk** | 1/5 | No financial exploits found. F-2 is the most impactful (data integrity) but requires seller auth. |
| **Security Risk** | 1/5 | No auth bypass, no injection, no wallet manipulation. All findings require authenticated access. |
| **Data Integrity** | 2/5 | F-2 allows status corruption. F-3/F-6 create orphaned data in edge cases. |
| **Regression Risk** | 1/5 | Fully backward compatible. Test suite passes 101/101. |
| **Overall Risk** | **2/10** | Low risk. Acceptable for MVP. Recommend fixing F-2 before production deployment. |
