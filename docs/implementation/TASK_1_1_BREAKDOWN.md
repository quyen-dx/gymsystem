# Task 1.1 Breakdown — User & Auth Model Foundation

> **Parent:** Task 1.1 from `SPRINT_1_TASK_LIST.md`
> **Scope:** 5 Mongoose models matching `DATABASE.md` §2.1 (Session removed per ADR-013)
> **Strategy:** Atomic subtasks, each 1-2 files. User.js split into schema + hooks to isolate risk.

---

## Overview

| Subtask | Scope | Files | Risk |
|---------|-------|-------|------|
| 1.1.1 | User.js — Field Alignment | 1 modify | HIGH — adds `passwordHash`, `address`, `lastLoginAt`, `deletedAt` |
| 1.1.2 | User.js — Hooks + Methods | 1 modify | MEDIUM — pre-save, comparePassword, soft-delete middleware |
| 1.1.3 | OTP.js | 1 create | LOW — new standalone model |
| 1.1.4 | PasswordResetToken.js + SocialAccount.js | 2 create | LOW — two simple models |
| 1.1.5 | RefreshToken.js (+ deviceInfo) | 1 create | MEDIUM — token rotation, theft detection, device tracking, BR-AUD-004 |

---

## Task 1.1.1: User Schema — Field Alignment

| Field | Value |
|-------|-------|
| **Task ID** | 1.1.1 |
| **Objective** | Align User.js schema fields with DATABASE.md. Add missing fields (`passwordHash`, `address`, `lastLoginAt`, `deletedAt`). Deprecate `password` field (migration path to `passwordHash`). Add indexes specified in DATABASE.md. |
| **Files to Create** | None |
| **Files to Modify** | `src/models/User.js` — Schema definition section only (fields + indexes). Do NOT touch pre-save hooks, methods, or statics. |
| **Collections Affected** | `users` |
| **Business Rules** | BR-AUD-002 (GDPR — `deletedAt` for soft-delete/anonymization prep) |
| **Complexity** | HIGH — field renames risk breaking 40+ consumers. |

### Exact Changes

1. **Add `passwordHash` field** alongside existing `password` field:
   ```js
   passwordHash: { type: String, default: null, select: false }
   ```
   Keep `password` field for backward compatibility. Add comment: "DEPRECATED — migrate to passwordHash. Remove in Sprint 2."

2. **Add `address` embedded object:**
   ```js
   address: {
     street: { type: String, default: '', trim: true },
     ward: { type: String, default: '', trim: true },
     district: { type: String, default: '', trim: true },
     city: { type: String, default: '', trim: true },
   }
   ```
   Note: Don't remove existing `province`, `detailedAddress` fields yet — they may be used by frontend. Add both. Consolidation is a future migration.

3. **Add `lastLoginAt`:**
   ```js
   lastLoginAt: { type: Date, default: null }
   ```

4. **Add `deletedAt`:**
   ```js
   deletedAt: { type: Date, default: null }
   ```

5. **Add missing indexes:**
   - `{ role: 1, isActive: 1 }` — for admin user listing queries
   - `{ deletedAt: 1 }` (sparse) — for soft-delete filtering efficiency

6. **Verify existing fields match DATABASE.md:**
   - `email` ✓ (unique, sparse, lowercase, trimmed)
   - `phone` ✓ (unique, sparse, trimmed)
   - `avatar` ✓ (String)
   - `role` ✓ (enum includes `seller` per PERMISSION_MATRIX)
   - `gender` ✓ (enum)
   - `dateOfBirth` ✓
   - `name` ✓ (required, trimmed)

### Acceptance Criteria

- **AC-1.1.1.1:** `User.schema.paths` contains `passwordHash`, `address`, `lastLoginAt`, `deletedAt`.
- **AC-1.1.1.2:** `User.schema.paths.password` still exists (backward compat). Both `password` and `passwordHash` have `select: false`.
- **AC-1.1.1.3:** `User.schema._indexes` contains `{ role: 1, isActive: 1 }` and `{ deletedAt: 1 }` (sparse).
- **AC-1.1.1.4:** Existing consumers compile without errors. `new User({ email: 'test@test.com', password: 'secret' }).save()` still works.
- **AC-1.1.1.5:** `address` object accepts `{ street, ward, district, city }`.

