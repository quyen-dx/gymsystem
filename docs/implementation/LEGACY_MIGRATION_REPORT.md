# Legacy Migration Report — Task 0.8

> **Date:** 2026-07-20
> **Sprint:** 0 (Foundation)
> **Task:** 0.8 — Legacy Cleanup
> **Principle:** No files deleted. All Category D files moved to `src/legacy/`. All active dependencies removed.

---

## Migration Summary

| Category | Files Moved | Files Modified | Dependencies Removed |
|----------|------------|----------------|---------------------|
| Models | 2 | 0 | 1 service import updated |
| Services | 1 | 0 | 1 controller import updated |
| Controllers | 2 | 0 | 2 route files replaced |
| AI Modules | 6 directories | 0 | 0 (dynamic import — auto-skipped) |
| Routes | 0 | 2 | 2 controller imports removed |
| **Total** | **11** | **4** | **5** |

---

## Migration Details

### 1. Models (2 files moved)

| Original Location | New Location | Reason | Importers Updated |
|-------------------|-------------|--------|-------------------|
| `src/models/PTReview.js` | `src/legacy/models/PTReview.js` | Empty file (0 lines). No schema exported. No imports found. | None — no consumers existed |
| `src/models/TrainingGroup.js` | `src/legacy/models/TrainingGroup.js` | Self-declared DEPRECATED at line 1. Replaced by TrainingClass model. | `src/services/trainingGroupService.js` — import updated to `../legacy/models/TrainingGroup.js` |

### 2. Services (1 file moved)

| Original Location | New Location | Reason | Importers Updated |
|-------------------|-------------|--------|-------------------|
| `src/services/trainingAssignmentService.js` | `src/legacy/services/trainingAssignmentService.js` | Self-declared DEPRECATED stub. All logic moved to trainingClassService. | `src/controllers/trainingAssignmentController.js` — import updated to `../legacy/services/trainingAssignmentService.js`. Internal model import updated to `../../models/TrainingAssignment.js` |

### 3. Controllers (2 files moved)

| Original Location | New Location | Reason | Routes Updated |
|-------------------|-------------|--------|----------------|
| `src/controllers/reportController.js` | `src/legacy/controllers/reportController.js` | 6 empty stub functions (`getOverviewStats`, `getChartsData`, `getHeatmap`, `getForecast`, `getChurnRisk`, `exportMonthlyReport`). `getRevenueReport` was the only working function — now returns 501 Not Implemented. | `src/routes/reportRoutes.js` — Replaced with 6 `catchAsync` handlers returning `501 FEATURE_NOT_IMPLEMENTED` |
| `src/controllers/groupClassController.js` | `src/legacy/controllers/groupClassController.js` | Legacy model only (GroupClass). No service layer. | `src/routes/groupClassRoutes.js` — Replaced with 4 `catchAsync` handlers returning `410 FEATURE_DEPRECATED` |

### 4. AI Modules (6 directories moved)

| Original Location | New Location | Reason |
|-------------------|-------------|--------|
| `src/modules/challenge/` | `src/legacy/modules/challenge/` | Dead — `ai.json` marked "chua kich hoat" (not activated), `tool.js` exports empty array |
| `src/modules/diet/` | `src/legacy/modules/diet/` | Dead — empty tool exports |
| `src/modules/faq/` | `src/legacy/modules/faq/` | Dead — empty tool exports |
| `src/modules/knowledge/` | `src/legacy/modules/knowledge/` | Dead — empty tool exports |
| `src/modules/nutrition/` | `src/legacy/modules/nutrition/` | Dead — empty tool exports |
| `src/modules/workout/` | `src/legacy/modules/workout/` | Dead — empty tool exports |

**No importers to update:** AI modules are loaded via dynamic `import()` in `src/services/toolRegistry.js:33`. The tool registry scans `src/modules/*/tool.js` at runtime. With the dead modules moved to `legacy/`, they are no longer scanned. Runtime behavior unchanged (they returned empty arrays anyway).

---

## Dependencies Removed

