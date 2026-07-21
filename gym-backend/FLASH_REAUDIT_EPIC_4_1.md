# Flash Re-Audit — Epic 4.1 (M-1 Fix)

**Date:** 2026-07-21  
**Scope:** `workoutLogService.js` — `getLogById` populate projection  
**Test Status:** 101/101 passed

---

## RESULT: **PASS**

## Remaining Findings: **NONE**

---

## M-1 Verification

| Check | Status |
|---|---|
| `getLogById` (line 27): `'name goal ptId'` | ✅ |
| `getLogs` (line 76): `'name goal ptId'` | ✅ |
| PT ownership check `sameId(log.workoutId.ptId, req.user._id)` now receives populated `ptId` | ✅ |
| No information leakage — `ptId` is a public User ObjectId already exposed via workout API | ✅ |
| Backward compatible — `name` and `goal` still present | ✅ |
| Regression — 101/101 tests pass | ✅ |
