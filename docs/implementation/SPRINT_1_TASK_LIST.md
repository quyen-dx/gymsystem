# Sprint 1 — Task List

> **Sprint:** 1 (Identity)
> **Parent:** `docs/implementation/02_SPRINT_1.md`
> **Governing Docs:** `AI_CODING_CONSTITUTION.md`, `AI_DEVELOPMENT_WORKFLOW.md`
> **Status:** Planning — Awaiting Approval

---

## Task Dependency Graph

```
1.1 (User Model)
  │
  ├── 1.2 (JWT & Token Infra) ──┐
  ├── 1.3 (Password & OTP)    ──┤
  │                              │
  └────────── 1.4 (Auth Service + Routes) ──┐
                 │                           │
                 ├── 1.5 (Auth Middleware) ──┤
                 ├── 1.6 (Social Auth)    ──┤
                 │                           │
                 └── 1.7 (User Service + Routes)
                       │
                       ├── 1.8 (Rate Limiting & Login Limits)
                       │
                       └── 1.9 (Integration, Tests & Docs)
```

---

## Critical Path

```
1.1 → 1.2 → 1.4 → 1.5 → 1.7 → 1.9
```

Tasks 1.3 and 1.6 are parallel to the critical path. Tasks 1.8 can be done after 1.7.

---

## Review Points

| Point | After Task | What to Verify |
|-------|-----------|----------------|
| RP-1 | 1.1 | All 6 Mongoose models match DATABASE.md §2.1 exactly |
| RP-2 | 1.4 | Registration → OTP → Login → Refresh flow end-to-end with curl |
| RP-3 | 1.5 | protect middleware rejects invalid tokens; authorize rejects wrong roles |
| RP-4 | 1.7 | Full permission matrix enforced (all 7 roles + ownership checks) |
| RP-5 | 1.9 | Full test suite passing. All 35 acceptance criteria verified. |

---

## Commit Points

| Commit | After Task(s) | Message |
|--------|--------------|---------|
| C-1 | 1.1 | `feat(auth): add User, OTP, PasswordResetToken, SocialAccount, RefreshToken models` |
| C-2 | 1.2 + 1.3 | `feat(auth): add JWT token service, OTP service, email service` |
| C-3 | 1.4 | `feat(auth): implement register, login, refresh, logout, password reset endpoints` |
| C-4 | 1.5 | `feat(auth): add protect, authorize, role guard middleware` |
| C-5 | 1.6 | `feat(auth): add Google and Facebook OAuth social login` |
| C-6 | 1.7 | `feat(users): implement profile CRUD, admin user management, avatar upload` |
| C-7 | 1.8 | `feat(auth): enforce BR-AUD-004 login limits and BR-AUD-005 OTP rate limiting` |
| C-8 | 1.9 | `test(auth): add unit, integration, business rule, and permission tests` |

---

## Task 1.1: User Model Foundation

| Field | Value |
|-------|-------|
| **Task ID** | 1.1 |
| **Task Name** | User & Auth Model Foundation |
| **Objective** | Create all 6 Mongoose models matching DATABASE.md §2.1 exactly. Enhance existing User.js with proper password hashing, soft-delete, and status flags. |
| **Complexity** | MEDIUM |
| **Risk** | MEDIUM — User.js already exists (Category B). Must enhance without breaking existing 40+ consumers. |
| **Business Rules** | None directly implemented. Models are structural. |
| **Database Collections** | `users` (enhance existing), `otps` (new), `password_reset_tokens` (new), `social_accounts` (new), `refresh_tokens` (new) |
| **API Endpoints** | None — models only. |
| **Permissions** | None — models only. |
| **Dependencies** | Sprint 0 (Foundation) complete. Mongoose 9 installed. |
| **Files to Create** | `src/models/OTP.js`, `src/models/PasswordResetToken.js`, `src/models/SocialAccount.js`, `src/models/RefreshToken.js` |
| **Files to Modify** | `src/models/User.js` (enhance: pre-save password hashing, comparePassword(), soft-delete hooks, consolidate isActive/status/isLocked) |
| **Acceptance Criteria** | AC-M1 to AC-M3 (see below) |
| **Definition of Done** | All 6 models match DATABASE.md fields/types/indexes. User.js enhanced without breaking existing consumers. Pre-save hooks tested. Soft-delete hooks verified. |
| **Implementation Order** | 1 (first task — no Sprint 1 dependencies) |

