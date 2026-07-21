# Epic 3.3 — Discovery Report

**Date:** 2026-07-21  
**Scope:** Remaining Sprint 3 — Schedule enforcement (BR-PT-002 sub-rules, socket events)

---

## Coverage: ~60%

| Item | Status | Details |
|---|---|---|
| BR-PT-002: 8 sessions/day | ✅ Epic 3.1 | `checkPTDailySessionLimit` |
| BR-PT-002: 7-day schedule publish | ❌ Missing | Not enforced in `updatePTSchedule`, `setSchedule`, or `trainerScheduleService` |
| BR-PT-002: No session overlap | ❌ Not checked | `createBooking` only checks slot conflicts, not time-range overlap |
| BR-PT-004: 24h lock | ✅ Epic 3.1 | `updatePTSchedule` with `midnightNow` |
| Socket: schedule events | ❌ Missing | No schedule-specific socket events (only booking via 3.2) |

---

## Existing Assets (already covering Epic 3.3 partially)

| Category | Key Files |
|---|---|
| Models | `PTSchedule.js` (PT availability), `TrainerSchedule.js` (trainer work hours), `WorkoutSchedule.js` (member sessions) |
| Controllers | `ptController.js` (`updatePTSchedule`), `trainerScheduleController.js` (`setSchedule`), `scheduleController.js` |
| Services | `trainerScheduleService.js` (`setSchedule`, conflict validation) |
| Routes | `ptRoutes.js`, `trainerScheduleRoutes.js`, `scheduleRoutes.js` |

---

## Missing Business Rules

| # | Gap | Severity |
|---|---|---|
| 1 | **BR-PT-002**: 7-day forward publication window not enforced in any schedule endpoint | **HIGH** |
| 2 | **BR-PT-002**: Time-range overlap detection between PT sessions | **MEDIUM** |
| 3 | No schedule socket events (only booking events from 3.2) | **MEDIUM** |

---

## Files to Modify

| File | Change |
|---|---|
| `src/controllers/ptController.js:updatePTSchedule` | Add 7-day guard for new schedule entries |
| `src/services/trainerScheduleService.js:setSchedule` | Add 7-day guard |
| `src/services/socketService.js` | Add `emitScheduleChanged` |

## Files to Create

None required.

---

## Recommended Approach: **Option 3 — Patch**

Only 3 gaps remain. Two guard additions (7-day rule) + one socket emitter. No new models or endpoints needed. Matches Epic 3.1/3.2 pattern.
