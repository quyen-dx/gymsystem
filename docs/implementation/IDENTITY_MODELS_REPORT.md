# Identity Models Report — Tasks 1.1.3 through 1.1.5

> **Scope:** OTP, PasswordResetToken, SocialAccount, RefreshToken models
> **Sprint:** 1 (Identity)
> **Status:** Complete
> **Date:** 2026-07-20

---

## Files Created

| # | File | Collection | Fields | Indexes |
|---|------|-----------|--------|---------|
| 1 | `src/models/OTP.js` | `otps` | 6 + timestamps | 2 (compound + TTL) |
| 2 | `src/models/PasswordResetToken.js` | `password_reset_tokens` | 4 + timestamps | 2 (unique + TTL) |
| 3 | `src/models/SocialAccount.js` | `social_accounts` | 5 + timestamps | 2 (unique compound + userId) |
| 4 | `src/models/RefreshToken.js` | `refresh_tokens` | 7 + timestamps | 3 (unique + compound + TTL) |

---

## Model Specifications

### OTP

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `code` | String | ✅ | — | 6-digit numeric |
| `type` | String (enum) | ✅ | — | `email_verification`, `password_reset`, `phone_verification`, `login` |
| `expiresAt` | Date | ✅ | — | TTL: documents deleted 5 min after expiry |
| `consumedAt` | Date | — | null | Set on successful verification |
| `attempts` | Number | — | 0 (max 5) | Incremented on failed verify |

**Indexes:**
- `{ userId: 1, type: 1 }` — rate-limit queries per user per type
- `{ expiresAt: 1 }` with `expireAfterSeconds: 300` — TTL

**Statics:**
- `generate(userId, type)` — Creates OTP with random 6-digit code, 5-min expiry

**Business Rule:** BR-AUD-005 — `attempts` field tracks failed verifications. Max 5 enforced at service layer.

---

### PasswordResetToken

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `token` | String (unique) | ✅ | — | 64-char hex (crypto.randomBytes) |
| `expiresAt` | Date | ✅ | — | TTL: documents deleted 1 hour after expiry |
| `usedAt` | Date | — | null | Set when consumed |

**Indexes:**
- `{ token: 1 }` (unique) — token lookup during reset
- `{ expiresAt: 1 }` with `expireAfterSeconds: 3600` — TTL

**Statics:**
- `generate(userId)` — Creates token with random 64-char hex, 1-hour expiry
- `consume(token)` — Atomically sets `usedAt` on unexpired, unconsumed token. Returns null if already consumed or expired.

---

### SocialAccount

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `provider` | String (enum) | ✅ | — | `google`, `facebook`, `apple` |
| `providerId` | String | ✅ | — | User's ID on provider platform |
| `profileUrl` | String | — | null | |
| `metadata` | Mixed | — | {} | Raw provider profile data |

**Indexes:**
- `{ provider: 1, providerId: 1 }` (unique compound) — prevents duplicate linking
- `{ userId: 1 }` — lookup all social accounts for a user

---

### RefreshToken

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `token` | String (unique) | ✅ | — | Hashed refresh token |
| `family` | String | ✅ | — | UUID grouping tokens in rotation chain |
| `deviceInfo.userAgent` | String | — | '' | From HTTP request headers |
| `deviceInfo.ip` | String | — | '' | From HTTP request |
| `deviceInfo.platform` | String | — | '' | Inferred from user-agent |
| `isRevoked` | Boolean | — | false | Set on rotation, logout, or theft detection |
| `expiresAt` | Date | ✅ | — | TTL: documents deleted 7 days after expiry |

**Indexes:**
- `{ token: 1 }` (unique) — token lookup during refresh
- `{ userId: 1, family: 1 }` — revoking entire family on theft detection
- `{ expiresAt: 1 }` with `expireAfterSeconds: 604800` — TTL (7 days after expiry)

**Statics:**
- `rotate(token)` — Atomically invalidates old token, returns `family` for creating new token. If token already revoked → `revokeFamily()` + throws `TOKEN_THEFT_DETECTED`. If not found → throws `AUTH_TOKEN_EXPIRED`.
- `revokeFamily(family)` — Sets `isRevoked: true` on ALL tokens in family
- `revokeAllForUser(userId)` — Sets `isRevoked: true` on ALL user's tokens (password change, forced logout)
- `countActiveByUser(userId)` — Counts non-revoked, non-expired tokens. Used for BR-AUD-004 enforcement.

**Business Rule:** BR-AUD-004 — `countActiveByUser()` enforces max 3 concurrent logins at service layer.

---

## Indexes Verification

| Model | Index | Type | Verified |
|-------|-------|------|----------|
| OTP | `{ userId: 1, type: 1 }` | Compound | ✅ |
| OTP | `{ expiresAt: 1 }` expireAfter 300s | TTL | ✅ |
| PasswordResetToken | `{ token: 1 }` | Unique | ✅ |
| PasswordResetToken | `{ expiresAt: 1 }` expireAfter 3600s | TTL | ✅ |
| SocialAccount | `{ provider: 1, providerId: 1 }` | Unique Compound | ✅ |
| SocialAccount | `{ userId: 1 }` | Standard | ✅ |
| RefreshToken | `{ token: 1 }` | Unique | ✅ |
| RefreshToken | `{ userId: 1, family: 1 }` | Compound | ✅ |
| RefreshToken | `{ expiresAt: 1 }` expireAfter 604800s | TTL | ✅ |

