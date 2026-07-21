# Epic 2.3 Fix Report — M-1: SMS Preference Bypass

**Date:** 2026-07-21  
**Finding:** M-1 (MEDIUM) from `FLASH_AUDIT_EPIC_2_3.md`  
**Status:** Fixed ✅  

---

## Change Summary

| File | Lines | Change |
|---|---|---|
| `src/services/notificationService.js` | +2 modified | Added `smsEnabled` guard + `typeNotDisabled` check to SMS dispatch |

### Before

```js
const emailEnabled = !pref || pref.isChannelEnabled('email')
const typeNotDisabled = !pref || !pref.isTypeDisabled(notificationType)

// ...

if (shouldSms && receiverId) {   // ← no preference check
```

### After

```js
const emailEnabled = !pref || pref.isChannelEnabled('email')
const smsEnabled = !pref || pref.isChannelEnabled('sms')       // ← added
const typeNotDisabled = !pref || !pref.isTypeDisabled(notificationType)

// ...

if (shouldSms && receiverId && smsEnabled && typeNotDisabled) { // ← added guards
```

---

## Verification

| Check | Result |
|---|---|
| SMS respects `smsEnabled` preference | ✅ `pref.isChannelEnabled('sms')` checked at line 211 |
| SMS respects `disabledTypes` | ✅ `typeNotDisabled` checked at line 211 |
| Transactional SMS batching bypass preserved | ✅ `bypassBatching` logic on lines 197–198 unchanged (affects email, not SMS) |
| Email behavior unchanged | ✅ Line 200 — same `emailEnabled && typeNotDisabled && skipEmailBatching` |
| Push behavior unchanged | ✅ Line 224 — same `pushEnabled && typeNotDisabled` |
| In-App behavior unchanged | ✅ Line 176 — same `pref.isChannelEnabled('in_app')` |
| All 101 tests pass | ✅ |

---

## Consistency

All four channels now apply the same guards before dispatch:

| Channel | Line | Guard |
|---|---|---|
| In-App | 176 | `pref.isChannelEnabled('in_app')` |
| Email | 200 | `emailEnabled && typeNotDisabled && skipEmailBatching` |
| SMS | 211 | `smsEnabled && typeNotDisabled` |
| Push | 224 | `pushEnabled && typeNotDisabled` |