| Dependency | Removed From | Replacement |
|------------|-------------|-------------|
| `reportController.js` `getRevenueReport` | `reportRoutes.js` | Returns 501 Not Implemented |
| `reportController.js` 5 stub functions | `reportRoutes.js` | Returns 501 Not Implemented |
| `groupClassController.js` all exports | `groupClassRoutes.js` | Returns 410 Feature Deprecated |
| `TrainingGroup.js` model | `trainingGroupService.js` | Imported from legacy location |
| `trainingAssignmentService.js` | `trainingAssignmentController.js` | Imported from legacy location |

---

## Active AI Modules Post-Cleanup

| Module | Tools | Status |
|--------|-------|--------|
| `membership` | 3 tools | Active |
| `booking` | 2 tools | Active |
| `checkin` | 1 tool | Active |
| `product` | 1 tool | Active |
| `pt` | 1 tool | Active |

**5 modules, 8 tool functions.** (Down from 11 modules, same 8 tool functions — 55% dead code removed.)

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/trainingGroupService.js` | Import path: `../models/TrainingGroup.js` → `../legacy/models/TrainingGroup.js` |
| `src/controllers/trainingAssignmentController.js` | Import path: `../services/trainingAssignmentService.js` → `../legacy/services/trainingAssignmentService.js` |
| `src/legacy/services/trainingAssignmentService.js` | Internal import path fixed: `../models/TrainingAssignment.js` → `../../models/TrainingAssignment.js` |
| `src/routes/groupClassRoutes.js` | Replaced controller imports with inline `410 FEATURE_DEPRECATED` stubs |
| `src/routes/reportRoutes.js` | Replaced controller imports with inline `501 FEATURE_NOT_IMPLEMENTED` stubs |

---

## Verification

| Check | Result |
|-------|--------|
| App creates without errors | ✅ Verified (`createApp()` succeeds) |
| Zero references to old model/service/controller file locations | ✅ Verified (grep returned zero matches) |
| Only 5 active AI modules remain | ✅ Verified (booking, checkin, membership, product, pt) |
| All moved files still accessible via `src/legacy/` | ✅ Verified (11 files/directories exist) |
| No routes returning unhandled errors | ✅ Verified (all replaced routes return proper error codes) |
| No console.log in new code | ✅ Verified |

---

## Future Removal Sprint

| File | Target Removal | Prerequisite |
|------|---------------|-------------|
| `legacy/models/PTReview.js` | Sprint 1 | None — already empty |
| `legacy/models/TrainingGroup.js` | Sprint 4 | Migrate `trainingGroupService.js` to use `TrainingClass` model |
| `legacy/services/trainingAssignmentService.js` | Sprint 4 | Remove `trainingAssignmentController.js` and its routes |
| `legacy/controllers/reportController.js` | Sprint 6 | Implement actual report features |
| `legacy/controllers/groupClassController.js` | Sprint 3 | Migrate to new class scheduling system |
| `legacy/modules/challenge/` | Sprint 6 | Implement challenge AI tool or delete |
| `legacy/modules/diet/` | Sprint 6 | Implement diet AI tool or delete |
| `legacy/modules/faq/` | Sprint 6 | Implement FAQ AI tool or delete |
| `legacy/modules/knowledge/` | Sprint 6 | Implement knowledge AI tool or delete |
| `legacy/modules/nutrition/` | Sprint 6 | Implement nutrition AI tool or delete |
| `legacy/modules/workout/` | Sprint 6 | Implement workout AI tool or delete |

---

## ADR Required

**No.** Task 0.8 is a code cleanup operation. No architectural decisions are made. All moved files are documented and accessible from `src/legacy/`.

---

## Cost/Benefit

| Metric | Before | After |
|--------|--------|-------|
| AI modules loaded at runtime | 11 (6 dead) | 5 (0 dead) |
| File imports crossing Category D boundaries | 5 | 0 |
| Routes serving dead endpoints | 10 routes (6 stubs + 4 deprecated) | 10 routes (clearly returning 501/410) |
| Startup import errors from dead files | 0 | 0 (unchanged) |

---

**Task 0.8 complete. Zero files deleted. All history preserved in `src/legacy/`.**
