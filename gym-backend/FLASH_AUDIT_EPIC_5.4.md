# Flash Audit: Epic 5.4 — Seller Dashboard & Payout

**Date:** 2026-07-21
**Scope:** SellerPayout model, escrowService, sellerService, sellerController, sellerRoutes, returnApprovalTimeoutJob, server.js

---

**Result:** **PASS** (1 MEDIUM finding)

---

## Risk: LOW
- No data corruption paths. Only restricted modules are read-only. All new code is additive.

## Security: PASS
- All seller dashboard routes protected by `protect` + `sellerOnly` middleware (`sellerRoutes.js:8`).
- Payout access scoped to `sellerId = req.user._id`.
- No role escalation paths.

## Architecture: PASS
- Option 3 patch: existing escrow/return/order infrastructure preserved.
- `holdEscrow`, `releaseEscrow`, `recaptureEscrow` unchanged.
- `settleStaleEscrow` extended with platform fee calc + payout recording (same transaction).
- Unique index `{ orderId: 1 }` on `SellerPayout` prevents duplicate payouts.
- Cron job idempotent via `escrowReleased` guard + `status: 'requested'` filter.

---

## Remaining Findings

### MEDIUM

| ID | Finding | File | Line | Description |
|----|---------|------|------|-------------|
| M-001 | Return timeout TOCTOU | `returnApprovalTimeoutJob.js` | 21 | `find()` then `save()` without atomic status check. If seller concurrently approves the return, the cron's `save()` overwrites status to `rejected`. Should use `findOneAndUpdate({_id, status:'requested'}, ...)` with filter. |

---

## Regression — PASS

| Module | Status | Notes |
|--------|--------|-------|
| Escrow | ✅ | Only `settleStaleEscrow` extended; hold/release/recapture untouched |
| Order | ✅ | Not modified |
| Return | ✅ | Backward compatible; OrderReturn model unchanged |
| Product | ✅ | Not modified |
| Inventory | ✅ | Not modified |
| Wallet | ✅ | Not modified |
| Payment | ✅ | Not modified |
| Notification | ✅ | Not modified |
| Membership/PT/Workout/Nutrition/Health/Audit/Auth | ✅ | Not modified |

## Tests — PASS
101/101 pass
