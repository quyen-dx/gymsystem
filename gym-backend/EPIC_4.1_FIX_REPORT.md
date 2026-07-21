# Epic 4.1 — Fix Report (M-1)

**Date:** 2026-07-21  
**Finding:** FLASH_AUDIT_EPIC_4_1.md M-1  
**Severity:** MEDIUM — PTs cannot view individual workout logs

---

## Fix Applied

| File | Change |
|---|---|
| `src/services/workoutLogService.js:27` | `.populate('workoutId', 'name goal')` → `.populate('workoutId', 'name goal ptId')` |

**Rationale:** `getWorkoutLogById` controller checks `sameId(log.workoutId.ptId, req.user._id)` for PT ownership. Without `ptId` in the populate projection, `log.workoutId.ptId` was always `undefined`, causing 403 for PTs viewing their own members' logs.

No other logic changed.

## Verification

- PT RBAC check in `exerciseController.getWorkoutLogById:186` now receives populated `ptId`
- Member ownership check (`sameId(log.userId._id, req.user._id)`) unaffected — `userId` populate was already correct
- Admin bypass (`isAdmin`) unaffected

## Test Results

```
Test Files  8 passed (8)
     Tests  101 passed (101)
```
