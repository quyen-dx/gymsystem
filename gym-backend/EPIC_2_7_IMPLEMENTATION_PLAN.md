# Epic 2.7 — Audit & Compliance Implementation Plan

**Date:** 2026-07-21  
**Strategy:** Option 3 — Patch existing services  
**Pre-Epic Coverage:** ~55% → Target: ~85%  

---

## Business Rules in Scope

| Rule | Description | Current | Target |
|---|---|---|---|
| **BR-AUD-001** | 5-year retention, immutable financial records | 70% | **95%** |
| **BR-AUD-002** | GDPR data export + anonymization | 10% | **60%** |
| **BR-AUD-003** | Daily gateway reconciliation | 5% | **75%** |
| **BR-ADM-001** | Refund approval threshold >1M VND | 50% | **90%** |

**Already complete:** BR-AUD-004 (session limit), BR-AUD-005 (OTP rate limit), BR-ADM-002 (RBAC)

---

## Files to Create

| # | File | Purpose | BR |
|---|---|---|---|
| 1 | `src/models/ReconciliationDiscrepancy.js` | Store flagged gateway vs internal mismatches | BR-AUD-003 |
| 2 | `src/services/archiveRetentionService.js` | Query records >5 years, export to cold storage | BR-AUD-001 |
| 3 | `src/services/gdprExportService.js` | Aggregate all member data as JSON bundle | BR-AUD-002 |
| 4 | `src/services/reconciliationService.js` | Compare internal Transaction vs gateway records | BR-AUD-003 |
| 5 | `src/routes/gdprExportRoutes.js` | GDPR export + data deletion endpoints | BR-AUD-002 |
| 6 | `src/controllers/gdprExportController.js` | Route handlers for GDPR endpoints | BR-AUD-002 |
| 7 | `src/jobs/dailyReconciliationJob.js` | Scheduled 03:00 daily reconciliation run | BR-AUD-003 |
| 8 | `src/jobs/archiveRetentionJob.js` | Weekly archive run for 5-year-old records | BR-AUD-001 |

---

## Files to Modify

| # | File | Change | Why | BR |
|---|---|---|---|---|
| 9 | `src/models/Transaction.js` | Add 6 immutable pre-hooks matching LedgerEntry pattern (block save/update/delete) | Financial records must be append-only. LedgerEntry already has this. Transaction is missing it. No schema migration needed — hooks are additive. | BR-AUD-001 |
| 10 | `src/models/AuditLog.js` | Add `oldValue`, `newValue`, `ip`, `userAgent` fields | BR-ADM-003 requires before/after snapshots + actor IP/UA for every admin action. All new fields are optional with defaults — zero impact on existing documents. | BR-ADM-003 |
| 11 | `src/services/auditLogService.js` | Capture `ip`/`userAgent` from `req`, accept `oldValue`/`newValue` params | Existing `recordAuditLog()` call sites are unaffected — new params are optional with defaults. | BR-ADM-003 |
| 12 | `src/services/refundRequestService.js` | Add 1M VND threshold check in `approveRefundRequest` | BR-ADM-001 requires `finance_admin` role for refunds >1M. Since `finance_admin` role doesn't exist in the codebase, enforce `admin`/`super_admin` as equivalent. No API contract change — function signature unchanged. | BR-ADM-001 |
| 13 | `src/app.js` | Import + mount `gdprExportRoutes` at `/api/admin/gdpr` | All new routes require registration. Purely additive — 1 import + 1 `app.use` line. | BR-AUD-002 |

---

## Detailed Design

### 1. Transaction Immutability (BR-AUD-001)

Copy the 6 pre-hooks from `LedgerEntry.js:42-67` into `Transaction.js` after the schema definition. No field changes needed. The hooks block:
- `pre('save')` — reject updates to existing documents
- `pre('findOneAndUpdate')` — reject find-and-update ops
- `pre('updateOne')` — reject direct updates
- `pre('deleteOne')` — reject single delete
- `pre('deleteMany')` — reject mass delete
- `pre('findOneAndDelete')` — reject find-and-delete

### 2. AuditLog Field Expansion (BR-ADM-003)

Added fields (all optional with defaults):
```js
oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
newValue: { type: mongoose.Schema.Types.Mixed, default: null },
ip: { type: String, trim: true, default: '' },
userAgent: { type: String, trim: true, default: '' },
```

