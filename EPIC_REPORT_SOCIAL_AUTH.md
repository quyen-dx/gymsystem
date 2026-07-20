# Epic 1.6 Report — Social Authentication

**Status:** Complete  
**Date:** 2026-07-20

---

## Summary

Implemented Google and Facebook OAuth social login integration with SocialAccount record management. Reused existing Passport strategies. Added link/unlink endpoints for authenticated users.

---

## Files Created

| File | Exports | Purpose |
|---|---|---|
| `src/services/socialAuthService.js` | `loginWithGoogle`, `loginWithFacebook`, `linkSocialAccount`, `unlinkSocialAccount` | Business logic: SocialAccount lifecycle, token verification, link/unlink enforcement |
| `src/controllers/socialAuthController.js` | `linkSocial`, `unlinkSocial` | Thin request handlers: extract params, call service, send response |

## Files Modified

| File | Change |
|---|---|
| `src/models/User.js` | Added `googleId` field (String, sparse unique, mirrors `facebookId`) |
| `src/config/passport.js` | Google strategy: store `googleId` on user create/backfill, pass `{ profile }` through `done()` info. Facebook strategy: pass `{ profile }` through `done()` info. `backfillSocialProfile` updated for `googleId`. |
| `src/routes/authRoutes.js` | Hook `loginWithGoogle`/`loginWithFacebook` into OAuth callbacks. Add `POST /link-social` and `DELETE /unlink-social` routes. |

---

## Routes

| Method | Path | Auth | Source |
|---|---|---|---|
| `GET` | `/auth/google` | Public | Existing (unchanged) |
| `GET` | `/auth/google/callback` | Public | Existing (enhanced — now creates SocialAccount) |
| `GET` | `/auth/facebook` | Public | Existing (unchanged) |
| `GET` | `/auth/facebook/callback` | Public | Existing (enhanced — now creates SocialAccount) |
| `POST` | `/auth/link-social` | `protect` | NEW |
| `DELETE` | `/auth/unlink-social` | `protect` | NEW |

### POST /auth/link-social

```json
// Request
{ "provider": "google", "token": "<id_token>" }
{ "provider": "facebook", "token": "<access_token>" }

// Response 200
{ "message": "Liên kết tài khoản mạng xã hội thành công" }

// Errors
// 400 — missing provider/token
// 401 — invalid token (provider-side verification failed)
// 409 — already linked (same user) or linked to different user
// 502 — provider verification API unavailable
```

### DELETE /auth/unlink-social

```json
// Request
{ "provider": "google" }

// Response 200
{ "message": "Hủy liên kết tài khoản mạng xã hội thành công" }

// Errors
// 400 — missing provider / last auth method warning
// 404 — no SocialAccount found for this provider
```

---

## Service Functions