### Acceptance Criteria

- **AC-M1:** `User` model has all fields from DATABASE.md (`name`, `email`, `passwordHash`, `phone`, `avatar`, `role`, `gender`, `dateOfBirth`, `address`, `isActive`, `lastLoginAt`, `deletedAt`). All indexes from DATABASE.md present.
- **AC-M2:** `User.pre('save')` hashes `passwordHash` with bcrypt (salt rounds 12) only when modified. `comparePassword(candidate)` returns boolean.
- **AC-M3:** All 4 new models (OTP, PasswordResetToken, SocialAccount, RefreshToken) have timestamps, correct indexes, TTL indexes where specified, and enum validation on status fields.

---

## Task 1.2: JWT & Token Infrastructure

| Field | Value |
|-------|-------|
| **Task ID** | 1.2 |
| **Task Name** | JWT Token Infrastructure |
| **Objective** | Build token generation, verification, refresh rotation, and theft detection. All JWT operations centralized in one service. |
| **Complexity** | LOW |
| **Risk** | LOW — stateless JWT. Separated from auth logic. |
| **Business Rules** | None directly implemented. Token expiry is infrastructure. |
| **Database Collections** | `refresh_tokens` (read/write) |
| **API Endpoints** | None — service only. |
| **Permissions** | None — service only. |
| **Dependencies** | Task 1.1 (RefreshToken model) |
| **Files to Create** | `src/services/tokenService.js` |
| **Files to Modify** | None |
| **Acceptance Criteria** | AC-T1 to AC-T5 (see below) |
| **Definition of Done** | Access token generation (15min). Refresh token generation (7d). Rotation with old invalidation. Theft detection (reuse → revoke family). Decoding with verification. |
| **Implementation Order** | 2 (after 1.1) |

### Acceptance Criteria

- **AC-T1:** `generateAccessToken(user)` returns JWT with `{ id, role, iat, exp }`. `exp` = 15 minutes from now.
- **AC-T2:** `generateRefreshToken(user, deviceInfo)` creates `RefreshToken` document with `family` UUID. Returns signed token with 7-day expiry.
- **AC-T3:** `rotateRefreshToken(oldToken)` invalidates old token, creates new token in same family. Returns new token pair.
- **AC-T4:** `decodeToken(token)` verifies signature and returns payload. Expired token → throws `AppError(401, 'AUTH_TOKEN_EXPIRED')`.
- **AC-T5:** Reusing an already-rotated refresh token calls `revokeFamily(family)` — all tokens in family set to `isRevoked: true`.

---

## Task 1.3: Password & OTP Infrastructure

| Field | Value |
|-------|-------|
| **Task ID** | 1.3 |
| **Task Name** | Password & OTP Infrastructure |
| **Objective** | Build OTP generation/sending/verification with rate-limit checks. Create Nodemailer email service for OTP and password reset emails. |
| **Complexity** | MEDIUM |
| **Risk** | MEDIUM — OTP rate limiting (BR-AUD-005) is security-critical. Email delivery depends on external SMTP. |
| **Business Rules** | BR-AUD-005 (max 5 failed OTP attempts per 15 min) |
| **Database Collections** | `otps` (read/write) |
| **API Endpoints** | None — service only. |
| **Permissions** | None — service only. |
| **Dependencies** | Task 1.1 (OTP model) |
| **Files to Create** | `src/services/emailService.js` (or enhance existing) |
| **Files to Modify** | `src/services/otpService.js` (enhance existing Category B — add rate limiting, improve error handling) |
| **Acceptance Criteria** | AC-O1 to AC-O5 (see below) |
| **Definition of Done** | OTP generation with 5-min TTL. OTP email sending via Nodemailer. OTP verification with attempt tracking. BR-AUD-005 enforced (5 fails/15 min → lockout). |
| **Implementation Order** | 2 (parallel with 1.2, after 1.1) |

### Acceptance Criteria

- **AC-O1:** `generateOTP(userId, type)` creates OTP document with 5-minute `expiresAt`. Returns 6-digit code.
- **AC-O2:** `sendOTPEmail(email, code, type)` sends email with OTP code. Uses Nodemailer transport from `config/env.js`.
- **AC-O3:** `verifyOTP(userId, code, type)` checks code matches, OTP not expired, not consumed. On success: sets `consumedAt`. On failure: increments `attempts`.
- **AC-O4:** `checkOTPRateLimit(userId, type)` queries failed OTP attempts within last 15 minutes. If count ≥ 5 → throws `AppError(429, 'OTP_RATE_LIMIT_EXCEEDED')`.
- **AC-O5:** Email delivery failure does not crash server. Logs error. Returns `false` — caller decides whether to proceed.

