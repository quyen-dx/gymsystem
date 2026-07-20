# Booking Module

- **Owner**: PT Team
- **Dependencies**: Auth (User), Membership, Schedule
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md)

## Purpose
Manages personal training session bookings including single and recurring sessions, PT confirmation workflow, waitlist management, violation tracking for no-shows, and cancellation policies with penalty fee handling.

## Models
| Model | Description |
|---|---|
| `Booking` | Session booking: member, PT, date, time slot, status, price, penalty |
| `BookingSlot` | Available time slots generated from PT schedule |
| `BookingRecurringPattern` | Recurring booking definition: day-of-week, time, number of weeks |
| `BookingWaitlist` | Waitlist entries when a slot is unavailable |
| `BookingViolation` | No-show / late-cancel violation records with rolling 90-day window |

## Services
| Service | Key Methods |
|---|---|
| `bookingService` | `createBooking()`, `cancelBooking()`, `confirmBooking()`, `completeBooking()`, `markNoShow()` |
| `bookingSlotService` | `getAvailableSlots()`, `reserveSlot()`, `releaseSlot()`, `generateSlotsFromSchedule()` |
| `recurringService` | `createRecurringPattern()`, `cancelRecurringPattern()`, `generateOccurrences()` |
| `waitlistService` | `joinWaitlist()`, `leaveWaitlist()`, `promoteFromWaitlist()`, `getWaitlistPosition()` |
| `violationService` | `recordViolation()`, `checkViolationThreshold()`, `applyBookingBlock()`, `expireViolations()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `bookingController` | CRUD `/bookings`, `PUT /bookings/:id/status`, `GET /bookings/my-bookings`, `GET /bookings/available` |
| `waitlistController` | `POST /bookings/:id/waitlist`, `DELETE /bookings/:id/waitlist` |

## Business Rules
| Rule | Description |
|---|---|
| BR-BKG-001 | Booking window max 30 days ahead |
| BR-BKG-002 | Member must have active membership to book |
| BR-BKG-003 | Max 1 booking per slot per PT per time |
| BR-BKG-004 | Cancellation by member: free up to 2 hours before; penalty fee after |
| BR-BKG-005 | No-show penalty: 1 violation point, auto-cancellation after 3 violations within 90 days |
| BR-BKG-006 | PT can confirm/reject booking within 1 hour; auto-confirm on timeout |
| BR-BKG-007 | Recurring booking rules: max 4 weeks, same day/time, full membership coverage |

## States
See STATE_MACHINES.md §2 — Booking State Machine.

States: `PENDING` → `CONFIRMED` → `COMPLETED` / `CANCELLED` / `NOSHOW`

## Key Flows

### Member Books → PT Confirms → Session → Completed
1. Member views available slots → `GET /bookings/available`
2. Member selects slot → `POST /bookings` (validates BR-BKG-001, BR-BKG-002, BR-BKG-003)
3. Booking created with status `PENDING`
4. PT receives notification; has 1 hour to confirm/reject (BR-BKG-006)
5. If PT confirms → status `CONFIRMED`, slot locked
6. If PT rejects → full refund, booking cancelled
7. If PT does nothing → auto-confirm after 1 hour
8. Session occurs; attendance marked → status `COMPLETED`
9. No-show → status `NOSHOW`, violation recorded (BR-BKG-005)

### Cancellation Flow
1. Member cancels → `PUT /bookings/:id/status` with action `cancel`
2. If ≥2 hours before session → full refund, status `CANCELLED`
3. If <2 hours before session → 50% penalty deducted, status `CANCELLED_WITH_PENALTY`

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/bookings` | Required | All | List bookings (filtered by role) |
| POST | `/bookings` | Required | Member, PT | Create booking |
| GET | `/bookings/:id` | Required | All | Get booking details |
| PUT | `/bookings/:id` | Required | Member, PT | Update booking |
| DELETE | `/bookings/:id` | Required | Member, PT | Cancel booking |
| PUT | `/bookings/:id/status` | Required | PT, Admin | Confirm/reject/complete booking |
| GET | `/bookings/my-bookings` | Required | Member | Get current user's bookings |
| GET | `/bookings/available` | Required | Member | Get available time slots |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `BOOKING_SLOT_UNAVAILABLE` | 409 | Requested time slot is fully booked |
| `BOOKING_TIME_CONFLICT` | 409 | Overlapping booking exists |
| `BOOKING_PAST_CANCELLATION` | 422 | Cancellation window has passed |
| `BOOKING_MEMBERSHIP_REQUIRED` | 403 | Active membership needed to book |

## Testing
- BR-BKG-001: booking date >30 days out → rejected
- BR-BKG-002: no active membership → rejected
- BR-BKG-003: double-book same PT/slot → rejected
- BR-BKG-004: cancel 3h before (free) vs 30min before (penalty)
- BR-BKG-005: 3 no-shows in 90 days → booking block
- BR-BKG-006: PT rejection → full refund; auto-confirm after 1h
- BR-BKG-007: recurring >4 weeks → rejected; lapsed membership mid-series
- Waitlist promotion when slot becomes available

## Future
- Group class bookings (yoga, HIIT, etc.)
- Calendar sync (Google Calendar, Outlook)
- AI-based PT scheduling optimization
- Member preference learning (favourite PT, time slots)
