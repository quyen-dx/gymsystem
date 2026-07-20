# JWT Infrastructure Report

> **Sprint:** 1 (Identity)
> **Epic:** 2 — JWT Infrastructure
> **Status:** Complete
> **Date:** 2026-07-20

---

## Objective

Create `tokenService.js` — centralized JWT access token generation/verification and opaque refresh token lifecycle using the RefreshToken model. SHA-256 hashing for fast indexed lookup. BR-AUD-004 enforcement (max 3 active refresh tokens). `changedPasswordAfter()` integration.

---

## Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `src/services/tokenService.js` | All token operations — generate, verify, rotate, revoke |

## Files Modified

None. Existing `src/utils/generateToken.js` preserved for backward compatibility with 40+ existing consumers.

---

## Token Lifecycle

### Access Token

```
generateAccessToken(user)
    │
    └── jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '15m', issuer: 'gym-system', audience: 'user' })
    │
    └── Returns: eyJhbGciOi... (3-part JWT string)
```

**Claims:** `{ id (user._id), role (user.role), iat (issued at), exp (15 min), iss ('gym-system'), aud ('user') }`

### Refresh Token — Generation (Login)

```
generateRefreshToken(user, { userAgent, ip, platform })
    │
    ├── crypto.randomBytes(40) → rawToken (80-char hex)
    ├── crypto.randomUUID() → family
    ├── SHA-256(rawToken) → tokenHash  (stored in DB)
    ├── BR-AUD-004: countActiveByUser(userId)
    │       ├── < 3 → proceed
    │       └── ≥ 3 → invalidate oldest (by createdAt)
    ├── RefreshToken.create({ userId, token: tokenHash, family, deviceInfo, expiresAt })
    ├── User.findByIdAndUpdate(userId, { lastLoginAt: now })
    └── Returns: { token: rawToken, expiresAt, family }
```

### Refresh Token — Rotation

```
rotateRefreshToken(rawToken)
    │
    ├── SHA-256(rawToken) → tokenHash
    ├── RefreshToken.rotate(tokenHash)
    │       ├── NOT FOUND → throw AUTH_TOKEN_EXPIRED (401)
    │       ├── FOUND + already revoked → revokeFamily(family) → throw TOKEN_THEFT_DETECTED (401)
    │       └── FOUND + valid → mark isRevoked: true → return family
    ├── crypto.randomBytes(40) → newRawToken
    ├── SHA-256(newRawToken) → newTokenHash
    ├── RefreshToken.create({ userId, token: newTokenHash, family, deviceInfo, expiresAt })
    └── Returns: { token: newRawToken, expiresAt, family }
```

### Access Token — Verification

```
verifyAccessToken(jwtString)
    │
    ├── jwt.verify(token, JWT_SECRET) → decoded
    │       ├── TokenExpiredError → throw AUTH_TOKEN_EXPIRED (401)
    │       ├── JsonWebTokenError → throw AUTH_INVALID_TOKEN (401)
    │       └── SUCCESS → proceed
    ├── User.findById(decoded.id).select('+password +passwordHash')
    │       ├── null → throw AUTH_USER_NOT_FOUND (401)
    ├── !user.isActive → throw AUTH_USER_INACTIVE (403)
    ├── user.status === 'locked' → throw AUTH_USER_LOCKED (423)
    ├── user.changedPasswordAfter(decoded.iat) → throw AUTH_TOKEN_EXPIRED (401)
    └── Returns: { user, decoded }
```

---

## Security Review

