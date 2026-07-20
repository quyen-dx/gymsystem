# Epic 1.8 — Authentication Hardening — Implementation Plan

## Status
- BR-AUD-004 (max 3 concurrent sessions) — **Already implemented** in `tokenService.generateRefreshToken()` via `RefreshToken.countActiveByUser()` → oldest eviction.
- `logout` / `logoutAll` — **Already implemented** in `authService.js` + `RefreshToken.revokeAllForUser()`.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/models/LoginHistory.js` | Mongoose model — immutable login attempt records |
| `src/services/loginHistoryService.js` | Business logic — `recordLoginHistory`, `getLoginHistory`, `getActiveSessions`, `revokeDevice`, `cleanupExpiredRefreshTokens`, `unlockAccount` |
| `src/controllers/loginHistoryController.js` | Thin handlers — max 5 lines each, `catchAsync` + `sendSuccess` |
| `src/validators/loginHistoryValidator.js` | Zod schemas — devideId param, unlock body, history query |

## Files to Modify

| File | Change |
|---|---|
| `src/services/authService.js` | Add `recordLoginHistory()` calls on every login path (success + all 5 failure modes) |
| `src/routes/authV2Routes.js` | Add 5 new routes at `/api/v1/auth` prefix |

---

## Routes (mounted at `/api/v1/auth`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/login-history` | `protect` | Own login history (paginated, self-only) |
| `GET` | `/sessions` | `protect` | Active session list from RefreshToken |
| `DELETE` | `/devices/:id` | `protect` | Revoke single device/session |
| `DELETE` | `/devices` | `protect` | Revoke all devices (logout all) |
| `POST` | `/unlock` | `protect` + `superAdminOnly` | Admin unlocks a locked account |

---

## Dependencies
- `mongoose` — LoginHistory model
- `RefreshToken` model — session queries, revocation
- `User` model — unlock endpoint
- `catchAsync` — controllers
- `sendSuccess` / `sendPaginated` — responses
- `protect`, `superAdminOnly` — RBAC
- `validateBody`, `validateParams`, `validateQuery` — Zod validation
- `logger` — audit logging

No new npm dependencies.

---

## Risks
- **LOW** — Login history adds DB write on every login attempt. Rate limiter (10/min) mitigates brute-force DOS.
- **LOW** — `cleanupExpiredRefreshTokens` is a utility only (no scheduler). Existing MongoDB TTL index handles auto-cleanup.
