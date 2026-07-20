# FLASH AUDIT — Epic 1.6 Social Authentication

**Auditor**: opencode  
**Date**: 2026-07-20  
**Status**: **PASS**

---

## Files Audited

| File | Role |
|---|---|
| `src/services/socialAuthService.js` | Business logic — SocialAccount lifecycle (login, link, unlink) |
| `src/controllers/socialAuthController.js` | Thin handlers for link/unlink |
| `src/config/passport.js` | Google + Facebook OAuth strategies (enhanced with `googleId`, profile pass-through) |
| `src/routes/authRoutes.js` | OAuth callbacks + `POST /link-social`, `DELETE /unlink-social` routes |
| `src/models/User.js` | `googleId` field added; `pre('validate')` hook |
| `src/models/SocialAccount.js` | Compound unique index `{ provider, providerId }` |

---

## 1. OAuth Flow

| Check | Result | Evidence |
|---|---|---|
| Google strategy creates user with `googleId`, `isVerified: true`, `role: 'member'` | ✅ | `passport.js:104-114` |
| Google strategy finds existing user by `$or: [{ googleId }, { email }]` | ✅ | `passport.js:97-102` |
| Google strategy requires email (returns error if absent) | ✅ | `passport.js:91-93` |
| Facebook strategy handles optional email | ✅ | `passport.js:154-158` (conditional `$or`) |
| Facebook strategy creates user with/without email | ✅ | `passport.js:161-172` |
| Passport passes `{ profile }` as third arg to `done()` | ✅ | `passport.js:125`, `passport.js:184` |
| Callback calls `loginWithGoogle`/`loginWithFacebook` after successful auth | ✅ | `authRoutes.js:100-101`, `authRoutes.js:137-138` |
| Callback uses `{ session: false }` | ✅ | `authRoutes.js:95`, `authRoutes.js:133` |
| Callback checks account lockout before token issuance | ✅ | `authRoutes.js:98` |
| Callback issues tokens via existing `generateAccessToken`/`generateRefreshToken` | ✅ | `authController.js:136-137`, `151-152` |

---

## 2. Security

| Check | Result | Evidence |
|---|---|---|
| OAuth state parameter encodes origin URL | ✅ | `authRoutes.js:75, 115` (base64 encode/decode) |
| CSRF nonce in state parameter | ❌ *pre-existing* | State carries only originUrl; no session-bound nonce. Predates Epic 1.6. |
| Server-side token verification (link endpoint) | ✅ | `socialAuthService.js:10-38` — Google tokeninfo API + Facebook debug_token |
| Duplicate SocialAccount prevention (compound index) | ✅ | `SocialAccount.js:31` — `{ provider: 1, providerId: 1 }` unique |
| Duplicate SocialAccount prevention (service-level check) | ✅ | `socialAuthService.js:49, 85, 135` |
| `loginWith` — different user conflict → 409 | ✅ | `socialAuthService.js:52-58`, `88-94` |
| `linkSocial` — already linked to self → 409 | ✅ | `socialAuthService.js:137-138` |
| `linkSocial` — already linked to other → 409 | ✅ | `socialAuthService.js:140` |
| `unlinkSocial` — prevents last-auth-method removal | ✅ | `socialAuthService.js:180-192` |
| `unlinkSocial` — checks password AND other social accounts | ✅ | `socialAuthService.js:180-184` |
| Maintenance mode check before token issuance | ✅ | `authController.js:131-133`, `146-148` |
| Access token in redirect URL query parameter | ❌ *pre-existing HIGH* | `authController.js:143, 158` — token passed as `?token=<accessToken>`. Predates Epic 1.6. |

---

## 3. Database

