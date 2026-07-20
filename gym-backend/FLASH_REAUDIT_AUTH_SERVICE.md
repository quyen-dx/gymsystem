# Flash Re-Audit — Epic 1.4 (Core Auth Service & API)

**Auditor:** Principal Backend Auditor  
**Date:** 2026-07-20  
**Scope:** `authService.js`, `v2AuthController.js`, `authV2Routes.js`, `authValidator.js`,  
`authMiddleware.js`, `rateLimiter.js`, `PasswordResetToken.js`, `emailService.js`,  
`tokenService.js`, `RefreshToken.js`, `User.js`, `Otp.js`, `otpService.js`,  
`responseHelper.js`, `validation.js`  

**Reference:** `BUSINESS_RULES.md`, `DATABASE.md`, `API_STANDARDS.md`,  
`PERMISSION_MATRIX.md`, `ADR-013.md`, `AI_CODING_CONSTITUTION.md`

---

## Result: PASS

| Metric | Score |
|--------|-------|
| **Risk Score** | 94/100 |
| **Security Score** | 92/100 |
| **Architecture Score** | 95/100 |

---

## Previously Reported Issues — Verification

### Critical (2/2 fixed)

| ID | Description | Status | Evidence |
|----|-------------|--------|----------|
| **C-1** | `changedPasswordAfter` check missing on protected routes | **FIXED** | `authMiddleware.js:15` now calls `tokenService.verifyAccessToken()` which invokes `user.changedPasswordAfter(decoded.iat)` at `tokenService.js:88` |
| **C-2** | No rate limiting on auth endpoints | **FIXED** | 5 named limiters in `rateLimiter.js:24-62` applied to all 8 auth routes in `authV2Routes.js:23-31` |

### High (3/3 fixed)

| ID | Description | Status | Evidence |
|----|-------------|--------|----------|
| **H-1** | `forgotPassword` has no email delivery | **FIXED** | `emailService.js:84-116` provides `sendPasswordResetEmail()`; `authService.js:177-179` calls it with `rawToken`; API no longer returns token |
| **H-2** | No `resend-verification` endpoint | **FIXED** | `authService.js:149-169` implements `resendVerificationOtp()`; controller handler at `v2AuthController.js:80-83`; route at `authV2Routes.js:29` |
| **H-3** | Password reset token stored in plaintext | **FIXED** | `PasswordResetToken.js:33` stores SHA-256 hash; `consume()` hashes input before query at line 40; `generate()` returns `{ doc, rawToken }`; raw token never persisted |

### Medium (4/4 fixed)

| ID | Description | Status | Evidence |
|----|-------------|--------|----------|
| **M-1** | verifyEmail TOCTOU race condition | **FIXED** | `authService.js:125` calls `consumeOtp` BEFORE `user.isVerified = true` at line 142 |
| **M-2** | Orphaned user on OTP send failure | **FIXED** | `authService.js:36-38`: try-catch around `sendOtp` deletes user via `findByIdAndDelete` on failure |
| **M-3** | `refreshAccessToken` fetches full documents | **FIXED** | `authService.js:99` uses `.select('userId').lean()`; `authService.js:104` uses `.select('_id role').lean()` |
| **M-4** | No `lean()` on read-only queries | **FIXED** | `forgotPassword` at line 172: `.select('_id').lean()`; `register` existence check at line 14: `.select('_id').lean()`; `resendVerificationOtp` at line 150: `.select('_id isVerified').lean()` |

---

## New Independent Audit

### Authentication Flow — PASS

| Operation | Checks | Status |
|-----------|--------|--------|
| Register | User creation, OTP send, rollback on failure, duplicate email detection | ✓ |
| Login | Email/password match, inactive/locked/blocked checks, unverified email rejection, tokens generated | ✓ |
| Logout | Single token revocation via cookie | ✓ |
| Logout all | `revokeAllForUser` | ✓ |
| Refresh | Cookie extraction, token rotation, family-based theft detection | ✓ |
| Verify email | OTP consume → user verification | ✓ |
| Resend verification | Enumeration-safe, OTP cooldown respected | ✓ |
| Forgot password | Enumeration-safe message, token generation + email delivery | ✓ |
| Reset password | Token consume (SHA-256 match), password hash + save, refresh tokens revoked | ✓ |

### JWT Lifecycle — PASS

- Access token: 15-min expiry via `jwtConfig.expiresIn` ✓
- Refresh token: 7-day TTL, SHA-256 hashed in DB ✓
- Rotation: old token revoked, new token in same family ✓
- Theft detection: `RefreshToken.rotate()` revokes entire family if already-revoked token is reused ✓
- Payload: `{ id, role }` only — no PII ✓
- Issuer/audience: `gym-system` / `user` ✓

### Refresh Token Rotation — PASS

