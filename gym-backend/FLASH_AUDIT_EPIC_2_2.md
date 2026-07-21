# Flash Audit — Epic 2.2: Membership Purchase & Activation

**Date**: 2026-07-21  
**Scope**: `membershipBusinessRules.js`, `statusTransitionService.js`, `purchaseValidator.js`, `membershipService.js` (+18 lines), `membershipRoutes.js` (+2 lines)  
**Baseline**: 101/101 tests passing

---

## Verdict: FAIL ❌

Two HIGH findings (BR-MEM-001 and BR-MEM-003 bypassable via non‑wallet code paths) and one MEDIUM finding (dead code with latent inconsistency) must be resolved before acceptance.

---

## PASS Items ✅

| Check | Result |
|---|---|
| 101/101 existing tests pass | ✅ |
| BR-MEM-001 enforced for wallet register path — `active` + `pending_renewal_activation` | ✅ |
| BR-MEM-003 enforced for wallet renew path — max 3 pending renewals | ✅ |
| `pending_initial_activation` → extension behavior preserved (EC10) | ✅ |
| `assertRenewalAllowed` (30‑day rule) unchanged | ✅ |
| Zod `purchaseSchema` / `renewSchema` applied on 3 routes | ✅ |
| No existing API signatures changed | ✅ |
| Epic 2.1 FreezeRequest module unaffected | ✅ |
| No IA (PII exposure) concerns identified | ✅ |

---

## FAIL Items ❌

### H‑1: BR-MEM-001 enforcement incomplete — Stripe & manual paths bypass `pending_renewal_activation` guard

**Severity**: HIGH  
**Risk**: Member can hold two simultaneous MembershipCycles (register while renewal pending)

Only the wallet pay path (`subscribeWithWallet:214‑221`) checks for `pending_renewal_activation` in register mode. Three other code paths are missing the check:

| Code path | File:Line | Checks `active`? | Checks `pending_renewal_activation`? |
|---|---|---|---|
| `subscribeWithWallet` (wallet) | membershipService.js:207‑221 | ✅ | ✅ |
| `createCheckoutSession` (Stripe) | membershipService.js:990‑997 | ✅ | ❌ |
| `createManualRegistration` (manual) | membershipService.js:933‑940 | ✅ | ❌ |
| `createActivatedMembership` (activation) | membershipService.js:635‑639 | ✅ | ❌ |

**Bypass scenario**:
1. Member has active cycle
2. Member initiates Stripe renewal → `createRenewalCheckoutSession` → creates `pending_renewal_activation`
3. Before active cycle expires, member uses `POST /` (with `onlinePaymentEnabled=true`) → `createCheckoutSession` → only checks `active` (not found, the active cycle is still the original one) → creates Stripe payment → creates second MembershipCycle via `createActivatedMembership`
4. Result: member holds two cycles, violating BR-MEM-001

---

### H‑2: BR-MEM-003 enforcement incomplete — Stripe renew path bypasses max 3 pending renewals

**Severity**: HIGH  
**Risk**: Member can create unlimited pending renewal cycles via Stripe

The max‑3 check exists only in `subscribeWithWallet:232‑239` (wallet renew). The Stripe renew path has none:

```
renewMyMembership (controller)
  → createRenewalCheckoutSession      ❌ no BR-MEM-003 check
    → createCheckoutSession(mode:'renew')  ❌ no BR-MEM-003 check
      → completeStripeCheckoutSession
        → createActivatedMembership(mode:'renew')  ❌ no BR-MEM-003 check
```

The wallet renew path is guarded because `renewMembershipWithWallet` and `renewMembershipWithDuration` both delegate to `subscribeWithWallet`. But `renewMyMembership` (Stripe) bypasses entirely.

**Bypass scenario**: Member calls `POST /my/renew` (Stripe) 10 times → 10 `pending_renewal_activation` cycles → all activate on expiry.

---

### M‑1: Dead code — `assertPurchaseEligibility` imported but never called

