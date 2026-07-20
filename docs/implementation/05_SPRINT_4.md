# Sprint 4: Wellness

> **Sprint Duration:** 2 weeks  
> **Sprint Number:** 4 of 5  
> **Target Release:** v1.4.0 — Wellness Release  
> **Status:** Planning

---

## 1. Sprint Goal

Implement member wellness tracking: workout plans with exercise library, nutrition guidance and meal tracking, health metrics dashboard with body composition history, and AI-powered food/scan analysis via the Vision pipeline.

---

## 2. Business Objectives

- Enable PTs to create structured workout plans for assigned members with exercise details
- Build a comprehensive exercise library searchable by muscle group, equipment, and difficulty
- Allow members to log completed workouts with sets, reps, and weight for progress tracking
- Provide nutrition logging with macro tracking and AI-powered food photo estimation
- Deliver a health metrics dashboard with body composition history (weight, body fat %, muscle mass)
- Offer AI-driven calculators (BMI, BMR, TDEE, macros) integrated into the assistant
- Support InBody scan OCR parsing via AI Vision for automated body composition data entry

---

## 3. Modules Included

| Module | Path | Owner | Status |
|--------|------|-------|--------|
| Workout | `docs/modules/workout.md` | PT Team | Existing module |
| Nutrition | New module (no existing doc) | Wellness Team | New for Sprint 4 |
| Health | New module (no existing doc) | Wellness Team | New for Sprint 4 |

---

## 4. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 1 — Auth & Membership | Must be complete | User roles, membership cycles for trial access validation |
| Sprint 3 — Scheduling | Must be complete | PT-member assignments (BR-PT-001) determine plan eligibility |
| AI Pipeline — Vision Tools | Must be functional | InBody scan OCR, food photo analysis (AI_ARCHITECTURE.md §9) |
| AI Pipeline — Calculator Tools | Must be functional | BMI, BMR, TDEE, macro calculators (AI_ARCHITECTURE.md §9) |
| AI Pipeline — RAG | Should be functional | Nutrition guides, exercise technique RAG (AI_ARCHITECTURE.md §9) |
| Upload Module | Should be functional | Exercise demonstration media, InBody scan uploads (docs/modules/upload.md) |

---

## 5. Prerequisites

- [ ] User module: `member` and `pt` roles with JWT auth
- [ ] Sprint 3 complete: PT-member assignment data available via `bookings` collection
- [ ] AI Vision pipeline deployed: `analyse_inbody`, `analyse_food_photo` tools operational
- [ ] AI Calculator tools deployed: `calculate_bmi`, `calculate_bmr`, `calculate_tdee`, `calculate_macros`
- [ ] RAG pipeline with vector knowledge base populated for `nutrition` and `exercises` collections
- [ ] Cloudinary upload integration functional (for exercise media and InBody scans)

---

## 6. Documents to Read

| Document | Path |
|----------|------|
| Workout Module | `docs/modules/workout.md` |
| Business Rules Catalog | `docs/BUSINESS_RULES.md` |
| Permission Matrix | `docs/PERMISSION_MATRIX.md` |
| Database Schema Reference | `docs/DATABASE.md` |
| API Standards | `docs/API_STANDARDS.md` |
| AI Architecture | `docs/AI_ARCHITECTURE.md` |
| Upload Module | `docs/modules/upload.md` |

---

## 7. Business Rules

| Rule ID | Module | Type | Summary |
|---------|--------|------|---------|
| BR-MEM-008 | Membership | constraint | Trial members: workout plans are accessible but trial members cannot book PT sessions; applicable for workout plan viewing restrictions during trial |
| BR-PT-001 | Trainer | constraint | Max 10 active member assignments per PT — determines which PT-member pairs are eligible for plan creation |

> **Note:** No specific BR-xxx rules are defined for workout, nutrition, or health modules. These are new feature areas being introduced in Sprint 4. The business logic for these modules is defined by system capability (AI tool outputs, data tracking) rather than constraint-based rules. BR-MEM-008 and BR-PT-001 provide cross-module constraints relevant to workout plan access.

---

## 8. State Machines

No formal state machine is defined for workout, nutrition, or health modules.

**Workout Plan status transitions** (application-level, not formal state machine):

`draft` → `active` → `completed` → `archived`

| From | To | Trigger | Guard | Action |
|------|----|---------|-------|--------|
| — | `draft` | PT creates plan | None | Plan created with exercises; not visible to member |
| `draft` | `active` | PT activates plan | Plan has at least 1 exercise; PT is assigned to member (BR-PT-001) | Plan visible to member; member can log workouts |
| `active` | `completed` | PT marks complete | All scheduled sessions elapsed or PT manually completes | Plan locked; logs preserved; progress summary generated |
| `draft` / `active` | `archived` | PT or admin archives | Plan is `draft` or `completed` | Plan hidden from default views |

**Invalid transitions:**
- `draft → completed` (must be activated first)
- `active → draft` (irreversible)
- `completed → active` (must create new plan)

---

## 9. Permission Matrix

> Source: `docs/PERMISSION_MATRIX.md`

### Workout Resource

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | — | R | — | — | — | R | R |
| View assigned | — | — | R | — | — | R | R |
| Create own | — | C | — | — | — | C | C |
| Create for member | — | — | C | — | — | C | C |
| Update own | — | U | — | — | — | U | U |
| Update any | — | — | U | — | — | U | U |
| Delete own | — | D | — | — | — | D | D |

