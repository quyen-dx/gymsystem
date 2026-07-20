# FLASH AUDIT — Epic 1.7 User Profile & Administration

**Auditor**: opencode  
**Date**: 2026-07-20  
**Status**: **FAIL** ❌

---

## Files Audited

| File | Role |
|---|---|
| `src/services/userService.js` | 12 business-logic functions (profile + admin) |
| `src/controllers/profileController.js` | 4 thin handlers: `getMe`, `updateMe`, `uploadAvatar`, `changePassword` |
| `src/controllers/adminController.js` | 8 thin handlers: user list, view, update, role, activate, deactivate, delete, restore |
| `src/routes/userRoutes.js` | 12 routes with RBAC + Zod validation |
| `src/validators/userValidator.js` | 6 Zod schemas |
| `src/models/User.js` | Existing schema — `deletedAt`, `password`, `passwordHash`, `isActive`, `role` |
| `src/config/cloudinary.js` | Multer + Cloudinary storage for avatar upload |
| `src/middlewares/authMiddleware.js` | `protect`, `authorize`, `adminOnly`, `superAdminOnly` |
| `src/middlewares/validation.js` | `validateBody`, `validateQuery`, `validateParams` |
| `docs/PERMISSION_MATRIX.md` | RBAC source of truth |

---

## 1. Profile Flow

| Check | Result | Evidence |
|---|---|---|
| `GET /me` returns sanitized user with `hasPassword` flag | ✅ | `userService.js:41-48` — calls `sanitizeUser`, strips secrets |
| `GET /me` masks `identityNumber` for non-admin roles | ✅ | `userService.js:43-46` — masks to `****...+last4` |
| `PATCH /me` updates only allowed fields | ✅ | `userService.js:65-82` — whitelist of 18 fields |
| `PATCH /me` uses `validateBeforeSave: false` | ✅ | `userService.js:84` |
| `POST /me/avatar` handles missing file | ✅ | `userService.js:99-101` — 400 error |
| `POST /me/avatar` stores Cloudinary URL | ✅ | `userService.js:103` — `file.path` or `file.secure_url` |
| `PATCH /me/password` verifies current password | ✅ | `userService.js:120` — `user.comparePassword(currentPassword)` |
| `PATCH /me/password` validates strength (Zod + service) | ✅ | Both `userValidator.js:31-34` and `userService.js:9-15` enforce same rules |
| `PATCH /me/password` checks account has password set | ✅ | `userService.js:117` — `!user.password && !user.passwordHash` |

---

## 2. Admin Flow

| Check | Result | Evidence |
|---|---|---|
| `GET /` paginates with `page`, `limit`, `search`, `role`, `status`, `isActive`, `sort`, `includeDeleted` | ✅ | `userService.js:143-180` — all filters applied |
| `GET /` excludes soft-deleted by default | ✅ | `userService.js:153-155` — `deletedAt: null` unless `includeDeleted` |
| `GET /` search uses `$or` with `$regex` on name, email, phone, fullName | ✅ | `userService.js:165-172` — `escape` for regex safety |
| `GET /:id` blocks non-admin viewing admin/super_admin profiles | ✅ | `userService.js:138-141` |
| `PATCH /:id` blocks self-edit | ✅ | `userService.js:192-194` |
| `PATCH /:id` requires Super Admin to edit admin profiles | ✅ | `userService.js:196-199` |
| `PATCH /:id/role` blocks self role change | ✅ | `userService.js:230-232` |
| `PATCH /:id/role` blocks changing Super Admin role | ✅ | `userService.js:239-241` |
| `POST /:id/activate` checks user not deleted | ✅ | `userService.js:258-260` |
| `POST /:id/activate` checks already active | ✅ | `userService.js:262-264` |
| `POST /:id/deactivate` blocks deactivating admin without Super Admin | ✅ | `userService.js:281-284` |
| `DELETE /:id` blocks self-delete | ✅ | `userService.js:304-306` |
| `DELETE /:id` blocks Super Admin deletion | ✅ | `userService.js:311-313` |
| `DELETE /:id` uses soft delete (`deletedAt=now, isActive=false`) | ✅ | `userService.js:318-319` |
| `PATCH /:id/restore` checks user was deleted | ✅ | `userService.js:335-337` |

