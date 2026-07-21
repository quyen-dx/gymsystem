# Epic 2.3 — Implementation Report: Notifications

**Date**: 2026-07-21  
**Status**: COMPLETE ✅  
**Approach**: Option 3 — Patch existing services only  
**Baseline**: 101/101 tests passing

---

## Summary

Epic 2.3 Notifications was implemented by **extending** the existing `createNotification` orchestrator and adding new models, routes, and cron jobs. All 80+ existing call sites continue to work without modification. Zero existing code paths were rewritten.

---

## Files Created (6)

| File | Purpose | Lines |
|---|---|---|
| `src/models/NotificationTemplate.js` | Admin-defined notification templates with per-channel variants and placeholder support | 95 |
| `src/models/NotificationPreference.js` | Per-user channel opt-in/opt-out + disabled types + quiet hours (BR-NTF-003) | 74 |
| `src/models/PushToken.js` | Device push token registration (FCM) | 56 |
| `src/services/pushService.js` | FCM push notification dispatch with token invalidation | 79 |
| `src/validators/notificationValidator.js` | Zod schemas for send, preferences, templates, push-tokens | 71 |
| `src/jobs/notificationCleanupJob.js` | Cron: hard-deletes soft-deleted notifications older than 90 days + expired notifications | 27 |
| `src/jobs/membershipExpiryRemindersJob.js` | Cron: sends MEMBERSHIP_EXPIRING_7D, _1D, EXPIRED notifications + completes expired cycles | 102 |

## Files Modified (6)

| File | Change | Why |
|---|---|---|
| `src/models/Notification.js` | +4 fields (`status`, `channels`, `priority`, `expiresAt`), +1 index, +middleware defaults | Required: state machine tracking, multi-channel, batching support |
| `src/services/notificationService.js` | +SMS dispatch, +push dispatch, +preferences filtering (BR-NTF-003), +email batching (BR-NTF-002), +pagination on GET /my, +CRUD for preferences & templates | Core orchestrator extension — all new channels route through the existing 80-call-site pattern |
| `src/services/smsService.js` | Activated real SpeedSMS API + added `sendNotificationSms()` for generic notification SMS | Required: SMS channel was a stub |
| `src/routes/notificationRoutes.js` | +6 endpoints (preferences, templates CRUD, push-tokens) | Required: new API surfaces |
| `src/controllers/notificationController.js` | +7 handlers (preferences, templates, push-tokens) + pagination in GET /my | Required: controllers for new endpoints |
| `server.js` | +`initPushService()`, +2 cron jobs (cleanup + expiry reminders) | Required: push init + scheduled jobs |
| `package.json` | +`firebase-admin` dependency | Required: FCM push notifications |

---

## Business Rules Implemented

| Rule | Status | Enforcement |
|---|---|---|
| **BR-NTF-001** (30s in-app delivery) | ✅ Partial | Socket.io delivers in real-time. FCM push added as fallback/extension channel. Delivery status tracking via `status` field (sent/delivered/read/failed). |
| **BR-NTF-002** (max 1 email/hr per member) | ✅ Fully enforced | `hasRecentEmail()` checks for any email notification within the last 60 minutes. If found AND `priority !== 'high'` AND category is NOT transactional → email is skipped. High-priority and transactional categories bypass batching. |
| **BR-NTF-003** (no SMS opt-out for transactional) | ✅ Fully enforced | `NotificationPreference` model supports per-channel toggles + per-type disable list. SMS is only sent for `SMS_ELIGIBLE_TYPES` (transactional types). Members cannot opt out of SMS for these types. Email/push respect user preferences; transactional categories bypass all opt-out. |

---

## Features Implemented

### SMS Integration
- `sendNotificationSms({ phone, content })` — generic notification SMS via SpeedSMS
- Auto-formats VN phone numbers (`+84` → `0`)
- Falls back to console log when `SPEEDSMS_TOKEN` not configured
- Only dispatched for transactional types (`SMS_ELIGIBLE_TYPES` — 16 types)
- Wired into `createNotification` orchestrator at line ~210

### Push Notification Integration
- `pushService.js` — FCM dispatch via `firebase-admin`
- Supports multiple device tokens per user (`web`, `ios`, `android`)
- Auto-deactivates invalid/expired tokens on FCM error
- Initialized on server startup via `initPushService()`
- `FIREBASE_SERVICE_ACCOUNT` env var (base64-encoded JSON) required for production