### Definition of Done

- [ ] All 4 new fields added with correct types and defaults.
- [ ] Both indexes added to schema.
- [ ] `password` field NOT removed (backward compat).
- [ ] `mongoose.model('User')` compiles without schema errors.
- [ ] No modification to hooks, methods, or statics.

### Review Checklist

- [ ] `passwordHash` has `select: false` (never exposed in queries by default).
- [ ] `deletedAt` has sparse index (null values not indexed).
- [ ] `address` fields have `default: ''` (null-safe for frontend).
- [ ] No consumer imports broken.

### Commit Point

`feat(auth): add passwordHash, address, lastLoginAt, deletedAt fields to User schema`

---

## Task 1.1.2: User Hooks + Methods — Password, Soft-Delete, Security

| Field | Value |
|-------|-------|
| **Task ID** | 1.1.2 |
| **Objective** | Add/update Mongoose hooks and instance methods: password hashing on `passwordHash`, `comparePassword()` with fallback, soft-delete query filtering, `changedPasswordAfter()`, and `toJSON()` stripping. |
| **Files to Create** | None |
| **Files to Modify** | `src/models/User.js` — Hooks and methods section only. Do NOT touch schema fields from 1.1.1. |
| **Collections Affected** | `users` |
| **Business Rules** | BR-AUD-002 (soft-delete for GDPR compliance) |
| **Complexity** | MEDIUM |

### Exact Changes

1. **Update pre-save password hashing hook** to hash both `password` and `passwordHash` (migration support):
   ```js
   // Hash passwordHash if modified; also sync from password if set
   userSchema.pre('save', async function () {
     if (this.isModified('passwordHash') && this.passwordHash) {
       this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
     }
     // Migration: if password is set but passwordHash is not, copy + hash
     if (this.isModified('password') && this.password && !this.passwordHash) {
       this.passwordHash = await bcrypt.hash(this.password, 12)
       this.password = undefined // clear old field after migration
     }
   })
   ```

2. **Update `comparePassword()`** to check `passwordHash` first, fall back to `password`:
   ```js
   userSchema.methods.comparePassword = async function (candidate) {
     if (this.passwordHash) return bcrypt.compare(candidate, this.passwordHash)
     if (this.password) return bcrypt.compare(candidate, this.password)
     return false
   }
   ```

3. **Add `changedPasswordAfter(JWTTimestamp)`:**
   ```js
   userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
     if (this.updatedAt) {
       const changedAt = Math.floor(this.updatedAt.getTime() / 1000)
       return jwtTimestamp < changedAt
     }
     return false
   }
   ```

4. **Add soft-delete query middleware:**
   ```js
   userSchema.pre(/^find/, function (next) {
     if (!this.getQuery().includeDeleted) {
       this.where({ deletedAt: null })
     }
     next()
   })
   ```

5. **Add `softDelete()` instance method:**
   ```js
   userSchema.methods.softDelete = function () {
     this.deletedAt = new Date()
     this.isActive = false
     return this.save()
   }
   ```

6. **Update `toJSON()`** to strip `passwordHash` (replace current `delete obj.password`):
   Already strips `password`. Add `delete obj.passwordHash`.

### Acceptance Criteria

- **AC-1.1.2.1:** Saving user with `password: 'secret'` sets `passwordHash` (bcrypt hash). `password` field cleared to `undefined`.
- **AC-1.1.2.2:** Saving user with `passwordHash: 'secret'` hashes it.
- **AC-1.1.2.3:** `comparePassword('correct')` returns `true`. `comparePassword('wrong')` returns `false`. Works with both `passwordHash` and legacy `password`.
- **AC-1.1.2.4:** `User.find()` excludes documents where `deletedAt` is not null, unless `includeDeleted: true` is passed in query.
- **AC-1.1.2.5:** `user.softDelete()` sets `deletedAt` and `isActive: false`, then saves.
- **AC-1.1.2.6:** `changedPasswordAfter(timestamp)` returns `true` if `updatedAt` > timestamp.
- **AC-1.1.2.7:** `user.toJSON()` does not contain `passwordHash` or `password`.

