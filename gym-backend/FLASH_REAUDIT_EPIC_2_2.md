# Flash Re-Audit — Epic 2.2: Membership Purchase & Activation

**Date**: 2026-07-21  
**Previous Verdict**: FAIL (2 HIGH, 1 MEDIUM, 1 LOW)  
**Baseline**: 101/101 tests passing

---

## Verdict: PASS ✅

| Metric | Previous | Now |
|---|---|---|
| Risk Score | HIGH (2 bypassable paths) | **15/100** (TOCTOU race only) |
| Security Score | 80/100 (incomplete gates) | **96/100** (all paths guarded) |
| Architecture Score | 82/100 (dead code) | **92/100** (single source of truth) |

All 4 findings resolved. No remaining HIGH or MEDIUM issues.

---

## H‑1: BR-MEM-001 bypass closed ✅

**Claim**: `pending_renewal_activation` guard missing from 3 code paths.
**Fix verification**: `assertPurchaseEligibility(memberId, 'register')` now called in all 4 paths.

| Entry point | Guard | Verified |
|---|---|---|
| `subscribeWithWallet` mode='register' | `assertPurchaseEligibility` line 203 | ✅ rejects if `active` or `pending_renewal_activation` exists |
| `createCheckoutSession` mode='register' | `assertPurchaseEligibility` line 970 | ✅ rejects before Stripe payment |
| `createManualRegistration` | `assertPurchaseEligibility` line 912 | ✅ rejects before creating registration |
| `createActivatedMembership` mode='register' | `assertPurchaseEligibility` line 607 | ✅ rejects before cycle creation |

**Bypass trace**: A member with `active` + `pending_renewal_activation` attempting register is blocked at every entry. No path allows creating a second `MembershipCycle`. `pending_initial_activation` is still extended (EC10) — not rejected. ✅

---

## H‑2: BR-MEM-003 bypass closed ✅

**Claim**: Max 3 pending renewals not enforced on Stripe renew path.
**Fix verification**: `assertPurchaseEligibility(memberId, 'renew')` now called in all renew paths.

| Entry point | Guard | Verified |
|---|---|---|
| `subscribeWithWallet` mode='renew' (wallet) | `assertPurchaseEligibility` line 203 | ✅ `assertMaxPendingRenewals` throws if ≥3 |
| `createCheckoutSession` mode='renew' (Stripe pre-check) | `assertPurchaseEligibility` line 970 | ✅ rejects before Stripe payment |
| `createActivatedMembership` mode='renew' (Stripe/Staff activation) | `assertPurchaseEligibility` line 607 | ✅ rejects before cycle creation |

**Bypass trace**: All 3 renew entry points enforce the limit. Wallet, Stripe, and staff-enabled renewals all hit `assertMaxPendingRenewals`. ✅

---

## M‑1: `assertPurchaseEligibility` now single source of truth ✅

| Before | After |
|---|---|
| Imported line 38, never called | 5 call sites: lines 203, 607, 912, 970 + exported definition |
| Inline BR queries in `subscribeWithWallet` only | All 4 paths call the same shared function |
| `assertOneActiveMembership` rejected `pending_initial_activation` | `pending_initial_activation` removed from `$in` check — aligned with EC10 |

Remaining inline `active`-only checks in `createActivatedMembership:613`, `createCheckoutSession:972`, `createManualRegistration:914` are safety-net redundancy — they never trigger because `assertOneActiveMembership` already threw. Removing them would be cosmetic; they don't create a bypass. ✅

---

## L‑1: `statusTransitionService.js` removed ✅

File deleted at `src/services/statusTransitionService.js`. Zero source‑code references remain. No regression — the module was never imported. ✅

---

## Regression Verification

| Module | Status | Evidence |
|---|---|---|
| Membership CRUD | ✅ Unchanged | No API signatures modified |
| Membership Plans | ✅ Unchanged | No Plan model touched |
| Membership Freeze (Epic 2.1) | ✅ Unchanged | No freeze service/controller/routes touched |
| Existing Membership APIs | ✅ Unchanged | `subscribeMembership`, `createMembership`, `renewMyMembership`, `renewMembershipByWallet`, `renewMembershipByWalletWithDuration` — same signatures |
| Existing frontend compatibility | ✅ Unchanged | All API contracts preserved |
| Auth / JWT / OTP / RBAC / User | ✅ Unchanged | No files touched |
| Wallet | ✅ Unchanged | Wallet deduction logic untouched |
| `assertRenewalAllowed` (30‑day rule) | ✅ Unchanged | Still called in renew path |
| 101/101 tests pass | ✅ | `npm test` — 8 files, 101 tests, 0 failures |

---

## INFO: TOCTOU race condition (pre‑existing, out of scope)

In both `subscribeWithWallet` and `createActivatedMembership`, the `assertMaxPendingRenewals` query and the subsequent `MembershipCycle.create` are not in the same atomic operation. Two concurrent requests could both see count < 3 and both proceed. This is a pre‑existing race (not introduced by this fix) and would require a unique compound index or a conditional `findOneAndUpdate` to fully resolve. Separately tracked — not blocking this audit.