Modified `recordAuditLog` signature:
```js
export const recordAuditLog = async ({ req, module, action, entity, entityName, details = '', oldValue = null, newValue = null }) => {
```

New fields populated from `req.ip` and `req.get('user-agent')`. Existing call sites work without changes (new params have defaults).

### 3. Refund Approval Threshold (BR-ADM-001)

Added at top of `approveRefundRequest`:
```js
const REFUND_APPROVAL_THRESHOLD = 1_000_000

// Fetch approver's role
const staff = await User.findById(staffId).select('role').lean()
const requiresFinanceAdmin = (totalRefundAmount || refundRequest.refundAmount) > REFUND_APPROVAL_THRESHOLD
if (requiresFinanceAdmin && !['admin', 'super_admin'].includes(staff?.role)) {
    throw new AppError('Hoàn tiền trên 1,000,000 VND cần phê duyệt bởi admin', 403)
}
```

### 4. GDPR Export Service (BR-AUD-002)

Aggregates member data across: User profile, Membership cycles, Check-in history, Booking history, Payment transactions, Wallet transactions, Notification preferences. Returns JSON bundle. Export endpoint: `GET /api/admin/gdpr/export/:userId`.

Data deletion endpoint: `POST /api/admin/gdpr/anonymize/:userId` — scrubs name, email, phone, avatar while retaining `_id` for financial records.

### 5. Reconciliation Service (BR-AUD-003)

Compares `Transaction` records (from `walletService`) against gateway reference:
- For VNPAY: uses `txnRef` to query VNPAY API
- For Stripe: uses `stripeSessionId` to query Stripe API
- Mismatched entries stored in `ReconciliationDiscrepancy` model
- Daily cron job at 03:00 AM

### 6. Archive Retention Service (BR-AUD-001)

- Queries `Transaction`, `LedgerEntry` records where `createdAt > 5 years`
- Exports to JSON file in `/storage/archive/YYYY-MM/`
- Does NOT delete from MongoDB (BR-AUD-001: "hard-delete is blocked at DB level")
- Weekly cron job (Sunday 02:00 AM)

---

## Files NOT Modified

| Module | Status |
|---|---|
| `LedgerEntry.js` | Immutable hooks already complete — zero changes |
| `walletService.js` | Ledger integration complete — zero changes |
| `Payment.js` / `paymentService.js` | Existing payment infrastructure untouched |
| `Notification.js` / `notificationService.js` | Existing notification system untouched |
| All Membership routes/controllers | Untouched — `refundRequestService.js` change is additive |
| All Shop files | Untouched |
| All Auth files | Untouched |
| Session management / OTP rate limiting | Already complete — zero changes |
| RBAC middleware | Already complete — zero changes |
| `AuditLog` controller + routes | Existing CRUD unchanged |

---

## Dependencies

| Dependency | Status |
|---|---|
| `LedgerEntry` immutable hooks pattern | ✅ Exists at `LedgerEntry.js:42-67` — copy pattern |
| `User.findById(role).lean()` | ✅ Standard Mongoose pattern |
| `Transaction` model existing fields | ✅ `balanceBefore`, `balanceAfter`, `idempotencyKey` all present |
| `recordAuditLog` existing call sites | ✅ 11 controllers — no breaking changes |
| `Payment.txnRef` / `Payment.stripeSessionId` | ✅ Gateway reference fields exist |
| Express `req.ip` / `req.get('user-agent')` | ✅ Built-in |
| `src/jobs/` directory pattern | ✅ 5 existing cron jobs to mirror |
| `app.js` route mounting pattern | ✅ Consistent pattern used by 60+ routes |

---

## Risks

| Risk | Mitigation |
|---|---|
| Transaction immutable hooks break existing wallet operations | Wallet operations use `Transaction.create()` (new document) — pre-hooks only block updates/deletes, not inserts |
| AuditLog field changes break query filters | All new fields are optional with defaults — existing documents have `null`/`''` for new fields |
| GDPR export exposes sensitive data | Only `admin`/`super_admin` can access. Audit log entry created for every access |
| Reconciliation service depends on VNPAY/Stripe APIs being available | Wrap in try-catch, log failures, don't crash. Graceful degradation if gateway is unreachable |
| Archive retention may be slow for large datasets | Batched with cursor-based iteration, limit 1000 docs per batch |
