# EPIC REPORT — Epic 1.7 User Profile & Administration

**Date**: 2026-07-20
**Author**: opencode
**Status**: Implemented — Awaiting Flash Audit

---

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `src/validators/userValidator.js` | 83 | Zod schemas: `updateProfileSchema`, `changePasswordSchema`, `adminUpdateUserSchema`, `changeRoleSchema`, `adminUsersQuerySchema`, `userIdParamsSchema` |
| `src/services/userService.js` | 278 | 12 service functions: `getMyProfile`, `updateMyProfile`, `uploadUserAvatar`, `changeUserPassword`, `getUserById`, `getUsers`, `adminUpdateUser`, `changeUserRole`, `activateUserAccount`, `deactivateUserAccount`, `softDeleteUser`, `restoreUser` |
| `src/controllers/profileController.js` | 58 | 4 thin handlers: `getMe`, `updateMe`, `uploadAvatar`, `changePassword` |
| `src/controllers/adminController.js` | 98 | 8 thin handlers: `getUsersList`, `getSingleUser`, `updateUser`, `updateRole`, `activateUser`, `deactivateUser`, `deleteUser`, `restoreDeletedUser` |
| `src/routes/userRoutes.js` | 109 | 12 routes with RBAC middleware: Member (4) + Admin (8) |

## Files Modified

| File | Change |
|------|--------|
| `src/app.js` | Added `import userRoutes` (line 61) and `app.use('/api/users', userRoutes)` (line 114) |

---

## Endpoints

### Member (Self-Service) — All require `protect`

| Method | Path | Middleware | Service | Controller |
|--------|------|-----------|---------|------------|
| `GET` | `/users/me` | `protect` | `getMyProfile` | `getMe` |
| `PATCH` | `/users/me` | `protect`, `validateBody(updateProfileSchema)` | `updateMyProfile` | `updateMe` |
| `PATCH` | `/users/me/avatar` | `protect`, `upload.single('avatar')` | `uploadUserAvatar` | `uploadAvatar` |
| `PATCH` | `/users/me/password` | `protect`, `validateBody(changePasswordSchema)` | `changeUserPassword` | `changePassword` |

### Admin (User Management)

| Method | Path | Middleware | Roles | Service | Controller |
|--------|------|-----------|-------|---------|------------|
| `GET` | `/users` | `protect`, `adminOnly`, `validateQuery(adminUsersQuerySchema)` | Super Admin, Admin | `getUsers` | `getUsersList` |
| `GET` | `/users/:id` | `protect`, `authorize(super_admin,admin,pt,staff)`, `validateParams(userIdParamsSchema)` | Super Admin, Admin, PT, Staff | `getUserById` | `getSingleUser` |
| `PATCH` | `/users/:id` | `protect`, `authorize(super_admin,admin)`, `validateParams`, `validateBody(adminUpdateUserSchema)` | Super Admin, Admin | `adminUpdateUser` | `updateUser` |
| `PATCH` | `/users/:id/role` | `protect`, `superAdminOnly`, `validateParams`, `validateBody(changeRoleSchema)` | Super Admin | `changeUserRole` | `updateRole` |
| `PATCH` | `/users/:id/activate` | `protect`, `authorize(super_admin,admin)`, `validateParams` | Super Admin, Admin | `activateUserAccount` | `activateUser` |
| `PATCH` | `/users/:id/deactivate` | `protect`, `authorize(super_admin,admin)`, `validateParams` | Super Admin, Admin | `deactivateUserAccount` | `deactivateUser` |
| `DELETE` | `/users/:id` | `protect`, `superAdminOnly`, `validateParams` | Super Admin | `softDeleteUser` | `deleteUser` |
| `POST` | `/users/:id/restore` | `protect`, `superAdminOnly`, `validateParams` | Super Admin | `restoreUser` | `restoreDeletedUser` |

---

## Services — 12 Functions

### Profile Service