---

## Task 1.4: Core Auth Service & Auth Routes

| Field | Value |
|-------|-------|
| **Task ID** | 1.4 |
| **Task Name** | Core Authentication Service & Routes |
| **Objective** | Implement the complete auth lifecycle: register, verify OTP, login, refresh token, logout, forgot/reset password. All business logic in `authService.js`. Thin controllers. Auth routes with rate limiting. |
| **Complexity** | HIGH |
| **Risk** | HIGH — this is the security foundation for the entire system. A flaw here compromises everything. |
| **Business Rules** | BR-AUD-002 (GDPR export prep) |
| **Database Collections** | `users` (read/write), `otps` (read/write), `refresh_tokens` (read/write), `password_reset_tokens` (write) |
| **API Endpoints** | POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, POST /auth/otp/verify |
| **Permissions** | None at service level. Routes: register/login/forgot/reset/otp are public. Refresh uses cookie. Logout requires `protect`. |
| **Dependencies** | Task 1.2 (tokenService), Task 1.3 (otpService, emailService), Task 1.1 (all models) |
| **Files to Create** | `src/services/authService.js`, `src/controllers/authController.js`, `src/routes/authRoutes.js` |
| **Files to Modify** | `src/routes/index.js` (mount authRoutes), `src/app.js` (if needed for rate-limit on auth) |
| **Acceptance Criteria** | AC-1.1 through AC-1.17 from Sprint 1 doc §17 |
| **Definition of Done** | Registration with OTP flow. Login with JWT pair. Token refresh with rotation. Logout with session invalidation. Password reset flow. All 17 ACs pass. |
| **Implementation Order** | 3 (after 1.2 + 1.3) |

---

## Task 1.5: Auth Middleware (protect, authorize, RBAC)

| Field | Value |
|-------|-------|
| **Task ID** | 1.5 |
| **Task Name** | Authorization Middleware |
| **Objective** | Create `protect` (JWT verification), `authorize(...roles)` (RBAC gate), `selfOrAdmin` (ownership check), and role shortcut middlewares. Enhance existing `authMiddleware.js` without breaking consumers. |
| **Complexity** | MEDIUM |
| **Risk** | HIGH — middleware bugs → unauthorized access or blocked legitimate users. Must not break existing 40+ routes using `protect`/`authorize`. |
| **Business Rules** | None directly. Enforces PERMISSION_MATRIX. |
| **Database Collections** | `users` (read) |
| **API Endpoints** | None — middleware only. |
| **Permissions** | Enforces User Management matrix row. Prepares all subsequent sprints. |
| **Dependencies** | Task 1.1 (User model), Task 1.2 (tokenService) |
| **Files to Create** | `src/middlewares/auth.js` (new clean implementation) or None (enhance existing) |
| **Files to Modify** | `src/middlewares/authMiddleware.js` (enhance: add token blacklist check, user existence check, soft-delete filter, consistent error codes) |
| **Acceptance Criteria** | AC-1.21 through AC-1.25 from Sprint 1 doc §17 |
| **Definition of Done** | `protect` verifies JWT, checks blacklist, attaches `req.user`. `authorize` checks role. `selfOrAdmin` enforces ownership. All existing consumers unaffected. |
| **Implementation Order** | 4 (after 1.4 — middleware wraps routes) |

---

## Task 1.6: Social Auth (Google + Facebook OAuth)

| Field | Value |
|-------|-------|
| **Task ID** | 1.6 |
| **Task Name** | Social Authentication (OAuth) |
| **Objective** | Implement Google and Facebook OAuth login/registration. Users can sign in with social accounts. Existing users can link social accounts. |
| **Complexity** | MEDIUM |
| **Risk** | MEDIUM — external API dependency. Google/Facebook API changes could break flow. |
| **Business Rules** | None |
| **Database Collections** | `users` (read/create), `social_accounts` (read/write/create), `refresh_tokens` (write) |
| **API Endpoints** | POST /auth/social/google, POST /auth/social/facebook |
| **Permissions** | Public |
| **Dependencies** | Task 1.4 (authService for token issuance), Task 1.1 (SocialAccount model) |
| **Files to Create** | `src/services/socialAuthService.js`, `src/controllers/socialAuthController.js` |
| **Files to Modify** | `src/routes/authRoutes.js` (add social endpoints), `src/config/passport.js` (enhance existing — already has Google/Facebook strategies) |
| **Acceptance Criteria** | AC-1.18 through AC-1.20 from Sprint 1 doc §17 |
| **Definition of Done** | Google OAuth: receive ID token → verify → create/link user → issue JWT. Facebook OAuth: receive access token → verify → link account → issue JWT. Duplicate provider link → 409. |
| **Implementation Order** | 5 (after 1.4, parallel with 1.5) |

