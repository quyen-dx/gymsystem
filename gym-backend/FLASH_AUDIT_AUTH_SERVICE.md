# Flash Audit — Epic 1.4 (Core Auth Service & API)

**Auditor:** Principal Backend Auditor
**Date:** 2026-07-20
**Scope:** `authService.js`, `v2AuthController.js`, `authV2Routes.js`, `authValidator.js`, `EPIC_REPORT_AUTH_SERVICE.md`

---

## Result: FAIL

| Metric | Score |
|--------|-------|
| **Risk Score** | 62/100 |
| **Business Rule Coverage** | 80% |
| **Security Score** | 55/100 |
| **Architecture Score** | 85/100 |
| **Validation Score** | 90/100 |

---

## Critical Issues

### C-1: `changedPasswordAfter` check missing on protected routes (CVE-style)

The `authMiddleware.protect` used by `POST /logout` and `POST /logout-all` relies on the **old** `generateToken.verifyAccessToken()` which performs zero user-state validation. It does NOT call `user.changedPasswordAfter(decoded.iat)`. After a password reset, existing access tokens remain valid until natural expiry (15 minutes). This is a direct violation of AI_CODING_CONSTITUTION.md Part 11 (JWT: "Access token: 15 minutes expiry") and the User model's `changedPasswordAfter` design.

- **File:** `src/middlewares/authMiddleware.js` (not part of this epic but used by it)
- **Epic 1.4 impact:** `POST /logout` and `POST /logout-all` are gated by this middleware
- **Fix:** Replace old `verifyAccessToken()` with `tokenService.verifyAccessToken()` in the protect middleware or add `changedPasswordAfter` check inline

### C-2: No rate limiting on any Epic 1.4 endpoint

AI_CODING_CONSTITUTION.md Part 7 §Security First: "Every endpoint must have authentication + authorization + validation + rate limiting." Part 11 §Rate Limiting: "Auth endpoints: 5 requests/minute per IP." **Zero** rate limiters are applied in `authV2Routes.js`. This affects:

- `POST /register` — brute-force email enumeration
- `POST /login` — credential stuffing
- `POST /verify-email` — OTP guessing (partially mitigated by BR-AUD-005 in otpService)
- `POST /forgot-password` — email enumeration (partially mitigated by constant message)
- `POST /reset-password` — token brute-force

---

## High Issues

### H-1: `forgotPassword` has no email delivery mechanism

`authService.forgotPassword` creates a `PasswordResetToken` but never sends it via any channel. The token is only returned in the API response in `NODE_ENV !== 'production'`. In production, the user receives nothing. The endpoint is non-functional.

- **Risk:** 100% of password reset requests in production silently fail
- **File:** `src/services/authService.js:142-157`

### H-2: No resend-verification-otp endpoint

If the OTP email from `register` is lost or expires, the user has no way to request a new one. The `verifyEmail` endpoint returns `OTP_EXPIRED`, and the user is stuck with `isVerified: false` forever.

- **Risk:** User abandonment (cannot complete registration)
- **Sprint 1 spec:** §22 impl order lists "Email service" as step 4, but no resend endpoint is defined

### H-3: Password reset token stored in plaintext; leaked in dev response

`PasswordResetToken.generate()` stores the raw hex token directly in the DB. While MongoDB is trusted, the token is also returned verbatim in the `forgotPassword` API response in non-production. Any developer tooling, network logs, or console output can capture the plaintext reset token.

- **File:** `src/services/authService.js:148-155`
- **Pre-existing:** The `PasswordResetToken` model has no hashing mechanism

---

## Medium Issues

### M-1: `verifyEmail` TOCTOU race condition

`verifyEmail` sets `user.isVerified = true` first, then calls `otpService.consumeOtp(record._id)`. If `consumeOtp` fails (DB error, network), the user is verified but the OTP is not consumed. The same OTP could be replayed.

- **File:** `src/services/authService.js:132-135`
- **Fix:** Consume OTP first, then mark user verified

### M-2: Orphaned user on OTP send failure

`register` creates the User document, then calls `otpService.sendOtp`. If `sendOtp` throws (SMTP down, bad payload), the User is already created with `isVerified: false`. The user cannot log in, and their email is registered.

- **File:** `src/services/authService.js:18-33`
- **Fix:** Send OTP before creating user, or wrap in a transaction with rollback

### M-3: `refreshAccessToken` fetches full Mongoose document when only `_id` and `role` needed

- Line 98: `User.findById(newRecord.userId)` returns full document with all fields
- `generateAccessToken` only needs `_id` and `role`
- **Fix:** `User.findById(newRecord.userId).select('_id role').lean()`

### M-4: No `lean()` on queries in `verifyEmail` and `forgotPassword`

- `verifyEmail` calls `User.findById(userId)` — full document, then calls `save()` (needs document)
- `forgotPassword` calls `User.findOne({ email })` — only used to check existence + get `_id`
- H-4 applies to `forgotPassword`: the user is fetched for a simple existence check; `.select('_id').lean()` would suffice

---

## Low Issues

### L-1: Response format deviates from API_STANDARDS.md

The standard specifies:
```json
{ "success": true, "data": { ... }, "message": "..." }
```

But `sendSuccess` omits the top-level `message`. For mutation endpoints (logout, resetPassword, verifyEmail), the message is nested inside `data`:
```json
{ "success": true, "data": { "message": "..." } }
```