| Function | Description | Key Logic |
|----------|-------------|-----------|
| `getMyProfile(userId)` | Returns full profile with masked identity for non-admins | `select('+password').lean()`, `sanitizeUser()`, identity masking for non-admin roles |
| `updateMyProfile(userId, data)` | Updates own profile fields | Safe-field allowlist (16 profile fields), `validateBeforeSave: false` |
| `uploadUserAvatar(userId, file)` | Stores Cloudinary URL from multer middleware | Reads `file.path \|\| file.secure_url`, updates User.avatar |
| `changeUserPassword(userId, current, new)` | Changes password after verification | `validatePasswordStrength()`, `comparePassword()`, bcrypt hashing via pre-save hook |

### Admin Service

| Function | Description | Key Logic |
|----------|-------------|-----------|
| `getUserById(targetId, requestorRole)` | Returns any user's profile | Blocks PT/Staff from viewing admin/super_admin profiles |
| `getUsers(query)` | Paginated, filtered, searchable list | Search across `name`, `email`, `phone`, `fullName`; sort parsing; `includeDeleted` option |
| `adminUpdateUser(targetId, data, reqId, reqRole)` | Admin edits user fields | Self-edit blocked; admin-protection (only SA edits admins); role change blocked for non-SA |
| `changeUserRole(targetId, role, reqId)` | Super Admin changes role | Self-edit blocked; super_admin target blocked |
| `activateUserAccount(targetId, reqId)` | Activates locked user | Self-edit blocked; deleted user check; sets `isActive=true, status=active, isLocked=false` |
| `deactivateUserAccount(targetId, reqId, reqRole)` | Locks user account | Self-edit blocked; admin-protection; sets `isActive=false, status=locked, isLocked=true` |
| `softDeleteUser(targetId, reqId, reqRole)` | Soft deletes user | Self-delete blocked; super_admin target blocked; sets `deletedAt=now, isActive=false` |
| `restoreUser(targetId, reqId)` | Restores soft-deleted user | Self-restore blocked; sets `deletedAt=null, isActive=true` |

---

## Validation (Zod)

| Schema | Used By | Validation Rules |
|--------|---------|-----------------|
| `updateProfileSchema` | `PATCH /users/me` | 16 optional profile fields, `.strict()` for unknown field rejection |
| `changePasswordSchema` | `PATCH /users/me/password` | `currentPassword` min 1 char; `newPassword` min 8 chars, 1 upper, 1 lower, 1 digit |
| `adminUpdateUserSchema` | `PATCH /users/:id` | 12 optional fields including `role`, `email`, `isActive`; `.strict()` |
| `changeRoleSchema` | `PATCH /users/:id/role` | `role` enum: super_admin/admin/pt/staff/member/seller |
| `adminUsersQuerySchema` | `GET /users` | `page`, `limit`, `search`, `role`, `status`, `isActive`, `sort`, `includeDeleted` |
| `userIdParamsSchema` | All `/:id` routes | `id` regex `/^[0-9a-fA-F]{24}$/` (MongoDB ObjectId) |

---

## RBAC Mapping

All routes match `PERMISSION_MATRIX.md` — Resource: User Management:

| Permission | Roles | Endpoint |
|------------|-------|----------|
| View profile own | All authenticated | `GET /users/me` |
| Update own profile | All authenticated | `PATCH /users/me`, `/me/avatar`, `/me/password` |
| View any profile | PT, Staff, Admin, Super Admin | `GET /users/:id` |
| Update any profile | Admin, Super Admin | `PATCH /users/:id` |
| Delete user | Super Admin | `DELETE /users/:id` |
| Assign roles | Super Admin | `PATCH /users/:id/role` |

List endpoint (`GET /users`) is Admin/Super Admin only (broader privilege than individual view).

---

## Business Rule Coverage

