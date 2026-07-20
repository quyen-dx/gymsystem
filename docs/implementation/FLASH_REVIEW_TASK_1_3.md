# Flash Audit Report — Task 1.3 (Password & OTP Infrastructure)

> **Auditor:** Independent Senior Backend Reviewer  
> **Date:** 2026-07-20  
> **Scope:** `src/services/otpService.js` (diff: `verifyOtp()` BR-AUD-005 rate limit addition)  
> **Status:** **FAIL** — 4 Critical, 1 High, 3 Medium, 2 Low  

---

## Executive Summary

The implementation attempts to add BR-AUD-005 rate limiting to `verifyOtp()`. However, three of the four critical issues mean the rate limit is either **completely bypassable** or **never executes**. Additionally, a **catastrophic schema mismatch** exists between the service and the underlying model.

---

## 1. Business Rule Compliance — BR-AUD-005

| Requirement | Implementation | Verdict |
|-------------|---------------|---------|
| Max 5 failed attempts / 15 min | `totalAttempts = countDocuments(past docs with attempts>0) + record.attempts` | **FAIL** |
| 30-minute account lockout | Not implemented | **FAIL** |
| Scoped per `(member_id, action_type)` | Uses `(identifier, purpose)` | **FAIL** |

### Critical: `countDocuments` counts documents, not total failures

```javascript
const pastAttempts = await Otp.countDocuments({
  identifier,
  purpose,
  _id: { $ne: record._id },
  createdAt: { $gte: fifteenMinAgo },
  attempts: { $gt: 0 },    // <-- counts documents, not SUM of attempts
})
```

`$gt: 0` selects documents WHERE `attempts > 0`. If a past document has `attempts: 5`, it counts as **1**, not **5**. An attacker gets:

- OTP 1: fail 5 times (doc 1, attempts=5) → blocked  
- Send OTP 2 → attempts reset to 0 (same doc upserted)  
- OTP 2: fail 5 more times → total 10 attempts allowed

### Critical: No 30-minute account lockout

BR-AUD-005 explicitly requires `lock_account_temporarily(member_id, action_type, 30 minutes)`. The implementation has **zero** lockout state — no flag, no record, no check. The only barrier is resending a new OTP (60s cooldown), which grants another 5 attempts.

**The rate limit can be bypassed indefinitely** by requesting a new OTP every 65 seconds.

### Critical: Scope uses `(identifier, purpose)` instead of `(member_id, action_type)`

- BR-AUD-005 specifies `(member_id, action_type)` — tied to a user account.
- Implementation uses `(identifier, purpose)` — tied to an email/phone string and a purpose label.
- An attacker can bypass by using a different identifier (e.g., login via Google instead of email) for the same member.

---

## 2. Schema Mismatch — Model vs Service

**This is the most severe defect.** The file `src/models/Otp.js` was replaced in Task 1.1 with a new schema:

| Old Schema (used by otpService.js) | New Schema (current file on disk) |
|-------------------------------------|------------------------------------|
| `identifier` (String) | `userId` (ObjectId, ref: User) |
| `otp` (String) | `code` (String) |
| `purpose` (String) | `type` (enum) |
| `channel` (String) | *(removed)* |
| `provider` (String) | *(removed)* |
| `payload` (Mixed) | *(removed)* |
| `resendAvailableAt` (Date) | *(removed)* |
| `expiresAt` (Date) | `expiresAt` (Date) |
| `attempts` (Number) | `attempts` (Number, max: 5) |
| | `consumedAt` (Date, new) |

**otpService.js uses ZERO fields that match the new schema.** Mongoose v9.3.1 with `strictQuery: false` passes `{ identifier, purpose }` straight to MongoDB, which finds nothing. Required fields (`userId`, `code`, `type`) are never written. **Every call to `sendOtp` or `verifyOtp` fails** — either with Mongoose validation errors or `null` results.

**Verdict: CRITICAL — the entire service is non-functional against the current model.**

---

## 3. Security

| Check | Verdict | Severity |
|-------|---------|----------|
| OTP brute force resistance | **FAIL** — See §1 above | CRITICAL |
| Race condition | **FAIL** — No atomic increment | CRITICAL |
| Replay attack | **PASS** — OTP single-use via `consumeOtp` | OK |
| Timing attack | **PASS** — JS `!==` is char-by-char | OK |
| Enumeration risk | **FAIL** — Distinct error messages | MEDIUM |
| CSPRNG for OTP | **FAIL** — Uses `Math.random()` | HIGH |