| Check | Result | Evidence |
|---|---|---|
| `googleId` field: `{ type: String, unique: true, sparse: true }` | ✅ | `User.js:39-43` |
| `googleId` matches `facebookId` pattern | ✅ | `User.js:34-38` |
| `SocialAccount.provider` enum includes `'google'`, `'facebook'`, `'apple'` | ✅ | `SocialAccount.js:12` |
| Compound unique index `{ provider, providerId }` | ✅ | `SocialAccount.js:31` |
| `userId` index on SocialAccount | ✅ | `SocialAccount.js:32` |
| `User` pre('validate') checks `googleId` alongside `email/phone/facebookId` | ❌ **LOW** | `User.js:266` — `!this.email && !this.phone && !this.facebookId` does **not** include `this.googleId`. Not exploitable (Google strategy requires email) but inconsistent. |
| `validateBeforeSave: false` used appropriately for backfill/link/unlink | ✅ | `passport.js:52`, `socialAuthService.js:160, 202` |

---

## 4. Architecture

| Check | Result | Evidence |
|---|---|---|
| Business logic in service layer | ✅ | `socialAuthService.js` — all 4 functions contain business logic |
| Controller is thin | ✅ | `socialAuthController.js` — ~20 lines per handler, no business logic |
| Passport strategies NOT rewritten (only enhanced) | ✅ | `passport.js` — only `googleId` field + `{ profile }` info arg added |
| Routes protected by `protect` middleware | ✅ | `authRoutes.js:149-150` |
| ADR-013 compliance (RefreshToken model, no Session) | ✅ | Uses `generateAccessToken` + `generateRefreshToken` (existing `tokenService`) |
| No new permissions/RBAC changes required | ✅ | Social auth users get `role: 'member'` (same as email registration) |
| No circular dependencies | ✅ | All imports verified |
| `passport.js` exports `isGoogleOAuthConfigured`/`isFacebookOAuthConfigured` for route guards | ✅ | `passport.js:56-62` |

---

## 5. Business Rules

| Rule | Impact | Result |
|---|---|---|
| BR-AUD-004 (max 3 concurrent logins) | Social auth uses same `tokenService.generateRefreshToken` → enforced by family rotation | ✅ |
| Registration (OTP, email/phone) | Unchanged — social auth bypasses OTP via Google/Facebook verification | ✅ |
| RBAC permissions | Unchanged — no new permissions needed | ✅ |

---

## Findings

### SA-1 (LOW) — Introduced by Epic 1.6
**`User.pre('validate')` missing `googleId` check**  
`User.js:266` — the `pre('validate')` hook ensures at least one identifier exists (`email || phone || facebookId`), but does not include `googleId`. While the Google strategy always requires email (`passport.js:91-93`), making this not exploitable, the schema validation is incomplete.

**Recommendation**: Add `this.googleId` to the `pre('validate')` condition:
```js
if (!this.email && !this.phone && !this.facebookId && !this.googleId) {
```

---

### Pre-existing Observations (predate Epic 1.6)

| ID | Sev | Description | Location |
|---|---|---|---|
| OBS-01 | HIGH | Access token passed as URL query parameter (`?token=<accessToken>`) in OAuth redirect. Visible in browser history, server logs, Referer headers. | `authController.js:143, 158` |
| OBS-02 | OBS | OAuth `state` parameter encodes only originUrl; no CSRF nonce bound to session. Risk is low since callbacks use `{ session: false }`. | `authRoutes.js:75, 115` |
| OBS-03 | OBS | Facebook callback error handler passes unauthenticated errors to `next(err)` (HTML error page) instead of redirecting. Inconsistent with Google callback which always redirects. | `authRoutes.js:134, 143` |

---

## Scores

| Category | Score |
|---|---|
| **Risk** | 95/100 |
| **Security** | 98/100 |
| **Architecture** | 96/100 |

---

## Verdict

**PASS** ✅ — Social Authentication (Epic 1.6) is correctly implemented. Architecture follows ADR-013 and established patterns. Business logic is in the service layer; controllers are thin. One LOW inconsistency found (SA-1: validation hook missing `googleId`). Pre-existing HIGH issue (token in URL, OBS-01) should be tracked separately but is not a blocker for this epic.
