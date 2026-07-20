# Workout Module

- **Owner**: PT Team
- **Dependencies**: Auth (User), Booking (PT-member assignment)
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md)

## Purpose
Manages workout plan creation and tracking between PTs and their assigned members. PTs create structured workout plans with exercises, sets, reps, and weight targets. Members log completed workouts and PTs review progress.

## Models
| Model | Description |
|---|---|
| `WorkoutPlan` | Named plan: assigned PT, member, start/end dates, notes, status |
| `Exercise` | Exercise library: name, muscle group, equipment, instructions, media URL |
| `WorkoutExercise` | Exercise instance within a plan: exercise ref, sets, reps, weight, rest time, order |
| `WorkoutLog` | Member's logged session: date, perceived effort, notes, per-exercise completion data |

## Services
| Service | Key Methods |
|---|---|
| `workoutPlanService` | `createPlan()`, `updatePlan()`, `getPlan()`, `listPlans()`, `assignPlan()`, `activatePlan()`, `completePlan()` |
| `exerciseService` | `createExercise()`, `updateExercise()`, `listExercises()`, `searchExercises()`, `getByMuscleGroup()` |
| `workoutLogService` | `createLog()`, `updateLog()`, `getLogs()`, `getPlanProgress()`, `getMemberHistory()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `workoutPlanController` | CRUD `/workout-plans`, `PUT /workout-plans/:id/activate`, `PUT /workout-plans/:id/complete` |
| `exerciseController` | CRUD `/exercises`, `GET /exercises?muscleGroup=`, `GET /exercises/search` |
| `workoutLogController` | CRUD `/workout-logs`, `GET /workout-logs/plan/:planId`, `GET /workout-logs/progress` |

## Business Rules
| Rule | Description |
|---|---|
| BR-PT-001 | Max 10 active member assignments per PT (determines which PT-member pairs can have plans) |

## States
No formal state machine. WorkoutPlan statuses: `draft`, `active`, `completed`, `archived`.

## Key Flows

### PT Creates Plan → Member Views → Member Logs → PT Reviews
1. PT creates `WorkoutPlan` with status `draft` → adds exercises with sets/reps/weight
2. PT activates plan → status `active`, member notified
3. Member views plan in mobile app → sees exercises for current day/week
4. Member completes workout → creates `WorkoutLog` with per-exercise data
5. PT reviews logs → `GET /workout-logs/plan/:planId` shows member progress
6. PT adjusts plan as needed → updates sets/reps/weight
7. At end of plan period → PT sets status `completed`, creates new plan if continuing

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/workout-plans` | Required | PT, Member | List workout plans |
| POST | `/workout-plans` | Required | PT | Create workout plan |
| GET | `/workout-plans/:id` | Required | PT, Member | Get plan details with exercises |
| PUT | `/workout-plans/:id` | Required | PT | Update plan |
| DELETE | `/workout-plans/:id` | Required | PT, Admin | Delete draft plan |
| PUT | `/workout-plans/:id/activate` | Required | PT | Activate plan for member |
| PUT | `/workout-plans/:id/complete` | Required | PT | Mark plan complete |
| GET | `/exercises` | Public | — | List exercises (filterable) |
| POST | `/exercises` | Required | PT, Admin | Create exercise |
| PUT | `/exercises/:id` | Required | PT, Admin | Update exercise |
| GET | `/workout-logs` | Required | PT, Member | List workout logs |
| POST | `/workout-logs` | Required | Member | Log completed workout |
| PUT | `/workout-logs/:id` | Required | Member | Update workout log |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_REQUIRED_FIELD` | 400 | Missing required field (e.g., exercises array empty) |
| `SYSTEM_DATABASE_ERROR` | 500 | Database failure |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | Non-PT trying to create plans |

## Testing
- Plan creation: empty exercises → rejected
- Logging: duplicate log for same day → allowed (multiple sessions per day)
- PT-review: PT sees only their assigned members' logs
- Exercise library search by muscle group, equipment
- Plan status transitions: draft → active → completed (no skipping)
- Progress tracking: completion percentage calculation

## Future
- Pre-built workout templates / programs
- Progressive overload auto-suggestion (AI weight/reps recommendations)
- Video exercise demonstrations in-app
- Workout sharing / social features
- Integration with wearable devices (Apple Watch, Fitbit)
