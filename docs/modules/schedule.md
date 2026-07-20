# Schedule Module

- **Owner**: PT Team
- **Dependencies**: Auth (User)
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md)

## Purpose
Manages personal trainer schedules including recurring templates and exceptions. Generates available booking slots based on PT availability and feeds into the Booking module for slot selection.

## Models
| Model | Description |
|---|---|
| `Schedule` | PT schedule entries: PT, day-of-week, start/end time, recurring flag, valid-from/to dates |
| `ScheduleException` | Date-specific overrides: unavailable (blocked) or extra slots added |
| `ScheduleTemplate` | Reusable weekly schedule template that PTs can apply to future periods |

## Services
| Service | Key Methods |
|---|---|
| `scheduleService` | `createSchedule()`, `updateSchedule()`, `getSchedule()`, `getPTAvailability()`, `getAvailableSlots()`, `blockSlot()`, `addException()` |
| `scheduleTemplateService` | `createTemplate()`, `applyTemplate()`, `updateTemplate()`, `listTemplates()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `scheduleController` | CRUD `/schedules`, `GET /schedules/available?pt=&date=`, `POST /schedules/exceptions` |
| `scheduleTemplateController` | CRUD `/schedule-templates`, `POST /schedule-templates/:id/apply` |

## Business Rules
| Rule | Description |
|---|---|
| BR-PT-002 | PT availability defined by schedule, max 8 sessions/day |
| BR-PT-004 | PT can modify own schedule min 24h in advance |

## States
No dedicated state machine. Schedule entries are active/inactive. Exception types: `unavailable`, `extra`.

## Key Flows

### PT Creates Schedule → Available Slots → Member Selects → Booking Created
1. PT creates weekly schedule via `POST /schedules` (e.g., Mon/Wed/Fri 9:00-17:00)
2. Optionally sets valid-from/valid-to date range
3. System generates `BookingSlot` records from schedule entries
4. If existing bookings exist for modified slots, check BR-PT-004 (≥24h)
5. Member queries `GET /schedules/available?pt=&date=` → sees open slots
6. Member selects slot → Booking module creates booking, slot reserved
7. PT can add exceptions for holidays, personal days, or extra availability

### Template Application
1. PT creates reusable template → `POST /schedule-templates`
2. PT applies template to date range → `POST /schedule-templates/:id/apply`
3. System creates schedule entries for each day in range matching template

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/schedules` | Required | PT, Admin | List schedules (filterable by PT) |
| POST | `/schedules` | Required | PT, Admin | Create schedule entry |
| GET | `/schedules/:id` | Required | PT, Admin | Get schedule entry |
| PUT | `/schedules/:id` | Required | PT, Admin | Update schedule entry |
| DELETE | `/schedules/:id` | Required | PT, Admin | Delete schedule entry |
| GET | `/schedules/available` | Public | — | Get available slots (PT x date) |
| POST | `/schedules/exceptions` | Required | PT, Admin | Add schedule exception |
| GET | `/schedule-templates` | Required | PT, Admin | List templates |
| POST | `/schedule-templates` | Required | PT, Admin | Create template |
| POST | `/schedule-templates/:id/apply` | Required | PT, Admin | Apply template to date range |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_REQUIRED_FIELD` | 400 | Missing required schedule fields |
| `VALIDATION_INVALID_FORMAT` | 400 | Invalid time range (end before start) |
| `SYSTEM_DATABASE_ERROR` | 500 | Database failure |

## Testing
- Schedule creation: overlapping time ranges → rejected
- BR-PT-002: schedule with >8 sessions/day → rejected
- BR-PT-004: modify slot <24h before → rejected; existing bookings flagged
- Exception handling: holiday blocks slot, extra slot adds availability
- Template apply: generates correct entries for date range
- Available slots query: excludes booked slots, respects exceptions
- Timezone handling across branches

## Future
- Auto-generate schedule from PT historical availability patterns
- Drag-and-drop schedule editor in admin panel
- PT leave management (vacation, sick leave) with auto-block
- Multi-branch schedule support
- Group class schedule management
