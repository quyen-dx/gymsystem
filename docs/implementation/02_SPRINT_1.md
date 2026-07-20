# Sprint 1 — Identity

> **Sprint:** 1 (Identity)
> **Duration:** 2–3 weeks
> **Phase:** Core
> **Status:** Not Started
> **Depends on:** Sprint 0 (Foundation)

---

## 1. Sprint Goal

Implement complete identity management including registration, login, OAuth, JWT-based authorization, and user profile management for all 7 roles. Every authenticated request in the system originates from the infrastructure built in this sprint.

---

## 2. Business Objectives

- Enable member self-service registration and onboarding without staff intervention.
- Secure all API access with a stateless JWT auth mechanism that supports silent token refresh.
- Provide OAuth shortcuts (Google, Facebook) to reduce registration friction and increase conversion.
- Enforce role-based access control so that every endpoint in every subsequent sprint can plug into the `protect` → `authorize` middleware chain.
- Give admins the tools to manage user accounts, roles, and statuses — essential for gym operations.
- Lay the foundation for audit compliance (BR-AUD-004, BR-AUD-005) by implementing session limits and rate limiting on sensitive endpoints.

---

## 3. Modules Included

| Module | Module Doc | Role in Sprint 1 |
|---|---|---|
| **Auth** | `docs/modules/auth.md` | Registration, login, token refresh, logout, password reset, OTP verification, social login. |
| **User Management** | `docs/modules/user-management.md` | Profile CRUD (self + admin), role assignment, account status management, user listing with filters. |

---

## 4. Dependencies

| Dependency | Status |
|---|---|
| Sprint 0 (Foundation) | Must be complete. Express app, MongoDB connection, AppError, catchAsync, logger, validators must exist. |
| `config/env.js` from Sprint 0 | JWT secrets, OAuth client IDs, email config loaded from here. |
| `config/logger.js` from Sprint 0 | Used for all auth audit logging. |
| `utils/AppError.js` from Sprint 0 | Used for all auth-specific error responses. |
| `utils/catchAsync.js` from Sprint 0 | Wraps all controller handlers. |

---

## 5. Prerequisites

