# Epic 2.7 — Audit & Compliance Discovery Report

**Date:** 2026-07-21  
**Module:** Audit, Compliance, Admin Controls (BR-AUD-001 through BR-AUD-005, BR-ADM-001 through BR-ADM-003)  
**Reference:** `docs/implementation/IMPLEMENTATION_SEQUENCE.md` §2.6 (Transaction Ledger), `docs/BUSINESS_RULES.md` §9–10  

---

## 1. Epic 2.7 Scope

| Source | Definition |
|---|---|
| `IMPLEMENTATION_SEQUENCE.md` §2.6 | Transaction ledger (dual-entry, immutable, audit-trail): encode every financial movement with a counterpart, enable reconciliation, prevent fraud. Depends on payment (2.4) + wallet (2.5). Deliverables: Transaction model, ledgerService, atomic transaction wrapper. |
| `BUSINESS_RULES.md` §9–10 | BR-ADM-001 (admin approval for refunds >1M VND), BR-ADM-002 (RBAC), BR-ADM-003 (admin audit logging with old/new values + IP), BR-AUD-001 (5-year financial retention), BR-AUD-002 (GDPR data export + anonymization), BR-AUD-003 (daily gateway reconciliation), BR-AUD-004 (max 3 device sessions), BR-AUD-005 (rate limiting: 5 OTP / 15 min) |

---

## 2. Existing Coverage Summary

| Business Rule | Coverage | Assessment |
|---|---|---|
| **BR-AUD-001** (5-year retention, immutable records) | **70%** | `LedgerEntry` model has full immutable hooks ✅. `Transaction` model: `balanceBefore`/`balanceAfter` + `ledgerEntryId` exist, but no immutable hooks ❌. Archive/retention logic missing ❌. Membership refunds don't create LedgerEntry pairs ❌. |
| **BR-AUD-002** (GDPR data export, anonymization) | **10%** | `User.softDelete()` exists ✅. `GET /api/admin/reports/export` returns 501 ❌. No data aggregation service ❌. No PII anonymization ❌. No "right to be forgotten" flow ❌. |
| **BR-AUD-003** (daily reconciliation job) | **5%** | `Payment` model has `txnRef`/`stripeSessionId` (foundation) ✅. No reconciliation service ❌. No reconciliation cron job ❌. No discrepancy model ❌. |
| **BR-AUD-004** (max 3 device sessions) | **100%** | Done. `RefreshToken.countActiveByUser()` + `tokenService.generateRefreshToken()` enforces limit. Session listing/revocation endpoints exist. |
| **BR-AUD-005** (rate limiting: OTP) | **100%** | Done. Dual-layer: express-rate-limit (`authOtpLimiter` = 5/15min) + `otpService.js` (attempt tracking across OTP records, 30-min lockout). |
| **BR-ADM-001** (refund approval >1M VND) | **50%** | `refundRequestService.js` exists. `adminApprovalQueue` exists in other modules. Not yet enforced for refund thresholds. |
| **BR-ADM-002** (RBAC for all admin actions) | **90%** | `protect` + role-based middleware (`adminOnly`, `sellerOnly`, etc.) + `permissions.js` feature-level checks. Comprehensive. |
| **BR-ADM-003** (admin audit logging) | **55%** | `AuditLog` model exists, `recordAuditLog()` called from 11 controllers. Missing: `oldValue`/`newValue`, `ip`, `userAgent` fields. Module enum limited to 8 types. |

**Overall Coverage: ~55%**

---

## 3. What ALREADY EXISTS

### 3.1 LedgerEntry Model (`src/models/LedgerEntry.js`) ✅ — 100%

Complete immutable dual-entry ledger model (69 lines). Implements BR-AUD-001 immutability with 6 pre-hooks:
- `pre('save')` — blocks updates to existing entries
- `pre('findOneAndUpdate')` — blocks find-and-update
- `pre('updateOne')` — blocks direct updates
- `pre('deleteOne')` — blocks single delete
- `pre('deleteMany')` — blocks mass delete
- `pre('findOneAndDelete')` — blocks find-and-delete

Fields: `transactionId`, `direction` (debit/credit), `amount`, `account`, `counterpartyAccount`, `description`, timestamps. Indexed on `account + createdAt` and `transactionId + direction`. **No changes needed.**

### 3.2 Ledger Service (`src/services/ledgerService.js`) ✅ — 80%

- `createLedgerPair()` — creates matching debit+credit entries atomically
- `createLedgerEntry()` — single entry creation
- `getLedgerEntries()` — read with filters
- Session-aware — accepts MongoDB session for transactional consistency

**Missing:** archive queries (filter by `createdAt > 5 years`), bulk export, cold-storage reference fields.

### 3.3 Wallet ↔ Ledger Integration (`src/services/walletService.js`) ✅ — 100%

