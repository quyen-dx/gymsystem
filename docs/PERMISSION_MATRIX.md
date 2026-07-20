# Permission Matrix — GymPro Gym Management System

> **Single source of truth** for authorization. All role-based access control (RBAC) decisions in the system MUST conform to this matrix.

---

## Roles

| Role | Description |
|------|-------------|
| `GUEST` | Unauthenticated / anonymous user |
| `MEMBER` | Active gym member with a membership plan |
| `PT` | Personal trainer employed by the gym |
| `STAFF` | Front-desk / administrative staff |
| `SELLER` | Shop / product sales personnel |
| `ADMIN` | General administrator |
| `SUPER_ADMIN` | System-wide super administrator (full access) |

**Key:** `-` = No access, `R` = Read, `C` = Create, `U` = Update, `D` = Delete.
Combinations (e.g. `CUD`) mean all listed permissions apply.

---

## Resource: Membership

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | R | - | - | R | R |
| View any | - | - | - | R | - | R | R |
| Create | - | - | - | C | - | C | C |
| Update own | - | - | - | - | - | - | - |
| Update any | - | - | - | - | - | U | U |
| Delete | - | - | - | - | - | - | D |
| Cancel own | - | C | - | - | - | C | C |
| Cancel any | - | - | - | - | - | C | C |
| Freeze own | - | C | - | - | - | C | C |
| Approve freeze | - | - | - | - | - | U | U |
| Process refund | - | - | - | - | - | U | U |

---

## Resource: Booking

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | R | - | - | R | R |
| View assigned | - | - | R | - | - | R | R |
| View all | - | - | - | R | - | R | R |
| Create | - | C | - | C | - | C | C |
| Confirm/reject | - | - | U | - | - | U | U |
| Cancel own | - | C | C | - | - | C | C |
| Cancel any | - | - | - | U | - | U | U |
| Mark no-show | - | - | U | - | - | U | U |

---

## Resource: Check-in

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | - | - | - | R | R |
| View any | - | - | - | R | - | R | R |
| Create (QR) | - | C | - | C | - | C | C |
| Manual check-in | - | - | - | C | - | C | C |

---

## Resource: Workout

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | - | - | - | R | R |
| View assigned | - | - | R | - | - | R | R |
| Create own | - | C | - | - | - | C | C |
| Create for member | - | - | C | - | - | C | C |
| Update own | - | U | - | - | - | U | U |
| Update any | - | - | U | - | - | U | U |
| Delete own | - | D | - | - | - | D | D |

---

## Resource: Payment

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | R | - | R | R | R |
| View all | - | - | - | - | - | R | R |
| Create payment | - | C | - | - | - | - | - |
| Process refund | - | - | - | - | - | U | U |
| View revenue | - | - | R | - | R | R | R |
| Export financials | - | - | - | - | - | R | R |

---

## Resource: Wallet

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | R | - | R | R | R |
| View all | - | - | - | - | - | R | R |
| Deposit | - | C | C | - | C | C | C |
| Withdraw | - | C | C | - | C | - | - |
| Transfer | - | C | C | - | C | - | - |
| Manual adjust | - | - | - | - | - | U | U |

---

## Resource: Shop & Products

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| Browse products | R | R | R | R | R | R | R |
| View own products | - | - | - | - | R | R | R |
| Create products | - | - | - | - | C | C | C |
| Update own products | - | - | - | - | U | U | U |
| Delete own products | - | - | - | - | D | D | D |
| Approve products | - | - | - | - | - | U | U |
| View orders own | - | R | - | - | R | R | R |
| View all orders | - | - | - | - | - | R | R |
| Process shipping | - | - | - | - | U | U | U |
| Process returns | - | - | - | - | - | U | U |
| Manage categories | - | - | - | - | - | CUD | CUD |

---

## Resource: Schedule

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | - | R | - | - | R | R |
| View all | - | R | R | R | - | R | R |
| Create own | - | - | C | - | - | C | C |
| Create any | - | - | - | C | - | C | C |
| Update own | - | - | U | - | - | U | U |
| Update any | - | - | - | U | - | U | U |

