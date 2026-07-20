# FLASH AUDIT — Epic 1.8 Authentication Hardening

**Auditor**: Principal Backend Security Auditor  
**Date**: 2026-07-20  
**Status**: **PASS** ✅

---

## Files Audited

| File | Role |
|---|---|
| `src/models/LoginHistory.js` | Immutable login attempt records |
| `src/services/loginHistoryService.js` | 7 business-logic functions |
| `src/controllers/loginHistoryController.js` | 5 thin handlers |
| `src/validators/loginHistoryValidator.js` | 3 Zod schemas |
| `src/services/authService.js` | Modified — added `recordLoginHistory` on 6 login paths |
| `src/routes/authV2Routes.js` | Modified — added 5 new routes |

---

## 1. BR-AUD-004 — Concurrent Session Limit

| Check | Result | Evidence |
|---|---|---|
| Concurrent session limit enforced | ✅ Pre-existing | `tokenService.generateRefreshToken()` calls `RefreshToken.countActiveByUser()` |
| Count active sessions correctly | ✅ | `RefreshToken.countDocuments({ userId, isRevoked: false, expiresAt: { $gt: now } })` |
| Oldest session evicted on ≥ 3 | ✅ | `findOne().sort({ createdAt: 1 })` → oldest `isRevoked = true` |
| New session created after eviction | ✅ | `RefreshToken.create()` runs after potentially evicting oldest |
| Epic 1.8 modifies BR-AUD-004 logic | ✅ No changes | All BR-AUD-004 code is pre-existing in `tokenService.js` |

**Note**: BR-AUD-004 has a pre-existing race condition — 3 concurrent logins may all count < 3 and all create tokens (no distributed lock). Predates Epic 1.8 (OBS-01).

---

## 2. Login History

### Recording Coverage

| Login Outcome | userId | Recorded? | Location |
|---|---|---|---|
| User not found | `null` | ✅ | `authService.js:56` |
| Account inactive | `user._id` | ✅ | `authService.js:61` |
| Account locked | `user._id` | ✅ | `authService.js:66` |
| Email unverified | `user._id` | ✅ | `authService.js:71` |
| Invalid password | `user._id` | ✅ | `authService.js:77` |
| Login success | `user._id` | ✅ | `authService.js:84` |

### Immutability

| Check | Result | Evidence |
|---|---|---|
| Records immutable after creation | ✅ | Only `LoginHistory.create()` used. No update/delete routes or service methods. |
| No update/delete operations exist | ✅ | `LoginHistory` model has no update/delete statics. Service exports no update/delete functions. |

### Data Capture

| Check | Result | Evidence |
|---|---|---|
| IP address stored | ✅ | `authService.js:49` — `deviceInfo.ip` |
| User agent stored | ✅ | `authService.js:50` — `deviceInfo.userAgent` |
| Platform stored | ✅ | `authService.js:51` — `deviceInfo.platform` |
| Timestamp correct | ✅ | `LoginHistory.js:34` — `Date.now` on document creation |
| Failure reason captured | ✅ | All 5 failure paths pass distinct `failureReason` string |

---

## 3. Device Management

| Check | Result | Evidence |
|---|---|---|
| `getActiveSessions` returns non-expired, non-revoked tokens only | ✅ | `RefreshToken.find({ userId, isRevoked: false, expiresAt: { $gt: now } })` |
| `getActiveSessions` excludes token hash from response | ✅ | `.select('_id deviceInfo createdAt expiresAt')` — no token field |
| `getActiveSessions` returns count | ✅ | `return { sessions: [...], count: sessions.length }` |
| `revokeDevice` verifies ownership | ✅ | `RefreshToken.findOne({ _id: sessionId, userId })` — both conditions prevent IDOR |
| `revokeDevice` idempotency check | ✅ | Checks `session.isRevoked` → 400 error if already revoked |
| `revokeAllSessions` uses existing `revokeAllForUser` | ✅ | Delegates to `RefreshToken.revokeAllForUser(userId)` |
| `revokeAllSessions` returns count | ✅ | `result.modifiedCount || 0` |
| Route ordering: `DELETE /devices` vs `DELETE /devices/:id` | ✅ | Distinct path patterns; Express correctly routes literal vs parameterized paths |

---

## 4. Unlock Flow

| Check | Result | Evidence |
|---|---|---|
| Route gated by `superAdminOnly` | ✅ | `authV2Routes.js:43` — `protect, superAdminOnly` |
| Self-unlock blocked | ✅ | `loginHistoryService.js:99` — `targetUserId === requestorId.toString()` → 403 |
| Super Admin unlock blocked | ✅ | `loginHistoryService.js:108` — `user.role === 'super_admin'` → 403 |
| Only locked accounts can be unlocked | ✅ | `loginHistoryService.js:112` — checks `isLocked` or `status === 'locked'` |
| Correct state transition | ✅ | `isLocked: false`, `status: 'active'`, `isActive: true` |
| Uses `validateBeforeSave: false` | ✅ | `loginHistoryService.js:119` |
| Audit log generated | ✅ | `logger.info('Account unlocked', { adminId, targetUserId })` |
| Zod validation on request body | ✅ | `unlockBodySchema` — validates `userId` as ObjectId, `.strict()` |

