# Epic 4.2 — Discovery Report

**Date:** 2026-07-21  
**Epic:** Nutrition Tracking (meal plans, daily logs, macros, calories)  
**Source:** IMPLEMENTATION_SEQUENCE.md, 05_SPRINT_4.md §§10-11

---

## Current Coverage: ~0%

| Feature | Status | Details |
|---|---|---|
| Nutrition models | ❌ None | No NutritionLog, NutritionPlan, or MealTemplate models exist |
| Nutrition services | ❌ None | No business logic |
| Nutrition controllers | ❌ None | No endpoints |
| Nutrition routes | ❌ None | Not registered in app.js |
| Existing overlap | ❌ Minimal | `HealthLog.type` has `'nutrition'` enum value only; legacy module has empty stubs |

## Missing Business Rules

None defined. Nutrition is a new feature area — business logic is data-tracking, not constraint-based.

## Target Endpoints (13)

- Nutrition logs: CRUD + daily summary + AI food analysis (7 endpoints)
- Nutrition plans: CRUD (5 endpoints)
- Meal templates: list + create (2 endpoints, PT/admin only)

## Files to Create (10)

| File | Purpose |
|---|---|
| `models/NutritionLog.js` | Meal entries: userId, date, mealType, foodName, quantity, unit, macros |
| `models/NutritionPlan.js` | Trainer plans: userId, trainerId, name, goal, daily targets |
| `models/MealTemplate.js` | Reusable meals: name, mealType, ingredients[], macros, isPublic |
| `services/nutritionLogService.js` | Log CRUD + daily macro summary aggregation |
| `services/nutritionPlanService.js` | Plan CRUD |
| `services/mealTemplateService.js` | Template CRUD + search |
| `controllers/nutritionController.js` | All nutrition endpoints |
| `routes/nutritionRoutes.js` | Mount at `/api/nutrition` |
| `validators/nutritionValidator.js` | Zod schemas |
| `app.js` (modify) | Register nutrition routes |

## Recommendation: Option 1 (Greenfield)

No existing code to patch. All models, services, controllers, and routes must be created from scratch. AI food photo analysis and macro calculator tools deferred to future AI integration epics.