### Critical: Race condition in `verifyOtp()`

```javascript
// Two concurrent requests:
// Req A reads: record.attempts = 4
// Req B reads: record.attempts = 4
// Both compute totalAttempts = 4 < 5
// Both increment: record.attempts += 1
// Both save()
// Final: record.attempts = 5 or 6 (last-write-wins)
```

No atomic operator (`$inc`) or `findOneAndUpdate` with conditional filter is used. Classic TOCTOU race condition allows exceeding the 5-attempt limit.

### High: `Math.random()` for OTP generation

```javascript
const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString()
```

`Math.random()` is **not cryptographically secure** (XorShift128+ in V8). An attacker with enough OTP samples can predict future codes. Fix: `crypto.randomInt(100000, 999999)`.

### Medium: Error message enumeration

Three distinct error messages allow attacker to probe state:

| Message | Leaks |
|---------|-------|
| "Không tìm thấy mã OTP..." | Whether an OTP was ever sent for this identifier |
| "Mã OTP đã hết hạn" | Whether an OTP exists but expired |
| "Mã OTP không đúng" | Whether an OTP exists and is still valid |

An attacker can enumerate which emails/phone numbers have active OTPs.

### Medium: `exposePreview` leaks OTP

```javascript
...(exposePreview && process.env.NODE_ENV !== 'production' ? { otpPreview: otp } : {})
```

If staging inadvertently runs with `NODE_ENV=development`, all OTPs are leaked in API responses.

### Medium: Full `record` returned from `sendOtp`

```javascript
return { ..., record }
```

The Mongoose document contains `record.otp` (old schema) / `record.code` (new schema). Any controller passing this to the frontend leaks the plaintext OTP code.

---

## 4. Concurrency

| Issue | Verdict | Severity |
|-------|---------|----------|
| Parallel `verifyOtp()` can exceed limit | **FAIL** — No atomic increment | CRITICAL |
| No MongoDB transaction | **FAIL** — Read-then-write gap | CRITICAL |

See §3 above. The implementation has zero concurrency protection.

---

## 5. Error Handling

| Check | Verdict |
|-------|---------|
| HTTP status correct | **PASS** — 400 for validation, 429 for rate limit |
| Error code present | **PARTIAL** — rate limit has `OTP_RATE_LIMIT_EXCEEDED`; other errors have no code |
| Information leakage | **FAIL** — Enumeration via distinct messages |
| Stack trace exposed | **PASS** — AppError handles this |

---

## 6. Performance

| Check | Verdict |
|-------|---------|
| Unnecessary queries | 1 extra query (`countDocuments`) per failed attempt — acceptable |
| Missing index | No index on `{ identifier, purpose, createdAt }` for the past-attempt query. Full collection scan on OTP collection |
| `.lean()` not used | Read-only `findOne` returns full Mongoose doc — minor overhead |
| `record.save()` vs `$inc` | Full document save instead of atomic `$inc` — unnecessary bandwidth |

---

## 7. Architecture

| Principle | Verdict |
|-----------|---------|
| SOLID — Single Responsibility | **PASS** — otpService handles OTP, no scope creep |
| SOLID — Open/Closed | **FAIL** — `sendOtp` has 9 parameters, rigid signature |
| DRY | **PASS** — No duplicated logic |
| Clean Architecture — dependency direction | **PASS** — Service → Model, correct direction |
| Module isolation | **WARN** — Uses legacy `Otp` model; Task 1.4 will need duplicate OTP functions for new model |

---

## 8. Full Issue Register

