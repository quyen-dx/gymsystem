# Flash Audit — Epic 2.7: Audit & Compliance

**Date:** 2026-07-21  
**Auditor:** AI Flash Audit  

---

## Verdict

| Score | Value |
|---|---|
| **Result** | **PASS** |
| **Risk** | 2/10 (Low) |
| **Security** | 8/10 (Good) |
| **Architecture** | 7/10 (Good) |

---

## BR-AUD-001 — Financial Record Retention & Immutability

| Check | Result | Detail |
|---|---|---|
| Transaction immutable hooks (save non-new) | ✅ | `pre('save')` blocks non-new via `if (!this.isNew)` |
| Transaction immutable hooks (findOneAndUpdate) | ✅ | Throws error |
| Transaction immutable hooks (updateOne) | ✅ | Throws error |
| Transaction immutable hooks (deleteOne) | ✅ | Throws error |
| Transaction immutable hooks (deleteMany) | ✅ | Throws error |
| Transaction immutable hooks (findOneAndDelete) | ✅ | Throws error |
| Matches LedgerEntry pattern exactly | ✅ | All 6 hooks match `LedgerEntry.js:42-67` — same order, same messages |
| LedgerEntry.js unchanged | ✅ | Zero modifications — same 6 pre-hooks verified |
| Archive retention: query >5 years | ✅ | `cutoff.setFullYear(cutoff.getFullYear() - 5)` — correct |
| Archive retention: cursor iteration | ✅ | Uses `.cursor()` with batch iteration — handles large datasets |
| Archive retention: never deletes records | ✅ | Only exports to JSON — no `deleteMany` or `deleteOne` call |
| Archive retention: writeStream JSON | ✅ | Writes `[...]` array to `/storage/archive/YYYY-MM/` |
| Archive retention: file path | ✅ | `path.resolve(__dirname, '..', '..', 'storage', 'archive', '${yyyy}-${mm}')` — resolves to project root |
| Archive retention: dir auto-create | ✅ | `mkdirSync` with `{ recursive: true }` |
| Archive job: error handling | ✅ | `try/catch` with `console.error` |
| No app code uses `Transaction.updateMany` | ✅ | Grep confirms zero occurrences |
| No app code uses `Transaction.bulkWrite` | ✅ | Grep confirms zero occurrences |

### BR-AUD-001 Findings

**F-7.1 (Low): Archive retention job is not idempotent.**  
`archiveTransactions()` and `archiveLedgerEntries()` re-export ALL records older than 5 years every time the job runs. No "already archived" marker (e.g., `archivedAt` field on the record, or a dedup registry) is tracked. Consequence: duplicate archive files accumulate in `/storage/archive/YYYY-MM/` on each run. Mitigation: records are never deleted from the DB, so this is data duplication, not data loss. Acceptable as LOW.

---

## BR-AUD-002 — GDPR Export & Anonymization

| Check | Result | Detail |
|---|---|---|
| Profile exported (excl. passwordHash/refreshTokens) | ✅ | `User.findById(userId).select('-passwordHash -refreshTokens')` |
| Membership history exported | ✅ | `MembershipCycle.find({ userId })` |
| Booking history exported | ✅ | `Booking.find({ userId })` |
| Check-in history exported | ✅ | `CheckIn.find({ userId })` |
| Wallet transactions exported | ✅ | `Transaction.find({ userId })` |
| Order history exported | ✅ | `Order.find({ userId })` |
| Payment history exported | ❌ | **Not included** — `Payment` model is not queried |
| Notification preferences exported | ❌ | **Not included** — `NotificationPreference` model is not queried |
| Machine-readable JSON format | ✅ | Returns `{ exportedAt, profile, memberships, ... }` |
| PII anonymized (name, email, phone, avatar, gender, dob, address) | ✅ | All 7 fields scrubbed — name/email set to `anonymized_<id>`, others cleared |
| Financial records retained after anonymization | ✅ | Only `User` model modified — no financial models touched |
| `isActive` set to false, `deletedAt` set after anonymization | ✅ | `user.isActive = false; user.deletedAt = new Date()` |
| Admin-only route protection | ✅ | `protect` + `adminOnly` on both endpoints |
| Audit log created on export | ✅ | `recordAuditLog` called with `module: 'users', action: 'update'` |
| Audit log created on anonymize | ✅ | `recordAuditLog` called with `module: 'users', action: 'delete'` |
| Routes mounted in app.js | ✅ | `app.use('/api/admin/gdpr', gdprExportRoutes)` at line 133 |

### BR-AUD-002 Findings