---

## Resource: User Management

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View profile own | - | R | R | R | R | R | R |
| View any profile | - | - | R | R | - | R | R |
| Create user | - | - | - | C | - | C | C |
| Update own profile | - | U | U | U | U | U | U |
| Update any profile | - | - | - | - | - | U | U |
| Delete user | - | - | - | - | - | - | D |
| Assign roles | - | - | - | - | - | - | U |

---

## Resource: System Settings

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View settings | - | - | - | - | - | R | R |
| Update settings | - | - | - | - | - | - | U |
| View logs | - | - | - | - | - | R | R |

---

## Resource: Notifications

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View own | - | R | R | R | R | R | R |
| View all | - | - | - | - | - | R | R |
| Send | - | - | - | - | - | C | C |
| Configure templates | - | - | - | - | - | U | U |

---

## Resource: Reports & Analytics

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View personal stats | - | R | R | - | R | R | R |
| View gym stats | - | - | - | - | - | R | R |
| Export reports | - | - | - | - | - | R | R |
| View financial reports | - | - | - | - | - | R | R |

---

## Resource: Content

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| View public | R | R | R | R | R | R | R |
| Create | - | - | - | - | - | C | C |
| Update | - | - | - | - | - | U | U |
| Delete | - | - | - | - | - | D | D |

---

## Resource: AI Assistant

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|--------|-------|--------|----|-------|--------|-------|-------------|
| Chat | - | C | C | C | C | C | C |
| View chat history | - | R | R | R | R | R | R |
| Admin override | - | - | - | - | - | U | U |

---

## Policy Overrides

1. **Admin override** — Admin inherits all permissions granted to MEMBER, PT, STAFF, and SELLER. The matrix for Admin is the ceiling; Admin may also perform actions marked only for lower roles unless explicitly forbidden.
2. **Super Admin override** — Super Admin inherits all permissions from every role and is never denied access. Super Admin is the only role with unconditional `Delete user` and `Assign roles` capabilities.
3. **Ownership override** — A user may always view and update their own data (profile, bookings, workouts, payments, wallet, notifications) regardless of role restrictions, **except** where access would expose financial audit data or system logs designated for ADMIN/SUPER_ADMIN only. Ownership does **not** confer delete permission unless explicitly granted.
4. **Staff override** — Staff inherits permissions from MEMBER for support scenarios (e.g., checking in a member, viewing a member's booking). Staff may **not** override PT or SELLER permissions.
5. **Guest isolation** — Guest permissions apply **only** to unauthenticated (anonymous) sessions. Once a user authenticates, their role-based permissions replace the Guest column entirely. Guest row entries outside of `View public` (`Shop & Products`) are effectively dead letters for authenticated users.

---

## Enforcement Notes

### Frontend (UI)
- All UI elements (buttons, links, tabs, routes) are conditionally rendered based on the authenticated user's role using a central `hasPermission(resource, action)` helper.
- If a user somehow navigates to a route they are not authorized for, a generic 404 or "Access Denied" page is shown — never the underlying data.
- The frontend MUST NOT rely on UI hiding as the sole security measure.

### Backend (API)
- Every API endpoint enforces authorization via a middleware layer that checks the request's role and the required resource + action against this matrix.
- Endpoints return **403 Forbidden** (never 404) when the user lacks permission, to avoid leaking resource existence.
- Parameterized ownership checks (e.g., `userId === req.user.id`) are applied for all "own" actions.

### AI / Permission Engine
- The AI Assistant's permission engine consults this matrix before any data access or mutation triggered by a chat request.
- AI-based admin override actions require explicit user confirmation with elevated authentication (re-verify password or 2FA).
- Chat history access is scoped to the requesting user unless the caller holds ADMIN or SUPER_ADMIN.

---

*This document is the authoritative source. Any discrepancy between code and this matrix is a bug — file an issue against the authorization module.*