| Item | Description |
|---|---|
| **JWT Secret** | `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` generated (e.g., `openssl rand -hex 64`). |
| **Google Cloud OAuth credentials** | Client ID + Client Secret for Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). |
| **Facebook App credentials** | App ID + App Secret for Facebook OAuth (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`). |
| **Email provider** | SMTP credentials or SendGrid API key for sending OTP emails, password reset links. |
| **Cloudinary account** | API key + secret + cloud name for avatar uploads. |
| **bcrypt** | Installed as npm dependency (password hashing). |
| **jsonwebtoken** | Installed as npm dependency. |
| **passport / passport-google-oauth20 / passport-facebook** | Installed as npm dependencies. |
| **express-rate-limit** | Already scaffolded in Sprint 0; configure per-endpoint limits here. |

---

## 6. Documents to Read

### Mandatory — Read before writing any code

| Document | Section / Relevance |
|---|---|
| `docs/modules/auth.md` | Complete auth module spec: models, services, controllers, flows, error codes. |
| `docs/modules/user-management.md` | Complete user management spec: profile operations, role assignment, account lifecycle. |
| `docs/BUSINESS_RULES.md` BR-AUD-004 | Concurrent session limit: max 3 devices per member. |
| `docs/BUSINESS_RULES.md` BR-AUD-005 | Rate limiting: max 5 failed OTP attempts per 15 minutes. |
| `docs/PERMISSION_MATRIX.md` | "User Management" section (all rows). Also note Policy Overrides §1–§5. |
| `docs/DATABASE.md` §2.1 | Auth & Users collections: `users`, `otps`, `sessions`, `password_reset_tokens`, `social_accounts`, `refresh_tokens`. |
| `docs/API_STANDARDS.md` | §11 (Authentication) — how JWTs are sent (Bearer header), refresh flow. |
| `docs/adr/ADR-003.md` | JWT Bearer Tokens — decision and rationale. |
| `docs/ERROR_HANDLING.md` | Auth-specific error codes: `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `AUTH_INSUFFICIENT_PERMISSIONS`, `AUTH_USER_NOT_FOUND`. |
| `docs/AI_CODING_CONSTITUTION.md` | Security principles (password handling, token storage, session management). |

### Reference — Skim for context

| Document | Relevance |
|---|---|
| `docs/STATE_MACHINES.md` | No state machine for auth — login/logout are discrete events. User status flags: `active`, `inactive`, `locked`, `unverified`. |
| `docs/BUSINESS_RULES.md` BR-AUD-001, BR-AUD-002 | Financial/GDPR retention — relevant for audit log design on admin operations. |

---

## 7. Business Rules

| Rule ID | Summary | Implementation |
|---|---|---|
| **BR-AUD-004** | Max 3 concurrent sessions per member. | `sessionService.createSession()` counts active sessions. If ≥ 3, invalidate oldest, create new. `sessions` collection stores active sessions indexed by `userId`. |
| **BR-AUD-005** | Max 5 failed OTP attempts per 15 minutes per action type. | `otpService.checkRateLimit()` queries `otps` collection for failed attempts within rolling 15-minute window. Returns error if count ≥ 5. Lockout scoped per `(userId, type)`. |
| **BR-AUD-002** | GDPR: member data exportable within 72 hours. | Not fully implemented here. `User` model must support `deletedAt` soft-delete and `anonymize()` method. Admin action logging (§BR-ADM-003) supports audit trail for data access. |

---

## 8. State Machines

No formal state machine for auth. User status is managed as discrete flags:

| Status | Description | Transition |
|---|---|---|
| `unverified` | Created but email/phone not verified. | → `active` on OTP verification success. |
| `active` | Normal operational state. Can log in, receive tokens. | → `inactive` on admin suspension; → `locked` on repeated OTP failures. |
| `inactive` | Admin-suspended. Cannot log in. | → `active` on admin reactivation. |
| `locked` | Temporarily locked due to security policy (BR-AUD-005). | → `active` after lockout period expires. |

No state transitions are recorded in STATE_MACHINES.md — these flags are specific to the User model's `status` field.

---

## 9. Permission Matrix

From `docs/PERMISSION_MATRIX.md` — Resource: **User Management** (all rows applicable):

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View profile own | - | R | R | R | R | R | R |
| View any profile | - | - | R | R | - | R | R |
| Create user | - | - | - | C | - | C | C |
| Update own profile | - | U | U | U | U | U | U |
| Update any profile | - | - | - | - | - | U | U |
| Delete user | - | - | - | - | - | - | D |
| Assign roles | - | - | - | - | - | - | U |

**Middleware rules derived from this matrix:**
- `protect` — verifies JWT, attaches `req.user`. Any authenticated user passes.
- `authorize(...roles)` — checks `req.user.role` against allowed roles list.
- `selfOrAdmin` — allows access if `req.user.id === req.params.id` OR `req.user.role` is admin/super_admin.
- `superAdminOnly` — shortcut for `authorize('super_admin')`.

Policy overrides from PERMISSION_MATRIX.md §1–§5 apply:
- **Ownership override §3**: User may always view/update their own profile.
- **Super Admin override §2**: Super Admin has unconditional access to all actions.

---

## 10. Database Collections

All 6 collections from `docs/DATABASE.md` §2.1 (Auth & Users):

### `users`

| Key Fields | Indexes |
|---|---|
| `name` (String, required), `email` (String, required, unique, lowercase, trimmed), `passwordHash` (String, required), `phone` (String, sparse unique), `avatar` (String, URL), `role` (enum: member, staff, pt, admin, super_admin), `gender` (enum: male, female, other), `dateOfBirth` (Date), `address` (Object: {street, ward, district, city}), `isActive` (Boolean, default true), `lastLoginAt` (Date), `deletedAt` (Date, soft-delete) | `email` (unique), `phone` (sparse unique), `{ role: 1, isActive: 1 }`, `{ deletedAt: 1 }` (sparse), text index `{ name: "text", email: "text" }` |

### `otps`

| Key Fields | Indexes |
|---|---|
| `userId` (ObjectId ref: User), `code` (String, required), `type` (enum: email_verification, password_reset, phone_verification, login), `expiresAt` (Date, required), `consumedAt` (Date), `attempts` (Number, default 0, max 5) | `{ userId: 1, type: 1 }`, TTL index `{ expiresAt: 1 }` (expire 5 min after `expiresAt`) |

### `sessions`

| Key Fields | Indexes |
|---|---|
| `userId` (ObjectId ref: User), `refreshToken` (String, required), `deviceInfo` (Object: {userAgent, ip, platform}), `isRevoked` (Boolean, default false), `expiresAt` (Date, required) | `{ userId: 1 }`, `{ refreshToken: 1 }` (unique), TTL index `{ expiresAt: 1 }` |

### `password_reset_tokens`

| Key Fields | Indexes |
|---|---|
| `userId` (ObjectId ref: User), `token` (String, required, unique), `expiresAt` (Date, required), `usedAt` (Date) | `token` (unique), TTL index `{ expiresAt: 1 }` (expire after 1 hour) |

### `social_accounts`

| Key Fields | Indexes |
|---|---|
| `userId` (ObjectId ref: User), `provider` (enum: google, facebook, apple), `providerId` (String, unique per provider), `profileUrl` (String), `metadata` (Object, raw provider data) | `{ provider: 1, providerId: 1 }` (unique compound), `{ userId: 1 }` |

### `refresh_tokens`

| Key Fields | Indexes |
|---|---|
| `userId` (ObjectId ref: User), `token` (String, required, unique), `family` (String, token rotation family), `isRevoked` (Boolean, default false), `expiresAt` (Date, required) | `token` (unique), `{ userId: 1, family: 1 }`, TTL index `{ expiresAt: 1 }` |

---

## 11. API Endpoints

### Auth Endpoints (from `docs/modules/auth.md`)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | — | Register new user (email + password + name). Creates user with status `unverified`, sends OTP email. |
| `POST` | `/api/v1/auth/login` | Public | — | Login with email + password. Returns access token (15 min) + refresh token (7 days, httpOnly cookie). Applies BR-AUD-004 (max 3 sessions). |
| `POST` | `/api/v1/auth/refresh` | Public (refresh cookie) | — | Refresh access token. Rotates refresh token (old revoked, new issued). Detects token reuse → revoke entire family (theft detection). |
| `POST` | `/api/v1/auth/logout` | Required | All | Invalidate current session. Revoke refresh token. Clear httpOnly cookie. |
| `POST` | `/api/v1/auth/forgot-password` | Public | — | Send password-reset email with time-limited token (1 hour expiry). |
| `POST` | `/api/v1/auth/reset-password` | Public | — | Reset password using token from email. Token consumed on success. |
| `POST` | `/api/v1/auth/otp/verify` | Public | — | Verify OTP code (email_verification, password_reset, phone_verification, login). Applies BR-AUD-005 (max 5 attempts / 15 min). |
| `POST` | `/api/v1/auth/social/google` | Public | — | Google OAuth login/registration. Accepts Google ID token, verifies with Google API, creates/link user, issues JWT pair. |
| `POST` | `/api/v1/auth/social/facebook` | Public | — | Facebook OAuth login/registration. Accepts Facebook access token, verifies with Facebook API, creates/link user, issues JWT pair. |

### User Management Endpoints (from `docs/modules/user-management.md`)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/users/profile` | Required | All | Get own profile. Returns full user object (excluding passwordHash). |
| `PUT` | `/api/v1/users/profile` | Required | All | Update own profile (name, phone, avatar, gender, dateOfBirth, address). Phone change triggers re-verification. |
| `GET` | `/api/v1/users` | Required | Admin, Super Admin | List users (paginated, filterable by role, status, search term). Excludes passwordHash. |
| `GET` | `/api/v1/users/:id` | Required | Admin, Super Admin | Get any user's details. PT and Staff can also view per PERMISSION_MATRIX. |
| `PUT` | `/api/v1/users/:id` | Required | Admin, Super Admin | Update any user (role assigned by Super Admin only, per PERMISSION_MATRIX). Admin can update profile fields, status. |
| `DELETE` | `/api/v1/users/:id` | Required | Super Admin | Soft-delete user (sets `deletedAt`). Cannot self-delete. Cannot delete another Super Admin. |

---

## 12. AI Components

No AI components are touched in Sprint 1. The auth middleware (`protect`, `authorize`) will eventually guard the AI chat endpoints (Sprint 5+), but the AI system itself is not modified here.

---

## 13. Files Expected to be Created

### Models (`gym-backend/src/models/`)

| File | Description |
|---|---|
| `models/User.js` | User schema with all fields from DATABASE.md §2.1 (`users`). Mongoose hooks: pre-save password hashing, pre-find soft-delete filter. Instance methods: `comparePassword()`, `changedPasswordAfter()`. |
| `models/OTP.js` | OTP schema with TTL index. Static methods: `generate()`, `verify()`. |
| `models/Session.js` | Session schema with TTL index. Static: `createSession()`, `invalidateAll()`. |
| `models/PasswordResetToken.js` | Token schema with TTL index. Static: `generate()`, `consume()`. |
| `models/SocialAccount.js` | Social account schema with compound unique index. |
| `models/RefreshToken.js` | Refresh token schema with rotation family support. Static: `rotate()`, `revokeFamily()`. |

### Services (`gym-backend/src/services/`)

| File | Description |
|---|---|
| `services/authService.js` | `register()`, `login()`, `refresh()`, `logout()`, `forgotPassword()`, `resetPassword()`, `socialLogin()` — full business logic per `docs/modules/auth.md` Services table. |
| `services/otpService.js` | `generateOTP()`, `sendOTP()`, `verifyOTP()`, `checkRateLimit()` — OTP lifecycle with BR-AUD-005 enforcement. |
| `services/tokenService.js` | `generateAccessToken()`, `generateRefreshToken()`, `rotateRefreshToken()`, `revokeRefreshToken()`, `decodeToken()` — JWT signing and verification. |
| `services/sessionService.js` | `createSession()`, `validateSession()`, `invalidateSession()`, `listActiveSessions()`, `enforceConcurrentLimit()` — BR-AUD-004 enforcement. |
| `services/userService.js` | `getProfile()`, `updateProfile()`, `getUser()`, `listUsers()`, `updateUser()`, `deleteUser()`, `createStaffAccount()` — all operations from `docs/modules/user-management.md` Services table. |

### Controllers (`gym-backend/src/controllers/`)

| File | Description |
|---|---|
| `controllers/authController.js` | Thin handlers for all auth endpoints. Delegates to `authService`, `otpService`. |
| `controllers/socialAuthController.js` | Handlers for Google and Facebook OAuth endpoints. |
| `controllers/userController.js` | Handlers for user CRUD (profile + admin). Delegates to `userService`. |

### Routes (`gym-backend/src/routes/`)

| File | Description |
|---|---|
| `routes/authRoutes.js` | Auth route definitions with rate-limit middleware on OTP and login endpoints. |
| `routes/userRoutes.js` | User route definitions with auth middleware (`protect`, `authorize`, `superAdminOnly`). |

### Middleware (`gym-backend/src/middlewares/`)

| File | Description |
|---|---|
| `middlewares/auth.js` | `protect` (verify JWT, attach `req.user`), `authorize(...roles)`, `adminOnly`, `superAdminOnly`, `selfOrAdmin`. |
| `middlewares/upload.js` | `uploadAvatar` — Multer + Cloudinary config for avatar uploads (field validation, size limit, format restriction). |

### Config (`gym-backend/src/config/`)

| File | Description |
|---|---|
| `config/passport.js` | Passport initialization with Google and Facebook OAuth strategies. |
| `config/cloudinary.js` | Cloudinary configuration (from Sprint 0 if already created, otherwise new). |

### Utils (extensions to Sprint 0)

| File | Description |
|---|---|
| `utils/emailService.js` | Nodemailer transport config + `sendOTPEmail()`, `sendPasswordReset()`, `sendWelcomeEmail()` methods. |
| `utils/tokenHelper.js` | JWT signing/verification wrappers with env-based secret selection. |

### Tests

| File | Description |
|---|---|
| `tests/unit/authService.test.js` | Unit tests for auth service methods. |
| `tests/unit/tokenService.test.js` | Token generation, expiry, theft detection. |
| `tests/unit/userService.test.js` | Profile updates, role assignment rules. |
| `tests/unit/middleware/auth.test.js` | `protect` and `authorize` middleware logic. |
| `tests/integration/auth.test.js` | Full registration → verification → login → refresh → logout flow. |
| `tests/integration/users.test.js` | Profile CRUD, admin user list, role assignment. |
| `tests/integration/socialAuth.test.js` | Mocked Google/Facebook token verification. |

---

## 14. Files Expected to be Modified

| File | Change |
|---|---|
| `gym-backend/server.js` | Mount `authRoutes` and `userRoutes`. Add `config/passport.js` initialization. Register error handler association for auth errors. |
| `gym-backend/src/config/env.js` | Add JWT secret vars, OAuth client IDs/secrets, email config, Cloudinary config. |
| `gym-backend/src/routes/index.js` | Import and mount auth and user route files. |

---

## 15. Definition of Ready

- [ ] Sprint 0 is complete and verified.
- [ ] All 6 document sets in §6 have been read and understood.
- [ ] JWT access and refresh secrets are generated and stored securely (not in repo).
- [ ] Google OAuth credentials are provisioned in Google Cloud Console.
- [ ] Facebook App is created and credentials are available.
- [ ] Cloudinary account is set up with upload preset for avatars.
- [ ] SMTP / SendGrid credentials are available for email delivery.
- [ ] `express-rate-limit` package is installed (from Sprint 0).
- [ ] Test database (separate from dev) is configured for integration tests.
- [ ] Integration test helper utilities (createTestUser, getAuthToken) are documented.

---

## 16. Definition of Done

- [ ] All 6 Mongoose models compile without errors and match DATABASE.md §2.1 exactly.
- [ ] All API endpoints in §11 return correct responses per API_STANDARDS.md §5.
- [ ] `POST /auth/register` creates user with `unverified` status, sends OTP email.
- [ ] `POST /auth/login` returns access + refresh tokens; refresh token set as httpOnly cookie.
- [ ] `POST /auth/refresh` rotates refresh token; detects reuse and revokes family.
- [ ] `POST /auth/logout` invalidates session and clears refresh cookie.
- [ ] Password reset flow works end-to-end (forgot → email → reset → login with new password).
- [ ] OTP verification enforces BR-AUD-005 (5 attempts / 15 min lockout).
- [ ] Concurrent session enforcement (BR-AUD-004) works: 4th login invalidates oldest session.
- [ ] Google OAuth and Facebook OAuth create/link accounts and issue tokens.
- [ ] `protect` middleware rejects requests without valid JWT with 401.
- [ ] `authorize('admin')` middleware rejects non-admin users with 403.
- [ ] `GET /users/profile` returns own data; `PUT /users/profile` updates own data.
- [ ] `GET /users` returns paginated user list; filterable by role, status, search.
- [ ] `PUT /users/:id/role` succeeds only for Super Admin.
- [ ] `DELETE /users/:id` soft-deletes user; Super Admin only; self-delete blocked.
- [ ] Avatar upload via `PUT /users/profile` stores on Cloudinary, returns URL.
- [ ] Phone verification flow works (OTP sent → verified → phone marked verified).
- [ ] All unit tests pass with >80% coverage on services.
- [ ] All integration tests pass.
- [ ] Audit log records are created for all admin operations (BR-AUD-003 compliance prep).
- [ ] Code review completed and approved.

---

## 17. Acceptance Criteria

### Registration & Verification

| ID | Criterion |
|---|---|
| AC-1.1 | `POST /api/v1/auth/register` with valid `{ email, password, name }` returns 201 with user object (no passwordHash). User status is `unverified`. |
| AC-1.2 | Duplicate email returns 409 with `AUTH_EMAIL_EXISTS`. |
| AC-1.3 | Weak password (<8 chars, no uppercase, no number) returns 400 with validation error pointing to `password` field. |
| AC-1.4 | OTP email is sent within 5 seconds of registration. |
| AC-1.5 | `POST /api/v1/auth/otp/verify` with correct OTP transitions user to `active` and returns success. |
| AC-1.6 | Expired OTP (>5 minutes) returns 410 with `OTP_EXPIRED`. |
| AC-1.7 | Incorrect OTP increments attempt counter. After 5 failed attempts within 15 minutes, returns 429 with lockout duration. |

### Login & Sessions

| ID | Criterion |
|---|---|
| AC-1.8 | `POST /api/v1/auth/login` with valid credentials returns access token (Bearer) + sets refresh token as httpOnly, Secure, SameSite=Strict cookie. |
| AC-1.9 | Access token has 15-minute expiry (`exp` claim). Refresh token has 7-day expiry. |
| AC-1.10 | Login with wrong password returns 401 with `AUTH_INVALID_CREDENTIALS`. |
| AC-1.11 | Login on a locked/inactive account returns 403 with descriptive message. |
| AC-1.12 | `POST /api/v1/auth/refresh` returns new access token and rotates refresh token. Old refresh token is revoked. |
| AC-1.13 | Using a revoked refresh token (theft detection) revokes the entire token family and returns 401. |
| AC-1.14 | 4th concurrent login invalidates the oldest session (BR-AUD-004). `GET /api/v1/auth/sessions` shows max 3 active sessions. |

### Password Reset

| ID | Criterion |
|---|---|
| AC-1.15 | `POST /api/v1/auth/forgot-password` with existing email sends reset email with valid token. Returns 200 regardless of whether email exists (prevents enumeration). |
| AC-1.16 | `POST /api/v1/auth/reset-password` with valid token + new password updates passwordHash and invalidates all sessions. |
| AC-1.17 | Reusing a consumed password reset token returns 400. Expired token (>1 hour) returns 410. |

### Social OAuth

| ID | Criterion |
|---|---|
| AC-1.18 | `POST /api/v1/auth/social/google` with valid Google ID token creates account (if new email) or logs in (if existing email). |
| AC-1.19 | `POST /api/v1/auth/social/facebook` with valid Facebook access token links social account and issues JWT pair. |
| AC-1.20 | Linking a social account to an already-linked provider returns 409. |

### Authorization Middleware

| ID | Criterion |
|---|---|
| AC-1.21 | Request to protected endpoint without Authorization header returns 401. |
| AC-1.22 | Request with expired access token returns 401 with `AUTH_TOKEN_EXPIRED`. |
| AC-1.23 | `authorize('admin', 'super_admin')` rejects member user with 403. |
| AC-1.24 | `superAdminOnly` rejects admin user with 403. |
| AC-1.25 | Token blacklist check happens on every authenticated request (logged-out tokens rejected). |

### Profile Management

| ID | Criterion |
|---|---|
| AC-1.26 | `GET /api/v1/users/profile` returns full profile for the authenticated user (no passwordHash). |
| AC-1.27 | `PUT /api/v1/users/profile` updates name, phone, avatar, gender, dateOfBirth, address. Phone change triggers re-verification. |
| AC-1.28 | Avatar upload accepts JPG/PNG/WebP up to 5 MB. File is uploaded to Cloudinary; `avatar` field stores the secure URL. |
| AC-1.29 | User cannot change own role or email via profile update endpoint. |

### Admin User Management

| ID | Criterion |
|---|---|
| AC-1.30 | `GET /api/v1/users?role=pt&status=active&search=Nguyen&page=1&limit=20` returns paginated, filtered results. |
| AC-1.31 | `GET /api/v1/users/:id` returns any user's full profile (excluding passwordHash). Staff and PT can also access per matrix. |
| AC-1.32 | `PUT /api/v1/users/:id` by admin can update name, status, phone. Changing role requires Super Admin. |
| AC-1.33 | Super Admin assigns `admin` role to a user. Non-Super-Admin attempting same returns 403. |
| AC-1.34 | `DELETE /api/v1/users/:id` by Super Admin sets `deletedAt`, user can no longer log in. Self-delete returns 400. |
| AC-1.35 | Attempting to delete another Super Admin returns 403. |

---

## 18. Testing Strategy

### Unit Tests

| Module | Key Test Cases |
|---|---|
| `authService.register()` | Valid input → user created. Duplicate email → AppError. Missing required fields → ValidationError. |
| `authService.login()` | Valid credentials → tokens issued. Wrong password → 401. Inactive user → 403. Locked user → 423. |
| `tokenService.generateAccessToken()` | Token contains `{ id, role, iat, exp }`. Expiry = 15 minutes from now. |
| `tokenService.rotateRefreshToken()` | Old token revoked, new token created with same family. |
| `tokenService.revokeFamily()` | All tokens in family set to `isRevoked: true`. |
| `otpService.checkRateLimit()` | 0–4 failed attempts → allowed. 5th attempt within 15 min window → throws AppError. 6th attempt after 15 min → allowed (window slides). |
| `sessionService.enforceConcurrentLimit()` | 0–2 active sessions → new session created. 3 active sessions → oldest invalidated, new created. |
| `userService.updateUser()` | Admin updates non-role fields → success. Admin attempts role change → 403. Super Admin changes role → success. |
| Middleware `protect` | No token → 401. Invalid token → 401. Expired token → 401. Valid token → `req.user` populated. |
| Middleware `authorize('admin')` | Member user → 403. Admin user → `next()`. Super Admin user → `next()`. |

### Integration Tests

| Flow | Test |
|---|---|
| Full registration → login → refresh → logout | Register user, verify OTP, login to get tokens, refresh access token with refresh cookie, logout, verify refresh token revoked. |
| Password reset flow | Forgot password → check email (mock) → reset with token → login with new password → verify old refresh tokens revoked. |
| Social login | POST Google token → receive JWT pair. Repeat with same Google ID → receive same user's tokens. POST different Google ID → new user created. |
| Role-based access | Member accesses `GET /users` → 403. Admin accesses → 200 with user list. Super Admin deletes user → 200. Admin deletes user → 403. |
| Concurrent sessions (BR-AUD-004) | Login 4 times from 4 different deviceInfo. Check `GET /auth/sessions` → exactly 3 active. |
| OTP rate limit (BR-AUD-005) | Send 5 wrong OTPs. 6th attempt within 15 min → 429. Wait 15 min → 6th attempt allowed. |
| Profile update with avatar | Upload image via `PUT /users/profile` with multipart/form-data. Verify Cloudinary URL saved. |

### Business Rule Tests

| Rule ID | Test |
|---|---|
| BR-AUD-004 | Login with 4th device → oldest session invalidated. `GET /auth/sessions` shows ≤ 3 active. |
| BR-AUD-005 | 5 failed OTP attempts in 15 min → lockout. Attempt after lockout → 429. Attempt after 30 min → allowed. |

### Permission Tests

| Test | Expected |
|---|---|
| Guest accesses `GET /users/profile` | 401 (no token) |
| Member accesses `GET /users/:id` for another user | 403 (see matrix: Member cannot View any profile) |
| PT accesses `GET /users/:id` for a member | 200 (PT can View any profile per matrix) |
| Staff accesses `PUT /users/:id` to change role | 403 (Staff cannot Update any profile per matrix) |
| Admin accesses `DELETE /users/:id` | 403 (only Super Admin can Delete per matrix) |
| Super Admin accesses `DELETE /users/:id` | 200 |
| Admin accesses `PUT /users/:id` role change | 403 (only Super Admin can Assign roles per matrix) |
| Member accesses `PUT /users/profile` for own account | 200 |
| Member accesses `PUT /users/:id` for another user | 403 |

---

## 19. Rollback Strategy

| Change Type | Rollback Method |
|---|---|
| **New models** | Drop collections from MongoDB. Revert model files. Regenerate indexes from backup. |
| **New routes** | Remove route registration from `server.js`. No data migration if never deployed. |
| **Auth middleware** | Revert to Sprint 0 middleware stack. Endpoints return 500 (no auth guard) — acceptable during rollback. |
| **Database migration** | If new indexes were created, drop them manually. User data seeded in dev can be discarded. |
| **Environment variables** | Revert `.env.example` additions. Existing vars from Sprint 0 are unaffected. |
| **Sessions / tokens in circulation** | Invalidate all refresh tokens by cycling JWT secrets (revoke all sessions). Users must re-login. |
| **Social OAuth config** | Disable social login endpoints. No data loss — users can still login with password. |

**Critical rollback note:** If Sprint 1 is rolled back after being deployed, all issued JWT tokens will be invalidated. This is acceptable for a pre-production sprint. In production, a token migration strategy would be needed.

---

## 20. Risks

| ID | Risk | Probability | Impact |
|---|---|---|---|
| R-1.1 | JWT secret leaked via environment misconfiguration or committed to repo. | LOW | CRITICAL |
| R-1.2 | bcrypt hashing is too slow (high salt rounds) → login response times exceed p95 target of 500ms. | MEDIUM | HIGH |
| R-1.3 | Refresh token theft detection (family revocation) falsely revokes tokens for legitimate users when network issues cause retried refresh calls. | MEDIUM | MEDIUM |
| R-1.4 | Google/Facebook OAuth API deprecations or breaking changes → social login stops working. | LOW | HIGH |
| R-1.5 | Cloudinary upload failures → avatar updates fail silently or crash the profile update flow. | LOW | LOW |
| R-1.6 | Rate limiter (express-rate-limit) uses in-memory store → state lost on server restart, OTP attack windows open. | MEDIUM | MEDIUM |
| R-1.7 | Soft-delete (`deletedAt`) not respected by all queries → deleted users appear in user lists, can still log in. | MEDIUM | HIGH |

---

## 21. Risk Mitigation

| Risk ID | Mitigation |
|---|---|
| R-1.1 | Add `.env` to `.gitignore` (confirmed from Sprint 0). Use `openssl rand -hex 64` to generate secrets. Never log JWT secrets. Add `detect-secrets` pre-commit hook. |
| R-1.2 | Benchmark bcrypt at salt rounds 10, 12, 14. Use 10 (default) if 12 exceeds 200ms per hash. Document salt round choice. Add `passwordCompare` timing test in CI. |
| R-1.3 | Implement a grace period: if a refresh token is used within 5 seconds of the previous rotation, assume it's a network retry and don't revoke the family. Return the existing new token pair instead. |
| R-1.4 | Monitor Google/Facebook deprecation notices. Implement graceful degradation: if Google OAuth fails, show clear UI message and fall through to email registration. |
| R-1.5 | Wrap Cloudinary upload in try/catch. On failure, return 502 with `UPLOAD_FAILED` code. Profile update proceeds without avatar change. Log failure for ops. |
| R-1.6 | Use `rate-limit-redis` store in production; in-memory store in dev is acceptable. Sprint 0 Docker Compose can include Redis. If Redis is unavailable, fallback to in-memory. |
| R-1.7 | Mongoose `pre('find')` and `pre('findOne')` hooks filter `deletedAt: null` for all queries. Explicit `withDeleted()` static method for admin audit views. Unit test every model query. |

---

## 22. Estimated Implementation Order

1. **Mongoose models**: `User`, `OTP`, `Session`, `PasswordResetToken`, `SocialAccount`, `RefreshToken`.
2. **JWT utilities**: `tokenHelper.js` (sign, verify, decode), `tokenService.js` (generate, rotate, revoke).
3. **Password hashing**: bcrypt config in `User` model pre-save hook. `comparePassword()` instance method.
4. **Email service**: `utils/emailService.js` with Nodemailer transport. Templates for OTP, password reset, welcome.
5. **OTP service**: `services/otpService.js` — generate, send, verify, rate-limit check (BR-AUD-005).
6. **Auth service**: `services/authService.js` — register, login, refresh, logout, forgotPassword, resetPassword.
7. **Session service**: `services/sessionService.js` — create, validate, invalidate, enforce BR-AUD-004.
8. **Auth middleware**: `middlewares/auth.js` — `protect`, `authorize`, `adminOnly`, `superAdminOnly`, `selfOrAdmin`.
9. **Auth routes + controller**: `routes/authRoutes.js` + `controllers/authController.js`.
10. **Rate limiting**: Apply `express-rate-limit` to `/auth/login` (10/min), `/auth/otp/verify` (5/15min per BR-AUD-005), `/auth/forgot-password` (3/hour).
11. **User service**: `services/userService.js` — profile CRUD, admin user management.
12. **User routes + controller**: `routes/userRoutes.js` + `controllers/userController.js`.
13. **Avatar upload**: `middlewares/upload.js` + `config/cloudinary.js`.
14. **Social auth**: `config/passport.js` + `controllers/socialAuthController.js` + Google/Facebook strategies.
15. **Route mounting**: Update `server.js` and `routes/index.js`.
16. **Integration tests**: Full auth flow, social auth flow, user CRUD flow.
17. **Unit tests**: All services and middleware.
18. **Permission tests**: Verify every matrix row against actual endpoint behavior.
19. **Documentation update**: §24 checklist.
20. **Review & merge**.

---

## 23. Review Checklist

Before marking Sprint 1 complete, verify each item:

- [ ] All 6 Mongoose models match DATABASE.md §2.1 exactly (fields, types, indexes).
- [ ] `npm run lint` passes for all new files.
- [ ] `npm run build` compiles all TypeScript without errors.
- [ ] `npm run test:unit` passes all service, middleware, and utility tests.
- [ ] `npm run test:integration` passes all endpoint flow tests.
- [ ] Registration flow works: register → OTP → verify → login → access protected endpoint.
- [ ] Social login (Google) works: POST token → receive JWT pair → access profile.
- [ ] Social login (Facebook) works: POST token → receive JWT pair → link to existing account.
- [ ] Password reset flow works end-to-end.
- [ ] Refresh token rotation works: refresh → new pair; reuse detection revokes family.
- [ ] Logout invalidates session and clears cookie.
- [ ] BR-AUD-004 enforced: 4th login kicks oldest session.
- [ ] BR-AUD-005 enforced: 5 wrong OTPs → lockout; lockout expires after 30 min.
- [ ] All permission matrix rows in §9 are enforced at the middleware level.
- [ ] Avatar upload stores file on Cloudinary, returns secure URL.
- [ ] Phone verification triggers OTP and marks phone as verified.
- [ ] Admin user list supports pagination, filtering by role/status, and text search.
- [ ] Super Admin can assign roles; Admin cannot.
- [ ] Super Admin can soft-delete users; Self-delete is blocked.
- [ ] No `passwordHash` is ever returned in API responses.
- [ ] All error responses follow ERROR_HANDLING.md §1 format.
- [ ] Winston logger records all auth events (login, logout, registration, password change).
- [ ] No secrets are logged (JWT tokens, passwords, OTP codes in production).
- [ ] Code review resolved, PR approved.

---

## 24. Documentation Update Checklist

After Sprint 1 code is complete, update these documents:

- [ ] `docs/modules/auth.md` — Update API Endpoints table with actual route paths + implemented status. Add notes on token rotation behavior.
- [ ] `docs/modules/user-management.md` — Update API Endpoints table with actual route paths. Add notes on soft-delete behavior.
- [ ] `docs/PERMISSION_MATRIX.md` — No schema changes expected. Verify enforcement matches matrix.
- [ ] `docs/BUSINESS_RULES.md` — Add implementation notes to BR-AUD-004 and BR-AUD-005 (which file implements each rule).
- [ ] `docs/API_STANDARDS.md` — Update §11 (Authentication) with token expiry values (15 min access, 7 day refresh).
- [ ] `docs/DATABASE.md` — Add actual index creation timings if significantly different from expected.
- [ ] `docs/ERROR_HANDLING.md` — Add any new auth error codes discovered during implementation.
- [ ] `docs/EDGE_CASES.md` — Add any new auth edge cases discovered and resolved.
- [ ] `docs/SYSTEM_ARCHITECTURE.md` — Update middleware stack diagram to include `protect` and `authorize`.
- [ ] `docs/README_FOR_AI.md` — Update "Auth" section with implemented JWT details.
- [ ] `docs/CURRENT_PHASE.md` — Update to indicate Sprint 1 completion.
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 1 as completed.

---

## 25. Deliverables

| # | Deliverable | Verification |
|---|---|---|
| 1 | `User` model with all fields from DATABASE.md | `mongoose.model('User').schema.paths` contains all fields. Pre-save hook hashes password. |
| 2 | `OTP` model with TTL index and rate-limit tracking | OTP documents auto-expire after `expiresAt` + 5 min. Attempts capped at 5. |
| 3 | `Session` model with concurrent limit tracking | Index `{ userId: 1 }` supports efficient count queries. TTL expires old sessions. |
| 4 | `PasswordResetToken` model with 1-hour TTL | `consume()` marks token used and prevents reuse. |
| 5 | `SocialAccount` model with compound unique index | `{ provider: 1, providerId: 1 }` prevents duplicate linking. |
| 6 | `RefreshToken` model with family rotation | `family` field groups tokens. `revokeFamily()` revokes all tokens in family. |
| 7 | Registration endpoint | `POST /api/v1/auth/register` — creates user, sends OTP. |
| 8 | OTP verification endpoint | `POST /api/v1/auth/otp/verify` — verifies OTP, activates user, enforces BR-AUD-005. |
| 9 | Login endpoint | `POST /api/v1/auth/login` — issues JWT pair, enforces BR-AUD-004. |
| 10 | Token refresh endpoint | `POST /api/v1/auth/refresh` — rotates token, detects theft. |
| 11 | Logout endpoint | `POST /api/v1/auth/logout` — revokes token, clears session. |
| 12 | Password reset flow | `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password`. |
| 13 | Social login (Google + Facebook) | `POST /api/v1/auth/social/google` + `POST /api/v1/auth/social/facebook`. |
| 14 | `protect` middleware | All requests to protected routes validate JWT and attach `req.user`. |
| 15 | `authorize` middleware | Role-based access enforced per PERMISSION_MATRIX.md. |
| 16 | Profile management (self-service) | `GET/PUT /api/v1/users/profile` with avatar upload to Cloudinary. |
| 17 | Admin user management | `GET /api/v1/users`, `GET/PUT /api/v1/users/:id`, `DELETE /api/v1/users/:id`. |
| 18 | Role assignment (Super Admin) | Super Admin can change `role` field; others get 403. |
| 19 | Unit tests | >80% coverage on auth, token, OTP, session, user services. |
| 20 | Integration tests | Full auth flow, social auth, user CRUD, permission checks. |
| 21 | Rate limiting | OTP: max 5/15 min. Login: max 10/min. Forgot-password: max 3/hour. |

---

*Sprint 1 document generated from `docs/modules/auth.md`, `docs/modules/user-management.md`, `docs/BUSINESS_RULES.md`, `docs/PERMISSION_MATRIX.md`, `docs/DATABASE.md`, `docs/API_STANDARDS.md`, `docs/ERROR_HANDLING.md`, `docs/adr/ADR-003.md`, and `docs/AI_CODING_CONSTITUTION.md`.*
