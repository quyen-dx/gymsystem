# User Management Module

- **Owner**: Core Services Team
- **Dependencies**: Auth Module (User model)
- **Related Documents**: ROLE_PERMISSIONS_MATRIX.md

## Purpose

Manage user profiles, role assignments, and account lifecycle across the system. Provides admin interfaces for creating staff/trainer accounts, assigning roles, suspending or deleting users, as well as self-service profile management.

## Models

- **User** (defined in Auth Module): Primary user entity. Fields relevant to management include id, email, name, phone, avatar, role, status (active, suspended, deleted), emailVerifiedAt, lastLoginAt, and timestamps.
- *(No additional models — this module extends the Auth User model with management operations.)*

## Services

- **userService**: Core user profile operations. Handles profile updates (self and admin), account status transitions, user search and filtering. Enforces status transition rules (active ↔ suspended, active → deleted). Integrates with Auth module for email verification and password management.
- **adminService**: Admin-specific operations. Creates staff accounts, trainer accounts, and other non-member user types. Manages role assignments with Super Admin oversight. Provides user listing with advanced filtering (by role, status, registration date, search term).

### Account Status Lifecycle

```
Registration → active ↔ suspended
                   ↘ deleted (soft)
```

- **active**: Normal operational state.
- **suspended**: User cannot log in or access the system. Data preserved.
- **deleted**: Soft delete. User cannot log in; profile anonymized after grace period.

### Role Assignment Rules

| Operation | Performed By | Notes |
|-----------|-------------|-------|
| Assign member role | System | Auto-assigned on registration |
| Assign staff/trainer role | Admin | Admin creates staff/PT accounts |
| Assign admin role | Super Admin | Only Super Admin can grant admin |
| Change admin role | Super Admin | Only Super Admin can modify admins |
| Cannot self-demote | — | Super Admin cannot remove own role; requires another Super Admin |

## Key Flows

1. **Admin Creates Staff Account**: Admin fills staff creation form → adminService creates user with staff role → welcome email sent → staff sets password via invitation link.
2. **Suspend User**: Admin suspends account → userService updates status to suspended → active sessions invalidated → user cannot log in → suspension reason logged.
3. **Self Profile Update**: User edits own profile → userService validates fields → updates user record → returns updated profile.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users | Admin | List users (paginated, filterable by role, status, search) |
| GET | /users/:id | Admin | Get user details (any user) |
| PUT | /users/:id | Admin | Update user (role, status, profile fields) |
| DELETE | /users/:id | Super Admin | Soft delete user |
| PUT | /users/profile | User | Update own profile (name, phone, avatar) |
| GET | /users/profile | User | Get own profile |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| USR_001 | User not found | Specified user ID does not exist |
| USR_002 | Invalid status transition | e.g. deleted → active not allowed |
| USR_003 | Cannot suspend super admin | Super Admin accounts cannot be suspended |
| USR_004 | Insufficient permissions | User cannot perform the requested role assignment |
| USR_005 | Cannot self-delete | User cannot delete own account via this endpoint |
| USR_006 | Email already exists | Cannot update email to one already in use |

## Future

- Bulk user import via CSV
- User activity log (login history, action audit)
- Account merge for duplicate users
- GDPR/privacy data export and deletion workflows
- Two-factor authentication enforcement per role
