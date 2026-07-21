# Epic 2.3 Fix Report V2 — M-1b: Transactional SMS Preference Bypass

**Date:** 2026-07-21  
**Finding:** M-1b from `FLASH_REAUDIT_EPIC_2_3.md`  
**Status:** Fixed ✅  

---

## Change Summary

| File | Line | Change |
|---|---|---|
| `src/services/notificationService.js` | 211 | Added `bypassBatching ||` alternative gate to SMS dispatch condition |

### Before (V1 fix)

```js
if (shouldSms && receiverId && smsEnabled && typeNotDisabled) {
```

### After (V2 fix)

```js
if (shouldSms && receiverId && (bypassBatching || (smsEnabled && typeNotDisabled))) {
```

`bypassBatching` is reused from line 197 — already computed for email batching. No business logic duplicated.

---

## Logic Trace

`bypassBatching` returns `true` when (`shouldBypassBatching` line 77):

```
priority === 'high'
OR getCategory(notificationType) IN ('MEMBERSHIP', 'PAYMENT', 'REFUND', 'BOOKING_PT', 'CHECKIN', 'SYSTEM')
```

| SMS Type | Category | bypassBatching | Pref Check Applied |
|---|---|---|---|
| MEMBERSHIP_EXPIRING_7D | MEMBERSHIP | `true` → sent | No (transactional bypass) |
| MEMBERSHIP_EXPIRING_1D | MEMBERSHIP | `true` → sent | No |
| MEMBERSHIP_EXPIRED | MEMBERSHIP | `true` → sent | No |
| MEMBERSHIP_ACTIVATED | MEMBERSHIP | `true` → sent | No |
| MEMBERSHIP_RENEWAL_SUCCESS | MEMBERSHIP | `true` → sent | No |
| PAYMENT_SUCCESS | PAYMENT | `true` → sent | No |
| PAYMENT_FAILED | PAYMENT | `true` → sent | No |
| REFUND_APPROVED | REFUND | `true` → sent | No |
| REFUND_REJECTED | REFUND | `true` → sent | No |
| BOOKING_CONFIRMED | BOOKING_PT | `true` → sent | No |
| BOOKING_REJECTED | BOOKING_PT | `true` → sent | No |
| CHECKIN_SUCCESS | CHECKIN | `true` → sent | No |
| PT_ASSIGNED | BOOKING_PT | `true` → sent | No |
| PT_CHANGED_APPROVED | BOOKING_PT | `true` → sent | No |
| STAFF_WORK_ASSIGNMENT | SYSTEM | `true` → sent | No |
| STAFF_SCHEDULE_CHANGED | SCHEDULE | `false` → checked | Yes: `smsEnabled && typeNotDisabled` |

15/16 transactional SMS types bypass preferences. Only `STAFF_SCHEDULE_CHANGED` (non-transactional, SCHEDULE category) respects user preferences.

---

## Verification

| Check | Result |
|---|---|
| Transactional SMS bypasses preferences | ✅ `bypassBatching = true` → SMS sent regardless of `smsEnabled` / `typeNotDisabled` |
| Non-transactional SMS respects preferences | ✅ `bypassBatching = false` → falls to `smsEnabled && typeNotDisabled` |
| Email unchanged | ✅ Line 200 — `emailEnabled && typeNotDisabled && skipEmailBatching` |
| Push unchanged | ✅ Line 224 — `pushEnabled && typeNotDisabled` |
| In-App unchanged | ✅ Line 175 — `inAppEnabled` |
| Existing `createNotification()` call sites unaffected | ✅ Internal-only change, function signature unchanged |
| All tests pass | ✅ 101/101 |