---

## 3. Validation

| Check | Result | Evidence |
|---|---|---|
| Every mutation endpoint has Zod validation | ✅ | `userRoutes.js` — `validateBody`/`validateQuery`/`validateParams` on all data-accepting routes |
| `updateProfileSchema` uses `.strict()` (no extra fields) | ✅ | `userValidator.js:30` |
| `changePasswordSchema` uses `.strict()` | ✅ | `userValidator.js:35` |
| `adminUpdateUserSchema` uses `.strict()` | ✅ | `userValidator.js:51` |
| `changeRoleSchema` uses `.strict()` | ✅ | `userValidator.js:56` |
| `userIdParamsSchema` validates MongoDB ObjectId hex format | ✅ | `userValidator.js:66` — `/^[0-9a-fA-F]{24}$/` |
| `adminUsersQuerySchema` coerces numeric/boolean query params | ✅ | `userValidator.js:58-64` — `z.coerce.number()`, `z.coerce.boolean()` |
| Validation runs before controller | ✅ | Middleware order: `protect` → `validate*` → controller |

---

## 4. RBAC

| Route | Middleware | Matrix Match | Result |
|---|---|---|---|
| `GET /me` | `protect` | Self-profile — no role gate needed | ✅ |
| `PATCH /me` | `protect` | Self-profile — no role gate needed | ✅ |
| `PATCH /me/avatar` | `protect` | Self-profile — no role gate needed | ✅ |
| `PATCH /me/password` | `protect` | Self-profile — no role gate needed | ✅ |
| `GET /` | `adminOnly` = `authorize('super_admin','admin')` | Matrix `view_any` → Admin: R, Super Admin: R | ✅ |
| `GET /:id` | `authorize('super_admin','admin','pt','staff')` | Matrix `view_any` → Admin: R, Super Admin: R, PT: R, Staff: R | ✅ |
| `PATCH /:id` | `authorize('super_admin','admin')` | Matrix `update_any` → Admin: U, Super Admin: U | ✅ |
| `PATCH /:id/role` | `superAdminOnly` | Matrix `assign_role` → Super Admin: U | ✅ |
| `PATCH /:id/activate` | `authorize('super_admin','admin')` | Falls under `update_any` | ✅ |
| `PATCH /:id/deactivate` | `authorize('super_admin','admin')` | Falls under `update_any` | ✅ |
| `DELETE /:id` | `superAdminOnly` | Matrix `delete` → Super Admin: D | ✅ |
| `POST /:id/restore` | `superAdminOnly` | Falls under `delete` (reverse) | ✅ |

**12/12 routes match the permission matrix.** ✅

---

## 5. Security

| Check | Result | Evidence |
|---|---|---|
| Self-edit blocked on all admin routes | ✅ | 6 checks in `userService.js` — `adminUpdateUser`, `changeUserRole`, `activateUserAccount`, `deactivateUserAccount`, `softDeleteUser`, `restoreUser` |
| Admin profile edit requires Super Admin | ✅ | `userService.js:196-199` — admin/super_admin targets require `requestorRole === 'super_admin'` |
| Admin deactivation requires Super Admin | ✅ | `userService.js:281-284` |
| Super Admin deletion blocked | ✅ | `userService.js:311-313` — `user.role === 'super_admin'` throws 403 |
| Super Admin role change blocked | ✅ | `userService.js:239-241` |
| Sensitive fields stripped via `sanitizeUser` | ✅ | `userService.js:21-26` — removes `password`, `passwordHash`, `refreshToken` |
| `getMyProfile` masks identityNumber for non-admin | ✅ | `userService.js:43-46` |
| `getUserById` masks identityNumber for non-admin requestors | ❌ **MEDIUM** | `userService.js:133-143` — calls `sanitizeUser` but does NOT mask `identityNumber` for PT/Staff requestors |
| `req.user.role` from JWT (server-signed, not client-injectable) | ✅ | `protect` → `verifyAccessToken` → JWT verified |
| No sensitive data in error messages | ✅ | All errors return generic messages; no internal state leaked |