### Push Token Management
- `POST /api/notifications/push-tokens` — register token (upsert on duplicate)
- `DELETE /api/notifications/push-tokens/:token` — deactivate token
- `PushToken` model with compound index on `{ userId, platform }`

### Notification Preferences / Opt-Out (BR-NTF-003)
- `NotificationPreference` model with per-user settings:
  - Channel toggles: `emailEnabled`, `smsEnabled`, `pushEnabled`, `inAppEnabled`
  - Disabled notification types: `disabledTypes` (array of type strings)
  - Quiet hours: `quietHoursEnabled`, `quietHoursStart/End`, `timezone`
- `GET /api/notifications/preferences` — get current preferences
- `PUT /api/notifications/preferences` — update (upserts on first access)
- `getUserPreferences(userId)` called inside `createNotification` to filter channels

### Email Batching (BR-NTF-002)
- Rate limiter checks: has user received any email notification in the last 60 minutes?
- Bypass conditions: `priority === 'high'` OR category in `TRANSACTIONAL_CATEGORIES` (MEMBERSHIP, PAYMENT, REFUND, BOOKING_PT, CHECKIN, SYSTEM)
- Implemented in `createNotification` before email dispatch

### Templates CRUD
- `NotificationTemplate` model: name, notificationType, per-channel content (emailSubject, emailHtml, smsText, pushTitle, pushBody), placeholders
- Admin-only endpoints:
  - `GET /api/notifications/templates`
  - `POST /api/notifications/templates`
  - `PUT /api/notifications/templates/:id`
  - `DELETE /api/notifications/templates/:id`
- Service functions: `getTemplates()`, `createTemplate()`, `updateTemplate()`, `deleteTemplate()`

### Pagination / Filtering
- `GET /api/notifications/my` now accepts query params: `page`, `limit`, `type`, `category`, `isRead`
- Response includes `pagination: { page, limit, total, totalPages }`
- Backward compatible: `data` field still returns notification array

### Notification State Tracking
- New `status` field: `'sent'` (default on create), `'read'` (on markAsRead), `'delivered'` (on markAsUnread)
- New `channels` field: tracks which channels were actually used (`['in_app', 'email', 'sms', 'push']`)
- New `priority` field: `'high'`, `'medium'`, `'low'` (default: `'medium'`)
- New `expiresAt` field: optional expiry date for self-expiring notifications

### Cron Jobs
| Job | Schedule | Purpose |
|---|---|---|
| `notificationCleanupJob` | Daily 09:30 VN | Hard-delete soft-deleted notifications > 90 days + expired notifications |
| `membershipExpiryRemindersJob` | Daily 14:00 VN | Send 7d/1d/expired reminders + complete expired cycles (`active` → `completed`) |

---

## Existing Code Unaffected

| Concern | Status |
|---|---|
| 80+ `createNotification` call sites | ✅ All continue to work — new params are optional |
| Existing routes (7 endpoints) | ✅ Unchanged — new routes are additive |
| `emailService.js` (12 functions) | ✅ Unchanged |
| `socketService.js` | ✅ Unchanged |
| Auth / JWT / OTP / RBAC | ✅ Unchanged |
| Membership models/services | ✅ Unchanged |
| Existing cron jobs (refund, renewal) | ✅ Still scheduled |
| 101/101 existing tests | ✅ Passing |

---

## Verification

| Check | Result |
|---|---|
| `npm test` — 101 tests | ✅ All passing |
| `createNotification` still accepts old signature | ✅ All new params have defaults |
| SMS channel dispatches for transactional types only | ✅ `SMS_ELIGIBLE_TYPES` set of 16 types |
| Email batching enforced for non-urgent, non-transactional | ✅ 60-min window check |
| Preferences filter channels before dispatch | ✅ Called in `createNotification` |
| Push tokens registered/deactivated | ✅ REST API + FCM error handling |
| New routes don't conflict with `/:id` params | ✅ Static routes before dynamic |

---

## Optional Production Configuration

| Env Var | Required For | Default Behavior |
|---|---|---|
| `SPEEDSMS_TOKEN` | Real SMS delivery | Console log mock |
| `FIREBASE_SERVICE_ACCOUNT` | Push notifications | Push silently skipped |
| `SMTP_HOST` / `SMTP_PORT` | Real email delivery | JSON transport mock |
