# Epic 4.1 — Discovery Report

**Date:** 2026-07-21  
**Epic:** Workout Plans (templates, exercise library, custom workouts, progress logs)  
**Source:** IMPLEMENTATION_SEQUENCE.md, 05_SPRINT_4.md §§1-10

---

## Current Coverage: ~45%

| Feature | Status | Details |
|---|---|---|
| Workout plan model + CRUD | ✅ Full | `Workout.js` (277 lines) + `workoutController.js` (891 lines) with embedded exercises, weeks, sessions, template mode, completion tracking, assignment, feedback |
| Exercise library | ❌ Missing | No standalone `Exercise` model — exercises are embedded subdocs inside `Workout`. No searchable library by muscle group, equipment, difficulty |
| Workout logs | ❌ Missing | No standalone `workout_logs` — completion tracked inline on embedded exercises (no actualSets, actualReps, weight, RPE fields) |
| Service layer | ❌ Missing | All logic lives in controller (891-line monolith) |
| Health logging | ✅ Partial | `HealthLog.js` + `healthController.js` covers measurements, BMI, weight history, body fat — overlaps with Epic 4.3 |

## Missing Business Rules

No new BR-xxx rules defined for workout. Existing cross-module constraints (BR-PT-001 for assignment, BR-MEM-008 for trials) already enforced. Application-level state machine (`draft → active → completed`) is partially implemented via `Workout.status` enum.

## Files to Create (8)

| File | Reason |
|---|---|
| `models/Exercise.js` | Standalone exercise library: muscleGroup[], equipment[], difficulty, mediaUrls, isActive |
| `models/WorkoutLog.js` | Standalone log: userId, exerciseId, planId, date, actualSets, actualReps, weight, rpe, notes |
| `services/workoutService.js` | Extract plan/exercise business logic from controller |
| `services/exerciseService.js` | Exercise library CRUD + search |
| `controllers/exerciseController.js` | Exercise endpoints: CRUD, search by muscle/equipment/difficulty |
| `routes/exerciseRoutes.js` | Mount exercise endpoints |
| `routes/index.js` (modify) | Register new exercise routes |
| `validators/workout.validator.js` | Input validation for exercise + workout log |

## Files to Modify (1)

| File | Change |
|---|---|
| `src/routes/index.js` | Add `exerciseRoutes` and any new workout log routes |

## Recommendation: Option 3 (Patch)

Existing `Workout.js` covers 90% of plan functionality. Add standalone Exercise library and WorkoutLog as new models; extract service layer without removing embedded exercise data. No schema teardown required.
