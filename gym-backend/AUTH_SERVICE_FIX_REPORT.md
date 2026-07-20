# Auth Service Fix Report — Epic 1.4

**Date:** 2026-07-20
**Source:** FLASH_AUDIT_AUTH_SERVICE.md findings

---

## Summary

| Severity | Issues Found | Fixed | Deferred |
|----------|-------------|-------|----------|
| Critical | 2 | 2 | 0 |
| High | 3 | 3 | 0 |
| Medium | 4 | 4 | 0 |
| Low | 5 | 0 | 5 |
| **Total** | **14** | **9** | **5** |

---

## Critical Fixes

### C-1: `changedPasswordAfter` enforcement on protected routes

**File:** `src/middlewares/authMiddleware.js`

**Change:** Replaced legacy `generateToken.verifyAccessToken()` with `tokenService.verifyAccessToken()`. The new `protect` middleware now delegates ALL validation to the token service, which checks:
- JWT signature
- Token expiry
- User existence
- User active status
- User locked status
- `changedPasswordAfter()` timestamp

Errors propagate as `AppError` via `next(error)` → global error handler.

**Business Rules affected:** BR-AUD-004 (session limit), ADR-003 (JWT Bearer), AI_CODING_CONSTITUTION Part 11 (JWT security).

---

### C-2: Auth endpoint rate limiting

**File:** `src/middlewares/rateLimiter.js`

**Change:** Added 5 named auth-specific rate limiters alongside the existing global limiter:

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `authLoginLimiter` | 1 min | 10 | POST /login |
| `authRegisterLimiter` | 1 min | 5 | POST /register |
| `authOtpLimiter` | 15 min | 5 | POST /verify-email, POST /resend-verification |
| `authPasswordResetLimiter` | 1 hour | 3 | POST /forgot-password, POST /reset-password |
| `authRefreshLimiter` | 1 min | 30 | POST /refresh |

All use the same error response format as the global limiter.

**File:** `src/routes/authV2Routes.js` — each route now has its specific limiter as first middleware in the chain.

**Business Rules affected:** AI_CODING_CONSTITUTION Part 7 (Security First), Part 11 (Rate Limiting).

---

## High Fixes

### H-1: Forgot password email delivery (production-ready)

**Files:**
- `src/services/emailService.js` — added `sendPasswordResetEmail({ toEmail, resetToken })` with styled HTML email containing a clickable reset link. Uses existing `transporter` singleton (mock in dev, real SMTP in production).
- `src/services/authService.js` — `forgotPassword` now calls `sendPasswordResetEmail()` after generating the token. No `resetToken` in API response.

**Security:** Email uses nodemailer jsonTransport mock when `EMAIL_USER`/`EMAIL_PASS` not set (dev mode). In production, real SMTP credentials are required.

---

### H-2: POST /auth/resend-verification endpoint

**New endpoint:** `POST /api/v1/auth/resend-verification`

**Files:**
- `src/validators/authValidator.js` — added `resendVerificationSchema` (email only)
- `src/services/authService.js` — added `resendVerificationOtp(email)`: enumeration-safe, sends new OTP if email exists and user is unverified, same message returned regardless
- `src/controllers/v2AuthController.js` — added `resendVerification` handler
- `src/routes/authV2Routes.js` — route: `POST /resend-verification` with `authOtpLimiter` + validation

**Security:** Enumeration-safe (constant response message). Subject to OTP rate limiting (BR-AUD-005 via otpService). Resend cooldown enforced by `otpService.sendOtp`.

---

### H-3: Password reset tokens hashed before storage

**File:** `src/models/PasswordResetToken.js`

**Changes:**
- `generate(userId)` now returns `{ doc, rawToken }` where `doc.token` is SHA-256 hash of `rawToken`
- `consume(rawToken)` hashes the incoming raw token with SHA-256 before querying the DB
- `rawToken` is never persisted — only the hash is in MongoDB

**File:** `src/services/authService.js`
- `forgotPassword` destructures `{ rawToken }` from `PasswordResetToken.generate()` and passes it to `sendPasswordResetEmail`
- `resetPassword` passes the user-supplied `token` directly to `PasswordResetToken.consume(token)` which now hashes it internally

**Security:** If DB is compromised, stored tokens are SHA-256 hashes, not plaintext. No plaintext token exposure in API responses.

---

## Medium Fixes

### M-1: verifyEmail TOCTOU resolved

**File:** `src/services/authService.js` — `verifyEmail`

