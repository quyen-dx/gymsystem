# Epic 3.1 — Discovery Report: PT Management

**Date:** 2026-07-21  
**Scope:** PT profiles, specializations, assignments — BR-PT-001 through BR-PT-004  
**Status:** Survey Complete

---

## 1. Current Coverage

| Metric | Value |
|---|---|
| **Overall** | **~65%** |
| BR-PT-001 (max 10 members) | 0% — no enforcement anywhere |
| BR-PT-002 (max 8 sessions/day) | 0% — no enforcement anywhere |
| BR-PT-003 (self-booking) | 100% — `checkSelfBooking` in bookingController.js |
| BR-PT-004 (24h schedule lock) | 50% — blanket block exists but granular slot locking + affected bookings notification missing |

---

## 2. Existing Assets (already cover ~65%)

| Layer | Files | Status |
|---|---|---|
| Models | `PT.js` (52 lines), `PTAssignment.js` (26 lines), `PTSchedule.js` (27 lines), `Specialization.js` (15 lines), plus 9+ related models | Complete |
| Services | `ptService.js` (86 lines, 1 export: `getAvailablePTs`) | Thin — most logic in controller |
| Controllers | `ptController.js` (709 lines, 10 handlers) | Complete |
| Routes | `ptRoutes.js` (37 lines, 12 endpoints) | Complete |

---

## 3. Missing Business Rules

| Rule | Gap |
|---|---|
| BR-PT-001 | No check on booking creation or assignment start: `countDocuments({ ptId, status: 'confirmed', date: { $gte: 30d ago } }).distinct('memberId') >= 10` |
| BR-PT-002 | No check on booking creation: `countDocuments({ ptId, date, status: { $nin: ['cancelled','rejected'] } }) >= 8` |
| BR-PT-004 | Current 24h block is all-or-nothing (keeps whole schedule if ANY booking in 24h). Should lock only affected slots + notify PT of impacted bookings |

Note: BR-PT-005 and BR-PT-006 are referenced in `IMPLEMENTATION_SEQUENCE.md` but not defined in `BUSINESS_RULES.md` — specification gap, not implementation gap.

---

## 4. Files to Modify

| File | Line Count | Changes |
|---|---|---|
| `src/services/ptService.js` | 86 | Extract `getActiveMemberCount(ptId)`, `getDailySessionCount(ptId, date)` from thin controller logic |
| `src/controllers/ptController.js` | 709 | Fix BR-PT-004: granular slot lock instead of blanket block; add affected bookings notification |
| `src/controllers/bookingController.js` | 1033 | Add BR-PT-001 and BR-PT-002 guards to `createBooking`, `createRecurringBooking`, `scheduleWeeklyBooking` |

---

## 5. Files to Create

| File | Purpose |
|---|---|
| None | No new models/routes/controllers needed. Insertion points exist in bookingController for BR-PT-001/002. |

---

## 6. Recommendation: **Option 3 — Patch Existing Services**

**Rationale:**
- Infrastructure is complete — 13 PT models, 12 endpoints, 709-line controller all working
- Gaps are 3 guard conditions that fit within existing insertion points
- No new files needed (BR-PT-001/002 reuse existing Booking queries)
- BR-PT-003 already shipped in Epic 2.8
- BR-PT-004 needs a granularity fix, not a rewrite

**Estimated effort:** 2 guard functions in ptService.js + 2 guard calls in bookingController.js + 1 schedule granularity fix in ptController.js.

---

## 7. Confidence: **HIGH**

All insertion points are known. BR-PT-001/002 are DB count queries before existing booking write. BR-PT-004 is a loop-level check instead of a blanket block. Infrastructure supports all enforcement with zero new models.
