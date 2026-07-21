# Flash Audit — Epic 4.1 (Exercise Library)

**Date:** 2026-07-21  
**Scope:** Exercise model, WorkoutLog model, 2 services, 1 controller, 1 route, 1 validator, app.js binding  
**Test Status:** 101/101 passed

---

## RESULT: **FAIL**

## Risk: **LOW**

## Security: **PASS** — RBAC unchanged, no privilege escalation

## Architecture: **PASS** — Clean separation, no backfill, no circular imports

---

## MEDIUM Findings

### M-1: `getWorkoutLogById` PT permission check is broken

- **File:** `src/controllers/exerciseController.js:186`
- **Code:** `.populate('workoutId', 'name goal')` in `workoutLogService.getLogById` (workoutLogService.js:27) omits `ptId` from the projection.
- **Impact:** `sameId(log.workoutId.ptId, req.user._id)` at exerciseController.js:186 always evaluates `undefined === userId` → `false`. PTs can **list** logs via `GET /api/exercises/logs` (PT scoping works) but **cannot view** individual logs via `GET /api/exercises/logs/:id` — they get a 403 even for logs belonging to workouts they created.
- **Fix:** Change `.populate('workoutId', 'name goal')` → `.populate('workoutId', 'name goal ptId')` in `workoutLogService.js:27`.