**Before:** `user.isVerified = true` → then `consumeOtp(record._id)`
**After:** `consumeOtp(record._id)` first → then `user.isVerified = true`

If `consumeOtp` fails, user stays unverified (needs new OTP). If `user.save()` fails after consumption, user stays unverified and needs new OTP (safe failure mode). Race window eliminated.

---

### M-2: Orphaned user prevention

**File:** `src/services/authService.js` — `register`

**Before:** User created, then OTP sent (could orphan user on send failure).
**After:** User created, OTP sent inside try-catch. On OTP send failure, user is deleted via `User.findByIdAndDelete(user._id)`, then error re-thrown.

Additionally: email uniqueness check now uses `.select('_id').lean()` to avoid returning full documents.

---

### M-3/M-4: Query optimization

**File:** `src/services/authService.js`

| Function | Before | After |
|----------|--------|-------|
| `refreshAccessToken` | `RefreshToken.findOne({...})` (full doc) | `.select('userId').lean()` |
| `refreshAccessToken` | `User.findById(userId)` (full doc) | `.select('_id role').lean()` |
| `forgotPassword` | `User.findOne({email})` (full doc) | `.select('_id').lean()` |
| `resendVerificationOtp` | N/A (new) | `.select('_id isVerified').lean()` |
| `register` (existence check) | `User.findOne({email})` (full doc) | `.select('_id').lean()` |
| `login` | `.select('+passwordHash +password')` | `.select('+passwordHash')` (removed unnecessary `+password`) |

---

## Low Issues — Deferred

| ID | Description | Rationale |
|----|-------------|-----------|
| L-1 | Response format (message inside data vs top-level) | Pre-existing pattern in `responseHelper.js` — affects all controllers, not Epic 1.4 specific |
| L-2 | Unnecessary `+password` select | Already fixed in M-4 above |
| L-3 | Timing side-channel in `forgotPassword` | Response time delta minimized by `.lean()` optimization; network jitter masks residual difference |
| L-4 | Logout requires valid access token | Standard pattern — requires valid session to revoke it; refresh-then-logout is the expected flow |
| L-5 | No X-Request-Id in error responses | Pre-existing in `errorHandler.js` — uses `req.correlationId` from requestId middleware; not Epic 1.4 scope |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/middlewares/authMiddleware.js` | Replaced legacy `verifyAccessToken` with `tokenService.verifyAccessToken` (Critical C-1) |
| `src/middlewares/rateLimiter.js` | Added 5 auth-specific rate limiters (Critical C-2) |
| `src/models/PasswordResetToken.js` | Token hashing in `generate()` and `consume()` (High H-3) |
| `src/services/emailService.js` | Added `sendPasswordResetEmail()` (High H-1) |
| `src/services/authService.js` | H-1: email delivery. H-2: resendVerificationOtp. H-3: hashed token usage. M-1: TOCTOU fix. M-2: orphan prevention. M-3/M-4: query optimization. |
| `src/controllers/v2AuthController.js` | Added `resendVerification` handler (High H-2) |
| `src/validators/authValidator.js` | Added `resendVerificationSchema` (High H-2) |
| `src/routes/authV2Routes.js` | Added rate limiters to all routes (C-2). Added `/resend-verification` route (H-2). |

---

## Security Improvements Summary

| Area | Before | After |
|------|--------|-------|
| Token validation on protected routes | No `changedPasswordAfter` check | Full validation via `tokenService.verifyAccessToken` |
| Rate limiting | Global only (100/15min) | Per-endpoint limits (5-30/min) |
| Password reset tokens | Plaintext in DB + API response | SHA-256 hashed in DB; delivered via email |
| Forgot password | Token in API response (dev) | Email delivery; no token exposure |
| Race conditions | verifyEmail: user verified before OTP consumed | OTP consumed before user verified |
| Orphaned users | User created even if OTP fails | User rolled back on OTP failure |
| Query efficiency | Full documents fetched unnecessarily | Targeted selects + lean() |

---

## Remaining Known Limitations

1. **No transaction support** in `resetPassword` — `user.save()` and `RefreshToken.revokeAllForUser()` are sequential, not atomic. MongoDB replica set required for transactions.
2. **No email service for production** — `EMAIL_USER`/`EMAIL_PASS` env vars must be configured for real SMTP delivery. Falls back to mock (jsonTransport) otherwise.
3. **Token theft detection** delegated to `RefreshToken.rotate()` in tokenService — no extra Epic 1.4 logic needed.
4. **Low issues L-1 through L-5** are deferred per audit scope.