---

## Task 1.7: User Service & User Routes (Profile + Admin)

| Field | Value |
|-------|-------|
| **Task ID** | 1.7 |
| **Task Name** | User Profile & Admin Management |
| **Objective** | Implement profile CRUD for self-service, admin user listing with pagination/filtering/search, role assignment (Super Admin only), soft-delete (Super Admin only), and avatar upload to Cloudinary. |
| **Complexity** | HIGH |
| **Risk** | MEDIUM — many endpoints, complex permission matrix. Cloudinary upload is external dependency. |
| **Business Rules** | BR-AUD-002 (GDPR export prep) |
| **Database Collections** | `users` (read/write) |
| **API Endpoints** | GET/PUT /users/profile, GET /users, GET/PUT /users/:id, DELETE /users/:id |
| **Permissions** | Full User Management matrix row enforced |
| **Dependencies** | Task 1.5 (auth middleware for protect/authorize/selfOrAdmin), Task 1.1 (User model) |
| **Files to Create** | `src/services/userService.js`, `src/controllers/userController.js`, `src/routes/userRoutes.js`, `src/middlewares/upload.js` (avatar upload) |
| **Files to Modify** | `src/routes/index.js` (mount userRoutes), `src/app.js` (if needed) |
| **Acceptance Criteria** | AC-1.26 through AC-1.35 from Sprint 1 doc §17 |
| **Definition of Done** | Profile CRUD. Admin user list with filters. Role assignment. Soft-delete. Avatar upload to Cloudinary. All 10 ACs pass. |
| **Implementation Order** | 6 (after 1.5) |

---

## Task 1.8: Rate Limiting & Login Limit Enforcement

| Field | Value |
|-------|-------|
| **Task ID** | 1.8 |
| **Task Name** | Rate Limiting & BR-AUD-004 Enforcement |
| **Objective** | Enforce BR-AUD-004 (max 3 concurrent logins) via `RefreshToken.countActiveByUser()`. Apply per-endpoint rate limiting: OTP 5/15min, login 10/min, forgot-password 3/hour. |
| **Complexity** | LOW |
| **Risk** | LOW — additive middleware. Rate limiter already scaffolded in Sprint 0. |
| **Business Rules** | BR-AUD-004 (max 3 logins via RefreshToken count), BR-AUD-005 (OTP rate limit) |
| **Database Collections** | `refresh_tokens` (read for count) |
| **API Endpoints** | None new — applies rate limiting to existing endpoints. |
| **Permissions** | None new |
| **Dependencies** | Task 1.4 (auth routes exist), Task 1.7 (user routes exist) |
| **Files to Create** | None (BR-AUD-004 enforced inline in authService) |
| **Files to Modify** | `src/routes/authRoutes.js` (add rate-limit middleware to OTP/login/forgot-password), `src/services/authService.js` (call RefreshToken.countActiveByUser on login, invalidate oldest if ≥3) |
| **Acceptance Criteria** | AC-1.14 (BR-AUD-004), AC-1.7 (BR-AUD-005) |
| **Definition of Done** | 4th login invalidates oldest RefreshToken. OTP rate limit enforced. Auth routes have correct rate limits. |

---

## Task 1.9: Integration, Tests & Documentation

