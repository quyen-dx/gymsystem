# Epic 2.2 — Fix Report

**Date**: 2026-07-21  
**Status**: FIXED ✅  
**Baseline**: FLASH_AUDIT_EPIC_2_2.md (FAIL, 2 HIGH, 1 MEDIUM, 1 LOW)

---

## Root Cause

The Epic 2.2 implementation patched only the wallet pay path (`subscribeWithWallet`) with BR-MEM-001 and BR-MEM-003 enforcement. Three other membership creation paths — Stripe checkout (`createCheckoutSession`), manual registration (`createManualRegistration`), and the shared activation function (`createActivatedMembership`) — were left unguarded.

Additionally, the shared validation utility `assertPurchaseEligibility` was imported into `membershipService.js` but never called, and `assertOneActiveMembership` (called by `assertPurchaseEligibility`) incorrectly rejected `pending_initial_activation` cycles (contradicting the production extension behavior EC10).

The `statusTransitionService.js` file was created but never imported anywhere.

---

## Files Modified (2) + Deleted (1)

| File | Action | Lines | Why |
|---|---|---|---|
| `src/services/membershipBusinessRules.js` | Modified | -2 query field, -6 lines | H-1/M-1: Removed `pending_initial_activation` from `assertOneActiveMembership` rejection check to match production EC10 behavior |
| `src/services/membershipService.js` | Modified | -24 inline, +5 shared calls | H-1/H-2/M-1: Replaced inline BR checks in `subscribeWithWallet` with `assertPurchaseEligibility`; added `assertPurchaseEligibility` calls to `createActivatedMembership`, `createCheckoutSession`, `createManualRegistration` |
| `src/services/statusTransitionService.js` | Deleted | -98 | L-1: Dead code — never imported or used anywhere |

---

## Findings Resolved

### H-1: BR-MEM-001 bypass closed ✅

**Before**: Only `subscribeWithWallet` checked for `pending_renewal_activation` in register mode. Three other paths (`createCheckoutSession`, `createManualRegistration`, `createActivatedMembership`) only checked for `active`.

**Fix**: `assertPurchaseEligibility(memberId, 'register')` now called in all four code paths, which invokes `assertOneActiveMembership` → queries for `active` OR `pending_renewal_activation` → throws if found.

| Code path | Register guard before | Register guard after |
|---|---|---|
| `subscribeWithWallet` | inline `active` + `pending_renewal_activation` | `assertPurchaseEligibility` |
| `createCheckoutSession` | inline `active` only | `assertPurchaseEligibility` |
| `createManualRegistration` | inline `active` only | `assertPurchaseEligibility` |
| `createActivatedMembership` | inline `active` only | `assertPurchaseEligibility` |

`pending_initial_activation` is intentionally excluded from the rejection check — it is handled by extension logic (EC10) in `subscribeWithWallet` and `createActivatedMembership`.

### H-2: BR-MEM-003 bypass closed ✅

**Before**: Only `subscribeWithWallet` (wallet renew) enforced the max 3 pending renewals limit. The Stripe renew path (`createRenewalCheckoutSession` → `createCheckoutSession` → `createActivatedMembership`) had zero enforcement.

**Fix**: `assertPurchaseEligibility(memberId, 'renew')` now called in both `createCheckoutSession` and `createActivatedMembership` for renew mode, invoking `assertMaxPendingRenewals` → counts `pending_renewal_activation` cycles → throws if >= 3.

| Code path | Renew guard before | Renew guard after |
|---|---|---|
| `subscribeWithWallet` (wallet) | inline `countDocuments` | `assertPurchaseEligibility` |
| `createCheckoutSession` (Stripe) | none | `assertPurchaseEligibility` |
| `createActivatedMembership` (shared) | none | `assertPurchaseEligibility` |

### M-1: `assertPurchaseEligibility` now the single source of truth ✅

**Before**: `assertPurchaseEligibility` imported on `membershipService.js:38` but never called. Inline DB queries duplicated the logic in `subscribeWithWallet` only.

**Fix**: 
- `subscribeWithWallet`: inline BR checks replaced with `assertPurchaseEligibility(memberId, mode)` call. Redundant `pendingRenewal` query and `countDocuments` for pending renewals removed.
- `createCheckoutSession`: `assertPurchaseEligibility(user._id, mode)` added.
- `createManualRegistration`: `assertPurchaseEligibility(user._id, 'register')` added.
- `createActivatedMembership`: `assertPurchaseEligibility(memberId, mode)` added.

All 4 code paths now call the same shared function. `assertOneActiveMembership` no longer rejects `pending_initial_activation` (aligned with production EC10).

### L-1: `statusTransitionService.js` removed ✅

**Before**: 98-line file with 6 exports, zero consumers.

**Fix**: File deleted. No source code references remain.

---

## Verification

| Check | Result |
|---|---|
| 101/101 existing tests pass | ✅ |
| `assertPurchaseEligibility` called from 4 code paths | ✅ |
| BR-MEM-001 enforced on `subscribeWithWallet` (wallet register) | ✅ |
| BR-MEM-001 enforced on `createCheckoutSession` (Stripe register) | ✅ |
| BR-MEM-001 enforced on `createManualRegistration` (manual register) | ✅ |
| BR-MEM-001 enforced on `createActivatedMembership` (shared activation) | ✅ |
| BR-MEM-003 enforced on `subscribeWithWallet` (wallet renew) | ✅ |
| BR-MEM-003 enforced on `createCheckoutSession` (Stripe renew) | ✅ |
| BR-MEM-003 enforced on `createActivatedMembership` (shared activation) | ✅ |
| `pending_initial_activation` → extension (EC10) preserved | ✅ |
| `assertRenewalAllowed` (30-day rule) unchanged | ✅ |
| No new dead code | ✅ |
| No API signatures changed | ✅ |
| No Auth/JWT/OTP/RBAC/Freeze modules touched | ✅ |

---

## Regression Checklist

| Check | Status |
|---|---|
| Wallet register with no existing cycles | ✅ |
| Wallet register with active cycle (reject) | ✅ |
| Wallet register with pending_renewal_activation (reject) | ✅ |
| Wallet register with pending_initial_activation (extend) | ✅ |
| Wallet renew with active cycle | ✅ |
| Wallet renew with 3+ pending renewals (reject) | ✅ |
| Wallet renew with <30 remaining days | ✅ |
| Stripe register flow (pre-check → payment → webhook → activation) | ✅ |
| Stripe renew flow (pre-check → payment → webhook → activation) | ✅ |
| Manual register → staff confirm flow | ✅ |
| `renewMembershipWithWallet` delegates to `subscribeWithWallet` | ✅ |
| `renewMembershipWithDuration` delegates to `subscribeWithWallet` | ✅ |
| `createRenewalCheckoutSession` calls `createCheckoutSession` with renew guard | ✅ |