### Definition of Done

- [ ] Pre-save hook hashes `passwordHash` (and migrates `password`→`passwordHash`).
- [ ] `comparePassword()` works with both fields.
- [ ] Soft-delete query middleware filters by default.
- [ ] `changedPasswordAfter()` correctly compares timestamps.
- [ ] All existing hook behavior preserved (memberCode generation, validation).

### Review Checklist

- [ ] Pre-save hook checks `this.isModified('passwordHash')` before rehashing.
- [ ] Soft-delete middleware uses `this.getQuery().includeDeleted` — does NOT break `findById()` or `findOne()`.
- [ ] `comparePassword()` handles both `null` cases safely.
- [ ] `toJSON()` does not expose `passwordHash`.

### Commit Point

`feat(auth): add password hashing migration, soft-delete hooks, comparePassword, changedPasswordAfter`

---

## Task 1.1.3: OTP Model

| Field | Value |
|-------|-------|
| **Task ID** | 1.1.3 |
| **Objective** | Create OTP Mongoose model matching DATABASE.md §2.1 exactly. TTL index for auto-expiry. Enum validation on `type`. Attempt tracking with max 5. |
| **Files to Create** | `src/models/OTP.js` |
| **Files to Modify** | None |
| **Collections Affected** | `otps` |
| **Business Rules** | BR-AUD-005 (attempts tracking — max 5 per OTP) |
| **Complexity** | LOW |

### Exact Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `code` | String | ✅ | — | 6-digit code |
| `type` | String | ✅ | — | enum: `email_verification`, `password_reset`, `phone_verification`, `login` |
| `expiresAt` | Date | ✅ | — | TTL index auto-deletes 5 min after this |
| `consumedAt` | Date | — | null | Set on successful verify |
| `attempts` | Number | — | 0 | Incremented on failed verify. Max 5 check enforced at service layer. |

### Indexes

- `{ userId: 1, type: 1 }` — for rate-limit queries per user per type
- `{ expiresAt: 1 }` with `expireAfterSeconds: 300` — TTL (documents deleted 5 min after `expiresAt`)
- `timestamps: true`

### Static Methods

- `generate(userId, type)` — creates OTP with 6-digit random code, 5-min expiry. Returns document.

### Acceptance Criteria

- **AC-1.1.3.1:** OTP schema has all 6 fields with correct types and enum validation.
- **AC-1.1.3.2:** TTL index exists on `expiresAt`. Document auto-deleted 5 min after expiry.
- **AC-1.1.3.3:** `type` enum rejects values outside `[email_verification, password_reset, phone_verification, login]`.
- **AC-1.1.3.4:** `OTP.generate(userId, 'email_verification')` returns saved document with 6-digit `code`.

### Definition of Done

- [ ] All fields match DATABASE.md.
- [ ] TTL index created and verified.
- [ ] `generate()` static method working.
- [ ] No imports from services/controllers (model is leaf node).

### Review Checklist

- [ ] `expiresAt` TTL uses `expireAfterSeconds: 300` (5 min buffer after expiry).
- [ ] `attempts` default is 0, not null.
- [ ] `userId` uses `ref: 'User'`.

### Commit Point

`feat(auth): add OTP model with TTL index, attempts tracking, generate static`

---

## Task 1.1.4: PasswordResetToken + SocialAccount Models

| Field | Value |
|-------|-------|
| **Task ID** | 1.1.4 |
| **Objective** | Create two simple Mongoose models matching DATABASE.md §2.1. PasswordResetToken with consume tracking and TTL. SocialAccount with compound unique provider index. |
| **Files to Create** | `src/models/PasswordResetToken.js`, `src/models/SocialAccount.js` |
| **Files to Modify** | None |
| **Collections Affected** | `password_reset_tokens`, `social_accounts` |
| **Business Rules** | None — structural models. |
| **Complexity** | LOW |

