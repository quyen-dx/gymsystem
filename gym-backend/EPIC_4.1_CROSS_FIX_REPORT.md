# EPIC_4.1_CROSS_FIX_REPORT

**Finding:** M-1 — PT `workoutId` query filter silently overwritten.

**File:** `src/controllers/exerciseController.js:164`

**Root cause:** `filters.workoutIds = allVisibleWorkouts` ran unconditionally after the PT validation block. When a PT supplied `workoutId=xxx`, the `auxWorkoutIds` property was set regardless and later overwrote the explicit `workoutId` in the service, silently broadening results to all visible workout logs.

**Fix:** Moved `filters.workoutIds = allVisibleWorkouts` into the conditional branches:

| PT scoping branch           | Behavior |
|-----------------------------|----------|
| `userId` specified          | Validates PT assigned to member; applies `workoutIds` scope (same as before) |
| `workoutId` specified       | Validates visibility; **preserves** explicit `workoutId` filter — no `workoutIds` applied |
| Neither specified           | Applies `workoutIds = allVisibleWorkouts` to scope to all visible logs |
| Member (non‑PT, non‑admin)  | Own logs only — unchanged |
| Admin / super_admin         | Unrestricted — unchanged |

**Tests:** 101/101 pass.

**Diff:**
```diff
-        } else if (filters.workoutId) {
-          ...
-        }
-
-        filters.workoutIds = allVisibleWorkouts
+          filters.workoutIds = allVisibleWorkouts
+        } else if (filters.workoutId) {
+          ...
+        } else {
+          filters.workoutIds = allVisibleWorkouts
+        }
```