Every wallet operation creates dual-entry LedgerEntry pairs via `createLedgerPair()`:
- `applyWalletTransaction` (lines 113-135): deposit/withdrawal/payment/refund → `Wallet:X:user` ↔ `PLATFORM:revenue`
- `transferWalletBalance` (lines 240-247): `Wallet:X:user₁` ↔ `Wallet:X:user₂`
- `holdBalance` (lines 319-326): `Wallet:X:user` ↔ `HOLD:X:user`
- `releaseBalance` (lines 370-377): `HOLD:X:user` ↔ `Wallet:X:user`
- `approveWithdrawal` (lines 567-574): `Wallet:X:user` ↔ `BANK:X:user`

All use MongoDB sessions for atomicity. **No changes needed.**

### 3.4 Transaction Model (`src/models/Transaction.js`) — 75%

Comprehensive 82-line schema: `userId`, `walletId`, `type` (10 types), `amount`, `balanceBefore`/`balanceAfter`, `status` (6 states), `idempotencyKey` (unique, sparse), `ledgerEntryId`, `metadata`, timestamps.

**Missing:** No immutable hooks (unlike LedgerEntry). `findOneAndUpdate`, `deleteOne`, `updateOne` are unrestricted on Transaction records.

### 3.5 Session Limit (BR-AUD-004) — 100% ✅

- `RefreshToken.countActiveByUser()` in `src/models/RefreshToken.js:67-73` — counts non-revoked, non-expired tokens
- `tokenService.generateRefreshToken()` in `src/services/tokenService.js:31-38` — revokes oldest if ≥ 3 active
- `GET /api/v1/auth/sessions` — lists active sessions
- `DELETE /api/v1/auth/devices/:id` — revokes specific device
- `DELETE /api/v1/auth/devices` — revokes all sessions
- Device tracking (`userAgent`, `ip`, `platform`) captured on login

### 3.6 Rate Limiting (BR-AUD-005) — 100% ✅

Dual-layer enforcement:
1. **Route-level:** `src/middlewares/rateLimiter.js` — `authOtpLimiter` (5 requests / 15 min), `authLoginLimiter` (10/min), `authRegisterLimiter` (5/min), `authPasswordResetLimiter` (3/hour)
2. **Code-level:** `src/services/otpService.js` — `MAX_ATTEMPTS = 5`, `RATE_LIMIT_WINDOW_MS = 15 min`, `LOCKOUT_DURATION_MS = 30 min`. `verifyOtp()` aggregates attempts across all OTP records for the same identifier within the 15-min window, locks if ≥ 5. `sendOtp()` checks `lockedUntil` before sending.

### 3.7 Audit Log Model (`src/models/AuditLog.js`) — 55%

42 lines. Fields: `module` (8 enum values: users/plans/products/shops/ai/system_settings/planFeatures/specializations), `action` (create/update/delete), `entityId`, `entityName`, `admin.{id,name,email}`, `details` (string).

**Missing for BR-ADM-003 compliance:**
- `oldValue` / `newValue` — required by BR-ADM-003 for change tracking
- `ip` / `userAgent` — required for actor identity audit trail
- `module` enum missing: memberships, bookings, payments, wallets, checkins, notifications, trainers, refunds, freezes (15+ modules only 8 covered)

### 3.8 Audit Log Service (`src/services/auditLogService.js`) — 50%

21 lines. `recordAuditLog({ req, module, action, entity, entityName, details })` — extracts admin info from `req.user`, creates AuditLog. Called from 11 controllers. **Does NOT capture oldValue/newValue, ip, or userAgent.**

### 3.9 Audit Log Routes (`src/routes/auditLogRoutes.js`) — 100% ✅

`GET /` protected by `protect` + `adminOnly` + `requireFeature('reports.auditLogEnabled')`. Supports `module` and `action` query filters. Paginated.

### 3.10 Refund Request Service (`src/services/refundRequestService.js`) — 60%

708 lines. Handles membership refund lifecycle. Creates `Transaction` records but does **NOT** create `LedgerEntry` pairs (gap for BR-AUD-001). Has admin approval queue infrastructure.

### 3.11 Report / Export Routes (`src/routes/reportRoutes.js`) — STUBS

All 6 endpoints return `501 FEATURE_NOT_IMPLEMENTED`: `/overview`, `/charts`, `/heatmap`, `/forecast`, `/export`, `/revenue`. No controller file exists.

---

## 4. Business Rule Gap Analysis

### BR-AUD-001: 5-year financial retention + immutable records

