# FLASH_REAUDIT_EPIC_4.1_CROSS

**File:** `src/controllers/exerciseController.js:154-165`

| Check | Status |
|---|---|
| Explicit `workoutId` preserved when specified alone | ✅ Lines 159-162: validated, NOT overwritten by `workoutIds` |
| `allVisibleWorkouts` applied only when `workoutId` absent | ✅ Applied in `userId` branch (line 158) or `else` branch (line 164); skipped in `workoutId` branch |
| PT visibility restrictions enforced | ✅ `userId` → 403 if unassigned; `workoutId` → 403 if not visible; neither → scoped to `allVisibleWorkouts` |
| No regression (tests) | ✅ 101/101 pass |

**Verdict: PASS**