### AI Assistant Resource

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| Chat | — | C | C | C | C | C | C |
| View chat history | — | R | R | R | R | R | R |

> **Note:** Nutrition and Health modules are new; their permission rows are inherited from the general user resource — members can read/write their own data; PTs can view assigned member data; admins have full access.

---

## 10. Database Collections

> Source: `docs/DATABASE.md` §2.5 (Workout), plus new collections for Nutrition and Health

### Existing — Workout (4 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `workout_plans` | `userId` (trainee), `trainerId` (optional), `name`, `description`, `goal` (enum: `strength`, `hypertrophy`, `endurance`, `weight_loss`, `general`), `difficulty` (enum: `beginner`, `intermediate`, `advanced`), `durationWeeks`, `isPublic`, `isActive` | PT-created workout plans for members |
| `exercises` | `name` (unique), `description`, `muscleGroup` [String], `equipment` [String], `difficulty`, `mediaUrls` [String], `isActive` | Exercise library with muscle groups, equipment, media |
| `workout_exercises` | `planId`, `exerciseId`, `dayOfWeek`, `order`, `sets`, `reps`, `restSeconds`, `notes` | Exercise instances within a plan (ordered by day) |
| `workout_logs` | `userId`, `workoutExerciseId`, `date`, `actualSets`, `actualReps`, `weight` (kg), `durationMinutes`, `rpe` (1-10), `notes` | Member's logged workout sessions |

### Existing — Workout Indexes

- `workout_plans`: `{ userId: 1, isActive: 1 }`, `{ trainerId: 1 }`, text: `{ name: "text", description: "text" }`
- `exercises`: unique `name`, `{ muscleGroup: 1 }`, text: `{ name: "text", description: "text" }`
- `workout_exercises`: `{ planId: 1, dayOfWeek: 1, order: 1 }`, `{ exerciseId: 1 }`
- `workout_logs`: `{ userId: 1, date: -1 }`, `{ workoutExerciseId: 1 }`, `{ userId: 1, date: -1, createdAt: -1 }`

### New — Nutrition (3 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `nutrition_logs` | `userId`, `date`, `mealType` (enum: `breakfast`, `lunch`, `dinner`, `snack`), `foodName`, `quantity`, `unit` (enum: `g`, `ml`, `serving`, `piece`), `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `imageUrl` (from AI food photo), `aiEstimated` (Boolean), `notes` | Daily meal and nutrition intake logs |
| `nutrition_plans` | `userId`, `trainerId` (optional), `name`, `goal`, `dailyCalorieTarget`, `proteinTarget_g`, `carbsTarget_g`, `fatTarget_g`, `isActive`, `startDate`, `endDate` | Nutrition plan templates with macro targets |
| `meal_templates` | `name`, `description`, `mealType`, `ingredients` [{ `foodName`, `quantity`, `unit`, `calories`, `protein_g`, `carbs_g`, `fat_g` }], `totalCalories`, `totalProtein_g`, `totalCarbs_g`, `totalFat_g`, `isPublic`, `createdBy` | Reusable meal templates |

### New — Nutrition Indexes

- `nutrition_logs`: `{ userId: 1, date: -1 }`, `{ userId: 1, mealType: 1, date: -1 }`
- `nutrition_plans`: `{ userId: 1, isActive: 1 }`
- `meal_templates`: `{ mealType: 1, isPublic: 1 }`, text: `{ name: "text", description: "text" }`

### New — Health (4 collections)

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `health_metrics` | `userId`, `date`, `weight_kg`, `height_cm`, `bodyFatPercent`, `muscleMass_kg`, `boneMass_kg`, `waterPercent`, `visceralFat`, `bmi`, `bmr`, `waist_cm`, `hip_cm`, `source` (enum: `manual`, `inbody_scan`, `ai_estimated`), `scanImageUrl` | Body composition and health measurement tracking over time |
| `body_composition` | `userId`, `date`, `source` (enum: `inbody`, `manual`, `smart_scale`), `rawData` (Object — full InBody report fields), `segmentalAnalysis` (Object — per-limb breakdown), `scanImageId` (ref: Upload) | Detailed InBody scan records with full report data |
| `fitness_goals` | `userId`, `type` (enum: `weight_loss`, `muscle_gain`, `maintenance`, `endurance`, `custom`), `targetWeight_kg`, `targetBodyFatPercent`, `targetDate`, `currentValue`, `progressPercent`, `isActive`, `notes` | Member fitness goal tracking with progress |
| `health_calculations` | `userId`, `type` (enum: `bmi`, `bmr`, `tdee`, `macros`), `input` (Object — height, weight, age, gender, activityLevel), `result` (Object — calculated values), `calculatedAt` | Cached AI calculator results for quick retrieval |

### New — Health Indexes

- `health_metrics`: `{ userId: 1, date: -1 }`, `{ userId: 1, source: 1 }`
- `body_composition`: `{ userId: 1, date: -1 }`
- `fitness_goals`: `{ userId: 1, isActive: 1 }`
- `health_calculations`: `{ userId: 1, type: 1, calculatedAt: -1 }`

---

## 11. API Endpoints

> Source: `docs/API_STANDARDS.md` §14.20 (Exercises), plus new endpoints