| # | Severity | Category | Description | File:Line |
|---|----------|----------|-------------|-----------|
| C1 | **CRITICAL** | Business Rule | `countDocuments({ attempts: { $gt: 0 } })` counts documents, not total failures — rate limit undercounts by 2-5x | `otpService.js:76` |
| C2 | **CRITICAL** | Business Rule | BR-AUD-005 requires 30-minute account lockout; not implemented. Rate limit resets on new OTP request (60s cooldown) | `otpService.js:86-91` |
| C3 | **CRITICAL** | Schema Mismatch | Service queries `{ identifier, purpose }` but model has `userId, code, type`. Service will always return `null` or throw validation error | `otpService.js:62` |
| C4 | **CRITICAL** | Concurrency | Race condition: parallel `verifyOtp()` calls both pass rate limit check, read-then-write allows exceeding 5 attempts | `otpService.js:73-96` |
| H1 | **HIGH** | Security | `Math.random()` used for OTP — not cryptographically secure | `otpService.js:10` |
| M1 | **MEDIUM** | Security | Distinct error messages enable enumeration of email/phone OTP state | `otpService.js:65,70,96` |
| M2 | **MEDIUM** | Security | `exposePreview` leaks OTP in non-production environments | `otpService.js:56` |
| M3 | **MEDIUM** | Security | `record` returned from `sendOtp` contains plaintext OTP code | `otpService.js:57` |
| L1 | **LOW** | Standards | Error messages are Vietnamese-only; no English fallback | `otpService.js:65-96` |
| L2 | **LOW** | Standards | AppError throws missing error code parameter (except rate limit) | `otpService.js:65,70,96` |

---

## 9. Suggested Fixes (do not apply)

### Fix C1 — Use aggregation to SUM attempts instead of counting documents

Replace `countDocuments` with an aggregation pipeline:
```javascript
const [result] = await Otp.aggregate([
  { $match: { identifier, purpose, _id: { $ne: record._id }, createdAt: { $gte: fifteenMinAgo } } },
  { $group: { _id: null, total: { $sum: '$attempts' } } },
])
const pastAttempts = result?.total ?? 0
```

### Fix C2 — Implement account lockout with lockout document or field

Add a `lockedUntil` field to the OTP model (or a new `OtpLock` collection):
```javascript
// After exceeding limit, create lockout record
await OtpLock.findOneAndUpdate(
  { identifier, purpose },
  { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) },
  { upsert: true }
)

// At start of verifyOtp, check lockout
const lock = await OtpLock.findOne({ identifier, purpose, lockedUntil: { $gt: new Date() } })
if (lock) throw new AppError('...', 429, 'OTP_ACCOUNT_LOCKED')
```

### Fix C3 — Update field names to match new model

Replace `identifier` → `userId` (ObjectId), `purpose` → `type` (enum), `otp` → `code` throughout the service. Or migrate the model to a combined approach.

### Fix C4 — Use atomic `findOneAndUpdate` with conditional

```javascript
const updated = await Otp.findOneAndUpdate(
  { _id: record._id, attempts: { $lt: 5 } },
  { $inc: { attempts: 1 } },
  { new: true }
)
if (!updated) throw new AppError('...', 429, 'OTP_RATE_LIMIT_EXCEEDED')
```

### Fix H1 — Use crypto.randomInt

```javascript
import crypto from 'crypto'
const generateOtpCode = () => crypto.randomInt(100000, 999999).toString()
```

---

## 10. Risk Score

| Category | Score |
|----------|-------|
| Business Rule Coverage | **15/25** (BR-AUD-005: 30% implemented) |
| Security | **10/25** (4 critical/high security defects) |
| Correctness | **15/25** (code cannot execute against current model) |
| Code Quality | **18/25** (clear, but race condition + CSPRNG) |

| Metric | Value |
|--------|-------|
| **Total Risk Score** | **58/100** |
| **Risk Rating** | **HIGH** |
| **PASS / FAIL** | **FAIL** |

---

## 11. Conclusion

Task 1.3 as implemented **does not satisfy** BR-AUD-005 and **cannot execute** against the current `Otp` model.

### Blockers

| Blocker | Why it blocks |
|---------|---------------|
| Schema mismatch (C3) | Service queries non-existent fields → always returns `null` or validation error |
| No lockout (C2) | Rate limit bypassable by requesting new OTP every 60 seconds |
| Document-count instead of sum (C1) | Attempts severely undercounted even if lockout existed |
| Race condition (C4) | Limit exceeds even with perfect timing |

### Required actions before re-review

1. Align `otpService.js` field names with the current `Otp` model schema (`userId`, `code`, `type`, `consumedAt`)
2. Implement 30-minute lockout as a separate collection/field with expiry
3. Replace `countDocuments` with `$sum` aggregation
4. Replace read-then-write with atomic `findOneAndUpdate` + `$inc`
5. Replace `Math.random()` with `crypto.randomInt()`

---

*Audit completed 2026-07-20. This review covers Task 1.3 only and does not evaluate model correctness, other services, or other tasks.*
