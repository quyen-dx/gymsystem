# Task 1.1.2 — Implementation Report

> **Task:** 1.1.2 — User Schema Hooks & Methods
> **Sprint:** 1 (Identity)
> **Status:** Complete
> **Date:** 2026-07-20

---

## Objective

Update User.js hooks and methods: password hashing migration from `password` to `passwordHash`, backward-compatible `comparePassword()`, `changedPasswordAfter()` for JWT token invalidation, soft-delete query middleware, `softDelete()` instance method, and hardened `toJSON()`.

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/models/User.js` | 4 edits: pre-save hook replaced, soft-delete middleware added, `comparePassword` enhanced, `changedPasswordAfter` + `softDelete` added, `toJSON` hardened |

---

## Hook Flow Diagram

```
SAVE USER
    │
    ├── pre('save'): Password Hashing
    │       │
    │       ├── isModified('passwordHash') && passwordHash?
    │       │       └── YES → bcrypt.hash(passwordHash, 12)
    │       │
    │       └── isModified('password') && password && !passwordHash?
    │               └── YES → MIGRATE:
    │                       passwordHash = bcrypt.hash(password, 12)
    │                       password = undefined (cleared for safety)
    │
    ├── pre('save'): Member Code (unchanged)
    │
    ├── pre('validate'): Email/Phone required (unchanged)
    │
    └── pre(/^find/): Soft-Delete Filter
            │
            └── getQuery().includeDeleted?
                    ├── NO → this.where({ deletedAt: null })
                    └── YES → skip (admin audit queries)
```

---

## Password Migration Flow

```
BEFORE: User document has password: "$2b$12$abc..." (bcrypt hash)
         User document has passwordHash: null

SAVE (any update, e.g. profile change):
    │
    ├── password is NOT modified → skip
    │   passwordHash is NOT modified → skip
    │   RESULT: User keeps existing password field. No change.

SAVE (explicit password update via changePassword API):
    │
    ├── password is modified AND passwordHash is null
    │       → passwordHash = bcrypt.hash(newPassword, 12)
    │       → password = undefined
    │   RESULT: User now has passwordHash only. password cleared.

SAVE (new user via register API, using passwordHash directly):
    │
    ├── passwordHash is modified AND passwordHash is set
    │       → passwordHash = bcrypt.hash(passwordHash, 12)
    │   RESULT: passwordHash is hashed. password stays undefined.

Legacy users (password only, never updated):
    LOGIN:
    │
    ├── comparePassword(candidate)
    │       → this.passwordHash? → null → skip
    │       → this.password? → "$2b$12$abc..." → bcrypt.compare(candidate, hash)
    │   RESULT: Legacy users authenticate successfully. No migration needed on login.
```

---

## Backward Compatibility Verification

| Scenario | Test | Result |
|----------|------|--------|
| Legacy user (password only, no passwordHash) | `comparePassword('correct')` | ✅ Returns true (falls back to `password`) |
| Legacy user (password only, no passwordHash) | `comparePassword('wrong')` | ✅ Returns false |
| Migrated user (passwordHash only) | `comparePassword('correct')` | ✅ Returns true (checks `passwordHash`) |
| No credentials (OAuth user) | `comparePassword('anything')` | ✅ Returns false (both null) |
| Null candidate | `comparePassword(null)` | ✅ Returns false (guard) |
| toJSON on any user | Check output | ✅ No passwordHash, password, or refreshToken |
| Existing `pre('validate')` hook | Email/phone validation | ✅ Unchanged |
| Existing `pre('save')` member code hook | Member code generation | ✅ Unchanged |
| Existing `provider` field | All 4 values | ✅ Unchanged |

---

## Security Review

| Check | Status | Details |
|-------|--------|---------|
| Password never exposed in queries | ✅ | `passwordHash` has `select: false` |
| Password never leaked in JSON | ✅ | `toJSON()` deletes `passwordHash`, `password`, `refreshToken` |
| bcrypt salt rounds | ✅ | 12 rounds (same as original) |
| Old password cleared on migration | ✅ | `password = undefined` after migration to `passwordHash` |
| No double-hashing | ✅ | Guard: `isModified('passwordHash')` prevents rehashing on non-password updates |
| Soft-delete blocks data leaks | ✅ | `pre(/^find/)` filters `deletedAt: null` by default |
| Soft-delete bypass for admin | ✅ | `includeDeleted: true` in query allows explicit override |
| Token invalidation on password change | ✅ | `changedPasswordAfter()` compares `updatedAt` against JWT `iat` |

---

## Self-Review

Per `AI_CODING_CONSTITUTION.md` Part 14:

### Business Logic
- [x] Did I change any business rules? No. Added security hooks and methods.
- [x] Did I introduce new business rules? No.

### Scope
- [x] Did I stay within Task 1.1.2? Yes — hooks, comparePassword, changedPasswordAfter, soft-delete, toJSON only.
- [x] Did I implement auth/service/controller logic? No.

### Code Quality
- [x] Did I introduce duplicate logic? No. Migration path is additive — `password` is kept until migration.
- [x] Did I add console.log? No.
- [x] Did I add TODO/FIXME? No.
- [x] Did I leave commented-out code? No.

### Architecture
- [x] Did I violate dependency direction? No. Model file — imports `bcrypt`, `mongoose`, `memberIdentity`.
- [x] Did I introduce circular dependencies? No.

### Security
- [x] Are passwords stored hashed? Yes — bcrypt with 12 rounds.
- [x] Is old password cleared after migration? Yes — `password = undefined`.
- [x] Are sensitive fields stripped from JSON? Yes — `toJSON()` removes all three.

---

## Definition of Done

- [x] `passwordHash` hashed on save (when modified)
- [x] `password` → `passwordHash` migration path working
- [x] Legacy `password` cleared to `undefined` after migration
- [x] `comparePassword()` checks `passwordHash` first, falls back to `password`
- [x] `changedPasswordAfter(JWTTimestamp)` correctly compares timestamps
- [x] `softDelete()` sets `deletedAt` + `isActive = false`
- [x] `pre(/^find/)` filters `deletedAt: null` unless `includeDeleted: true`
- [x] `toJSON()` strips `passwordHash`, `password`, `refreshToken`
- [x] All existing hooks preserved (validate, member code)
- [x] All existing consumers compile unchanged
- [x] No double-hashing on repeated saves

---

## Git Commit Message

```
feat(auth): add password migration, soft-delete hooks, comparePassword, changedPasswordAfter

- Migrate password → passwordHash with automatic hashing on save
- comparePassword() supports both legacy (password) and migrated (passwordHash) users
- Add soft-delete query middleware (pre-find filters deletedAt: null)
- Add softDelete() instance method (sets deletedAt + isActive = false)
- Add changedPasswordAfter(JWTTimestamp) for JWT token invalidation
- Harden toJSON() to strip passwordHash, password, refreshToken
- Legacy users authenticate without migration (comparePassword fallback)
- Per TASK_1_1_BREAKDOWN.md subtask 1.1.2

Task: 1.1.2
Sprint: 1 (Identity)
```

---

**Task 1.1.2 complete. Awaiting approval.**