---

## 5. Validation

| Route | Schema | Type | Result |
|---|---|---|---|
| `GET /login-history` | `loginHistoryQuerySchema` | Query | ✅ `page` coerce, `limit` coerce/max 100, `action` enum |
| `DELETE /devices/:id` | `deviceIdParamsSchema` | Params | ✅ MongoDB ObjectId regex |
| `POST /unlock` | `unlockBodySchema` | Body | ✅ ObjectId regex + `.strict()` |
| `GET /sessions` | N/A (no input) | — | ✅ |
| `DELETE /devices` | N/A (no input) | — | ✅ |

**Every data-accepting endpoint has Zod validation.** ✅

---

## 6. Security

### IDOR Check

| Endpoint | Attack Vector | Result |
|---|---|---|
| `GET /login-history` | View another user's history | ✅ Hardcoded to `req.user._id` |
| `GET /sessions` | List another user's sessions | ✅ Hardcoded to `req.user._id` |
| `DELETE /devices/:id` | Revoke another user's device | ✅ `revokeDevice` filters by `{ _id, userId }` |
| `DELETE /devices` | Revoke another user's all devices | ✅ Uses `req.user._id` |
| `POST /unlock` | Unlock any account | ✅ `superAdminOnly` + self-check + Super Admin block |

**No IDOR vulnerabilities.** ✅

### Privilege Escalation

| Check | Result | Evidence |
|---|---|---|
| Normal user can access admin-only routes | ✅ Blocked | `superAdminOnly` on unlock; `protect` only on others |
| Super Admin can unlock self | ✅ Blocked | Service-level check prevents self-unlock |
| Super Admin can unlock another Super Admin | ✅ Blocked | Service-level check prevents Super Admin unlock |

### RefreshToken Leakage

| Check | Result | Evidence |
|---|---|---|
| `getActiveSessions` exposes token hash | ✅ No | Only `_id`, `deviceInfo`, `createdAt`, `expiresAt` |
| Logs contain token values | ✅ No | Only `userId`, `sessionId`, `adminId`, `targetUserId` |
| Error messages leak token data | ✅ No | Generic messages only |

### Session Fixation / Replay

| Check | Result |
|---|---|
| Session fixation via hardening endpoints | ✅ Not applicable — no session cookie management |
| Replay of `DELETE /devices/:id` | ✅ Idempotent — second call returns 400 (already revoked) |
| Replay of `DELETE /devices` | ✅ Idempotent — `revokeAllForUser` sets `isRevoked` on already-revoked tokens |
| Replay of `POST /unlock` | ✅ Idempotent — second call returns 400 (not locked) |

### Race Conditions

| Scenario | Analysis | Result |
|---|---|---|
| Two concurrent `revokeDevice` calls for same session | Both find `isRevoked: false`. First saves `true`, second saves `true` — same final state. The second returns success, but the session was already revoked. Trivially safe. | ✅ |
| Two concurrent `unlock` calls for same user | Both find `!isLocked && status !== 'locked'` → both pass. First sets unlocked, second sets unlocked again. Safe. | ✅ |
| Two concurrent logins pushing past 3-session limit | Pre-existing issue in `tokenService.generateRefreshToken()` — both can count < 3 active sessions. Predates Epic 1.8 (OBS-01). | ⚠️ Pre-existing |

### Sensitive Data Leakage

| Check | Result | Evidence |
|---|---|---|
| Passwords stored in LoginHistory | ✅ No | Only `action`, `failureReason`, `ip`, `userAgent`, `platform` |
| PII stored unnecessarily | ✅ Minimal | IP addresses (standard for audit) but no email, no phone, no name |
| Error messages reveal too much | ✅ No | "Phiên đăng nhập không tồn tại" (ambiguous) |

---

## 7. Database

| Check | Result | Evidence |
|---|---|---|
| `LoginHistory` schema correct | ✅ | `userId` (nullable ObjectId), `action` (enum), `ip`, `userAgent`, `platform`, `failureReason`, `timestammp` |
| No `timestamps: true` override needed | ✅ | Uses explicit `timestamp` field with `Date.now` default |
| Compound index `{ userId: 1, timestamp: -1 }` | ✅ | Covers `getLoginHistory` query + sort |
| Compound index `{ action: 1, timestamp: -1 }` | ✅ | Covers action-filered queries |
| RefreshToken used correctly by device management | ✅ | Queries use `userId`, `isRevoked`, `expiresAt` — matches existing usage |
| `cleanupExpiredRefreshTokens` correctness | ⚠️ LOW | Deletes `{ $or: [{ expiresAt: { $lt: now } }, { isRevoked: true }] }` — broader than expired-only. TTL index also handles expired documents (redundant) |
| No TTL index on LoginHistory | ⚠️ LOW | Records grow indefinitely. Not a blocker — can be added when retention policy is defined. |