| Check | Status | Details |
|-------|--------|---------|
| JWT secrets from env.js | ✅ | `jwtConfig.secret` — Zod-validated, never hardcoded |
| Access token 15-min expiry | ✅ | Verified: JWT `exp` = `iat` + 900s |
| Refresh token opaque (not JWT) | ✅ | `crypto.randomBytes(40)` — 320 bits of entropy |
| Refresh token hashed before storage | ✅ | SHA-256 — fast indexed lookup, not reversible |
| Token theft detection | ✅ | Reuse of rotated token → `revokeFamily()` → all family tokens invalidated |
| BR-AUD-004 enforced | ✅ | `countActiveByUser()` on login. ≥ 3 → oldest invalidated |
| Password change invalidation | ✅ | `changedPasswordAfter(iat)` checked on every access token verification |
| Locked/inactive user blocked | ✅ | `isActive` check (403) + `status === 'locked'` check (423) |
| User existence check | ✅ | `User.findById` — if null, token is for a deleted user → 401 |
| No raw tokens in logs | ✅ | Only hash stored. Raw token returned once at creation. |

---

## Backward Compatibility

| Existing Code | Compatibility |
|---------------|---------------|
| `generateToken.js` exports (`generateAccessToken`, `verifyAccessToken`, etc.) | ✅ Preserved unchanged. Existing 40+ consumers continue to use it. |
| `authMiddleware.js` using `verifyAccessToken` from `generateToken.js` | ✅ Unchanged. New `tokenService.verifyAccessToken` adds user existence + status checks — will be used in new middleware. |
| `User.refreshToken` field (single token on user doc) | ✅ Preserved. New `RefreshToken` model is separate. Coexistence during transition. |
| `process.env.JWT_SECRET` usage | ⚠️ Existing code uses `process.env` directly. New code uses `env.js` → `jwtConfig.secret`. Same value, different source. |

---

## Self-Review

Per `AI_CODING_CONSTITUTION.md` Part 14:

### Business Logic
- [x] Did I change any business rules? No. BR-AUD-004 enforced via `countActiveByUser()`.
- [x] Did I introduce new business rules? No.

### Scope
- [x] Did I stay within JWT Infrastructure? Yes — tokenService only. No auth service, controllers, routes.

### Code Quality
- [x] Did I introduce duplicate logic? No. SHA-256 hash function centralized in `hashToken()`.
- [x] Did I add console.log? No.
- [x] Did I add TODO/FIXME? No.

### Architecture
- [x] Service imports model and config. Correct direction.
- [x] No circular dependencies.

### Security
- [x] Secrets from env.js, never hardcoded.
- [x] Refresh tokens hashed before storage.

---

## Definition of Done

- [x] `generateAccessToken(user)` returns signed JWT with 15-min expiry
- [x] `generateRefreshToken(user, deviceInfo)` creates RefreshToken doc, returns raw token
- [x] BR-AUD-004 enforced: ≥ 3 active tokens → oldest invalidated
- [x] `verifyAccessToken(token)` verifies JWT + user exists + active + not locked + password not changed
- [x] `rotateRefreshToken(rawToken)` hashes → looks up → rotates → returns new raw token
- [x] Theft detection: reused rotated token → `revokeFamily()` + throw
- [x] `decodeToken(token)` returns decoded payload
- [x] `revokeAllUserTokens(userId)` invalidates all user's tokens
- [x] Access tokens use JWT_HMAC_SHA256 (jsonwebtoken)
- [x] Refresh tokens use SHA-256 for fast indexed DB lookup
- [x] `lastLoginAt` updated on refresh token generation

---

## Git Commit Message

```
feat(auth): add tokenService — JWT access tokens + opaque refresh tokens with rotation

- generateAccessToken(user) — 15-min JWT with { id, role }
- generateRefreshToken(user, deviceInfo) — opaque 80-char hex, SHA-256 hashed in DB
- verifyAccessToken(token) — JWT verify + user exists + active + locked + password check
- rotateRefreshToken(rawToken) — SHA-256 lookup → rotate → new token in family
- BR-AUD-004: max 3 active tokens enforced on generation
- Theft detection: reused rotated token → revokeFamily()
- decodeToken(token) + revokeAllUserTokens(userId)
- Uses env.js for secrets. Existing generateToken.js preserved.

Epic: 2 (JWT Infrastructure)
Sprint: 1 (Identity)
```

---

**JWT Infrastructure complete. Awaiting approval.**