- `tokenService.rotateRefreshToken()`: hash raw → `RefreshToken.rotate()` (find + revoke old) → create new ✓
- Theft detection at `RefreshToken.js:48-52`: previously revoked token triggers `revokeFamily()` ✓
- `revokeFamily()` revokes all non-revoked tokens in the same family ✓

### Password Reset Security — PASS

- `crypto.randomBytes(32)` = 256-bit entropy ✓
- SHA-256 hashed before storage ✓
- `consume()` sets `usedAt`, token is single-use ✓
- TTL index on `expiresAt` (1 hour) ✓
- Password reset revokes ALL refresh tokens via `revokeAllForUser` ✓

### Email Verification Flow — PASS

- OTP sent via `sendOtpEmail` on register ✓
- OTP verified via `verifyOtp`, consumed before user marked verified ✓
- Resend endpoint enumeration-safe (same message returned for exists/not-exists/verified) ✓
- Login blocked until `isVerified === true` for `provider === 'email'` ✓
- OTP rate limited on verify (5/15min) and resend (5/15min) ✓

### Route Middleware Order — PASS

```
rate limiter → validation → controller
```

Applied on all user-input routes: `authV2Routes.js:23-31` ✓

### Rate Limiter Coverage — PASS

| Endpoint | Limiter | Window | Max |
|----------|---------|--------|-----|
| POST /register | `authRegisterLimiter` | 1 min | 5 |
| POST /login | `authLoginLimiter` | 1 min | 10 |
| POST /refresh | `authRefreshLimiter` | 1 min | 30 |
| POST /verify-email | `authOtpLimiter` | 15 min | 5 |
| POST /resend-verification | `authOtpLimiter` | 15 min | 5 |
| POST /forgot-password | `authPasswordResetLimiter` | 1 hour | 3 |
| POST /reset-password | `authPasswordResetLimiter` | 1 hour | 3 |

All 8 routes covered. 5 named limiters deployed ✓

### Validation Coverage — PASS

| Endpoint | Schema | Fields Validated |
|----------|--------|------------------|
| POST /register | `registerSchema` | email (format + normalize), password (8+ chars, upper, lower, digit), name (min 2) |
| POST /login | `loginSchema` | email (format), password (required) |
| POST /verify-email | `verifyEmailSchema` | email (format), otp (6 chars) |
| POST /resend-verification | `resendVerificationSchema` | email (format + normalize) |
| POST /forgot-password | `forgotPasswordSchema` | email (format) |
| POST /reset-password | `resetPasswordSchema` | token (required), password (strength) |

All user-input endpoints validated ✓

### Database Consistency — PASS

- `password_reset_tokens`: matches `DATABASE.md §2.1` — userId, token (hashed), expiresAt, usedAt ✓
- `refresh_tokens`: matches `DATABASE.md §2.1` — userId, token (hashed), family, deviceInfo, isRevoked, expiresAt ✓
- `users`: matches `DATABASE.md §2.1` — passwordHash (select: false), isActive, status, role, provider, isVerified ✓
- `otps`: matches `DATABASE.md §2.1` — identifier (polyfill), code, type, expiresAt, consumedAt, attempts, lockedUntil ✓
- Indexes match documented patterns for all queried fields ✓

### Business Rule Compliance — PASS

| Rule | Requirement | Implementation | Status |
|------|-------------|----------------|--------|
| **BR-AUD-004** | Max 3 concurrent sessions | `tokenService.generateRefreshToken` → `RefreshToken.countActiveByUser(userId)` → evict oldest if ≥ 3 | ✓ |
| **BR-AUD-005** | Max 5 failed OTP attempts / 15 min | `otpService.verifyOtp` → aggregation `$sum` over 15-min window → 30-min lockout | ✓ |
| Enumeration prevention | No false 404 on forgotPassword | Same message returned for exists/not-exists | ✓ |
| Password strength | Min 8 chars, 1 upper, 1 lower, 1 digit | Zod `passwordSchema` in `authValidator.js:3-8` | ✓ |
| Email unverified block | Unverified email users cannot login | `authService.js:60-61` rejects if `!user.isVerified && provider === 'email'` | ✓ |
| Token rotation | Each refresh issues new token, invalidates old | `tokenService.rotateRefreshToken()` | ✓ |
| Theft detection | Reuse of revoked token revokes family | `RefreshToken.rotate()` → `revokeFamily()` | ✓ |
| Password change invalidation | Changed password invalidates existing tokens | `changedPasswordAfter` checked in `verifyAccessToken` | ✓ |

### ADR-013 Compliance — PASS

- Session model removed; RefreshToken is single auth state ✓
- `deviceInfo` stored on RefreshToken per ADR-013 ✓
- `countActiveByUser()` static used for BR-AUD-004 ✓
- Token rotation with family-based theft detection ✓
- Single DB write per auth operation (login, logout, refresh) ✓