---

## 6. Database

| Check | Result | Evidence |
|---|---|---|
| `User` schema supports all required fields | ✅ | `name`, `email`, `phone`, `avatar`, `isActive`, `role`, `deletedAt`, etc. all present |
| Soft delete uses existing `deletedAt` strategy | ✅ | `softDeleteUser` sets `deletedAt = new Date()`, `isActive = false` |
| `deletedAt` index exists | ✅ | `User.js` — `sparse: true` index on `deletedAt` |
| `role + isActive` compound index exists | ✅ | `User.js` — `{ role: 1, isActive: 1 }` |
| Password change hashes new password via pre-save hook | ❌ **CRITICAL** | See finding UA-1 |
| `validateBeforeSave: false` used appropriately | ✅ | All admin mutations use `validateBeforeSave: false` (avoids identifier validation on admin edits) |

---

## 7. Architecture

| Check | Result | Evidence |
|---|---|---|
| Business logic in service layer | ✅ | `userService.js` — all 12 functions contain business logic |
| Controllers are thin | ✅ | `profileController.js` ~56 lines, `adminController.js` ~101 lines — extract params, call service, send response |
| Circular dependencies | ✅ | Verified via `node -e` — all imports resolve cleanly |
| No new dependencies | ✅ | Uses existing `bcrypt`, `cloudinary`, `multer`, `zod` |
| ADR-013 compliance | ✅ | Auth state through `req.user` from `tokenService.verifyAccessToken`; no sessions |
| Controllers follow `catchAsync` + `sendSuccess` pattern | ❌ **MEDIUM** | See finding UA-3 |

---

## 8. Backward Compatibility

| Check | Result | Evidence |
|---|---|---|
| New routes under `/api/users` — no overlap with existing `/api/auth` | ✅ | `app.js:114` — mounted at `/api/users`; all auth routes at `/api/auth` |
| Existing auth routes unchanged | ✅ | No modifications to `authRoutes.js`, `authController.js`, or `authService.js` |
| `User` model unchanged (no new required fields) | ✅ | All fields already exist in schema |
| Existing `protect`, `authorize`, role shortcuts reused | ✅ | All middleware imported from existing `authMiddleware.js` |

---

## Findings

### UA-1 (CRITICAL) — Password change silently broken

**File**: `src/models/User.js` (pre-save hook) + `src/services/userService.js:121-125`

**Description**:  
`changeUserPassword` sets `user.password = newPassword` and calls `user.save()`, expecting the `pre('save')` hook to hash the new password into `passwordHash`. However, the hook's condition is:

```js
if (this.isModified('password') && this.password && !this.passwordHash) {
  this.passwordHash = await bcrypt.hash(this.password, 12)
  this.password = undefined
}
```

For existing users, `passwordHash` is already populated (from registration). Therefore `!this.passwordHash` is `false`, the hash block is **entirely skipped**, and:
- `user.password` is stored as **plaintext**
- `user.passwordHash` retains the **old** password hash

Subsequent login attempts compare against the stale `passwordHash` (fails), then fall through to `bcrypt.compare(candidatePassword, plaintextPassword)` which throws `"data and hash arguments required"`.

**Result**: Changing password effectively **locks the user out permanently**.

**Root cause**: The `pre('save')` hook was designed only for initial registration (where `passwordHash` is null). Password-change requires a different path.

