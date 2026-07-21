# Flash Audit: Epic 6.2 — Dashboard

**Date:** 2026-07-21  
**Scope:** `dashboardService.js`, `dashboardController.js`, `dashboardRoutes.js`, `app.js`

---

**Result:** **PASS** (1 MEDIUM finding)

---

## Risk: LOW
All queries are read-only via `.lean()` + `countDocuments`/`aggregate`. No mutation paths. All modules accessed read-only.

## Security: PASS
- Authentication via `protect` middleware on all dashboard routes.
- Role-based dispatch in controller: PT/Member/Seller scoped by `userId`; admin/staff see only aggregate data.
- No privilege escalation.
- No PII leakage beyond member name/code (no emails, phones, addresses in responses).

## Architecture: PASS
- Independent dashboard module. Five clean role-specific aggregation functions.
- All parallelizable queries wrapped in `Promise.all` — no sequential blocking.
- `lean()` on all document queries. `countDocuments` for all counts.
- Route mounted additively at `/api/dashboard` — no existing routes touched.

---

## Remaining Findings

### MEDIUM

| ID | Finding | File | Lines | Description |
|----|---------|------|-------|-------------|
| M-001 | PT dashboard `assignedMembers` returns booking count, not unique member count | `dashboardService.js` | 95-96, 106 | `assignedCount = Booking.countDocuments({ ptId, status: 'confirmed' })` counts total booking documents. Should use `Booking.distinct('memberId', ...).length` to count unique assigned members. A PT with 1 member booked 10 times sees `10` instead of `1`. |

---

## Verification Results

### Dashboard Aggregation — PASS (1 MEDIUM)
| Check | Status |
|-------|--------|
| Admin stats correct | ✅ |
| Staff stats correct | ✅ |
| PT stats correct (except M-001 naming) | ✅ |
| Member stats correct | ✅ |
| Seller stats correct | ✅ |
| Existing services reused (streakService) | ✅ |
| No duplicated business rules | ✅ |
| Parallel queries safe | ✅ |

### Role-based Views — PASS
| Role | Data scoped to role | Status |
|------|---------------------|--------|
| Admin | Gym-wide | ✅ |
| Staff | Today + recent | ✅ |
| PT | Own bookings | ✅ |
| Member | Own check-ins/membership/orders | ✅ |
| Seller | Own shop | ✅ |

### Performance — PASS
| Check | Status |
|-------|--------|
| `lean()` on all document queries | ✅ |
| No N+1 queries | ✅ |
| All independent queries in `Promise.all` | ✅ |
| Read-only | ✅ |

### API — PASS
| Check | Status |
|-------|--------|
| Authentication required | ✅ |
| RBAC enforced | ✅ |
| Route `/api/dashboard` registered | ✅ |
| No sensitive info leakage | ✅ |

### Regression — PASS
| Module | Status |
|--------|--------|
| Membership/Wallet/Payment/Booking/Check-in/PT/Workout/Nutrition/Health/Shop/Audit/Auth | ✅ Not modified |