### `loginWithGoogle(userId, passportProfile)`
Called from Google OAuth callback. Creates or updates a `SocialAccount` document:
- `provider`: `"google"`
- `providerId`: `profile.id` (Google's unique user ID)
- `profileUrl`: first photo URL from profile
- `metadata`: raw `profile._json` from Google

If the Google account is already linked to a **different** user → throws `AppError(409, 'SOCIAL_ALREADY_LINKED')`.

### `loginWithFacebook(userId, passportProfile)`
Same pattern as `loginWithGoogle` but for `provider: "facebook"`.

### `linkSocialAccount(userId, provider, token)`
1. Validates `provider` is `"google"` or `"facebook"`
2. Calls provider API to verify the token:
   - Google: `POST https://oauth2.googleapis.com/tokeninfo?id_token=<token>`
   - Facebook: `GET https://graph.facebook.com/debug_token?input_token=<token>&access_token=<app_id>|<app_secret>`
3. Extracts `providerId` from verified response
4. Checks no existing `SocialAccount` with same `{ provider, providerId }` → 409
5. Creates `SocialAccount` + updates `User` (`googleId` / `facebookId`)
6. Logs audit event

### `unlinkSocialAccount(userId, provider)`
1. Finds `SocialAccount` for `{ userId, provider }` → 404 if not found
2. Checks user has remaining auth method (password OR another social account) → 400 if none
3. Deletes `SocialAccount`
4. Cleans `User.googleId` / `User.facebookId`
5. Logs audit event

---

## OAuth Redirect Flow

```
┌─────────┐     GET /auth/google      ┌──────────┐    Google OAuth     ┌──────────────┐
│ Browser │ ────────────────────────── │  Server   │ ─────────────────→ │ Google Login │
└─────────┘                           └──────────┘                    └──────────────┘
     │                                      │                               │
     │    GET /auth/google/callback         │←──────────────────────────────│
     │←─────────────────────────────────────│                               │
     │                                      │                               │
     │                         passport.authenticate('google')
     │                         → find/create User (by email + googleId)
     │                         → done(null, user, { profile })
     │                                      │
     │                         loginWithGoogle(userId, profile)
     │                         → SocialAccount.create/update
     │                                      │
     │                         buildGoogleOauthRedirect()
     │                         → generateAccessToken()  (15 min)
     │                         → generateRefreshToken() (7 days, httpOnly)
     │                         → redirect to frontend with token
     │                                      │
┌─────────┐                         ┌──────────┐
│ Browser │ ←────────────────────── │ Frontend │  /oauth-success?token=xxx
└─────────┘    redirect with JWT    └──────────┘
```

---

## SocialAccount Model Mapping

```
SocialAccount {
  userId:    ObjectId → User (indexed)
  provider:  "google" | "facebook"
  providerId: "117318..." (Google sub / Facebook user_id)
  profileUrl: "https://lh3.googleusercontent.com/..." | null
  metadata:  { ... } (raw provider profile JSON)
}

Compound unique index: { provider: 1, providerId: 1 }
```

---

## Architectural Compliance

| Constraint | Status |
|---|---|
| Passport not rewritten | ✅ Passport strategies only enhanced with `info` parameter and `googleId` — OAuth logic unchanged |
| Reuse existing auth flow | ✅ Same `buildGoogleOauthRedirect` / `buildFacebookOauthRedirect` + same token issuance |
| Create/link SocialAccount | ✅ Created on OAuth callback + explicit link endpoint |
| Issue JWT + RefreshToken | ✅ Same token flow via `generateAccessToken` + `generateRefreshToken` |
| No duplicated login logic | ✅ Login still handled by passport strategies; SocialAccount is supplementary |
| Controller thin | ✅ Controllers only extract params, call service, send response |
| Service has business logic | ✅ Token verification, duplicate checking, auth-method safety in `socialAuthService.js` |
| ADR-013 (RefreshToken only) | ✅ Uses `tokenService.generateAccessToken` + `generateRefreshToken` (RefreshToken model) |

---

## Security

| Vector | Result |
|---|---|
| Token verification | Server-side: Google tokeninfo + Facebook debug_token (not client-trusted) |
| Duplicate linking | Blocked at DB level (compound unique index) + service level check |
| Cross-user linking | Service checks existing SocialAccount owner before linking |
| Last auth method | Unlink blocked if no password + no other social account |
| Authentication | Link/unlink routes behind `protect` (JWT verification) |
| Information leakage | Generic error messages; no user enumeration |

---

## Backward Compatibility

| Area | Status |
|---|---|
| Existing routes | Unchanged — same paths, same handlers |
| OAuth callbacks | Enhanced (additive → SocialAccount creation) — existing behavior preserved |
| User model | Added `googleId` (sparse unique) — existing documents unaffected |
| Passport strategies | Same OAuth flow — added `info` parameter (used by callback, backwards-compatible) |
| Server module tree | Loads cleanly — all imports resolve, no circular dependencies |

---

## Self-Review

- **Compile**: All 5 files load without errors. Full server module tree loads clean.
- **OAuth flow**: Google/Facebook redirect OAuth unchanged. Added `loginWithGoogle`/`loginWithFacebook` call after passport auth.
- **JWT flow**: Same `generateAccessToken` + `generateRefreshToken` — no changes to token infrastructure.
- **RefreshToken flow**: Unchanged — `buildGoogleOauthRedirect`/`buildFacebookOauthRedirect` generate refresh tokens via the existing flow.
- **SocialAccount mapping**: Created during OAuth callback (redirect flow) + explicit link endpoint. Compound unique index prevents duplicates.
- **Security**: All tokens verified server-side. Linking/unlinking protected. No client-trusted input for auth decisions.
- **Backward compatibility**: No breaking changes. All existing consumers compile.
