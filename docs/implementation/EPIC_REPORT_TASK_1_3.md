# Epic Report — Password & OTP Infrastructure (Task 1.3)

> **Sprint:** 1 (Identity)
> **Epic:** 3 — Password & OTP Infrastructure
> **Status:** Complete
> **Date:** 2026-07-20

---

## Objective

Enhance existing `otpService.js` with BR-AUD-005 rate limiting (max 5 failed OTP attempts per 15 minutes). Email service already exists and requires no changes.

---

## Files Created

None.

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/services/otpService.js` | Enhanced `verifyOtp()` with BR-AUD-005 rate limiting. Added past-attempt scanning within 15-min window. Added `OTP_RATE_LIMIT_EXCEEDED` error (429). |

---

## Services

### otpService.js (Enhanced)

| Function | Status | Change |
|----------|--------|--------|
| `sendOtp()` | ✅ Unchanged | Resend cooldown (1 min). Uses legacy Otp model (`identifier`/`purpose`). |
| `verifyOtp()` | ✅ Enhanced | Added BR-AUD-005: scans past OTP records within 15 min. If total attempts ≥ 5 → throws `OTP_RATE_LIMIT_EXCEEDED` (429). |
| `consumeOtp()` | ✅ Unchanged | Deletes OTP record after successful verification. |
| `hashPendingPassword()` | ✅ Unchanged | bcrypt.hash(password, 12). |

### emailService.js

| Function | Status |
|----------|--------|
| `sendOtpEmail()` | ✅ Unchanged — already exists |
| `sendRenewalSuccessEmail()` | ✅ Unchanged |
| `sendRenewalReminderEmail()` | ✅ Unchanged |
| + 7 other email functions | ✅ Unchanged |

---

## API Endpoints

None. This epic modifies a service layer only. No routes, controllers, or middleware.

---

## Validation

| Check | Status |
|-------|--------|
| OTP code is 6-digit numeric | ✅ Verified (existing `generateOtpCode()`) |
| OTP expires after 5 min | ✅ Verified (existing `DEFAULT_OTP_TTL_MS`) |
| Resend cooldown 60 seconds | ✅ Verified (existing `RESEND_COOLDOWN_MS`) |
| BR-AUD-005: max 5 attempts / 15 min | ✅ Implemented — `verifyOtp()` scans past records |

---

## Security Review

| Check | Status |
|-------|--------|
| OTP not logged | ✅ No console.log of OTP codes in service |
| Rate limit prevents brute force | ✅ 5 attempts / 15 min / per identifier+purpose |
| Rate limit returns 429 | ✅ `OTP_RATE_LIMIT_EXCEEDED` with descriptive message |
| Expired OTPs cleaned | ✅ Deleted on expiry check in `verifyOtp()` |
| bcrypt for password hashing | ✅ 12 rounds in `hashPendingPassword()` |

---

## Business Rule Coverage

| Rule | Implementation | Status |
|------|---------------|--------|
| BR-AUD-005 | Max 5 failed OTP attempts per 15 minutes per `(identifier, purpose)`. Past attempts scanned via `Otp.countDocuments({ identifier, purpose, createdAt: ≥ 15min ago, attempts > 0 })`. Current attempt counts toward total. | ✅ |

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Uses legacy Otp model (`identifier`/`purpose`) not new OTP model (`userId`/`type`) | New auth flow (Task 1.4) will need its own OTP functions using the new model | New auth service will use new OTP model directly |
| Rate limit is per `(identifier, purpose)` not per `userId` | If a user changes their email between OTP requests, rate limiting resets | Low risk — email changes are rare |
| Past attempt count queries all OTP records within 15 min | Performance concern at scale (>10K OTPs/day) | Index on `{ identifier: 1, purpose: 1, createdAt: 1 }` would optimize. Not needed at current scale. |

---

## Self-Review

Per `AI_CODING_CONSTITUTION.md` Part 14:

### Business Logic
- [x] Did I change any business rules? No. Added enforcement for existing BR-AUD-005.
- [x] Did I introduce new business rules? No.

### Scope
- [x] Did I stay within Task 1.3? Yes — otpService enhancement only. No routes/controllers/middleware.

### Code Quality
- [x] Did I introduce duplicate logic? No.
- [x] Did I add console.log? No.

### Architecture
- [x] Service imports model. Correct direction.
- [x] No circular dependencies.

### Backward Compatibility
- [x] All existing `sendOtp` callers unaffected.
- [x] `verifyOtp` returns same success shape. Only failure path enhanced.

---

## Definition of Done

- [x] BR-AUD-005 rate limiting enforced in `verifyOtp()`
- [x] Past OTP records scanned within 15-minute rolling window
- [x] Total attempts (past + current) assessed before increment
- [x] `OTP_RATE_LIMIT_EXCEEDED` error thrown with 429 status
- [x] All existing exports preserved
- [x] All existing callers unaffected (additive guard only)
- [x] No console.log added
- [x] No new files created

---

## Git Commit Message

```
feat(auth): add BR-AUD-005 OTP rate limiting to verifyOtp

- Scan past OTP records within 15-min window for same identifier+purpose
- If total failed attempts >= 5, throw OTP_RATE_LIMIT_EXCEEDED (429)
- Restricts to 5 failed attempts per 15 minutes per identifier+purpose
- Backward compatible — success path unchanged

Task: 1.3 (Password & OTP Infrastructure)
Sprint: 1 (Identity)
```

---

**Epic 3 complete. Awaiting flash audit.**
