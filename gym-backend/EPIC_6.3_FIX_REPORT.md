# EPIC_6.3_FIX_REPORT

**Tests:** 101/101 pass

## M-001: Renewal rate uses period-consistent values — FIXED

`reportService.js:80` — both numerator and denominator now use the same date range.

- **Before:** `Math.round((active / (active + cancelled)) * 100)` — `active` was total cumulative, `cancelled` was period-specific. Mixed scopes produced meaningless results.
- **After:** `Math.round((newSignups / (newSignups + cancelled)) * 100)` — `newSignups` and `cancelled` are both scoped to the report period. Ratio represents the percentage of membership activity that was new signups vs cancellations.

## M-002: Product report excludes refunded orders — FIXED

`reportService.js:150` — filter narrowed to completed sales only.

- **Before:** `paymentStatus: { $in: ['paid', 'refunded'] }` — refunded orders inflated unitsSold, revenue, and sales ranking.
- **After:** `paymentStatus: 'paid'` — only completed successful sales contribute to product metrics.

## Files Modified

| File | Change |
|------|--------|
| `src/services/reportService.js` | M-001: renewal rate formula; M-002: product report payment filter |

## Regression

| Module | Status |
|--------|--------|
| All restricted modules | Unchanged |
| Tests | 101/101 pass |