### Workout Plans

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/workout-plans` | Yes | `pt`, `member` | List workout plans (member: own only; PT: assigned members) |
| `POST` | `/api/v1/workout-plans` | Yes | `pt`, `admin` | Create workout plan (BR-PT-001 assignment check) |
| `GET` | `/api/v1/workout-plans/:id` | Yes | `pt`, `member` | Get plan details with exercises (owner or assigned PT) |
| `PUT` | `/api/v1/workout-plans/:id` | Yes | `pt`, `admin` | Update plan (add/remove exercises, adjust sets/reps) |
| `DELETE` | `/api/v1/workout-plans/:id` | Yes | `pt`, `admin` | Delete draft plan |
| `PUT` | `/api/v1/workout-plans/:id/activate` | Yes | `pt` | Activate plan for member (draft → active) |
| `PUT` | `/api/v1/workout-plans/:id/complete` | Yes | `pt` | Mark plan complete (active → completed) |
| `PUT` | `/api/v1/workout-plans/:id/archive` | Yes | `pt`, `admin` | Archive plan |

### Exercises

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/exercises` | Yes | Any | List exercises (filterable: `?muscleGroup=&equipment=&difficulty=`) |
| `GET` | `/api/v1/exercises/search` | Yes | Any | Full-text search exercises |
| `POST` | `/api/v1/exercises` | Yes | `pt`, `admin`, `super_admin` | Create exercise |
| `GET` | `/api/v1/exercises/:id` | Yes | Any | Get exercise with instructions and media |
| `PUT` | `/api/v1/exercises/:id` | Yes | `pt`, `admin`, `super_admin` | Update exercise |
| `DELETE` | `/api/v1/exercises/:id` | Yes | `admin`, `super_admin` | Delete exercise |

### Workout Logs

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/workout-logs` | Yes | `pt`, `member` | List workout logs (member: own; PT: assigned members) |
| `POST` | `/api/v1/workout-logs` | Yes | `member` | Log completed workout with per-exercise data |
| `GET` | `/api/v1/workout-logs/:id` | Yes | `pt`, `member` | Get log details |
| `PUT` | `/api/v1/workout-logs/:id` | Yes | `member` | Update workout log |
| `GET` | `/api/v1/workout-logs/progress` | Yes | `member`, `pt` | Get progress summary (weight lifted over time, volume trends) |
| `GET` | `/api/v1/workout-logs/plan/:planId` | Yes | `pt`, `member` | Get all logs for a specific workout plan |

### Nutrition

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/nutrition-logs` | Yes | `member` | List own nutrition logs (`?dateFrom=&dateTo=&mealType=`) |
| `POST` | `/api/v1/nutrition-logs` | Yes | `member` | Log meal with macro data (manual or AI-estimated) |
| `GET` | `/api/v1/nutrition-logs/:id` | Yes | `member` | Get nutrition log details |
| `PUT` | `/api/v1/nutrition-logs/:id` | Yes | `member` | Update nutrition log |
| `DELETE` | `/api/v1/nutrition-logs/:id` | Yes | `member` | Delete nutrition log |
| `GET` | `/api/v1/nutrition-logs/daily-summary` | Yes | `member` | Get daily macro totals for a date (`?date=`) |
| `GET` | `/api/v1/nutrition-plans` | Yes | `member`, `pt` | List nutrition plans |
| `POST` | `/api/v1/nutrition-plans` | Yes | `pt` | Create nutrition plan for member |
| `GET` | `/api/v1/nutrition-plans/:id` | Yes | `member`, `pt` | Get nutrition plan with macro targets |
| `PUT` | `/api/v1/nutrition-plans/:id` | Yes | `pt` | Update nutrition plan |
| `GET` | `/api/v1/meal-templates` | Yes | `member`, `pt` | List public meal templates (`?mealType=`) |
| `POST` | `/api/v1/meal-templates` | Yes | `pt`, `admin` | Create meal template |
| `POST` | `/api/v1/nutrition-logs/analyse-food` | Yes | `member` | Upload food photo → AI Vision returns estimated calories/macros |