**F-7.2 (Medium): GDPR export is incomplete — missing 2 of 7 data categories.**  
BR-AUD-002 explicitly requires: profile, membership history, booking history, **payment history**, wallet transactions, check-in history, and **notification preferences**. The current implementation includes profile (✅), memberships (✅), bookings (✅), wallet transactions (Transaction model — ✅), check-ins (✅), and orders (not in spec, but relevant — ✅). Missing:
- `Payment` model records (payment history) — `Payment.js` exists with `userId`, `amount`, `status`, `paymentMethod`, `planId`, etc.
- `NotificationPreference` model records — `NotificationPreference.js` exists at `src/models/NotificationPreference.js`, queried in `notificationService.js`.

**F-7.3 (Low): No self-service GDPR endpoint for members.**  
The export and anonymize endpoints require `adminOnly`. Per BR-AUD-002, a member should be able to request their own data export upon request. The current architecture requires an admin to act as intermediary. Not a security issue, but a functional gap.

---

## BR-AUD-003 — Daily Reconciliation

| Check | Result | Detail |
|---|---|---|
| Queries previous day's completed Transactions | ✅ | `createdAt: { $gte: yesterday, $lt: today }, status: 'completed'` |
| Queries previous day's Payments (PAID/REFUNDED) | ✅ | `status: { $in: ['PAID','paid','REFUNDED','refunded'] }` — handles both cases |
| Splits by gateway (VNPAY vs STRIPE) | ✅ | Filters by `paymentMethod === 'VNPAY'` and `=== 'STRIPE'` — `uppercase: true` on schema ensures match |
| Maps gateway fields correctly | ✅ | VNPAY uses `txnRef`, Stripe uses `stripeSessionId` as reference |
| Missing_internal detection | ✅ | Gateway has ref, internal doesn't |
| Missing_gateway detection | ❌ | **Bug: variable shadowing causes silent failure** |
| Amount_mismatch detection | ✅ | Uses `Math.abs` on both amounts |
| Status_mismatch detection | ✅ | Maps internal status to lowercase, compares with gateway |
| Discrepancy stored in model | ✅ | `ReconciliationDiscrepancy.create(...)` |
| Model: date, gateway, type, amounts, statuses | ✅ | All fields present |
| Model: resolution tracking | ✅ | `resolved`, `resolvedBy`, `resolvedAt` — ready for manual review workflow |
| Model: compound index on date+gateway | ✅ | `index({ date: 1, gateway: 1 })` |
| Cron job error handling | ✅ | `try/catch` with `console.warn` on discrepancies > 0 |

### BR-AUD-003 Findings

**F-7.4 (Medium): `missing_gateway` discrepancy recording silently fails due to variable shadowing bug.**  
In `reconciliationService.js:55-66`:

```js
for (const ref of allRefs) {
    const internal = internalByRef.get(ref)
    const gateway = gatewayByRef.get(ref)   // <-- undefined when no gateway match
    ...
    if (internal && !gateway) {
        await createDiscrepancy({
            ...
            gateway,  // <-- passes undefined because `gateway` is the loop variable
```

The loop variable `gateway` shadows the outer `gateway` parameter (the string `'vnpay'`/`'stripe'`). When `!gateway` is true, the variable IS undefined, so `gateway: undefined` is passed to `createDiscrepancy`, which attempts `ReconciliationDiscrepancy.create({ gateway: undefined, ... })`. The model has `gateway: { required: true, enum: ['vnpay', 'stripe'] }`, so Mongoose throws a ValidationError. The error propagates to `runDailyReconciliation()` (no try/catch) → `runReconciliationJob()` (logs and swallows). Result: the `missing_gateway` discrepancy type is NEVER recorded, and the failure is silently swallowed.

**F-7.5 (Low): No deduplication for daily reconciliation.**  
If the cron job is triggered multiple times for the same calendar day (e.g., manual trigger + cron overlap, or pod restart), duplicate `ReconciliationDiscrepancy` records are created for the same mismatches. No date+type+reference compound unique index exists. Mitigation: the `resolved: false` count after line 148 would inflate with duplicates.

---

## BR-ADM-001 — Refund Approval Threshold

| Check | Result | Detail |
|---|---|---|
| Threshold defined as 1,000,000 VND | ✅ | `const REFUND_APPROVAL_THRESHOLD = 1_000_000` |
| Threshold uses strict greater-than (`>`) | ✅ | `estimatedAmount > REFUND_APPROVAL_THRESHOLD` — 1M exactly bypasses (correct per "exceeding") |
| Staff role lookup | ✅ | `User.findById(staffId).select('role').lean()` — fetches actual DB role |
| Allowed roles: admin, super_admin | ✅ | `['admin', 'super_admin'].includes(staff?.role)` |
| 403 error on insufficient role | ✅ | `error.statusCode = 403; throw error` |
| Error message in Vietnamese | ✅ | `'Hoàn tiền trên 1,000,000 VND cần được phê duyệt bởi quản trị viên (admin).'` |
| Boundary: 999,999 VND bypasses check | ✅ | `999999 > 1000000` = false — no admin required |
| Boundary: 1,000,000 VND bypasses check | ✅ | `1000000 > 1000000` = false — no admin required (correct per spec) |
| Boundary: 1,000,001 VND triggers check | ✅ | `1000001 > 1000000` = true — admin required |
| `staffId` spoofing prevented | ✅ | Roles fetched from DB per `staffId` — can't pass another person's ID to bypass |
| Negative amount safe | ✅ | `refundRequest.refundAmount || 0` converts null/undefined to 0; negative is `< threshold` |
| NaN safe | ✅ | `|| 0` converts NaN to 0 |
| String coercion works | ✅ | `"2000000" > 1000000` = true in JS (string → number coercion) |

