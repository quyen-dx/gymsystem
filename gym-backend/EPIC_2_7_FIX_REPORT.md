# Epic 2.7 — Fix Report

**Date:** 2026-07-21  
**Test Result:** 101/101 passed  

---

## F-7.2 (MEDIUM) — GDPR Export Incomplete

**Fix:** Added `Payment` and `NotificationPreference` models to `gdprExportService.js:7-8,18-19,32-33`.

| Data Category | Before | After |
|---|---|---|
| Profile | ✅ | ✅ |
| Membership history | ✅ | ✅ |
| Booking history | ✅ | ✅ |
| Check-in history | ✅ | ✅ |
| Wallet transactions | ✅ | ✅ |
| Order history | ✅ | ✅ |
| Payment history | ❌ | ✅ (`Payment.find({ userId }).lean()`) |
| Notification preferences | ❌ | ✅ (`NotificationPreference.findOne({ userId }).lean()`) |

Existing exported entities (`profile`, `memberships`, `checkIns`, `bookings`, `transactions`, `orders`) remain unchanged. Only the user's own data is exported — queries use `{ userId }` filter.

**File modified:** `src/services/gdprExportService.js`

---

## F-7.4 (MEDIUM) — Variable Shadowing in Reconciliation

**Fix:** Renamed loop variable `gateway` → `gwTxn` in `reconciliationService.js:52`. All 9 references to the inner loop variable updated (`gwTxn` for gateway transaction data). The `gateway` parameter (the gateway name string `'vnpay'`/`'stripe'`) is now correctly passed to `createDiscrepancy` in the `missing_gateway` case at line 70.

| Case | Before | After |
|---|---|---|
| missing_internal | gateway field = outer (string) ✅ | gateway field = outer (string) ✅ |
| missing_gateway | gateway field = inner (undefined) ❌ → ValidationError | gateway field = outer (string) ✅ |
| amount_mismatch | gateway field = inner (object) ❌ → wrong type but happened to work | gateway field = outer (string) ✅ |
| status_mismatch | gateway field = inner (object) ❌ → wrong type but happened to work | gateway field = outer (string) ✅ |

**File modified:** `src/services/reconciliationService.js`

---

## F-7.5 (LOW) — Duplicate Reconciliation Discrepancies

**Fix:** Changed `createDiscrepancy` in `reconciliationService.js:5-30` from `ReconciliationDiscrepancy.create()` to `ReconciliationDiscrepancy.findOneAndUpdate()` with `upsert: true` and `$setOnInsert`. The deduplication key is `{ date, gateway, type, gatewayTransactionId, internalTransactionId }`. If a discrepancy record with the same key exists, it is returned unchanged (no duplicate). If none exists, a new record is created.

**File modified:** `src/services/reconciliationService.js`

---

## F-7.1 (LOW) — Archive Retention Not Idempotent

**Fix:** Added month-level checkpoint files to `archiveRetentionService.js:23-29`.

- `isMonthArchived(archiveDir, label)` — checks if `.archived-{label}` file exists
- `markMonthArchived(archiveDir, label)` — creates the checkpoint file with timestamp

Archive functions now:
1. Compute the archive directory for the cutoff date
2. Check if the month has already been archived (skip if yes, return `{ archived: 0, file: null, skipped: true }`)
3. Only proceed with query + export if not yet archived
4. Write checkpoint file after successful export

Separate checkpoints for transactions (`.archived-transactions`) and ledger entries (`.archived-ledger`) allow partial re-runs if only one type failed.

**File modified:** `src/services/archiveRetentionService.js`

---

## F-7.3 (LOW) — No Self-Service GDPR Endpoint

**Fix:** Created `src/routes/gdprSelfServiceRoutes.js` — member-facing GDPR endpoints that reuse the existing `exportUserData` and `anonymizeUserData` controllers. The routes set `req.params.userId` to `req.user._id.toString()` before delegating to the controller, ensuring members can only access their own data.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/gdpr/me/export` | Member (protect) | Export own data |
| POST | `/api/gdpr/me/anonymize` | Member (protect) | Anonymize own data |

Mounted in `app.js` at `/api/gdpr/me`. No duplication of export logic — same controller functions reused.

**Files created:** `src/routes/gdprSelfServiceRoutes.js`  
**Files modified:** `src/app.js`

---

## F-7.6 (LOW) — Trust Proxy Not Configured

**Fix:** Added environment-variable-guarded trust proxy configuration in `app.js:77-79`:

```js
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1)
}
```

No reverse proxy exists in the project's `docker-compose.yml` (direct port exposure, no nginx). The backend connects directly on port 5000. Trust proxy is disabled by default to avoid incorrect IP logging. When deployed behind nginx, Cloudflare, or AWS ALB, set `TRUST_PROXY=true` environment variable to enable accurate `req.ip` capture.

**File modified:** `src/app.js`

---

## Regression Check

| Check | Result |
|---|---|
| 101/101 tests pass | ✅ |
| No Wallet modified | ✅ |
| No Payment business logic modified | ✅ |
| No Membership modified | ✅ |
| No Notification modified | ✅ |
| No Shop modified | ✅ |
| No Auth modified | ✅ |
| Existing API contracts unchanged | ✅ |
| Existing frontend behavior unchanged | ✅ |
| No refactoring performed | ✅ |
| No architecture redesign | ✅ |
