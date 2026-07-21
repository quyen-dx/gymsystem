# Flash Re-Audit — Epic 2.3 (Notifications)

**Re-Audit Date:** 2026-07-21  
**Original Audit:** `FLASH_AUDIT_EPIC_2_3.md` (1 MEDIUM — M-1)  
**Fix Report:** `EPIC_2_3_FIX_REPORT.md`  
**Verdict:** **FAIL** ❌  
**Risk Score:** 30/100  
**Security Score:** 95/100  
**Architecture Score:** 85/100  

---

## Remaining Findings

| ID | Severity | Category | Description | File |
|---|---|---|---|---|
| M-1b | MEDIUM | BR-NTF-003 | SMS preference check is unconditional — transactional notifications must bypass preferences per BR-NTF-003 | `src/services/notificationService.js:211` |

---

## M-1 Re-Verification

### What was added (lines 195, 211)

✅ `pref.isChannelEnabled('sms')` — guard variable `smsEnabled` at line 195  
✅ `typeNotDisabled` — guard variable at line 196, applied at line 211  

### What was NOT added

❌ **Transactional bypass.** BR-NTF-003 states: *"SMS notifications are reserved exclusively for transactional/urgent messages and cannot be opted out of."*

The current condition at line 211:

```js
if (shouldSms && receiverId && smsEnabled && typeNotDisabled) {
```

This unconditionally checks preferences for **all** SMS notifications, including transactional ones. Per BR-NTF-003, transactional/urgent notifications must bypass preference checks.

### Analysis of SMS_ELIGIBLE_TYPES vs TRANSACTIONAL_CATEGORIES

| SMS Type | Category | In TRANSACTIONAL_CATEGORIES? | bypassBatching? |
|---|---|---|---|
| MEMBERSHIP_EXPIRING_7D | MEMBERSHIP | ✅ | ✅ |
| MEMBERSHIP_EXPIRING_1D | MEMBERSHIP | ✅ | ✅ |
| MEMBERSHIP_EXPIRED | MEMBERSHIP | ✅ | ✅ |
| MEMBERSHIP_ACTIVATED | MEMBERSHIP | ✅ | ✅ |
| MEMBERSHIP_RENEWAL_SUCCESS | MEMBERSHIP | ✅ | ✅ |
| PAYMENT_SUCCESS | PAYMENT | ✅ | ✅ |
| PAYMENT_FAILED | PAYMENT | ✅ | ✅ |
| REFUND_APPROVED | REFUND | ✅ | ✅ |
| REFUND_REJECTED | REFUND | ✅ | ✅ |
| BOOKING_CONFIRMED | BOOKING_PT | ✅ | ✅ |
| BOOKING_REJECTED | BOOKING_PT | ✅ | ✅ |
| CHECKIN_SUCCESS | CHECKIN | ✅ | ✅ |
| PT_ASSIGNED | BOOKING_PT | ✅ | ✅ |
| PT_CHANGED_APPROVED | BOOKING_PT | ✅ | ✅ |
| STAFF_WORK_ASSIGNMENT | SYSTEM | ✅ | ✅ |
| STAFF_SCHEDULE_CHANGED | SCHEDULE | ❌ | ❌ (unless priority=high) |

15/16 types are transactional and would have `bypassBatching = true`. `STAFF_SCHEDULE_CHANGED` (category `SCHEDULE`) is the only non-transactional type.

### Required condition

The `bypassBatching` mechanism (already computed at line 197 for email batching) should be reused for SMS:

```js
if (shouldSms && receiverId && (bypassBatching || (smsEnabled && typeNotDisabled))) {
```

This is **consistent with BR-NTF-003**:
- Transactional/urgent SMS → `bypassBatching = true` → sent regardless of preferences
- Non-transactional SMS (e.g., future marketing SMS) → preference check applies

---

## Consistency with other channels

| Channel | Lines | Preference Check | Transactional Bypass |
|---|---|---|---|
| In-App | 175–176 | `inAppEnabled` | ❌ (same issue per BR-NTF-003, but pre-existing) |
| Email | 200 | `emailEnabled && typeNotDisabled` + `skipEmailBatching` | ❌ batching-only bypass, not preference bypass (pre‑existing) |
| **SMS** | **211** | **`smsEnabled && typeNotDisabled`** | **❌ no bypass (M-1b)** |
| Push | 224 | `pushEnabled && typeNotDisabled` | ❌ (same issue per BR-NTF-003, but pre-existing) |

SMS is now **consistent with email and push** in applying unconditional preference checks. However, BR-NTF-003 requires SMS to be **always-on** (never opt-out-able) because SMS is reserved for transactional messages.

---

## Regression

| Check | Status |
|---|---|
| Existing notification APIs unchanged | ✅ |
| Existing `createNotification()` call sites unaffected | ✅ |
| Existing Email behavior unchanged | ✅ |
| Existing Push behavior unchanged | ✅ |
| Existing In-App behavior unchanged | ✅ |
| All tests pass | ✅ (101/101) |

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| **Risk** | 30/100 | 1 MEDIUM remaining — unconditional preference check blocks transactional SMS |
| **Security** | 95/100 | No auth bypass, no data exposure |
| **Architecture** | 85/100 | M-1 fix added `smsEnabled` correctly but omitted transactional bypass required by BR-NTF-003 |

---

## Verdict

**FAIL** ❌ — M-1 is partially resolved (preference variable `smsEnabled` is correctly defined and referenced). However, the condition at line 211 does not bypass preferences for transactional notifications as required by BR-NTF-003.

**Remaining finding:** Add `bypassBatching` as an alternative gate to the SMS dispatch condition, so transactional/urgent SMS always sends regardless of user preferences.
