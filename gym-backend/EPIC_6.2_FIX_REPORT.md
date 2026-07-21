# EPIC_6.2_FIX_REPORT

**Tests:** 101/101 pass

## M-001: PT assignedMembers counts unique members — FIXED

`dashboardService.js:96` — replaced `Booking.countDocuments()` with `Booking.distinct('memberId', ...)`.

- `Booking.distinct('memberId', { ptId: userId, status: 'confirmed' })` returns array of unique member ObjectIds
- `assignedMembersArr.length` gives the count of unique assigned members
- `Booking.distinct` is MongoDB's built-in efficient distinct operation (no full scan needed)

## Files Modified

| File | Change |
|------|--------|
| `src/services/dashboardService.js` | Replaced `Booking.countDocuments` → `Booking.distinct('memberId', ...)` for PT assigned count |

## Regression

| Module | Status |
|--------|--------|
| All restricted modules | Unchanged |
| All other dashboard metrics | Unchanged |
| Tests | 101/101 pass |