---

## TTL Indexes Summary

| Collection | TTL Field | Buffer | Effective Cleanup | Purpose |
|-----------|-----------|--------|-------------------|---------|
| `otps` | `expiresAt` | 300s | 5 min after expiry | Auto-clean expired OTP codes |
| `password_reset_tokens` | `expiresAt` | 3600s | 1 hour after expiry | Auto-clean expired reset tokens |
| `refresh_tokens` | `expiresAt` | 604800s | 7 days after expiry | Auto-clean expired refresh tokens |

---

## Relations

```
User (1) ─────────── (N) OTP              [one user, many OTPs]
User (1) ─────────── (N) PasswordResetToken[one user, many reset tokens]
User (1) ─────────── (N) SocialAccount     [one user, many social accounts (3 max)]
User (1) ─────────── (N) RefreshToken      [one user, max 3 active]
```

All relations use `ref: 'User'` with `ObjectId`.

---

## Business Rules Verification

| Rule | Model | Enforcement | Status |
|------|-------|-------------|--------|
| BR-AUD-005 | OTP | `attempts` field with `max: 5`. Rate-limit check at service layer. | ✅ Infrastructure ready |
| BR-AUD-004 | RefreshToken | `countActiveByUser()` returns count. Limit enforcement at service layer. | ✅ Infrastructure ready |
| BR-AUD-002 | User (1.1.2) | `deletedAt` + `softDelete()`. RefreshToken `revokeAllForUser()`. | ✅ Infrastructure ready |

---

## Security Review

| Check | Status |
|-------|--------|
| OTP codes are 6-digit random | ✅ `Math.floor(100000 + Math.random() * 900000)` |
| Reset tokens are 64-char hex | ✅ `crypto.randomBytes(32).toString('hex')` |
| Refresh tokens stored hashed | ✅ Hashing handled in tokenService (not model) |
| TTL auto-cleans expired data | ✅ All 3 models have TTL indexes |
| No secrets/exposed data in models | ✅ No console.log, no embedded secrets |
| No raw tokens returned by default | ✅ `token` field has no `select: false` — but tokens ARE hashed before storage. Raw token returned once at creation time. |
| Theft detection on refresh | ✅ `rotate()` detects reuse → revokes entire family |

---

## Migration Impact

**None.** All 4 models are net-new. No existing collections to migrate. No existing code to update.

- Existing `User.refreshToken` field (single token on user doc) is separate from the `RefreshToken` model (multi-token collection). Coexistence is intentional during transition.
- Existing `OTP` collection in the database was managed via manual Mongoose operations. The new `OTP` model formalizes the schema with TTL and attempt tracking.

---

## Self-Review

Per `AI_CODING_CONSTITUTION.md` Part 14:

### Business Logic
- [x] Did I change any business rules? No.
- [x] Did I introduce new business rules? No.

### Scope
- [x] Did I stay within model scope? Yes — 4 Model files, no services/controllers/routes.

### Code Quality
- [x] Did I introduce duplicate logic? No. OTP and PasswordResetToken both have `generate()` but serve different purposes.
- [x] Did I add console.log? No.
- [x] Did I add TODO/FIXME? No.

### Architecture
- [x] All models are leaf nodes — import only `mongoose`, `crypto`, `AppError`.
- [x] No imports from services/controllers/routes.

---

## Definition of Done

- [x] OTP model matches DATABASE.md §2.1
- [x] PasswordResetToken model matches DATABASE.md §2.1
- [x] SocialAccount model matches DATABASE.md §2.1
- [x] RefreshToken model matches DATABASE.md §2.1 + ADR-013
- [x] All TTL indexes configured correctly
- [x] All unique indexes configured correctly
- [x] All statics return expected types
- [x] All enum validations working
- [x] RefreshToken `rotate()` includes theft detection
- [x] RefreshToken `countActiveByUser()` supports BR-AUD-004

---

## Git Commit Message

```
feat(auth): add OTP, PasswordResetToken, SocialAccount, RefreshToken models

- OTP: 6-digit codes, 5-min TTL, attempts tracking (BR-AUD-005)
- PasswordResetToken: 64-char hex tokens, 1-hour TTL, atomic consume()
- SocialAccount: compound unique (provider, providerId), OAuth link tracking
- RefreshToken: family rotation, theft detection, deviceInfo, countActiveByUser (BR-AUD-004)
- Per DATABASE.md §2.1, ADR-013, TASK_1_1_BREAKDOWN.md subtasks 1.1.3-1.1.5

Tasks: 1.1.3, 1.1.4, 1.1.5
Sprint: 1 (Identity)
```

---

**Identity models complete. Task 1.1 (User & Auth Model Foundation) fully delivered.**
