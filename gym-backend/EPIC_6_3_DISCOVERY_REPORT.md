# Epic 6.3 Discovery: Reports

**Coverage: ~5%** — `reportRoutes.js` has 6 stubs (all 501). Legacy `reportController.js` uses wrong model fields (`status:'PAID'`, `$sum:'$amount'` vs actual `paymentStatus:'paid'`, `totalAmount`). No `reportService.js` or export infrastructure.

## Existing (Reuse)
| Piece | File | Status |
|-------|------|--------|
| Route prefix + 6 endpoint stubs | `reportRoutes.js` | Mounted at `/api/admin/reports`, all return 501 |
| Legacy revenue report (incompatible) | `legacy/controllers/reportController.js` | Uses wrong field names — **not reusable** |
| Dashboard aggregations (Epic 6.2) | `dashboardService.js` | Can inform aggregation patterns |

## Missing (per docs/modules/report.md)
5 report types: revenue, memberships, check-ins, trainers, products. Export to CSV. Report definitions/audit log marked "Future."

## Recommendation: Option 3 (Patch)
Reuse `reportRoutes.js` and `/api/admin/reports` prefix. Replace 501 stubs with real implementations. Requires: `reportService.js` (aggregation queries per report type), `reportController.js`, rewriting `reportRoutes.js` to import controller. Add `authorize('admin','super_admin')` to protect routes (currently `protect` only — no role gate).

**Files to create:** `reportService.js`, `reportController.js`  
**Files to modify:** `reportRoutes.js`
