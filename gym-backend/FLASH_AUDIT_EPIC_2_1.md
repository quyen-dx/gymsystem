# Flash Audit — Epic 2.1 (FreezeRequest)

**Audit Date**: 2026-07-21  
**Result**: **FAIL** ❌

---

## Findings

### HIGH-1 — Race condition on freeze limit check
**File**: `src/services/freezeService.js:39-49,68`  
**Severity**: HIGH  
**Category**: Race Condition  

`createFreezeRequest` performs a `countDocuments` query and then a separate `MembershipFreeze.create` without any atomicity mechanism (MongoDB transaction or `findOneAndUpdate`). Under concurrent requests, two freeze creations could both pass the count check (e.g., both see count=1 when max=2), resulting in 3 freezes for a cycle, violating BR-MEM-004's "max 2 per cycle" rule.

**Fix**: Either wrap the entire check+create in a MongoDB transaction, or use `findOneAndUpdate` with conditions (e.g., increment a counter atomically on the cycle document).

---

### HIGH-2 — Completed freezes excluded from limit count, allowing >2 per cycle
**File**: `src/services/freezeService.js:39-42`  
**Severity**: HIGH  
**Category**: BR-MEM-004 Compliance  

BR-MEM-004 specifies "A membership cycle may be frozen no more than 2 times" (lifetime total). The freeze count query filters `{ status: { $in: ['pending', 'approved', 'active'] } }`, which excludes `'completed'` status. A member could:
1. Create, approve, and complete 2 freezes.
2. Request a 3rd freeze — count returns 0 (no pending/approved/active) → allowed.

**Fix**: Include `'completed'` in the count query, or remove the status filter entirely. Only `'rejected'` should be excluded.

---

### MEDIUM-3 — Expiry date extension not implemented
**File**: `src/services/freezeService.js` (missing logic)  
**Severity**: MEDIUM  
**Category**: BR-MEM-004 Compliance  

BR-MEM-004 explicitly requires: "The membership expiry date is extended by the freeze duration." The pseudocode in the rule includes `-- Approve freeze and extend expiry`. No implementation exists to extend the cycle's `endDate` upon freeze approval. The report acknowledges this as "Out of Scope."

**Fix**: On freeze approval, increment `MembershipCycle.endDate` by `freeze.durationDays`. Requires schema awareness that `endDate` may already be referenced elsewhere.

---

### LOW-4 — Dead validator code (approveFreezeSchema note field unused)
**File**: `src/validators/freezeValidator.js:9-11`, `src/controllers/freezeController.js:26-28`  
**Severity**: LOW  
**Category**: Code Quality  

`approveFreezeSchema` validates an optional `note` field, but neither `approveFreezeRequest` controller nor `approveFreeze` service accepts or passes this field. The validated body is silently discarded. Creates confusion about expected API contract.

**Fix**: Either remove the schema or plumb the `note` into the service for logging/storage.

---

### LOW-5 — Unused model field `previousFreezeEndDate`
**File**: `src/models/MembershipFreeze.js:54-57`, `src/services/freezeService.js:76`  
**Severity**: LOW  
**Category**: Code Quality  

`previousFreezeEndDate` is stored during creation but never read by any query or business logic. The 7-day gap check reads `lastCompletedFreeze.endDate` directly from the DB query result. Redundant storage with no consumer.

**Fix**: Remove the field from the model and its assignment in `createFreezeRequest`.

---

### LOW-6 — Model fields deviate from DATABASE.md schema
**File**: `src/models/MembershipFreeze.js` vs `docs/DATABASE.md:178-192`  
**Severity**: LOW  
**Category**: Documentation Drift  

The DATABASE.md schema defines 7 fields for `membership_freezes`: cycleId, userId, startDate, endDate, reason, status, approvedBy, deletedAt. The implementation adds 4 undocumented fields: `durationDays`, `approvedAt`, `rejectedAt`, `previousFreezeEndDate`. While `durationDays` and timestamps are justifiable, they cause documentation drift.

**Fix**: Update DATABASE.md to reflect the actual schema.

---

## Summary

| Finding | Severity | Category |
|---------|----------|----------|
| H-1: Race condition on freeze limit | HIGH | Race Condition |
| H-2: Completed freezes excluded from count | HIGH | BR-MEM-004 Compliance |
| M-3: Expiry extension not implemented | MEDIUM | BR-MEM-004 Compliance |
| L-4: Dead validator code | LOW | Code Quality |
| L-5: Unused field `previousFreezeEndDate` | LOW | Code Quality |
| L-6: Model/DATABASE.md drift | LOW | Documentation |

---

**Verdict**: FAIL — 2 HIGH issues (race condition + BR-MEM-004 compliance gap) and 1 MEDIUM issue (expiry extension). Fix findings H-1, H-2, and M-3 before re‑audit.