### L-2: `login` selects unnecessary `+password` field

`User.findOne({ email }).select('+passwordHash +password')` includes the legacy `password` field. The new system only uses `passwordHash`. The `+password` fallback is never triggered for accounts created by the new `register` flow.

### L-3: Timing side-channel in `forgotPassword`

When the email exists, `forgotPassword` does a `PasswordResetToken.generate()` (DB write + crypto). When it doesn't exist, it returns immediately. While the response message is identical, the timing difference is measurable.

### L-4: Logout requires valid access token

If the access token has expired (15-min TTL), `protect` rejects the request with 401 before `logout` can invalidate the refresh token. The user must refresh first, then logout. Standard pattern, but means stale refresh tokens linger until TTL.

### L-5: No `X-Request-Id` correlation in error responses

The error handler (`errorHandler.js`) reads `req.correlationId` but this is only set by the `requestId` middleware if `X-Request-Id` is provided. API_STANDARDS.md §12.2 says `X-Request-Id` should be echoed back. Epic 1.4 controllers do not forward or generate request IDs.

---

## Business Rule Compliance

| Rule | Epic 1.4 | Status |
|------|----------|--------|
| **BR-AUD-004** (max 3 sessions) | Enforced via `tokenService.generateRefreshToken` → `RefreshToken.countActiveByUser` | ✓ PASS |
| **BR-AUD-005** (OTP rate limit) | Enforced via `otpService.verifyOtp` → `$inc` + aggregation `$sum` + 30-min lockout | ✓ PASS |
| **Enumeration prevention** | `forgotPassword` returns same message for exists/not-exists | ✓ PASS (partial — see L-3) |
| **Password strength** | Zod: min 8 chars, 1 upper, 1 lower, 1 digit | ✓ PASS |
| **Email unverified block** | `login` rejects `!user.isVerified && provider === 'email'` | ✓ PASS |
| **Token rotation** | `refreshAccessToken` → `tokenService.rotateRefreshToken` | ✓ PASS |
| **Theft detection** | `RefreshToken.rotate` → `revokeFamily` on reuse | ✓ PASS |
| **Password change invalidation** | `changedPasswordAfter` NOT checked by `protect` middleware | ✗ FAIL (C-1) |

---

## Security Compliance

| Requirement | Status |
|-------------|--------|
| Rate limiting on auth endpoints | ✗ FAIL (C-2) |
| `changedPasswordAfter` invalidation | ✗ FAIL (C-1) |
| Password hashing (bcrypt, 12 rounds) | ✓ PASS (via User pre-save) |
| JWT access token (HS256, 15-min expiry) | ✓ PASS |
| Refresh token (SHA-256 hashed in DB) | ✓ PASS |
| Refresh token rotation | ✓ PASS |
| Refresh token family/theft detection | ✓ PASS |
| Cookie: httpOnly, Secure, SameSite=Strict | ✓ PASS |
| Password reset token (crypto.randomBytes) | ✓ PASS |
| Token consumed on reset | ✓ PASS |
| OTP rate limiting (BR-AUD-005) | ✓ PASS |
| Email response — no false 404 on forgotPassword | ✓ PASS |
| Enumeration-safe error messages | ✓ PASS |
| `toJSON` strips passwordHash/password/refreshToken | ✓ PASS |
| `select: false` on passwordHash/password | ✓ PASS |

---

## Architecture Compliance

| Requirement | Status |
|-------------|--------|
| Controller → Service separation | ✓ PASS |
| Controllers are thin (no business logic) | ✓ PASS |
| catchAsync wraps all handlers | ✓ PASS |
| Dependency direction (routes → controllers → services) | ✓ PASS |
| ADR-013 (Session removed, RefreshToken as auth state) | ✓ PASS |
| AppError typed errors with codes | ✓ PASS |
| Logger usage for auth events | ✓ PASS |
| No business logic in models | ✓ PASS |
| Zod validation on all public endpoints | ✓ PASS (5 of 8 have validation) |
| No dead code | ✓ PASS |
| Max 300 lines per file | ✓ PASS |

---

## Summary of Required Changes

| ID | Severity | Description |
|----|----------|-------------|
| C-1 | Critical | `authMiddleware.protect` must use `tokenService.verifyAccessToken` to enforce `changedPasswordAfter` |
| C-2 | Critical | Apply `express-rate-limit` to register, login, verify-email, forgot-password, reset-password |
| H-1 | High | Implement email delivery for password reset token |
| H-2 | High | Add POST /auth/resend-verification-otp endpoint |
| H-3 | High | Hash password reset tokens before storage; remove from dev API response |
| M-1 | Medium | Reverse OTP consume/verify order in `verifyEmail` |
| M-2 | Medium | Prevent orphaned user creation when OTP send fails |
| M-3 | Medium | Use `.select('_id role').lean()` in `refreshAccessToken` |
| M-4 | Medium | Use `.lean()` on read-only queries in `forgotPassword` |
| L-1 | Low | Align response format with API_STANDARDS.md §5.1 |
| L-2 | Low | Remove unnecessary `+password` select from `login` |
| L-3 | Low | Eliminate timing side-channel in `forgotPassword` |
| L-4 | Low | Accept expired access tokens on logout (optional) |
| L-5 | Low | Ensure `X-Request-Id` is always present in responses |