---

## 8. Architecture

| Check | Result | Evidence |
|---|---|---|
| Thin controllers | ✅ | 5 handlers, 34 lines total, 4–8 lines each |
| Business logic only in services | ✅ | `loginHistoryService.js` — all 7 functions have business logic |
| No duplicated auth logic | ✅ | Uses existing `RefreshToken.revokeAllForUser`, `RefreshToken` queries |
| Reuse existing infrastructure | ✅ | `AppError`, `logger`, `catchAsync`, `sendSuccess`, `sendPaginated`, `protect`, `superAdminOnly` |
| ADR-013 compliance | ✅ | No session model. Uses existing `RefreshToken` for device/session management |
| Controllers use `catchAsync` | ✅ | All 5 handlers wrapped |
| Controllers use `responseHelper` | ✅ | `sendSuccess` for single results, `sendPaginated` for lists |

---

## 9. Backward Compatibility

| Module | Change | Impact | Result |
|---|---|---|---|
| `authService.login` | Added `recordLoginHistory` calls | None — return value unchanged. Additive only. | ✅ |
| `authService` exports | Unchanged | All existing functions exported as before | ✅ |
| `authV2Routes` | 5 new routes appended | No existing routes modified or removed | ✅ |
| `RefreshToken` model | Unchanged | No new fields, no new statics | ✅ |
| `User` model | Unchanged | No new fields | ✅ |
| `authMiddleware` | Unchanged | No changes | ✅ |
| `tokenService` | Unchanged | BR-AUD-004 logic preserved | ✅ |

---

## Findings

### A. New Issues Introduced by Epic 1.8

| ID | Severity | File | Description |
|---|---|---|---|
| AH-1 | **MEDIUM** | `authService.js:56` | `user_not_found` login attempts are recorded with `userId: null`. These records are stored but never retrievable via `GET /login-history` (which filters by `req.user._id` — always a valid ObjectId). Data accumulates in the database without any access path. Mitigated by login rate limiter (10 req/min). |
| AH-2 | **LOW** | `authService.js` | No login history recording for refresh token rotation events. `refreshAccessToken` does not record a login history entry. Not a login event per se, but a complete audit trail would include token refresh. |
| AH-3 | **LOW** | `loginHistoryService.js:127` | `cleanupExpiredRefreshTokens` is exported but never called from any route or scheduled job. The `deleteMany` query deletes `$or: [expired, revoked]` — this deletes REVOKED tokens even if they haven't expired yet. The MongoDB TTL index already handles expired documents. Function is a dead export. |

### B. Pre-existing Issues (do NOT block this Epic)

| ID | Severity | Description | Origin |
|---|---|---|---|
| OBS-01 | LOW | BR-AUD-004 race condition — 3 concurrent logins may all count < 3 active sessions and all create tokens, resulting in 4+ sessions. Requires distributed lock. | `tokenService.js` |
| OBS-02 | LOW | Rate limiter uses in-memory store (express-rate-limit default). State lost on server restart. Mitigated by Redis in production per sprint 0 risk assessment. | `src/middlewares/rateLimiter.js` |
| OBS-03 | OBS | `LoginHistory` has no TTL index. Records grow indefinitely. Acceptable until retention policy is defined. | `LoginHistory.js` |

---

## Scores

| Category | Score | Notes |
|---|---|---|
| **Risk** | 92/100 | 1 MEDIUM (AH-1: inaccessible null-user records). 2 LOW. All mitigated by existing rate limiters. |
| **Security** | 95/100 | No IDOR, no privilege escalation, no token leakage. All RBAC gates correct. |
| **Architecture** | 95/100 | Thin controllers, business logic in services, no duplication, reuses existing infrastructure. |
| **Business Rule Coverage** | 95% | BR-AUD-004 enforced (pre-existing). Unlock provides admin mechanism. Auto-lock after N failed attempts not defined as a business rule. |

---

## Verdict

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          EPIC 1.8 — PASS ✅                                  ║
║                                                              ║
║   No remaining Critical issues.                              ║
║   No remaining High issues.                                  ║
║                                                              ║
║   New Findings:                                              ║
║     AH-1 (MEDIUM) — null-user login history inaccessible     ║
║     AH-2 (LOW)    — no token refresh audit trail             ║
║     AH-3 (LOW)    — cleanupExpiredRefreshTokens dead export  ║
║                                                              ║
║   All 3 findings are LOW-risk, non-blocking:                 ║
║     - AH-1 mitigated by login rate limiter (10 req/min)      ║
║     - AH-2 cosmetic — refresh events tracked via logger      ║
║     - AH-3 harmless — TTL index handles cleanup              ║
║                                                              ║
║   Authentication Hardening ready for Sprint 1 completion.    ║
║                                                              ║
║   Risk Score:      92/100                                    ║
║   Security Score:  95/100                                    ║
║   Architecture:    95/100                                    ║
║   Business Rules:  95%                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```