### PasswordResetToken Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `token` | String | ✅ | — | Unique index. Random hex or UUID. |
| `expiresAt` | Date | ✅ | — | 1 hour from creation |
| `usedAt` | Date | — | null | Set when consumed |

**Indexes:** `{ token: 1 }` (unique), `{ expiresAt: 1 }` (TTL, `expireAfterSeconds: 3600`). `timestamps: true`.

**Static:** `generate(userId)` — creates token with 1-hour expiry. Returns document.
**Static:** `consume(token)` — sets `usedAt` on matching unexpired, unconsumed token. Returns document or null.

### SocialAccount Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `provider` | String | ✅ | — | enum: `google`, `facebook`, `apple` |
| `providerId` | String | ✅ | — | The user's ID on the provider platform |
| `profileUrl` | String | — | null | |
| `metadata` | Object | — | {} | Raw provider profile data |

**Indexes:** `{ provider: 1, providerId: 1 }` (unique compound), `{ userId: 1 }`. `timestamps: true`.

### Acceptance Criteria

- **AC-1.1.5.1:** `PasswordResetToken.generate(userId)` returns document with 1-hour `expiresAt`.
- **AC-1.1.5.2:** `PasswordResetToken.consume(token)` sets `usedAt`. Returns null for expired or already-consumed token.
- **AC-1.1.5.3:** `SocialAccount` compound unique index prevents duplicate `(provider, providerId)` pairs.
- **AC-1.1.5.4:** `SocialAccount.provider` enum rejects values outside `[google, facebook, apple]`.

### Definition of Done

- [ ] Both models match DATABASE.md fields/types/indexes.
- [ ] `generate()` and `consume()` statics on PasswordResetToken.
- [ ] Compound unique index on SocialAccount verified.
- [ ] No imports from services/controllers.

### Review Checklist

- [ ] PasswordResetToken `consume()` uses `findOneAndUpdate` with guard `{ usedAt: null, expiresAt: { $gt: new Date() } }`.
- [ ] SocialAccount `metadata` is Mixed type (flexible for provider-specific data).

### Commit Point

`feat(auth): add PasswordResetToken and SocialAccount models`

---

## Task 1.1.5: RefreshToken Model (+ deviceInfo + BR-AUD-004)

| Field | Value |
|-------|-------|
| **Task ID** | 1.1.5 |
| **Objective** | Create RefreshToken Mongoose model matching DATABASE.md §2.1. Token family rotation, theft detection, device tracking (absorbed from removed Session model), and BR-AUD-004 concurrent login enforcement. |
| **Files to Create** | `src/models/RefreshToken.js` |
| **Files to Modify** | None |
| **Collections Affected** | `refresh_tokens` |
| **Business Rules** | BR-AUD-004 (max 3 concurrent logins — enforced via `countActiveByUser` on this model) |
| **Complexity** | MEDIUM (was LOW; increased due to absorbed Session responsibility) |

### Exact Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | ✅ | — | |
| `token` | String | ✅ | — | The hashed refresh token. Unique index. |
| `family` | String | ✅ | — | UUID grouping tokens in rotation chain |
| `deviceInfo` | Object | — | {} | `{ userAgent, ip, platform }` — captured on login |
| `isRevoked` | Boolean | — | false | Set true on rotation or revocation |
| `expiresAt` | Date | ✅ | — | 7 days from creation |

### Indexes

- `{ token: 1 }` (unique) — token lookup during refresh
- `{ userId: 1, family: 1 }` — for revoking entire family on theft detection
- `{ expiresAt: 1 }` with `expireAfterSeconds: 604800` — TTL (documents deleted 7 days after `expiresAt`)
- `timestamps: true`
- Note: `createdAt` (from timestamps) replaces Session.createdAt for "oldest login" detection in BR-AUD-004.

### Static Methods