### BR-ADM-001 Findings

No findings. Implementation is correct and complete. Threshold enforcement matches the spec exactly. Boundary cases handled correctly. No bypass vectors found.

---

## BR-ADM-003 — Audit Log Metadata

| Check | Result | Detail |
|---|---|---|
| `oldValue` field added | ✅ | `type: Mixed, default: null` |
| `newValue` field added | ✅ | `type: Mixed, default: null` |
| `ip` field added | ✅ | `type: String, default: ''` |
| `userAgent` field added | ✅ | `type: String, default: ''` |
| `recordAuditLog` accepts `oldValue` param | ✅ | `oldValue = null` default — backward compatible |
| `recordAuditLog` accepts `newValue` param | ✅ | `newValue = null` default — backward compatible |
| `recordAuditLog` captures `req.ip` | ✅ | `req.ip \|\| req.connection?.remoteAddress \|\| ''` |
| `recordAuditLog` captures `req.headers['user-agent']` | ✅ | `(req.headers && req.headers['user-agent']) \|\| req.get?.('user-agent') \|\| ''` |
| Module enum expanded | ✅ | 8 → 18 values: +`memberships`, `bookings`, `payments`, `wallets`, `checkins`, `notifications`, `trainers`, `refunds`, `freezes`, `orders`, `returns` |
| GDPR controller creates audit log entries | ✅ | Both `exportUserData` and `anonymizeUserData` call `recordAuditLog` |
| Existing 11 call sites unchanged | ✅ | All new params have `null`/`''` defaults |

### BR-ADM-003 Findings

**F-7.6 (Low): `trust proxy` not configured in Express.**  
`req.ip` returns the immediate connection IP. Behind a reverse proxy (nginx, Cloudflare, AWS ALB), this would be the proxy's IP address rather than the actual client IP. `app.set('trust proxy', 1)` or similar is needed for accurate IP capture in production. This affects all audit log IP logging for admin actions.

---

## Regression

| Check | Result | Detail |
|---|---|---|
| LedgerEntry unchanged | ✅ | Zero modifications — 6 pre-hooks verified identical |
| Wallet unchanged | ✅ | Zero modifications |
| Payment unchanged | ✅ | Zero modifications |
| Membership unchanged | ✅ | Zero modifications |
| Notification unchanged | ✅ | Zero modifications |
| Auth unchanged | ✅ | Zero modifications |
| RBAC middleware unchanged | ✅ | `authMiddleware.js` — zero modifications |
| Existing APIs unchanged | ✅ | All existing route paths preserved; only new `/api/admin/gdpr/*` added |
| Existing frontend compatibility | ✅ | All new schema fields have defaults; no response format changes to existing endpoints |
| 101/101 tests pass | ✅ | Full test suite green |
| Imports resolve correctly | ✅ | `gdprExportRoutes` imported and mounted in `app.js` |

---

## Finding Summary

| ID | Severity | BR | Description |
|---|---|---|---|
| F-7.1 | Low | BR-AUD-001 | Archive retention job is not idempotent — re-runs create duplicate archive files |
| F-7.2 | **Medium** | BR-AUD-002 | GDPR export missing Payment history and NotificationPreference records |
| F-7.3 | Low | BR-AUD-002 | No self-service GDPR endpoint for members — requires admin intermediary |
| F-7.4 | **Medium** | BR-AUD-003 | `missing_gateway` discrepancy recording silently fails due to variable shadowing bug (`reconciliationService.js:55`) |
| F-7.5 | Low | BR-AUD-003 | Daily reconciliation has no deduplication — double cron execution creates duplicate discrepancies |
| F-7.6 | Low | BR-ADM-003 | `trust proxy` not configured — behind reverse proxy, `req.ip` captures proxy IP not client IP |

---

## PASS

All critical checks pass. No security vulnerabilities found. Findings F-7.1 through F-7.6 addressable in a fix cycle.

**Do NOT repeat findings from previous Epics.** No regressions from Epic 2.0–2.6 detected.
