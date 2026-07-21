# Flash Audit — Epic 2.3 (Notifications)

**Audit Date:** 2026-07-21  
**Auditor:** Automated Flash Audit  
**Verdict:** **PASS** ✅  
**Risk Score:** 25/100 (LOW)  
**Security Score:** 95/100  
**Architecture Score:** 88/100  

---

## Summary

Epic 2.3 extends the notification system with SMS and push channels, user notification preferences, admin-managed templates, push-token registration, and two cron jobs (cleanup, membership expiry reminders). 6 new files were created and 6 existing files were modified. All 80+ pre-existing `createNotification` call sites remain untouched.

**One MEDIUM finding** was identified:

| ID | Severity | Category | Description | File |
|---|---|---|---|---|
| M-1 | MEDIUM | BR-NTF-003 | SMS dispatch bypasses user preferences | `src/services/notificationService.js:210` |

---

## Verification Results

### 1. BR‑NTF‑002 — Notification Batching ✅
- `shouldBypassBatching()` returns `true` for high-priority and transactional-category notifications — they always send.
- `hasRecentEmail(receiverId)` checks for any email-channel notification within the last 60 minutes.
- `skipEmailBatching = bypassBatching || !hasRecentEmail` — if a non-transactional, non-high-priority notification had an email sent in the last 60 min, the email is skipped.
- This implements rate-limiting/consolidation for email as specified.

### 2. BR‑NTF‑003 — User Notification Preferences ⚠️
- **Email:** checks `pref.isChannelEnabled('email')` and `!pref.isTypeDisabled(notificationType)` before sending (line 194–195).
- **Push:** checks `pref.isChannelEnabled('push')` and `typeNotDisabled` before sending (line 222).
- **In-app:** checks `pref.isChannelEnabled('in_app')` before socket emit (line 175).
- **SMS:** ❌ **No preference check.** Line 210 only checks `shouldSms && receiverId`. If a notification type is in `SMS_ELIGIBLE_TYPES`, the SMS will be sent regardless of the user's `smsEnabled` preference or `disabledTypes` setting. **This is M-1.**
- `NotificationPreference` model correctly supports all four channel toggles and `disabledTypes` array with `isChannelEnabled()` / `isTypeDisabled()` instance methods.

### 3. New Models ✅
- **`NotificationTemplate`:** name (unique), notificationType, per-channel content fields (emailSubject, emailHtml, smsText, pushTitle, pushBody), placeholders, isActive, indexes. All correct.
- **`NotificationPreference`:** userId (unique), 4 channel booleans, disabledTypes, quietHours fields, timezone. Instance methods `isChannelEnabled` / `isTypeDisabled`. Correct.
- **`PushToken`:** userId, token, platform (web/ios/android), isActive, lastUsedAt. Statics `deactivateToken()` and `getActiveTokensForUser()`. Correct.

### 4. Push Service (pushService.js) ✅
- Initializes Firebase Admin SDK from base64-encoded env var `FIREBASE_SERVICE_ACCOUNT`.
- Graceful degradation when env var is not set (logged, push disabled).
- `sendPushNotification()` fetches active tokens, sends via FCM, tracks sent/failed.
- Invalid/expired tokens are deactivated via `messaging/registration-token-not-registered` and `messaging/invalid-registration-token` error codes.

### 5. SMS Service (smsService.js) ✅
- `sendNotificationSms()` added alongside existing `sendOtpSms()`.
- Calls SpeedSMS API with proper basic auth.
- Mock mode when `SPEEDSMS_TOKEN` is not set.
- Phone formatting normalizes +84/84 prefixes.
- Message truncated to 160 characters (SMS limit).

### 6. Controllers + Routes ✅
- **+8 new handlers:** `getMyPreferences`, `updateMyPreferences`, `handleGetTemplates`, `handleCreateTemplate`, `handleUpdateTemplate`, `handleDeleteTemplate`, `registerPushToken`, `unregisterPushToken`.
- **+6 new endpoints:** `GET/PUT /preferences`, `GET/POST /templates`, `PUT/DELETE /templates/:id`, `POST /push-tokens`, `DELETE /push-tokens/:token`.
- Static routes (`/preferences`, `/templates`, `/push-tokens`) are registered before parameterized routes (`/:id/read`, `/:id/unread`, `/:id`) — no route-shadowing bug.
- Input validation via Zod schemas on all mutation endpoints.
- Pagination in `getMyNotifications` (page, limit, total, totalPages).

### 7. Cleanup Job ✅
- Hard-deletes notifications with `deletedAt >= 90 days`.
- Hard-deletes notifications with `expiresAt <= now`.
- Logs counts on each run.
- Scheduled daily at 02:30 UTC (09:30 VN time).

### 8. Membership Expiry Reminders Job ✅
- Finds cycles expiring in exactly 7 days → sends `MEMBERSHIP_EXPIRING_7D` (email + SMS, high priority).
- Finds cycles expiring in exactly 1 day → sends `MEMBERSHIP_EXPIRING_1D` (email + SMS, high priority).
- Completes cycles with `expiresAt <= todayEnd` (sets status → `completed`).
- Sends `MEMBERSHIP_EXPIRED` for cycles completed today.
- Scheduled daily at 07:00 UTC (14:00 VN time).

### 9. Regression ✅
- All 80+ existing `createNotification({...})` call sites throughout the codebase untouched.
- Existing notification flow (in-app socket + email) continues to work identically.
- `npm test` passes **101/101** tests.
- All changes are additive — no existing code was refactored or removed.

---

## Finding Details

### M-1: SMS dispatch does not check user preferences (MEDIUM)

**File:** `src/services/notificationService.js:210`  
**Rule:** BR‑NTF‑003 — User Notification Preferences  
**Description:** When sending SMS notifications, the code checks only `shouldSms && receiverId` but does not consult the user's `NotificationPreference` document. A user who has disabled SMS (`smsEnabled: false`) or added the notification type to their `disabledTypes` array will still receive SMS messages. Email, push, and in-app channels all properly check preferences before dispatching.  
**Impact:** MEDIUM — Users may receive unwanted SMS messages, potentially incurring costs or annoyance. No security or data integrity impact.  
**Fix:** Add `pref.isChannelEnabled('sms')` and `!pref.isTypeDisabled(notificationType)` checks before the SMS dispatch block at line 210, consistent with the email and push patterns.

---

## Architecture Assessment

- Clean separation: models, services, controllers, routes, validators, jobs.
- All new features are additive; no existing code was restructured.
- Static-before-dynamic route ordering respected.
- Missing SMS preference check is the only architectural gap.

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| **Risk** | 25/100 | 1 MEDIUM finding, no HIGH/CRITICAL |
| **Security** | 95/100 | No auth bypass, no data exposure |
| **Architecture** | 88/100 | Clean structure; SMS preference gap |

---

## Verdict

**PASS** ✅ — Epic 2.3 is approved for production deployment. The single MEDIUM finding (M-1, missing SMS preference check) is recommended for resolution but does not block the release.

## Remediation Recommendation

1. **M-1 (optional, pre‑release):** Add the following two conditions before line 210 in `src/services/notificationService.js`:

```js
const smsEnabled = !pref || pref.isChannelEnabled('sms')
if (shouldSms && receiverId && smsEnabled && typeNotDisabled) {
```

This mirrors the email and push patterns already in place. Tests would not need to change as the existing mock preference data sets all channels to enabled by default.