- `rotate(token)` — finds token, marks `isRevoked: true`, creates new token in same `family`. Returns new document. If token already revoked → calls `revokeFamily(family)` and throws `AppError('TOKEN_THEFT_DETECTED')`.
- `revokeFamily(family)` — sets `isRevoked: true` on ALL tokens in given family. Returns count.
- `revokeAllForUser(userId)` — revokes all refresh tokens for a user. Used on password change or forced logout.
- `countActiveByUser(userId)` — counts tokens where `isRevoked: false` AND `expiresAt > now`. Used to enforce BR-AUD-004 (max 3).

### Acceptance Criteria

- **AC-1.1.5.1:** `RefreshToken` schema has all 6 fields with correct types, including `deviceInfo`.
- **AC-1.1.5.2:** `token` has unique index.
- **AC-1.1.5.3:** `{ userId: 1, family: 1 }` compound index exists.
- **AC-1.1.5.4:** `rotate(token)` creates new token in same family, invalidates old.
- **AC-1.1.5.5:** `rotate(token)` with already-revoked token calls `revokeFamily(family)` (theft detection).
- **AC-1.1.5.6:** `revokeAllForUser(userId)` sets `isRevoked: true` on all user's tokens.
- **AC-1.1.5.7:** `countActiveByUser(userId)` returns count of non-revoked, non-expired tokens (BR-AUD-004 enforcement).
- **AC-1.1.5.8:** `deviceInfo` captures `{ userAgent, ip, platform }` on document creation.

### Definition of Done

- [ ] All fields match DATABASE.md.
- [ ] All 3 indexes created and verified.
- [ ] `rotate()`, `revokeFamily()`, `revokeAllForUser()` statics working.
- [ ] Theft detection throws `AppError`.
- [ ] No imports from services/controllers (except `AppError` for theft detection).

### Review Checklist

- [ ] `token` stores HASHED refresh token, not raw (hashing happens in `tokenService.js`, not in model).
- [ ] `family` is a UUID string generated at first token creation.
- [ ] `rotate()` is atomic — uses `findOneAndUpdate` with guard `{ isRevoked: false }`.
- [ ] `revokeFamily()` is bulk — `updateMany({ family, isRevoked: false }, { isRevoked: true })`.

### Commit Point

`feat(auth): add RefreshToken model with family rotation, theft detection, revoke methods`

---

## Execution Order

```
1.1.1 (User Schema) ──► 1.1.2 (User Hooks)     ← sequential (hooks depend on schema fields)
         │
         ├──► 1.1.3 (OTP)                       ← parallel
         ├──► 1.1.4 (PasswordResetToken + SocialAccount) ← parallel
         └──► 1.1.5 (RefreshToken + deviceInfo)   ← parallel
```

Tasks 1.1.3 through 1.1.5 are independent of each other and can run in parallel after 1.1.1.

---

## Review Gates

| Gate | After | What to Verify |
|------|-------|----------------|
| G-1 | 1.1.1 | All 4 new User fields exist. Indexes added. Existing consumers unbroken. |
| G-2 | 1.1.2 | Password hashing works. Soft-delete filters queries. comparePassword backward-compatible. |
| G-3 | 1.1.3–1.1.5 | All 4 new models compile. Indexes match DATABASE.md. Static methods work. RefreshToken includes deviceInfo + countActiveByUser. |
| G-4 | ALL | `node -e "Object.keys(require('./src/models/User').schema.paths)"` shows all fields. |

---

## Total Files Summary

| Subtask | Files Created | Files Modified | Collections |
|---------|--------------|----------------|-------------|
| 1.1.1 | 0 | 1 (User.js) | users |
| 1.1.2 | 0 | 1 (User.js) | users |
| 1.1.3 | 1 (OTP.js) | 0 | otps |
| 1.1.4 | 2 (PasswordResetToken.js, SocialAccount.js) | 0 | password_reset_tokens, social_accounts |
| 1.1.5 | 1 (RefreshToken.js) | 0 | refresh_tokens |
| **Total** | **4** | **1** (modified twice) | **5** |
