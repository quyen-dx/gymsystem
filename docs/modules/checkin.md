# Check-in Module

- **Owner**: Core Team
- **Dependencies**: Auth (User), Membership
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md)

## Purpose
Handles member check-in at the gym entrance via QR code scanning. Manages membership activation on first check-in, daily attendance tracking, streak calculation, and enforces check-in policies such as operating hours and daily limits.

## Models
| Model | Description |
|---|---|
| `CheckIn` | Individual check-in record: member, timestamp, membership, branch, QR token used |
| `AttendanceLog` | Aggregated attendance data per member per day |
| `CheckInStreak` | Derived read-only view of consecutive daily check-in count |

## Services
| Service | Key Methods |
|---|---|
| `checkinService` | `checkIn()`, `getHistory()`, `validateQR()`, `validateOperatingHours()`, `canCheckIn()` |
| `streakService` | `getStreak()`, `recalculateStreak()`, `getLeaderboard()`, `getStreakMilestones()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `checkinController` | `POST /checkin`, `GET /checkin/history`, `GET /checkin/streak` |

## Business Rules
| Rule | Description |
|---|---|
| BR-CHK-001 | QR code required for check-in; single-use within 30-second window |
| BR-CHK-002 | Auto-activates pending membership on first check-in |
| BR-CHK-003 | Streak tracking: consecutive calendar days only |
| BR-CHK-004 | Daily check-in limit: once per membership per day |
| BR-CHK-005 | Check-in window: gym operating hours only |
| BR-MEM-002 | Pending activation auto-activates on first check-in |

## States
No dedicated state machine. Integrates with Membership Cycle State Machine (`PENDING_ACTIVATION` → `ACTIVE` transition via BR-CHK-002).

## Key Flows

### QR Scan → Validate Membership → Record Check-in → Update Streak → Notify
1. Staff scans member QR code from mobile app → `POST /checkin`
2. Validate QR: exists, not expired (30s window per BR-CHK-001), single use
3. Validate membership: status `active` or `pending`, not expired
4. Validate operating hours (BR-CHK-005)
5. Validate daily limit (BR-CHK-004): no existing check-in today
6. If membership is `PENDING_ACTIVATION` → activate per BR-CHK-002
7. Create `CheckIn` record with timestamp
8. Recalculate streak (BR-CHK-003): count consecutive days back from today
9. Send in-app notification to member with current streak info
10. Return success response with streak data

### Streak Calculation
1. `streakService.getStreak(memberId)` queries check-ins ordered by date DESC
2. Counts consecutive calendar days backward from `CURRENT_DATE`
3. If today's check-in missing and current time > operating hours → streak = 0 for yesterday
4. Milestone rewards configured: 7, 14, 30, 60, 90, 180, 365 days

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/checkin` | Required | Staff | Record member check-in via QR |
| GET | `/checkin/history` | Required | Member, Staff | Get check-in history (paginated) |
| GET | `/checkin/streak` | Required | Member | Get current streak and milestones |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `CHECKIN_INVALID_QR` | 400 | QR code unrecognized or forged |
| `CHECKIN_ALREADY_CHECKED` | 409 | Member already checked in today |
| `CHECKIN_MEMBERSHIP_EXPIRED` | 403 | Membership expired at time of check-in |
| `CHECKIN_OUTSIDE_HOURS` | 422 | Outside facility operating hours |

## Testing
- BR-CHK-001: expired QR (31s old) → rejected; invalid token → rejected
- BR-CHK-002: first check-in with pending membership → activated
- BR-CHK-003: check-in Mon-Tue-Wed → streak 3; skip Thu → reset to 1 on Fri
- BR-CHK-004: double check-in same day → rejected
- BR-CHK-005: check-in before open / after close → rejected
- Trial membership check-in count enforcement (BR-MEM-008)
- Offline backup mode: queue check-ins, process on reconnect

## Future
- Facial recognition check-in
- NFC / biometric scanner integration
- Entry gate hardware API integration
- Check-in rewards / gamification (badge system)
- Real-time capacity tracking per branch