| Field | Value |
|-------|-------|
| **Task ID** | 1.9 |
| **Task Name** | Integration Testing, Documentation Update & Sprint Closure |
| **Objective** | Write all unit tests, integration tests, business rule tests, and permission tests. Update all 12 documentation files per the checklist. Run full test suite. |
| **Complexity** | HIGH (volume) |
| **Risk** | LOW — tests are additive. Documentation is additive. |
| **Business Rules** | All Sprint 1 BR-AUD-004, BR-AUD-005, BR-AUD-002 |
| **Database Collections** | All Sprint 1 collections (test database) |
| **API Endpoints** | All Sprint 1 endpoints (test coverage) |
| **Permissions** | Full User Management matrix row (test coverage) |
| **Dependencies** | ALL previous Sprint 1 tasks (1.1 through 1.8) |
| **Files to Create** | `tests/unit/authService.test.js`, `tests/unit/tokenService.test.js`, `tests/unit/userService.test.js`, `tests/unit/otpService.test.js`, `tests/unit/middleware/auth.test.js`, `tests/integration/auth.test.js`, `tests/integration/users.test.js`, `tests/integration/socialAuth.test.js` |
| **Files to Modify** | 12 documentation files from Sprint 1 doc §24 |
| **Acceptance Criteria** | All 35 acceptance criteria from Sprint 1 doc §17 verified. |
| **Definition of Done** | Full test suite passes (>80% coverage on services). All 12 docs updated. Review checklist complete. |
| **Implementation Order** | 8 (final task) |

---

## Execution Order

| Step | Task | Depends On | Est. Files | Can Parallel |
|------|------|------------|-----------|-------------|
| 1 | 1.1 — Models | Sprint 0 | 6 (5 new, 1 modify) | — |
| 2a | 1.2 — JWT Token | 1.1 | 1 new | ✅ with 1.3 |
| 2b | 1.3 — Password & OTP | 1.1 | 2 (1 new, 1 modify) | ✅ with 1.2 |
| 3 | 1.4 — Core Auth | 1.1, 1.2, 1.3 | 3 new, 1 modify | — |
| 4a | 1.5 — Middleware | 1.1, 1.2, 1.4 | 0-1 new, 1 modify | ✅ with 1.6 |
| 4b | 1.6 — Social Auth | 1.1, 1.4 | 2 new, 2 modify | ✅ with 1.5 |
| 5 | 1.7 — Users | 1.1, 1.5 | 4 new, 1 modify | — |
| 6 | 1.8 — Rate Limits | 1.4, 1.7 | 1 new, 2 modify | — |
| 7 | 1.9 — Tests & Docs | ALL | 8 new, 12 modify | — |

---

## Complexity & Risk Summary

| Task | Complexity | Risk | Files | Key Challenge |
|------|-----------|------|-------|---------------|
| 1.1 | MEDIUM | MEDIUM | 6 | Enhancing User.js without breaking 40+ consumers |
| 1.2 | LOW | LOW | 1 | Pure JWT — well-understood pattern |
| 1.3 | MEDIUM | MEDIUM | 2 | OTP rate limiting is security-critical |
| 1.4 | HIGH | HIGH | 4 | Security foundation. A flaw here compromises everything. |
| 1.5 | MEDIUM | HIGH | 2 | Must not break existing 40+ route guards |
| 1.6 | MEDIUM | MEDIUM | 4 | External API dependency (Google/Facebook) |
| 1.7 | HIGH | MEDIUM | 5 | Many endpoints. Complex permission matrix. Cloudinary upload. |
| 1.8 | LOW | LOW | 3 | Additive middleware. Rate limiter already scaffolded. |
| 1.9 | HIGH | LOW | 20 | Volume. 8 test files + 12 doc files. |

---

## Review Points

| Point | After | Checklist |
|-------|-------|-----------|
| RP-1 | 1.1 | All 6 models match DATABASE.md. User.js pre-save hook tested. Soft-delete hooks verified. |
| RP-2 | 1.2 + 1.3 | Token lifecycle correct. OTP rate limit enforced. Email sent. |
| RP-3 | 1.4 | Register → OTP → Login → Refresh → Logout flow works with curl. |
| RP-4 | 1.5 | protect rejects invalid. authorize rejects wrong roles. All existing consumers intact. |
| RP-5 | 1.6 | Google OAuth flow. Facebook OAuth flow. Duplicate link rejected. |
| RP-6 | 1.7 | Profile CRUD. Admin user list. Role assignment. Avatar upload. |
| RP-7 | 1.8 | BR-AUD-004: 4th login kicks oldest. BR-AUD-005: OTP lockout after 5 failures. |
| RP-8 | 1.9 | Full test suite passes. 12 docs updated. |

---

**Sprint 1 decomposed into 9 atomic tasks. Each task independently reviewable. Total: ~30 source files, 8 test files, 12 doc files.**
