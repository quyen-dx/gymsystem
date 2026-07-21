# Flash Audit: Epic 6.3 — Reports

**Date:** 2026-07-21  
**Scope:** `reportService.js`, `reportController.js`, `reportRoutes.js`

---

**Result:** **PASS** (2 MEDIUM findings)

---

## Risk: LOW
All read-only queries via `.lean()`/`aggregate`/`countDocuments`. No mutation paths. No restricted modules touched.

## Security: PASS
Routes gated by `protect` + `authorize('admin','super_admin')`. No privilege escalation.

## Architecture: PASS
Five independent report functions with `Promise.all` parallelism. CSV reuses same report data (no recomputation). `exportCSV` is a pure formatting helper.

---

## Remaining Findings

### MEDIUM

| ID | Finding | File | Line | Description |
|----|---------|------|------|-------------|
| M-001 | Renewal rate formula incorrect | `reportService.js` | 80 | `renewalRate = active / (active + cancelled)` mixes total active (cumulative) with cancelled (period-specific). Example: 500 active members + 10 cancellations this month → 98% rate, which is meaningless. |
| M-002 | Product report includes refunded orders | `reportService.js` | 150 | `paymentStatus: { $in: ['paid', 'refunded'] }` counts refunded orders as sales, inflating `unitsSold` and `revenue`. Should be `paymentStatus: 'paid'`. |

---

## Verification Results

| Report | Status | Notes |
|--------|--------|-------|
| Revenue | ✅ | Aggregations correct; `$dateToString`, `$unwind` + group all correct |
| Membership | 🔶 M-001 | Renewal rate formula incorrect; other metrics correct |
| Check-in | ✅ | Daily/hourly groupings correct; `$add` for Vietnam TZ; unique member distinct |
| Trainer | ✅ | Booking-to-PT join via `Map` correct; `$addToSet` for unique members |
| Product | 🔶 M-002 | Refunded orders included; low-stock filter correct |

### CSV — PASS
| Check | Status |
|-------|--------|
| CSV uses same report data | ✅ `exportCSV(data.daily)` etc. |
| No recomputation | ✅ |
| Date range consistent | ✅ Same `getDateParams(req)` |
| Content-Type/Disposition | ✅ `text/csv; charset=utf-8`, `attachment` |

### RBAC — PASS
| Check | Status |
|-------|--------|
| Admin-only | ✅ `authorize('admin', 'super_admin')` |
| No privilege escalation | ✅ |

### Regression — PASS
All restricted modules untouched. Only `reportRoutes.js` modified (additive route replacement).