| Requirement | Status | Detail |
|---|---|---|
| All financial records retained 5 years | ❌ | No archive service. No cold-storage export job. No retention policy enforcement. |
| Soft-delete prohibited | ❌ | `Transaction.js` has no soft-delete (`deletedAt`) — good. But also has no hard-delete prevention hooks. |
| Hard-delete blocked at DB level | ⚠️ | `LedgerEntry.js` does this correctly (6 pre-hooks). `Transaction.js` does NOT. |
| Archive to cold storage after 5 years | ❌ | No `src/jobs/` archival job. No archive service. |
| Records retrievable within 72 hours | ❌ | No retrieval endpoint or service. |
| Dual entry for all transactions | ⚠️ | Wallet operations: YES. Membership refunds: NO (gap in `refundRequestService.js`). |

### BR-AUD-002: GDPR / data privacy

| Requirement | Status | Detail |
|---|---|---|
| Member data exportable in JSON | ❌ | `GET /api/admin/reports/export` returns 501. No aggregation service. |
| Export within 72 hours | ❌ | No job system for deferred exports. |
| Data deletion within 30 days | ❌ | `User.softDelete()` exists but doesn't anonymize. No deletion request flow. |
| Financial records anonymized (not deleted) | ❌ | No anonymization service. No PII scrubbing logic. |

### BR-AUD-003: Daily reconciliation

| Requirement | Status | Detail |
|---|---|---|
| Automated daily 03:00 AM job | ❌ | No reconciliation cron job in `src/jobs/`. |
| Compare internal DB vs gateway | ❌ | No reconciliation service. |
| Flag discrepancies | ❌ | No reconciliation_issues model. |
| Notify finance admin | ❌ | No notification integration for reconciliation results. |
| Gateway API clients for comparison | ⚠️ | VNPAY service exists (`src/services/vnpayService.js`). Stripe service exists. Can be repurposed for reconciliation queries. |

### BR-AUD-004: Concurrent session limit — ✅ COMPLETE (see §3.5)

### BR-AUD-005: OTP rate limiting — ✅ COMPLETE (see §3.6)

### BR-ADM-001: Admin approval for refunds >1M VND

| Requirement | Status | Detail |
|---|---|---|
| Refund >1,000,000 VND requires approval | ⚠️ | Refund service exists. Approval queue pattern exists. Threshold enforcement not verified. |
| `finance_admin` role required | ⚠️ | Role exists in permission matrix. Not used as a guard in refund endpoints. |
| Pending_approval status | ⚠️ | `refundRequest` status enum includes `pending`/`approved`/`rejected`. |

### BR-ADM-002: RBAC for admin actions — ✅ COMPLETE

`protect` + role-based middleware chain is applied to all endpoints. `permissions.js` defines granular feature-level permissions. Role hierarchy: member < seller < trainer < staff < admin < super_admin.

### BR-ADM-003: Admin audit logging

| Requirement | Status | Detail |
|---|---|---|
| Every admin action logged | ⚠️ | `recordAuditLog()` called from 11 controllers. Coverage gaps exist (bookings, checkins, refunds). |
| Actor ID + timestamp | ✅ | Captured in `admin.id` + `createdAt`. |
| Action type + resource type + resource ID | ✅ | `action` enum + `module` enum + `entityId`. |
| Old value + new value | ❌ | Schema only has `details` (generic string). |
| IP address + user agent | ❌ | Not captured despite being available on `req`. |

---

## 5. API Coverage

| Endpoint | Status | Purpose |
|---|---|---|
| `GET /api/audit-logs` | ✅ Done | List audit logs (filtered by module/action, paginated) |
| `GET /api/admin/reports/export` | ❌ 501 | GDPR data export |
| `GET /api/admin/reports/revenue` | ❌ 501 | Revenue reconciliation report |

---

## 6. Recommendation

**Option 3 — Patch existing services.**

| Factor | Assessment |
|---|---|
| **Pre-existing coverage** | ~55%. LedgerEntry model is fully immutable. Ledger integration in wallet operations is complete. Session limit + rate limiting are done. Transaction/AuditLog models need hardening, not replacement. |
| **Rewriting risk** | HIGH. Wallet service (627 lines) has ledger integration at 5+ call sites. Rewriting would risk financial data integrity. |
| **Missing pieces** | Transaction immutable hooks, membership refund ledger entries, archive service, GDPR export, reconciliation service, AuditLog field expansion. Each is a targeted addition to existing files. |
| **Files to create** | ~4 (archive retention service, GDPR export service, reconciliation service + cron job, reconciliation discrepancy model) |
| **Files to modify** | ~3 (Transaction.js add immutable hooks, AuditLog.js add fields, auditLogService.js add ip/ua capture) |

**Recommendation:** Option 3 — apply minimum additive changes to complete the Epic 2.6 scope (Transaction Ledger) and extend into Epic 2.7 (BR-AUD + BR-ADM). The pre-existing code is solid; gaps are specific and additive.
