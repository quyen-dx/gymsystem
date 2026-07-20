# Epic 1.4 — Core Auth Service & API

## Status: IMPLEMENTED

## Files Created

| File | Purpose |
|------|---------|
| `src/validators/authValidator.js` | Zod schemas for register, login, verifyEmail, forgotPassword, resetPassword |
| `src/services/authService.js` | All auth business logic: register, login, logout, logoutAll, refreshAccessToken, verifyEmail, forgotPassword, resetPassword |
| `src/controllers/v2AuthController.js` | Thin catchAsync handlers for 8 auth endpoints |
| `src/routes/authV2Routes.js` | Route definitions with validation, protect middleware, and rate-limiter scaffolding |

## Files Modified

| File | Change |
|------|--------|
| `src/app.js` | Imported + mounted `authV2Routes` at `POST /api/v1/auth/*` |

## API Endpoints

| Method | Path | Auth | Validator | Service Method |
|--------|------|------|-----------|----------------|
| POST | `/api/v1/auth/register` | Public | `registerSchema` | `authService.register` |
| POST | `/api/v1/auth/login` | Public | `loginSchema` | `authService.login` |
| POST | `/api/v1/auth/refresh` | Cookie | none | `authService.refreshAccessToken` |
| POST | `/api/v1/auth/logout` | `protect` | none | `authService.logout` |
| POST | `/api/v1/auth/logout-all` | `protect` | none | `authService.logoutAll` |
| POST | `/api/v1/auth/verify-email` | Public | `verifyEmailSchema` | `authService.verifyEmail` |
| POST | `/api/v1/auth/forgot-password` | Public | `forgotPasswordSchema` | `authService.forgotPassword` |
| POST | `/api/v1/auth/reset-password` | Public | `resetPasswordSchema` | `authService.resetPassword` |

## Business Rules Enforced

| Rule | Implementation |
|------|---------------|
| BR-AUD-004 (max 3 sessions) | `tokenService.generateRefreshToken` → `RefreshToken.countActiveByUser` → evicts oldest if ≥ 3 |
| BR-AUD-005 (OTP rate limit) | `otpService.verifyOtp` → `$inc attempts` + aggregation `$sum` across 15-min window → lockout at 5 fails |
| Enumeration prevention | `forgotPassword` returns same message whether email exists or not |
| Strong password | Zod: min 8 chars, 1 uppercase, 1 lowercase, 1 digit |
| Email unverified block | `login` rejects `!user.isVerified && provider === 'email'` with 403 |
| Token rotation | `refreshAccessToken` → `tokenService.rotateRefreshToken` (old revoked, new issued, theft detection) |

## Refresh Cookie

| Attribute | Value |
|-----------|-------|
| Name | `refreshToken` |
| HttpOnly | true |
| Secure | true (production) |
| SameSite | Strict |
| Path | `/api/v1/auth` |

## Compilation

All 4 new files and the modified `app.js` compile without syntax or import errors.