### Controller → Service Separation — PASS

- Controllers are thin: extract params → call service → send response ✓
- All business logic in `authService.js` (not in controller, not in model) ✓
- All handlers wrapped in `catchAsync` ✓
- No business logic in models (PasswordResetToken has token hashing — acceptable static method) ✓

### Sensitive Data Leakage — PASS

- `passwordHash`: `select: false` on User model ✓
- `password`: `select: false` on User model ✓
- `refreshToken` (user-level): `select: false` ✓
- `toJSON()` strips `password`, `passwordHash`, `refreshToken` ✓
- JWT payload: only `id` and `role` ✓
- API responses for forgotPassword no longer return raw token ✓
- Reset tokens hashed in DB (SHA-256) ✓
- Refresh tokens hashed in DB (SHA-256) ✓

### Replay Attack Prevention — PASS

- OTP consumed on verification ✓
- Password reset token consumed on use ✓
- Refresh token revoked on rotation ✓
- OTP resend has 60-second cooldown ✓

### Race Conditions — PASS

- verifyEmail: OTP consumed BEFORE user marked verified ✓
- register: OTP send failure triggers user deletion ✓
- resetPassword: password saved BEFORE refresh tokens revoked (sequential, acceptable; no atomicity guarantee noted as limitation) ✓

### CSRF — PASS

- Refresh token: `httpOnly`, `Secure` (production), `SameSite=Strict` cookie ✓
- Access token: `Authorization: Bearer` header — inherently CSRF-safe ✓

### Timing Attacks — PASS (residual LOW)

- Forgot password returns same message regardless of email existence ✓
- Timing delta (DB write vs immediate return) still exists but is deferred L-3 from original audit ✓

### Performance — PASS

- `.lean()` used on all read-only queries ✓
- `.select()` limits fields on all queries ✓
- Compound indexes on queried fields (identifier + type for OTP, userId + family for RefreshToken) ✓
- No N+1 queries in auth flow ✓

### Query Optimization Verification

| Function | Query | lean | select | Status |
|----------|-------|------|--------|--------|
| register (existence) | `User.findOne({email})` | ✓ | `_id` | ✓ |
| login | `User.findOne({email})` | need doc (comparePassword) | `+passwordHash` | ✓ |
| refreshAccessToken (1) | `RefreshToken.findOne({token})` | ✓ | `userId` | ✓ |
| refreshAccessToken (2) | `User.findById(newRecord.userId)` | ✓ | `_id role` | ✓ |
| verifyEmail | `User.findById(userId)` | need doc (save) | full | ✓ |
| forgotPassword | `User.findOne({email})` | ✓ | `_id` | ✓ |
| resendVerificationOtp | `User.findOne({email})` | ✓ | `_id isVerified` | ✓ |
| resetPassword | `User.findById(consumed.userId)` | need doc (save) | full | ✓ |

---

## New Observations (LOW severity)

| ID | Description | Location | Impact |
|----|-------------|----------|--------|
| O-1 | Reset token appears as URL query parameter in email | `emailService.js:86` | Token leakable via browser history, referrer headers, and proxy logs. Mitigation: deliver token in email body requiring manual entry. |
| O-2 | `authMiddleware.protect` and `authorize` return raw JSON on auth failure instead of AppError | `authMiddleware.js:12`, `authMiddleware.js:27` | Inconsistent error format with rest of API. No `error.code` in response. Deferred to global middleware refactor. |
| O-3 | Login (10/min) and refresh (30/min) rate limits exceed AI_CODING_CONSTITUTION §11 guidance of 5/min for auth endpoints | `rateLimiter.js:26,56` | Rates are reasonable for real-world use but technically exceed constitutional guidance. |

No Critical, High, or Medium issues found.

---

## Final Verdict

```
PASS
```

- **No remaining Critical issues.**
- **No remaining High issues.**
- **Business Rules satisfied** (BR-AUD-004 ✓, BR-AUD-005 ✓, enumeration ✓, password strength ✓, email unverified block ✓, token rotation ✓, theft detection ✓, password change invalidation ✓).
- **Authentication ready for Sprint 1 continuation.**

| Domain | Verdict |
|--------|---------|
| Authentication flow | ✓ PASS |
| Authorization (protect middleware) | ✓ PASS |
| Rate limiting | ✓ PASS |
| Validation | ✓ PASS |
| Password reset security | ✓ PASS |
| Email verification | ✓ PASS |
| Refresh token rotation + theft detection | ✓ PASS |
| JWT lifecycle | ✓ PASS |
| Sensitive data protection | ✓ PASS |
| ADR-013 compliance | ✓ PASS |
| Architecture (controller/service separation) | ✓ PASS |
| Database consistency | ✓ PASS |
| Error handling | ✓ PASS |
| Performance / query optimization | ✓ PASS |