### Health Metrics

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/v1/health-metrics` | Yes | `member` | List own health metrics (`?dateFrom=&dateTo=`) |
| `POST` | `/api/v1/health-metrics` | Yes | `member` | Record health metric (manual entry) |
| `GET` | `/api/v1/health-metrics/:id` | Yes | `member` | Get metric details |
| `DELETE` | `/api/v1/health-metrics/:id` | Yes | `member` | Delete metric record |
| `GET` | `/api/v1/health-metrics/trends` | Yes | `member` | Get trend data: weight, body fat %, muscle mass over time |
| `POST` | `/api/v1/health-metrics/inbody-scan` | Yes | `member` | Upload InBody scan → AI Vision parses → auto-create metrics record |
| `GET` | `/api/v1/body-composition` | Yes | `member` | List InBody scan history |
| `GET` | `/api/v1/body-composition/:id` | Yes | `member` | Get full InBody report details |
| `GET` | `/api/v1/fitness-goals` | Yes | `member` | List own fitness goals |
| `POST` | `/api/v1/fitness-goals` | Yes | `member` | Set fitness goal |
| `PUT` | `/api/v1/fitness-goals/:id` | Yes | `member` | Update goal |
| `DELETE` | `/api/v1/fitness-goals/:id` | Yes | `member` | Remove goal |

### Health Calculators (AI-Powered)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `POST` | `/api/v1/health-calculators/bmi` | Yes | `member` | Calculate BMI from height/weight |
| `POST` | `/api/v1/health-calculators/bmr` | Yes | `member` | Calculate BMR (Mifflin-St Jeor) |
| `POST` | `/api/v1/health-calculators/tdee` | Yes | `member` | Calculate TDEE from BMR + activity level |
| `POST` | `/api/v1/health-calculators/macros` | Yes | `member` | Calculate macro split based on goal (cut/bulk/maintain) |
| `GET` | `/api/v1/health-calculators/history` | Yes | `member` | Get cached calculation history |

---

## 12. AI Components

> Source: `docs/AI_ARCHITECTURE.md` §9

### Calculator Tools

| Tool | AI Architecture Reference | Purpose |
|------|--------------------------|---------|
| `calculate_bmi` | §9 — Calculator Tools | Body Mass Index from height/weight |
| `calculate_bmr` | §9 — Calculator Tools | Basal Metabolic Rate (Mifflin-St Jeor equation) |
| `calculate_tdee` | §9 — Calculator Tools | Total Daily Energy Expenditure |
| `calculate_macros` | §9 — Calculator Tools | Macro nutrient split based on fitness goals |
| `calculate_calories` | §9 — Calculator Tools | Calorie tracking and estimation |

### Vision Tools

| Tool | AI Architecture Reference | Purpose |
|------|--------------------------|---------|
| `analyse_inbody` | §9 — Vision Tools | OCR + interpretation of InBody scan results |
| `analyse_food_photo` | §9 — Vision Tools | Object detection + calorie/macro estimation from food image |
| `ocr_nutrition_label` | §9 — Vision Tools | OCR extraction from nutrition facts labels |

### RAG Tools

| Tool | AI Architecture Reference | Purpose |
|------|--------------------------|---------|
| `search_nutrition` | §9 — RAG Tools | Nutrition guides, meal plans, diet information |
| `search_exercises` | §9 — RAG Tools | Exercise library, form guides, muscle groups |
| `search_faq` | §9 — RAG Tools | General fitness FAQ |

### DB Tools

| Tool | AI Architecture Reference | Purpose |
|------|--------------------------|---------|
| `query_workouts` | §9 — DB Tools | Workout logs, routines, exercise history |
| `query_profiles` | §9 — DB Tools | User profile data (height, weight for calculators) |

### Business Tools

| Tool | AI Architecture Reference | Purpose |
|------|--------------------------|---------|
| `calculate_goal_progress` | §9 — Business Tools | Progress towards user-set fitness goals |

---

## 13. Files Expected Created

### Models (11)

| File | Purpose |
|------|---------|
| `src/models/workoutPlan.model.js` | Workout plan Mongoose model |
| `src/models/exercise.model.js` | Exercise Mongoose model |
| `src/models/workoutExercise.model.js` | Workout exercise (plan-exercise junction) Mongoose model |
| `src/models/workoutLog.model.js` | Workout log Mongoose model |
| `src/models/nutritionLog.model.js` | Nutrition log Mongoose model |
| `src/models/nutritionPlan.model.js` | Nutrition plan Mongoose model |
| `src/models/mealTemplate.model.js` | Meal template Mongoose model |
| `src/models/healthMetric.model.js` | Health metric Mongoose model |
| `src/models/bodyComposition.model.js` | Body composition Mongoose model |
| `src/models/fitnessGoal.model.js` | Fitness goal Mongoose model |
| `src/models/healthCalculation.model.js` | Health calculation (cached) Mongoose model |

### Services (9)

| File | Purpose |
|------|---------|
| `src/services/workoutPlanService.js` | Plan CRUD, activation, completion, progress summary |
| `src/services/exerciseService.js` | Exercise library CRUD, search by muscle group/equipment |
| `src/services/workoutLogService.js` | Log creation, update, progress tracking (weight lifted over time, volume) |
| `src/services/nutritionLogService.js` | Meal logging, daily macro summary, AI food photo integration |
| `src/services/nutritionPlanService.js` | Nutrition plan CRUD with macro targets |
| `src/services/mealTemplateService.js` | Meal template CRUD, search by meal type |
| `src/services/healthMetricService.js` | Metric CRUD, trend data, InBody scan integration |
| `src/services/bodyCompositionService.js` | InBody report storage and retrieval |
| `src/services/fitnessGoalService.js` | Goal CRUD, progress calculation |

### Controllers (10)

| File | Purpose |
|------|---------|
| `src/controllers/workoutPlanController.js` | Workout plan REST endpoints |
| `src/controllers/exerciseController.js` | Exercise library REST endpoints |
| `src/controllers/workoutLogController.js` | Workout log REST endpoints |
| `src/controllers/nutritionLogController.js` | Nutrition log REST endpoints |
| `src/controllers/nutritionPlanController.js` | Nutrition plan REST endpoints |
| `src/controllers/mealTemplateController.js` | Meal template REST endpoints |
| `src/controllers/healthMetricController.js` | Health metric REST endpoints |
| `src/controllers/bodyCompositionController.js` | Body composition REST endpoints |
| `src/controllers/fitnessGoalController.js` | Fitness goal REST endpoints |
| `src/controllers/healthCalculatorController.js` | Health calculator (BMI/BMR/TDEE/macros) REST endpoints |

### Validators (4)

| File | Purpose |
|------|---------|
| `src/validators/workout.validator.js` | Validation schemas for workout plan, exercise, log payloads |
| `src/validators/nutrition.validator.js` | Validation schemas for nutrition log, plan, meal template payloads |
| `src/validators/health.validator.js` | Validation schemas for health metric, body composition, goal payloads |
| `src/validators/calculator.validator.js` | Validation schemas for calculator input payloads |

### Middleware (2)

| File | Purpose |
|------|---------|
| `src/middleware/workoutAuthorization.js` | Workout plan/log ownership + PT assignment check |
| `src/middleware/nutritionAuthorization.js` | Nutrition plan/log ownership check |

### Routes (5)

| File | Purpose |
|------|---------|
| `src/routes/workout.routes.js` | Workout plan, exercise, log route definitions |
| `src/routes/nutrition.routes.js` | Nutrition log, plan, meal template route definitions |
| `src/routes/health.routes.js` | Health metric, body composition, fitness goal route definitions |
| `src/routes/calculator.routes.js` | Health calculator route definitions |
| `src/routes/healthAdmin.routes.js` | Admin-only health management routes |

### AI Integration (3)

| File | Purpose |
|------|---------|
| `src/ai/tools/foodPhotoAnalyzer.js` | AI Vision food photo → calorie/macro estimation |
| `src/ai/tools/inbodyScanParser.js` | AI Vision InBody scan OCR → structured health metrics |
| `src/ai/tools/nutritionCalculatorAgent.js` | AI agent for BMI/BMR/TDEE/macro calculation orchestration |

### Jobs (2)

| File | Purpose |
|------|---------|
| `src/jobs/updateGoalProgressJob.js` | Cron: recalculate fitness goal progress from latest metrics |
| `src/jobs/syncBodyCompositionJob.js` | Cron: sync InBody data to health_metrics for chart consistency |

### Constants (4)

| File | Purpose |
|------|---------|
| `src/constants/workoutEnums.js` | Goal, difficulty, status enum constants |
| `src/constants/nutritionEnums.js` | Meal type, unit, goal type enum constants |
| `src/constants/healthEnums.js` | Metric source, goal type enum constants |
| `src/constants/calculatorEnums.js` | Calculator type, activity level enum constants |

### Tests (8)

| File | Purpose |
|------|---------|
| `tests/unit/services/workoutPlanService.test.js` | Unit tests — plan CRUD, activation, completion |
| `tests/unit/services/exerciseService.test.js` | Unit tests — exercise library search and CRUD |
| `tests/unit/services/workoutLogService.test.js` | Unit tests — log creation, progress calculation |
| `tests/unit/services/nutritionLogService.test.js` | Unit tests — meal logging, macro summaries |
| `tests/unit/services/healthMetricService.test.js` | Unit tests — metric CRUD, trend calculation |
| `tests/unit/services/fitnessGoalService.test.js` | Unit tests — goal creation, progress calculation |
| `tests/unit/ai/foodPhotoAnalyzer.test.js` | Unit tests — AI Vision food photo analysis |
| `tests/unit/ai/inbodyScanParser.test.js` | Unit tests — AI Vision InBody scan parsing |
| `tests/integration/workoutPlanWorkflow.test.js` | Integration: PT creates plan → activates → member logs → PT reviews |
| `tests/integration/nutritionWorkflow.test.js` | Integration: food photo upload → AI analysis → log creation → daily summary |
| `tests/integration/healthMetricsWorkflow.test.js` | Integration: InBody scan upload → AI parse → metrics created → trends |
| `tests/e2e/workout.e2e.test.js` | E2E: real API tests for all workout endpoints |
| `tests/e2e/nutrition.e2e.test.js` | E2E: real API tests for all nutrition endpoints |
| `tests/e2e/health.e2e.test.js` | E2E: real API tests for all health endpoints |

---

## 14. Files Expected Modified

| File | Change |
|------|--------|
| `src/routes/index.js` | Register workout, nutrition, health, calculator routes |
| `src/app.js` | Mount new route groups |
| `src/ai/pipeline.js` | Register food photo analyser, InBody scan parser, nutrition calculator agent |
| `src/ai/tools/registry.js` | Add `analyse_inbody`, `analyse_food_photo`, `ocr_nutrition_label` to vision tools; add `calculate_bmi`, `calculate_bmr`, `calculate_tdee`, `calculate_macros` to calculator tools; add `search_nutrition` to RAG tools |
| `.env.example` | Add AI Vision model configuration for food/inbody analysis |

---

## 15. Definition of Ready

- [ ] Sprint 3 (Scheduling) complete and tested — PT-member assignment data available
- [ ] AI Vision pipeline deployed and tested with sample InBody and food images
- [ ] AI Calculator tools producing correct outputs for known test cases (BMI, BMR, TDEE, macros)
- [ ] RAG knowledge base seeded with nutrition guides and exercise technique content
- [ ] Exercise library seed data prepared (minimum 50 exercises across all muscle groups)
- [ ] Meal template seed data prepared (minimum 20 templates across all meal types)
- [ ] Cloudinary upload bucket configured for exercise media and scan images
- [ ] API contracts agreed for all 40+ endpoints listed in §11
- [ ] Frontend wireframes available for: workout plan builder, workout logger, nutrition diary, health dashboard, goal tracker
- [ ] Test InBody scan PDFs and food photos collected for Vision pipeline validation

---

## 16. Definition of Done

- [ ] All 52 files listed in §13 created with complete implementations
- [ ] All models have proper Mongoose schemas with indexes, enums, and soft-delete support
- [ ] Workout plan activation validates PT-member assignment (BR-PT-001)
- [ ] Trial membership check: trial members can view but not receive new workout plans (BR-MEM-008)
- [ ] Food photo upload → AI Vision analysis → auto-populated nutrition log pipeline functional
- [ ] InBody scan upload → AI Vision OCR → `body_composition` + `health_metrics` auto-creation functional
- [ ] All four AI calculators (BMI, BMR, TDEE, macros) return correct results with caching
- [ ] Progress tracking: weight lifted over time and volume trends computed correctly
- [ ] Daily macro summary aggregation accurate for multi-meal days
- [ ] Goal progress recalculated automatically when new metrics are added
- [ ] Unit test coverage ≥80% across all service files
- [ ] Integration tests pass for all 3 workflow scenarios
- [ ] E2E tests pass for all acceptance criteria in §17
- [ ] AI Vision tests pass with sample InBody and food images
- [ ] Exercise library search by muscle group, equipment, difficulty returns correct results
- [ ] Health metric trend data (weight, body fat %, muscle mass) charts correctly over time
- [ ] Linting passes (`npm run lint`) with no errors
- [ ] TypeScript type checking passes (`npm run typecheck`) if applicable
- [ ] API documentation generated (Swagger/OpenAPI) for all endpoints

---

## 17. Acceptance Criteria

| # | Criteria | Verification |
|---|----------|-------------|
| AC-4.1 | PT creates workout plan with exercises; `POST /workout-plans` succeeds with status `draft` | Plan document created; exercises linked via `workout_exercises` |
| AC-4.2 | PT activates plan; status transitions to `active`; member receives notification | `PUT /workout-plans/:id/activate` |
| AC-4.3 | Member views active plan with exercises for current day; `GET /workout-plans/:id` | Plan details with ordered exercises returned |
| AC-4.4 | Member logs completed workout with sets/reps/weight; `POST /workout-logs` | Log document created with per-exercise data |
| AC-4.5 | PT reviews member's workout logs and progress; `GET /workout-logs/plan/:planId` | Logs grouped by date with volume summaries |
| AC-4.6 | Exercise library searchable by muscle group: `GET /exercises?muscleGroup=chest` | Only chest exercises returned |
| AC-4.7 | Exercise library searchable by equipment: `GET /exercises?equipment=dumbbell` | Only dumbbell exercises returned |
| AC-4.8 | Exercise library full-text search: `GET /exercises/search?q=bench press` | Matching exercises returned |
| AC-4.9 | Progress tracking: weight lifted over time correctly computed | `GET /workout-logs/progress` returns correct aggregate data |
| AC-4.10 | Member logs a meal manually: `POST /nutrition-logs` with food, quantity, macros | Nutrition log created |
| AC-4.11 | Member uploads food photo; AI Vision returns estimated calories/macros | `POST /nutrition-logs/analyse-food` → AI response → auto-populate log |
| AC-4.12 | Daily macro summary: `GET /nutrition-logs/daily-summary?date=2024-01-15` | Correct totals for protein, carbs, fat across all meals |
| AC-4.13 | PT creates nutrition plan with macro targets; `POST /nutrition-plans` | Plan with `dailyCalorieTarget`, `proteinTarget_g`, etc. |
| AC-4.14 | Member records body composition manually: `POST /health-metrics` | Metric document with weight, body fat %, muscle mass |
| AC-4.15 | Member uploads InBody scan; AI Vision parses; auto-creates metrics + body composition record | `POST /health-metrics/inbody-scan` → parse → create both records |
| AC-4.16 | Health metric trends: `GET /health-metrics/trends?metric=weight&dateFrom=&dateTo=` | Correct trend data points over time |
| AC-4.17 | Member sets fitness goal: `POST /fitness-goals` with target weight and date | Goal created with 0% progress |
| AC-4.18 | Goal progress auto-updates when new metrics logged; `GET /fitness-goals` | Progress percent reflects latest metric vs target |
| AC-4.19 | BMI calculator: `POST /health-calculators/bmi` with height/weight | Correct BMI value and category |
| AC-4.20 | BMR calculator: `POST /health-calculators/bmr` | Correct BMR (Mifflin-St Jeor) |
| AC-4.21 | TDEE calculator: `POST /health-calculators/tdee` with activity level | Correct TDEE = BMR × activity multiplier |
| AC-4.22 | Macro calculator: `POST /health-calculators/macros` with goal type | Correct protein/carbs/fat split |
| AC-4.23 | Calculator results cached; `GET /health-calculators/history` | Previous calculations returned without recomputation |
| AC-4.24 | Trial member can view workout plans but PT assignment restricted (BR-MEM-008) | Trial member plan view works; assignment blocked |
| AC-4.25 | AI assistant can answer nutrition/fitness queries via RAG tools (`search_nutrition`, `search_exercises`) | Chat queries return RAG-grounded responses with citations |

---

## 18. Testing Strategy

### Unit Tests

- **workoutPlanService:** Plan CRUD, status transitions (draft → active → completed → archived), exercise ordering, PT assignment validation
- **exerciseService:** Exercise CRUD, search by muscle group, search by equipment, full-text search, media URL validation
- **workoutLogService:** Log creation with per-exercise data, progress calculation (weight volume over time), duplicate log handling (allowed — multiple sessions per day)
- **nutritionLogService:** Meal logging, AI food photo integration (mock AI response), daily macro summary aggregation, meal type filtering
- **nutritionPlanService:** Plan CRUD with macro target validation
- **healthMetricService:** Metric CRUD, trend calculation (weight/BF%/muscle mass over time), InBody scan integration
- **bodyCompositionService:** InBody record parsing and storage, segmental analysis handling
- **fitnessGoalService:** Goal CRUD, progress calculation from latest metrics
- **foodPhotoAnalyzer:** AI Vision mock — returns estimated macros from sample food images
- **inbodyScanParser:** AI Vision mock — returns parsed body composition from sample InBody PDFs

### Integration Tests

- **workoutPlanWorkflow:** PT creates plan → adds exercises → activates → member views → member logs → PT reviews → PT marks complete
- **nutritionWorkflow:** Member uploads food photo → AI analysis → auto-logs → checks daily summary → PT creates nutrition plan
- **healthMetricsWorkflow:** Member uploads InBody scan → AI parse → metrics + body composition created → trends queried → goal progress updated

### E2E Tests

- Real HTTP requests against test database via supertest
- All 25 acceptance criteria enumerated in §17
- AI Vision endpoints tested with real sample images (InBody scans, food photos)

---

## 19. Rollback Strategy

| Scenario | Rollback Action |
|----------|----------------|
| AI Vision food analysis returns incorrect macros | Allow manual override in nutrition log; member can edit AI-estimated values post-creation |
| InBody scan parsing fails for specific scan format | Fall back to manual entry; flag scan for admin review; log raw OCR output for debugging |
| Workout plan activation fails after exercise creation | Transaction rollback: delete plan + exercises if plan activation fails |
| Macro calculator returns scientifically incorrect split | Admin-configurable macro ratios; override defaults via system settings |
| Health metric trend data incorrect due to timezone issues | Recompute trends on-demand with corrected timezone; backfill job available |
| Cloudinary upload fails for exercise media | Allow exercise creation without media; retry upload with exponential backoff |
| Database migration for new collections fails | Run `*.rollback.js`; restore from backup |

---

## 20. Risks

| # | Risk | Probability | Impact |
|---|------|------------|--------|
| R-4.1 | AI Vision food photo analysis accuracy is low (<70%) | High | Medium — member trust in AI feature erodes |
| R-4.2 | InBody scan OCR misreads critical values (body fat %, muscle mass) | Medium | High — incorrect health recommendations based on bad data |
| R-4.3 | Exercise library seed data incomplete or inaccurate | Medium | Medium — PTs cannot create plans effectively |
| R-4.4 | Macro/target calculations incorrect due to missing user profile data (no height/weight set) | Medium | Low — calculator returns error prompting user to complete profile |
| R-4.5 | Workout log volume aggregation slow with large datasets (>10K logs) | Low | Medium — degraded dashboard performance |
| R-4.6 | Trial members accessing paid workout features via API manipulation | Low | High — revenue loss if trials get full workout access |
| R-4.7 | Cloudinary bandwidth cost exceeds budget for exercise video hosting | Low | Medium — unexpected infrastructure cost |

---

## 21. Risk Mitigation

| Risk # | Mitigation |
|--------|-----------|
| R-4.1 | AI-estimated macros always require user confirmation before saving; display "AI Estimate — please verify" label; allow user to edit; track estimate-vs-actual accuracy over time; fall back to manual entry |
| R-4.2 | InBody OCR results displayed with confidence scores; flag values outside normal ranges for review; allow user to correct parsed values before saving; store raw OCR text alongside parsed values for debugging |
| R-4.3 | Seed exercise library from reputable sources (ACE, NASM); have certified PT review and validate all seed data before production; allow PTs to create custom exercises |
| R-4.4 | Calculator endpoints validate required inputs exist (height, weight) and return clear error messages; prompt user to complete health profile before using calculators |
| R-4.5 | Pre-aggregate log volume data in a `workout_progress_snapshots` collection updated by cron; dashboard reads from pre-computed snapshots; use MongoDB aggregation pipeline with proper indexes |
| R-4.6 | Enforce BR-MEM-008 at middleware level: trial members can `GET` plans but cannot `POST` new plans or `POST /workout-logs`; trial plan viewing is read-only |
| R-4.7 | Set Cloudinary media size limits (max 50MB per video per upload module); compress exercise videos server-side before upload; implement CDN caching; monitor bandwidth monthly |

---

## 22. Estimated Implementation Order

Tasks are dependency-ordered. Same-numbered tasks can be parallelised.

1. **Enums & Constants** — `workoutEnums.js`, `nutritionEnums.js`, `healthEnums.js`, `calculatorEnums.js`
2. **Exercise Library** — `exercise.model.js`, `exerciseService.js`, `exerciseController.js` (foundational — all other modules depend on exercises)
3. **Health Models** — `healthMetric.model.js`, `bodyComposition.model.js`, `fitnessGoal.model.js`, `healthCalculation.model.js`
4. **Nutrition Models** — `nutritionLog.model.js`, `nutritionPlan.model.js`, `mealTemplate.model.js`
5. **Workout Models** — `workoutPlan.model.js`, `workoutExercise.model.js`, `workoutLog.model.js`
6. **Health Services** — `healthMetricService.js`, `bodyCompositionService.js`, `fitnessGoalService.js`
7. **Nutrition Services** — `nutritionLogService.js`, `nutritionPlanService.js`, `mealTemplateService.js`
8. **Workout Services** — `workoutPlanService.js`, `workoutLogService.js`
9. **AI Integration** — `foodPhotoAnalyzer.js`, `inbodyScanParser.js`, `nutritionCalculatorAgent.js`
10. **Validators** — `workout.validator.js`, `nutrition.validator.js`, `health.validator.js`, `calculator.validator.js`
11. **Middleware** — `workoutAuthorization.js`, `nutritionAuthorization.js`
12. **Controllers** — All 10 controllers (parallel)
13. **Routes** — All 5 route files (parallel)
14. **Jobs** — `updateGoalProgressJob.js`, `syncBodyCompositionJob.js`
15. **App Registration** — Register routes in `src/routes/index.js` and `src/app.js`
16. **AI Pipeline Registration** — Add tools to `src/ai/tools/registry.js`, `src/ai/pipeline.js`
17. **Unit Tests** — All service unit tests (parallel: workout, nutrition, health, AI)
18. **Integration Tests** — All 3 workflow tests (parallel)
19. **E2E Tests** — All 3 E2E test files (parallel)
20. **API Documentation** — OpenAPI/Swagger for all endpoints
21. **Lint & Typecheck** — `npm run lint`, `npm run typecheck`

---

## 23. Review Checklist

- [ ] Workout plan activation validates PT-member assignment exists (BR-PT-001 guard)
- [ ] Trial members restricted to read-only workout access per BR-MEM-008
- [ ] Exercise library search indexes cover `muscleGroup`, `equipment`, and text search
- [ ] AI Vision food photo analysis requires user confirmation before saving
- [ ] AI Vision InBody scan displays confidence scores; allows user correction
- [ ] Calculator results cached in `health_calculations` collection for performance
- [ ] All monetary amounts use integer arithmetic (not applicable — no payments in wellness)
- [ ] Health metrics store weight in kg, height in cm consistently
- [ ] Macro values stored as grams (floating-point 1 decimal place OK for grams)
- [ ] Soft-delete pattern (`deletedAt`) on all collections per `docs/DATABASE.md` §3.2
- [ ] Timestamp fields (`createdAt`, `updatedAt`) on all collections per `docs/DATABASE.md` §3.1
- [ ] All API endpoints return standardised response format per `docs/API_STANDARDS.md` §5
- [ ] All API endpoints use kebab-case URL paths per `docs/API_STANDARDS.md` §2.3
- [ ] Pagination uses offset-based with `page`/`limit` query params per `docs/API_STANDARDS.md` §6
- [ ] Authorization middleware checks role against `docs/PERMISSION_MATRIX.md` workout resource rows
- [ ] All endpoints handle `NOT_FOUND` (404) and `VALIDATION_ERROR` (400) per API standards
- [ ] AI responses include disclaimer for non-DB data per anti-hallucination rule #8
- [ ] File uploads validated against `docs/modules/upload.md` size/type limits
- [ ] Progress aggregation uses indexed queries; no full collection scans
- [ ] Database migrations created for all 7 new collections with proper indexes

---

## 24. Documentation Update Checklist

- [ ] `docs/modules/workout.md` — Update with complete API endpoint list, add status transition diagram
- [ ] Create `docs/modules/nutrition.md` — New module documentation with all models, services, controllers, API endpoints
- [ ] Create `docs/modules/health.md` — New module documentation with all models, services, controllers, API endpoints
- [ ] `docs/BUSINESS_RULES.md` — Add BR-WL-xxx rules if new business constraints emerge during sprint (none pre-defined)
- [ ] `docs/PERMISSION_MATRIX.md` — Add rows for Nutrition and Health resources
- [ ] `docs/DATABASE.md` — Add §2.17 Nutrition collections, §2.18 Health collections
- [ ] `docs/API_STANDARDS.md` — Add §14.21 Nutrition endpoints, §14.22 Health endpoints, §14.23 Calculator endpoints
- [ ] `docs/AI_ARCHITECTURE.md` — Update §9 with implementation details for Vision tools (food, InBody) and Calculator tools (BMI/BMR/TDEE/macros)
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 4 as complete
- [ ] `CHANGELOG.md` — Add v1.4.0 entry

---

## 25. Deliverables

| # | Deliverable | Format | Recipient |
|---|-------------|--------|-----------|
| 1 | Workout Plan API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 2 | Exercise Library API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 3 | Workout Logging API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 4 | Nutrition Logging API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 5 | Nutrition Plan API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 6 | Meal Templates API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 7 | Health Metrics API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 8 | Body Composition API (InBody) | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 9 | Fitness Goals API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 10 | Health Calculators API | REST endpoints + OpenAPI spec | Frontend team, Mobile team |
| 11 | AI Food Photo Analysis | AI Vision integration | AI team, Frontend team |
| 12 | AI InBody Scan Analysis | AI Vision integration | AI team, Frontend team |
| 13 | Exercise library seed data | JSON/MongoDB dump | DB team |
| 14 | Meal template seed data | JSON/MongoDB dump | DB team |
| 15 | Progress tracking & trends | Aggregation pipelines | Analytics team |
| 16 | Unit test suite | `tests/unit/` | QA team |
| 17 | Integration test suite | `tests/integration/` | QA team |
| 18 | E2E test suite | `tests/e2e/` | QA team |
| 19 | API documentation | Swagger UI at `/api-docs` | All teams |
| 20 | Database migration scripts | `src/scripts/` | Ops team |
| 21 | Sprint report | Sprint retrospective doc | Project Manager |
