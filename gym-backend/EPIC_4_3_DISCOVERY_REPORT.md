# EPIC_4.3_DISCOVERY_REPORT

## Coverage: ~15%

Legacy `HealthLog` model (1 polymorphic document) and `healthController` (6 endpoints at `/api/health`) partially overlap — ~10 measurement fields, no service layer, no Zod, member-only RBAC. All other resources are absent.

## Existing Assets (legacy, unmodified)

| File | Covers |
|------|--------|
| `HealthLog.js` | weight, height, bodyFat, muscle, visceralFat, waist/hips/chest/arm/thigh, BMI auto-calc (pre-validate hook) |
| `healthController.js` | createHealthLog, uploadPhoto, getBmiHistory, getWeightHistory, compareHealthLogs, getMonthlyMeasurements |
| `healthRoutes.js` | mounted at `/api/health` in app.js:169 |

## What Epic 4.3 Requires (uncovered)

| Resource | Endpoints | Status |
|----------|-----------|--------|
| health_metrics | 6 (CRUD + trends + inbody-scan) | 0% — needs dedicated model + controller |
| body_composition | 2 (list, detail) | 0% |
| fitness_goals | 4 (CRUD) | 0% |
| health_calculators | 5 (BMI, BMR, TDEE, macros, history) | 0% |
| AI tools | inbodyScanParser, calculator functions | 0% |
| Jobs | goal auto-progress, body comp sync | 0% |

## Missing Business Rules

- PII encryption for health data (AI_CODING_CONSTITUTION.md §11)
- Audit logging for health data access (BR-AUD)
- PT scoping via PTAssignment (legacy is member-only)
- Goal progress auto-update on metric insert

## Files to Create (14)

**Models (4):** `HealthMetric.js`, `BodyComposition.js`, `FitnessGoal.js`, `healthEnums.js` constants  
**Services (2):** `healthMetricService.js`, `fitnessGoalService.js`  
**Controllers (3):** `healthMetricController.js`, `fitnessGoalController.js`, `healthCalculatorController.js`  
**Validator (1):** `healthValidator.js`  
**Routes (2):** `healthMetricsRoutes.js`, `calculatorRoutes.js`  
**Reports (2):** `IMPLEMENTATION_REPORT_EPIC_4.3.md`, `FLASH_AUDIT_EPIC_4.3.md`

## Files to Modify (1)

- `src/app.js` — register new route groups

## Recommendation: Option 1 (Greenfield)

No refactor of legacy `HealthLog`/`healthController`. All new models, services, controllers, routes at fresh paths (`/api/health-metrics`, `/api/calculator`). Legacy `/api/health` coexists untouched — same pattern as Epic 4.2 Nutrition adopted.