**Recommendation**: In `changeUserPassword`, hash the new password directly and set `passwordHash`:

```js
const salt = await bcrypt.genSalt(12)
user.passwordHash = await bcrypt.hash(newPassword, salt)
user.password = undefined
await user.save({ validateBeforeSave: false })
```

---

### UA-2 (MEDIUM) — `getUserById` does not mask `identityNumber` for non-admin requestors

**File**: `src/services/userService.js:133-143`

**Description**:  
`getUserById` (used by `GET /admin/users/:id` for PT/Staff/Admin) calls `sanitizeUser()` which strips `password`/`passwordHash`/`refreshToken` but does **not** mask `identityNumber`. The `getMyProfile` function applies masking for non-admin users (`userService.js:43-46`), but `getUserById` has no equivalent.

PT and Staff roles can view other users' profiles (per the permission matrix), but `identityNumber`, `identityFrontImage`, and `identityBackImage` are sensitive PII that should be masked.

**Recommendation**: Add the same masking logic from `getMyProfile` (lines 43-46) to `getUserById`, keyed on `requestorRole`.

---

### UA-3 (MEDIUM) — Controllers do not follow the established project convention

**File**: `src/controllers/profileController.js`, `src/controllers/adminController.js`

**Description**:  
The newer `v2AuthController.js` establishes the project convention:
- Use `catchAsync` (from `../utils/catchAsync.js`) instead of raw `try/catch`
- Use `sendSuccess` (from `../utils/responseHelper.js`) instead of `res.json()`

The Epic 1.7 controllers use raw `try/catch` + manual `res.status().json()` responses. While functionally correct, this creates inconsistency:
- `profileController.js` has 4 `try/catch` blocks with identical error handling duplicated
- `adminController.js` uses a `handleError` helper but still does not use `sendSuccess`
- `getUsersList` returns `{ success, users, pagination }` instead of the `sendPaginated` pattern `{ success, data, pagination }`

**Recommendation**: Refactor to use `catchAsync` and `sendSuccess`/`sendPaginated`.

---

### UA-4 (LOW) — Avatar upload accepts all file types via multer

**File**: `src/config/cloudinary.js:99-102`, `src/routes/userRoutes.js:14`

**Description**:  
The default `upload` multer instance (used for avatar) has no `fileFilter`, accepting any file type. Cloudinary's `allowed_formats` provides server-side filtering, but the user receives a cryptic Cloudinary error instead of a clear "chỉ chấp nhận file ảnh" message.

**Recommendation**: Add `fileFilter` to the `upload` multer instance, matching `productImageUpload`'s pattern.

---

### UA-5 (LOW) — `identityFrontImage` / `identityBackImage` deleted in `getMyProfile` but not in `getUserById`

**File**: `src/services/userService.js:46-47`, `userService.js:133-143`

**Description**:  
`getMyProfile` deletes `identityFrontImage` and `identityBackImage` for non-admin users (`userService.js:46-47`). `getUserById` has no equivalent treatment.

**Recommendation**: Apply the same `identityFrontImage`/`identityBackImage` deletion in `getUserById` for non-admin/super_admin requestors.

---

## Scores

| Category | Score |
|---|---|
| **Risk** | 65/100 |
| **Security** | 85/100 |
| **Architecture** | 80/100 |

---

## Verdict

**FAIL** ❌ — Epic 1.7 User Profile & Administration has one **CRITICAL** defect (UA-1: password change silently broken, causes permanent lockout). Two MEDIUM issues (UA-2: identityNumber unmasked for PT/Staff; UA-3: controller pattern deviation). Two LOW observations.

The implementation is structurally sound — all 12 routes have correct RBAC, Zod validation is applied on every data-accepting endpoint, self-edit is blocked in all 6 admin mutation functions, Super Admin deletion and role-change are protected, and soft-delete follows the established `deletedAt` strategy. However, the password-change defect (UA-1) is a release blocker.