**Severity**: MEDIUM  
**Risk**: Latent inconsistency; future caller would break extension flow

`membershipService.js:38` imports `assertPurchaseEligibility`, but the function is **never invoked** anywhere in the codebase. All business‑rule enforcement is done via raw inline queries instead of the shared utility.

Worse, `assertOneActiveMembership` (called by `assertPurchaseEligibility`) **rejects** `pending_initial_activation`:

```js
// membershipBusinessRules.js:29-33
if (existing.status === 'pending_initial_activation') {
  throw new AppError('Bạn đã có gói tập đang chờ kích hoạt...')
}
```

But production code **extends** the existing pending cycle instead (intentional EC10 at `membershipService.js:718-727`). If someone later calls `assertPurchaseEligibility` for a register flow with a pending cycle, the extension behavior breaks.

---

### L‑1: `statusTransitionService.js` never imported or used

**Severity**: LOW  
**Risk**: Dead code

The 98‑line state machine at `src/services/statusTransitionService.js` exports 6 symbols (`validateCycleTransition`, `validateMembershipTransition`, `isTerminalCycleStatus`, `isPendingCycleStatus`, `CycleStatus`, `MembershipStatus`). Zero are imported anywhere in the codebase.

---

## Root Cause

The implementation patched only `subscribeWithWallet` (wallet pay path). But the business rules (BR-MEM-001, BR-MEM-003) must be enforced at the **lowest common entry point** — `createActivatedMembership` — or separately in every code path (Stripe checkout, manual registration, wallet).

---

## Recommended Fix (all in one change)

1. **Fix `assertOneActiveMembership`** to allow `pending_initial_activation` (pass through, don't reject — the caller decides extension vs rejection):
   ```js
   $in: ['active', 'pending_renewal_activation'],  // remove pending_initial_activation
   ```

2. **Fix `assertPurchaseEligibility`** to accept a `skipRenewalCheck` option so the extend flow can bypass:
   ```js
   export const assertPurchaseEligibility = async (memberId, mode, { skipRenewalCheck = false } = {}) => {
     if (mode === 'renew' && !skipRenewalCheck) {
       await assertMaxPendingRenewals(memberId)
     }
     if (mode !== 'renew') {
       await assertOneActiveMembership(memberId)
     }
   }
   ```

3. **Add `assertPurchaseEligibility` call in `createActivatedMembership`** (line 628) — catches both Stripe webhook and staff‑confirm paths:
   ```js
   await assertPurchaseEligibility(memberId, mode, { skipRenewalCheck: mode === 'register' && !!existingPendingCycle })
   ```

4. **Add pre‑check in `createCheckoutSession`** (line 980) — reject early before Stripe payment:
   ```js
   await assertPurchaseEligibility(user._id, mode)
   ```

5. **Add pre‑check in `createManualRegistration`** (line 931):
   ```js
   await assertPurchaseEligibility(user._id, 'register')
   ```

6. **Wire up `statusTransitionService`** by importing and calling `validateCycleTransition` / `validateMembershipTransition` in `createActivatedMembership`, `freezeService.approveFreeze`, `activateCycle`, `completeCycle`, etc., or remove the file.

---

## Re‑audit Checklist

| Item | Check |
|---|---|
| Fix `assertOneActiveMembership` — allow `pending_initial_activation` | ☐ |
| Fix `assertPurchaseEligibility` — support extension skip | ☐ |
| Add `assertPurchaseEligibility` to `createActivatedMembership` | ☐ |
| Add pre‑check to `createCheckoutSession` | ☐ |
| Add pre‑check to `createManualRegistration` | ☐ |
| Wire or remove `statusTransitionService` | ☐ |
| Run 101‑test suite | ☐ |
| Verify Stripe register path rejects when `pending_renewal_activation` exists | ☐ |
| Verify Stripe renew path rejects when ≥3 pending renewals | ☐ |
| Verify wallet register path still extends `pending_initial_activation` | ☐ |
