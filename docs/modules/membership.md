# Membership Module

- **Owner**: Core Team
- **Dependencies**: Auth (User), Payment
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md), [MEMBERSHIP_SYSTEM_ARCHITECTURE.md](../MEMBERSHIP_SYSTEM_ARCHITECTURE.md)

## Purpose
Manages the full lifecycle of gym memberships including plan definitions, purchase, activation, freeze, cancellation, renewal, and refund. Supports multiple membership types (regular, trial) with cycle-based tracking and automated expiry notifications.

## Models
| Model | Description |
|---|---|
| `MembershipPlan` | Available plans: name, duration, price, max freezes, trial flags, features |
| `MembershipCycle` | Individual membership instance: status, start/end dates, cycle number, root plan reference |
| `MembershipFreeze` | Freeze request records: start/end dates, reason, status |
| `MembershipCancellationRequest` | Cancellation requests with reason, admin approval status, refund calculation |
| `MembershipDiscount` | Promotional discounts/coupons applicable to plan purchases |

## Services
| Service | Key Methods |
|---|---|
| `membershipService` | `buyPlan()`, `renew()`, `getActiveMembership()`, `validateMembership()` |
| `membershipCycleService` | `createCycle()`, `activateCycle()`, `expireCycle()`, `getCycleHistory()` |
| `membershipPlanService` | `listPlans()`, `getPlan()`, `createPlan()`, `updatePlan()`, `toggleActive()` |
| `freezeService` | `requestFreeze()`, `approveFreeze()`, `cancelFreeze()`, `getFreezeHistory()` |
| `cancellationService` | `requestCancellation()`, `approveCancellation()`, `calculateRefund()`, `processRefund()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `membershipController` | `GET /memberships`, `POST /memberships/buy-plan`, `GET /memberships/my-cycles`, `POST /memberships/renew` |
| `membershipPlanController` | `CRUD /admin/membership-plans` |
| `freezeController` | `POST /memberships/freeze`, `GET /memberships/freeze-history` |
| `cancellationController` | `POST /memberships/cancel/:cycleId`, `PUT /admin/cancellations/:id/approve` |

## Business Rules
| Rule | Description |
|---|---|
| BR-MEM-001 | One active membership per member |
| BR-MEM-002 | Pending activation auto-activates on first check-in or after payment |
| BR-MEM-003 | Renewal creates pending cycle up to max 3 pending |
| BR-MEM-004 | Freeze max 2 per cycle, max 30 days per freeze, min 7 days between freezes |
| BR-MEM-005 | Cancellation requires admin approval if activated |
| BR-MEM-006 | Refund calculation (full, prorated, or none based on timing) |
| BR-MEM-007 | Expiry notification sent 7, 3, and 1 day before |
| BR-MEM-008 | Trial period rules (no booking, limited check-ins, single use per lifetime) |

## States
See STATE_MACHINES.md §1 — Membership Cycle State Machine.

States: `PENDING_ACTIVATION` → `ACTIVE` → `FROZEN` / `EXPIRED` / `CANCELLED` → `REFUNDED`

## Key Flows

### Buy Plan → Payment → Pending Activation → Active
1. Member selects plan → `POST /memberships/buy-plan`
2. System creates `MembershipCycle` with status `PENDING_ACTIVATION`
3. Payment initiated via Payment module
4. On payment success → membership remains `PENDING_ACTIVATION`
5. On first check-in (BR-MEM-002) → status becomes `ACTIVE`, activation date set
6. Expiry date = activation date + plan duration

### Freeze Request
1. Member requests freeze → validate BR-MEM-004 (max 2 per cycle, ≤30 days, ≥7 day gap)
2. Freeze record created with status `REQUESTED`
3. System auto-approves → status `APPROVED`
4. On start date → status `ACTIVE`, membership clock paused
5. On end date → membership clock resumes, expiry extended by freeze duration

### Cancellation
1. Member requests cancellation → `POST /memberships/cancel/:cycleId`
2. If `PENDING_ACTIVATION` → auto-cancel (no admin needed)
3. If `ACTIVE` → admin approval required (BR-MEM-005)
4. Refund calculated per BR-MEM-006
5. On approval → cycle set to `CANCELLED`, refund processed via Payment module

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/memberships` | Required | All | List available membership plans |
| POST | `/memberships/buy-plan` | Required | Member | Purchase a membership plan |
| GET | `/memberships/my-cycles` | Required | Member | Get user's membership cycle history |
| POST | `/memberships/cancel/:cycleId` | Required | Member | Request cancellation |
| POST | `/memberships/freeze` | Required | Member | Request freeze |
| POST | `/memberships/renew` | Required | Member | Renew current membership |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `MEMBERSHIP_NOT_FOUND` | 404 | Membership record not found |
| `MEMBERSHIP_EXPIRED` | 422 | Membership has passed end date |
| `MEMBERSHIP_ALREADY_ACTIVE` | 409 | User already holds an active membership |
| `MEMBERSHIP_MAX_RENEWAL` | 422 | Renewal limit reached |
| `MEMBERSHIP_INVALID_STATE` | 409 | State transition not allowed |

## Testing
- Purchase flow: successful buy → payment → activation chain
- BR-MEM-001: attempt second active membership → rejected
- BR-MEM-004: freeze limits, freeze during freeze, back-to-back freezes
- BR-MEM-005: pending vs active cancellation paths
- BR-MEM-006: full refund (≤7d unactivated), prorated refund, no refund (≥50% consumed)
- BR-MEM-007: expiry notification cron at 7, 3, 1 days
- Trial restrictions (BR-MEM-008): no booking, max 3 check-ins, single lifetime

## Future
- Family / group membership plans
- Membership upgrade (pro-rate diff, change mid-cycle)
- Automated membership upsell based on attendance patterns
- Multi-branch membership with branch-specific pricing
