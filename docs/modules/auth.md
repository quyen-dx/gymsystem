# Auth Module

- **Owner**: Platform Team
- **Dependencies**: None (foundational module)
- **Related Documents**: [BUSINESS_RULES.md](../BUSINESS_RULES.md), [ERROR_HANDLING.md](../ERROR_HANDLING.md), [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md)

## Purpose
Handles all authentication and authorization concerns including user registration, login, session management, password recovery, and social authentication via Google/Facebook OAuth. Provides JWT-based token issuance with refresh rotation for secure stateless auth.

## Models
| Model | Description |
|---|---|
| `User` | Core user profile: email, password hash, full name, phone, role, status, verification flags |
| `OTP` | One-time passwords for email verification, login 2FA, and password reset |
| `Session` | Active user sessions with device info, IP, last activity, and refresh token hash |
| `PasswordResetToken` | Time-limited tokens for forgot-password flow |
| `SocialAccount` | Linked social provider accounts (Google/Facebook) per user |
| `RefreshToken` | Refresh token family with rotation tracking and revocation support |

## Services
| Service | Key Methods |
|---|---|
| `authService` | `register()`, `login()`, `refresh()`, `logout()`, `forgotPassword()`, `resetPassword()`, `verifyOTP()`, `socialLogin()` |
| `otpService` | `generateOTP()`, `sendOTP()`, `verifyOTP()`, `checkRateLimit()` |
| `tokenService` | `generateAccessToken()`, `generateRefreshToken()`, `rotateRefreshToken()`, `revokeRefreshToken()` |
| `sessionService` | `createSession()`, `validateSession()`, `invalidateSession()`, `listActiveSessions()` |

## Controllers
| Controller | Endpoints |
|---|---|
| `authController` | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/otp/verify` |
| `socialAuthController` | `POST /auth/social/google`, `POST /auth/social/facebook` |

## Business Rules
| Rule | Description |
|---|---|
| BR-AUD-004 | Concurrent session limit: max 3 devices per member |
| BR-AUD-005 | Rate limiting: max 5 failed OTP attempts per 15 minutes |
| BR-NTF-003 | Transactional notifications (password change, security alerts) cannot be opted out of |

## States
No state machine. User status flags: `active`, `inactive`, `locked`, `unverified`.

## Key Flows

### Registration (Email + OTP)
1. User submits email, password, name → `POST /auth/register`
2. System validates input, checks uniqueness
3. User record created with status `unverified`
4. OTP sent to email
5. User calls `POST /auth/otp/verify` with OTP
6. User status set to `active`, welcome notification sent

### Login (Email + Password + 2FA)
1. User submits credentials → `POST /auth/login`
2. Validate password hash against stored hash
3. If 2FA enabled, OTP sent to registered email/phone
4. Client calls `POST /auth/otp/verify` with session token
5. On success: access token + refresh token issued
6. Session recorded; concurrent session limit enforced (BR-AUD-004)

### Social Login (Google/Facebook OAuth)
1. Client obtains provider access token via OAuth flow
2. Client posts token to `POST /auth/social/google` (or `/facebook`)
3. Backend verifies token with provider API
4. If email matches existing user → link account, issue tokens
5. If new email → create user record, link social account

### Token Refresh Rotation
1. Client sends refresh token to `POST /auth/refresh`
2. Validate refresh token signature and expiry
3. Rotate: old refresh token revoked, new pair issued
4. If refresh token is reused after rotation → all tokens for that family revoked (theft detection)

## API Endpoints
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/auth/register` | Public | — | Register new user |
| POST | `/auth/login` | Public | — | Login with email + password |
| POST | `/auth/refresh` | Public | — | Refresh access token |
| POST | `/auth/logout` | Required | All | Invalidate session |
| POST | `/auth/forgot-password` | Public | — | Send password reset email |
| POST | `/auth/reset-password` | Public | — | Reset password with token |
| POST | `/auth/otp/verify` | Public | — | Verify OTP code |
| POST | `/auth/social/google` | Public | — | Google OAuth login |
| POST | `/auth/social/facebook` | Public | — | Facebook OAuth login |

## Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_INVALID_TOKEN` | 401 | Token malformed or tampered |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role/scope |
| `AUTH_USER_NOT_FOUND` | 404 | User record does not exist |
| `VALIDATION_INVALID_FORMAT` | 400 | Invalid email format, weak password, etc. |
| `VALIDATION_REQUIRED_FIELD` | 400 | Missing required field |

## Testing
- Registration: duplicate email, weak password, OTP expiry
- Login: wrong password, locked account, concurrent session limit
- Token refresh: rotation theft detection, expired token
- Social login: provider token invalid, email already linked to different provider
- Rate limiting on OTP verification (BR-AUD-005)

## Future
- Biometric authentication (fingerprint / face ID)
- Passkey / WebAuthn support
- OAuth 2.0 + OpenID Connect provider mode (3rd-party app auth)
- Adaptive MFA (risk-based step-up authentication)
