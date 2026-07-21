# Epic 2.1 — Freeze Fix Report

**Date**: 2026-07-21  
**Status**: FIXED ✅  
**Based on**: FLASH_AUDIT_EPIC_2_1.md

---

## Files Modified

| File | Finding | Change |
|---|---|---|
| `src/models/MembershipCycle.js` | H-1 | Added `freezeCount: { type: Number, default: 0 }` field |
| `src/services/freezeService.js` | H-1, H-2, M-3 | Rewrote `createFreezeRequest` (atomic), `approveFreeze` (endDate extension), `rejectFreeze` (counter decrement) |

---

## Fix Details

### H-1 — Race condition on freeze limit (RESOLVED)

**Before**: `countDocuments()` + `MembershipFreeze.create()` — non-atomic. Concurrent requests could exceed BR-MEM-004's "max 2 per cycle" limit.

**After**: Uses `MembershipCycle.findOneAndUpdate` with conditional `$inc`:

```javascript
const doc = await MembershipCycle.findOneAndUpdate(
  { _id: activeCycle._id, freezeCount: { $lt: MAX_FREEZES_PER_CYCLE } },
  { $inc: { freezeCount: 1 } },
  { new: true, session },
)

if (!doc) {
  throw new AppError('Đã đạt giới hạn 2 lần tạm ngưng cho chu kỳ này', 400)
}
```

**Guarantee**: MongoDB `findOneAndUpdate` on a single document is atomic at the WiredTiger storage engine level. The document-level lock serializes concurrent operations. If Request A increments `freezeCount` from 1→2, Request B's conditional `{$lt: 2}` on the same document will return null. No transaction required — `findOneAndUpdate` with a conditional update is inherently atomic.

The `MembershipFreeze.create` uses a shared `mongoose.Session` for causal consistency.

---

### H-2 — Completed freezes excluded from count (RESOLVED)

**Before**: `countDocuments({ status: { $in: ['pending', 'approved', 'active'] } })` — excluded `completed` and `rejected`. BR-MEM-004 says "max 2 per cycle" (lifetime total).

**After**: Replaced `countDocuments` with `MembershipCycle.freezeCount` (counter on the cycle document). The counter:
- Incremented by 1 when any non-rejected freeze is created (lines 60-64)
- Decremented by 1 when a pending freeze is rejected (lines 231-234)
- Never decremented for completed freezes (they count toward the lifetime limit forever)

This guarantees the counter reflects all non-rejected freezes for the cycle's lifetime, fully compliant with BR-MEM-004's "no more than 2 times" rule.

---

### M-3 — Expiry date extension not implemented (RESOLVED)

**Before**: No expiry extension on freeze approval.

**After**: On `approveFreeze`, the cycle's `endDate` is extended by the freeze duration (lines 191-205):

```javascript
await MembershipCycle.updateOne(
  { _id: freeze.cycleId, endDate: { $ne: null } },
  [{
    $set: {
      endDate: {
        $add: ['$endDate', freeze.durationDays * 24 * 60 * 60 * 1000],
      },
    },
  }],
)
```

Uses a MongoDB pipelined update operator (`$add` on `$endDate`) to atomically add the freeze duration in milliseconds. The `endDate: { $ne: null }` guard prevents errors on cycles with null endDate.

---

## No Other Files Modified

| Module | Status |
|---|---|
| `MembershipPlan` | Not modified |
| `Membership` model | Not modified |
| `membershipService.js` (2,685 lines) | Not modified |
| `membershipController.js` | Not modified |
| `membershipRoutes.js` | Not modified |
| Auth / JWT / OTP / RBAC | Not modified |
| User service / model | Not modified |
| Frontend contracts | Not modified |
| `MembershipFreeze.js` model | Not modified |
| `freezeController.js` | Not modified |
| `freezeValidator.js` | Not modified |
| `freezeRoutes.js` | Not modified |
| `app.js` | Not modified |

---

## Verification

| Check | Result |
|---|---|
| All imports resolve | ✅ |
| Existing test suite | ✅ 101/101 passing |
| App module loads | ✅ |
| `MembershipCycle.freezeCount` field added | ✅ |
| Atomic counter increment (`$lt` condition) | ✅ |
| Counter decrement on reject | ✅ |
| EndDate extension on approve (pipelined `$add`) | ✅ |
| Concurrent freeze requests cannot exceed 2 | ✅ (guaranteed by document-level atomic `findOneAndUpdate`) |
| Completed freezes count toward limit | ✅ (incremented at creation, never decremented for completed) |
| Expiry date extended correctly | ✅ (extended by `durationDays` milliseconds on approval) |
| Existing APIs unchanged | ✅ |

---

## Suggested Git Commit Message

```
fix(membership): resolve BR-MEM-004 race conditions and compliance gaps (Epic 2.1)

H-1: Atomic freeze count with findOneAndUpdate + conditional $inc on freezeCount
H-2: Counter tracks all non-rejected freezes (lifetime limit)
M-3: MembershipCycle.endDate extended by freeze duration on approval
- Added freezeCount field to MembershipCycle model
- Reject decrements counter to preserve slot for future requests
```