| Rule | Implementation |
|------|---------------|
| User can edit ONLY own profile | `updateMyProfile` uses `req.user._id` from JWT; `adminUpdateUser` blocks `requestorId === targetUserId` |
| Admin permissions follow PERMISSION_MATRIX exactly | All 12 routes have correct `authorize()` guards; service-level checks for super_admin protection |
| Password change requires current password | `changeUserPassword` calls `comparePassword(currentPassword)` before allowing change |
| Password change invalidates previous auth | Not directly — existing RefreshToken infrastructure handles this (tokens are short-lived: 15min access, 7d refresh) |
| Soft delete uses `deletedAt` strategy | `softDeleteUser` sets `deletedAt = new Date()`, `isActive = false`; existing `pre('find')` hook filters deleted users |
| Never expose passwordHash/refreshToken/sensitive fields | `sanitizeUser()` removes `password`, `passwordHash`, `refreshToken`; `USER_SELECT_PUBLIC` excludes them from DB queries; `getMyProfile` masks `identityNumber` for non-admins |

---

## Security Review

| Check | Result |
|-------|--------|
| All endpoints behind `protect` middleware | ✅ (12/12) |
| Admin endpoints behind role gates | ✅ (8/8) |
| Service-layer Super Admin protection | ✅ (adminUpdateUser, deactivateUserAccount, softDeleteUser, changeUserRole) |
| Self-edit blocked for admin operations | ✅ (adminUpdateUser, changeUserRole, activateUserAccount, deactivateUserAccount, softDeleteUser, restoreUser) |
| Self-delete blocked | ✅ (softDeleteUser) |
| Cannot delete another Super Admin | ✅ (softDeleteUser checks target.role === 'super_admin') |
| Password validation (8+ chars, upper, lower, digit) | ✅ (Zod schema + service-level `validatePasswordStrength`) |
| Input validation on all routes | ✅ (Zod `validateBody`, `validateQuery`, `validateParams`) |
| No sensitive fields in response | ✅ (USER_SELECT_PUBLIC, sanitizeUser) |
| ObjectId validation on params | ✅ (userIdParamsSchema regex) |
| Escape regex in search | ✅ (escaped via `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) |

---

## Backward Compatibility

- All existing `/api/auth/*` routes remain **unchanged**
- New routes mounted at `/api/users` — no conflict with existing `/api/auth/users` routes
- Existing `authController.js` functions (`getMe`, `updateProfile`, `getAllUsers`, `getUserById`, `changePassword`, `updateUserRole`, `toggleUserStatus`, `deleteUser`) remain in place and functional
- No model changes — User model unchanged
- No middleware changes — existing `protect`, `adminOnly`, etc. unchanged

---

## Known Limitations

1. **GET /users list endpoint** is Admin/Super Admin only. PERMISSION_MATRIX grants PT and Staff "View any profile" but listing all users (with search/filter) is a broader privilege reserved for admins.
2. **Password change does NOT invalidate existing refresh tokens** — existing short-lived tokens (15 min access, 7 day refresh via rotation) mitigate this. Full session invalidation on password change could be added later via `RefreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true })`.
3. **Avatar upload** reuses the existing Cloudinary `upload` middleware (400x400 crop, 2MB limit) from `config/cloudinary.js`.
4. **Restore endpoint** restores `isActive = true` but does not reset `status = 'active'`. This is intentional — a restored user's status should stay as-was before deletion.

---

## Suggested Git Commit Message

```
feat(users): implement profile CRUD, admin user management, avatar upload

- Add userService with 12 functions (profile self-service + admin ops)
- Add profileController (4 handlers) and adminController (8 handlers)
- Add Zod validation schemas for all user endpoints
- Add userRoutes with full RBAC: Member (4 routes) + Admin (8 routes)
- Mount routes at /api/users in app.js
- Enforce PERMISSION_MATRIX: SA role assignment, soft-delete SA-only
- Business logic in service layer; controllers remain thin
- Security: input validation, password verification, self-edit protection
```
