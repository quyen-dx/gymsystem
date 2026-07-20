# TEST COVERAGE FIX REPORT — Epic 1.9

**Date**: 2026-07-21  
**Source**: `FLASH_AUDIT_TESTS.md` (FAIL — 5 MEDIUM gaps)  
**Status**: All 5 gaps resolved ✅

---

## Issues Fixed

| ID | Severity | Feature | Resolution |
|---|---|---|---|
| TQ-1 | MEDIUM | Verify Email — 0 test coverage | 4 tests added |
| TQ-2 | MEDIUM | Reset Password — 0 test coverage | 4 tests added |
| TQ-3 | MEDIUM | Google Login (Social Auth) — 0 test coverage | 11 tests added (new file) |
| TQ-4 | MEDIUM | BR-AUD-004 (concurrent sessions) — 0 test coverage | 6 tests added (new file) |
| TQ-5 | MEDIUM | BR-AUD-005 (OTP rate limit) — 0 test coverage | 7 tests added (new file) |

---

## Files Created

| File | Tests | Lines |
|---|---|---|
| `tests/unit/otpService.test.js` | 7 | BR-AUD-005: verifyOtp rate limit, lockout, expiry |
| `tests/unit/tokenService.test.js` | 6 | BR-AUD-004: session counting, oldest eviction, device attach |
| `tests/unit/socialAuthService.test.js` | 11 | Google/Facebook login, unlink, error paths |

## Files Modified

| File | Tests Added | Added Lines |
|---|---|---|
| `tests/unit/authService.test.js` | 8 (4 verifyEmail + 4 resetPassword) | 65 |

---

## Tests Added — Detail

### TQ-1: Verify Email (4 tests)

| Test | Scenario |
|---|---|
| should verify email successfully | Correct OTP, user.isVerified → true |
| should fail with invalid OTP | verifyOtp throws OTP_INVALID |
| should fail with expired OTP | verifyOtp throws OTP_EXPIRED |
| should fail if already verified | User.isVerified is already true → 400 error |

### TQ-2: Reset Password (4 tests)

| Test | Scenario |
|---|---|
| should reset password successfully | Valid token, user found, password changed |
| should fail with invalid token | PasswordResetToken.consume returns null |
| should fail with expired token | Same path as invalid (consume returns null) |
| should fail if user not found after valid token | Token valid but user deleted |

### TQ-3: Social Auth (11 tests — new file)

| Describe | Tests | Scenarios |
|---|---|---|
| loginWithGoogle | 4 | Create new account, update existing, throw if linked to other user, skip if no profile id |
| loginWithFacebook | 2 | Create new account, update existing |
| linkSocialAccount | 1 | Invalid provider rejection |
| unlinkSocialAccount | 4 | Invalid provider, social account not found, no other auth method, unlink with password |

### TQ-4: BR-AUD-004 Concurrent Sessions (6 tests — new file)

| Test | Scenario |
|---|---|
| should create token when under limit (0 active) | countActiveByUser → 0, create called |
| should create token when under limit (2 active) | countActiveByUser → 2, no eviction |
| should evict oldest when at limit (3 active) | countActiveByUser → 3, oldest.isRevoked = true |
| should not evict if count >= 3 but oldest not found | Guard against null findOne result |
| should set deviceInfo on created token | Verify deviceInfo passed through to RefreshToken.create |
| revokeAllUserTokens | Delegates to RefreshToken.revokeAllForUser |

### TQ-5: BR-AUD-005 OTP Rate Limit (7 tests — new file)

| Test | Scenario |
|---|---|
| should verify correct OTP successfully | Happy path verification |
| should fail on 1st wrong OTP | Code mismatch → OTP_INVALID |
| should increment attempts counter on wrong OTP | $inc: { attempts: 1 } verified |
| should lock after 5 total failed attempts | attempts + aggregate total ≥ 5 → lockedUntil set, 429 returned |
| should block if already locked | lockedUntil in future → 429 |
| should allow after lockout expires | lockedUntil in past → verification allowed |
| should reject expired OTP | expiresAt < now → OTP_EXPIRED |

---

## Coverage Improvement

| Metric | Before | After | Change |
|---|---|---|---|
| Test files | 5 | 8 | +3 |
| Total tests | 69 | 101 | +32 (46% increase) |
| Features covered | 12/18 | 17/18 | +5 |
| Business rules tested | 0/2 | 2/2 | BR-AUD-004, BR-AUD-005 |
| Auth flows tested | 11/16 | 14/16 | Verify Email, Reset Password, Social Auth |

### Remaining Gaps

| Feature | Reason |
|---|---|
| Social Auth link/unlink (token validation flows) | Requires global.fetch mocking for Google/Facebook API calls. Validation error paths tested. |
| OTP send rate limit (resend cooldown) | BR-AUD-005 verify path is fully covered. sendOtp resend cooldown is a separate path. |

---

## Test Results

```
 Test Files  8 passed (8)
      Tests  101 passed (101)
   Duration  2.31s
```

---

## Verification

| Check | Result |
|---|---|
| All 8 test suites pass | ✅ 101/101 |
| No production code modified | ✅ Services/controllers/models unchanged |
| Only test files added/modified | ✅ |
| Imports resolve cleanly | ✅ |
| Tests isolated (beforeEach reset) | ✅ |
| Deterministic (no flaky timing/random) | ✅ |
