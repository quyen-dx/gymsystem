# Trainer (PT) Module

- **Owner**: PT Team
- **Dependencies**: Auth (User), Booking, Schedule, Workout
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md)

## Purpose
Manages personal trainer profiles, assignments, and availability. Acts as a coordination layer over the User (trainer role), Booking (sessions), Schedule (availability), and Workout (plans) modules to provide a unified trainer experience.

## Models
No dedicated models. Uses:
- `User` with `role = 'pt'` for trainer profiles
- `Booking` for session history and active member counts
- `Schedule` for availability
- `WorkoutPlan` for training plans

## Services
| Service | Key Methods |
|---|---|
| `trainerService` | `getTrainers()`, `getTrainerById()`, `getActiveMembers()`, `getTrainerSchedule()`, `getTrainerStats()`, `assignMember()`, `getTrainerPerformance()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `trainerController` | `GET /trainers`, `GET /trainers/:id`, `GET /trainers/:id/schedule`, `GET /trainers/:id/members`, `GET /trainers/:id/stats` |
| `adminTrainerController` | CRUD `/admin/trainers` (create, update, deactivate trainer accounts) |

## Business Rules
| Rule | Description |
|---|---|
| BR-PT-001 | Max 10 active member assignments per PT |
| BR-PT-002 | PT availability defined by schedule, max 8 sessions/day |
| BR-PT-003 | PT cannot book themselves |
| BR-PT-004 | PT can modify own schedule min 24h in advance |

## States
PT uses `User` status: `active`, `inactive`, `on_leave`.

## Key Flows

### Member Browses Trainers → Selects → Books Session
1. Member lists trainers → `GET /trainers`
2. Each trainer shows: name, specialties, rating, next available slot, active member count
3. Member selects trainer → `GET /trainers/:id` for profile + schedule
4. Member books session via Booking module

### Admin Onboards New PT
1. Admin creates `User` with `role = 'pt'` via `POST /admin/trainers`
2. PT receives welcome email with login credentials
3. PT completes profile (bio, specialties, certifications, photo)
4. PT creates schedule via Schedule module
5. Admin assigns members up to BR-PT-001 limit

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/trainers` | Public | — | List active trainers |
| GET | `/trainers/:id` | Public | — | Get trainer profile |
| GET | `/trainers/:id/schedule` | Public | — | Get trainer's schedule |
| GET | `/trainers/:id/members` | Required | PT, Admin | Get trainer's assigned members |
| GET | `/trainers/:id/stats` | Required | PT, Admin | Get trainer performance stats |
| POST | `/admin/trainers` | Required | Admin | Create trainer account |
| PUT | `/admin/trainers/:id` | Required | Admin | Update trainer profile |
| DELETE | `/admin/trainers/:id` | Required | Admin | Deactivate trainer |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_USER_NOT_FOUND` | 404 | Trainer does not exist |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | Non-admin trying to manage trainers |

## Testing
- BR-PT-001: assign 11th member → rejected
- BR-PT-002: schedule >8 sessions in a day → blocked
- BR-PT-003: trainer tries to book self → rejected
- BR-PT-004: schedule change <24h before → rejected
- Public listing: only `active` trainers shown
- Stats endpoint: session count, member count, rating, no-show rate
- Admin CRUD: deactivate PT → cancels future bookings

## Future
- PT rating and review system
- PT commission / revenue reporting
- PT certification management with expiry alerts
- PT performance leaderboard
- Member-PT matching algorithm based on goals and specializations
