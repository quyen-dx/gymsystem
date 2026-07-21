# Epic 6.2 Discovery: Dashboard

**Coverage: ~5%** — No dashboard service, controller, or routes exist. `reportRoutes.js` has 6 stubs returning 501. Legacy `reportController.js` has partial `getRevenueReport` but is orphaned (not wired).

## Existing (None)
No dashboard infrastructure exists. Existing per-module endpoints provide raw data but no aggregation layer.

## Scope (from IMPLEMENTATION_SEQUENCE)
Role-based views: member, PT, staff, admin, super_admin. Aggregates membership, booking, check-in, payment, shop data.

## Files to Create (3)
| File | Purpose |
|------|---------|
| `src/services/dashboardService.js` | Per-role aggregation queries |
| `src/controllers/dashboardController.js` | Role-gated handlers |
| `src/routes/dashboardRoutes.js` | `GET /api/dashboard/:role` |

## Files to Modify (1)
| File | Change |
|------|--------|
| `src/app.js` | Mount dashboard routes |

## Key Per-Role Views
| Role | Needs from prior sprints |
|------|--------------------------|
| Member | Personal: check-ins, bookings, membership, orders |
| PT | Assigned members, sessions, upcoming bookings |
| Admin | Revenue, membership counts, check-in stats, trainer perf |

## Recommendation: Option 1 (Greenfield)
No existing infrastructure to patch. Build focused dashboardService with per-role aggregation, single `/api/dashboard` endpoint group, mount in app.js.
