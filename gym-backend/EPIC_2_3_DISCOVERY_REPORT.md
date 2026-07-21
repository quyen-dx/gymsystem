# Epic 2.3 — Discovery Report: Notifications

**Date**: 2026-07-21  
**Purpose**: Determine what already exists vs. what needs building

---

## 1. Epic 2.3 Scope (from docs)

| Source | Definition |
|---|---|
| `ROADMAP.md` | Sprint 2.3: Notifications — Email/SMS/in-app delivery, templates, preferences, batched delivery |
| `IMPLEMENTATION_ROADMAP.md` | Notification state machine (QUEUED → SENT → DELIVERED → READ → FAILED), Email (Nodemailer), SMS (Twilio/SpeedSMS), In-app (Socket.io), Preferences (opt-out), Batched email (max 1/hr) |
| `BUSINESS_RULES.md` | BR-NTF-001 (30s in-app delivery), BR-NTF-002 (max 1 email/hr with urgent bypass), BR-NTF-003 (no SMS opt-out for transactional) |
| `STATE_MACHINES.md` | 5 states, 5 valid transitions, 5 terminal/invalid transitions |
| `modules/notification.md` | 4 models, 4 services, 3 flows, 11 API endpoints, 5 error codes |
| `SPRINT_6.md` | 9 files expected under `src/features/notification/` + templates directory + Socket.io handler |

---

## 2. What ALREADY EXISTS

### 2.1 Notification Model (`src/models/Notification.js`) ✅

**Coverage**: ~70% of required data model.

| Field | Status |
|---|---|
| `receiverId`, `receiverRole` | ✅ Targeted delivery |
| `notificationType` (67 types, 9 categories) | ✅ Comprehensive enum |
| `title`, `content` | ✅ |
| `isRead`, `readAt` | ✅ Read tracking (boolean, not state machine) |
| `relatedId`, `relatedType` | ✅ Polymorphic references |
| `redirectUrl` | ✅ Frontend deep-links |
| `createdBy` (System/Admin/PT/Staff) | ✅ Actor tracking |
| `deletedAt` (soft delete) | ✅ |
| Dedup index (5-min window) | ✅ In service logic |
| `status` (QUEUED/SENT/DELIVERED/READ/FAILED) | ❌ **Missing** — only boolean `isRead` |
| `channel` (email/sms/push/in-app) | ❌ **Missing** — delivery is implicit |
| `priority` (high/medium/low) | ❌ **Missing** |
| `metadata` (JSON extensibility) | ❌ **Missing** |

### 2.2 Notification Service (`src/services/notificationService.js`) ✅

**Coverage**: ~55% of required orchestration.

| Function | Status | Notes |
|---|---|---|
| `createNotification()` — DB write + Socket emit + Email | ✅ | Central orchestrator used at 80+ call sites |
| Dedup (5-min window, same receiver + type + relatedId) | ✅ | |
| Socket.io emit (per-user room + staff room) | ✅ | In-app delivery works |
| Email dispatch (nodemailer, 45 event types auto-email) | ✅ | HTML email via `sendPlainEmail` |
| `markAsRead(id)` | ✅ | Sets `isRead=true, readAt=now` |
| `markAsUnread(id)` | ✅ | |
| `softDelete(id)` | ✅ | |
| `getNotificationsForUser()` | ✅ | No pagination/filtering |
| `countUnread()` | ✅ | |
| `markAllAsRead()` | ✅ | |
| SMS channel dispatch | ❌ **Missing** | `createNotification` only does Socket + Email |
| Push (FCM) dispatch | ❌ **Missing** | No firebase-admin dependency |
| User preference filtering | ❌ **Missing** | Always delivers to all channels |
| Batching (1/hr limit per member) | ❌ **Missing** | No rate limiting |
| Notification state machine transitions | ❌ **Missing** | Only tracks isRead boolean |
| Retry/queue mechanism | ❌ **Missing** | TODO comment acknowledges this |

### 2.3 Email Service (`src/services/emailService.js`) ✅

**Coverage**: ~65% of required email channel.

| Feature | Status |
|---|---|
| SMTP/Service-based transport (nodemailer) | ✅ |
| JSON transport mock fallback | ✅ |
| 12 specialized email functions (OTP, reset, renewal, refund, etc.) | ✅ |
| HTML templates (inline) | ✅ All hardcoded in service file |
| Generic `sendPlainEmail` via `createNotification` | ✅ Used by notificationService |
| Separate template files / template engine | ❌ **Missing** — all HTML inline |
| Admin-managed templates (CRUD) | ❌ **Missing** — no Template model |
| Email scheduling (immediate only) | ❌ **Missing** |

### 2.4 SMS Service (`src/services/smsService.js`) ⚠️

**Coverage**: ~10%. **Stub only.**

| Feature | Status |
|---|---|
| `sendOtpSms()` function | ⚠️ **Console.log stub** — real SpeedSMS code commented out |
| Phone formatting (VN locale) | ✅ |
| Generic SMS for notifications | ❌ **Missing** — never called by `createNotification` |
| `twilio` package installed | ✅ Installed but **never imported** anywhere |

### 2.5 Socket.io Service (`src/services/socketService.js`) ✅

**Coverage**: ~80% of in-app channel.

| Feature | Status |
|---|---|
| `initSocketIO(httpServer)` with JWT auth | ✅ |
| Per-user rooms (`userId` room) | ✅ |
| Staff broadcast room | ✅ |
| `emitNotificationToUser()`, `emitNotificationToStaff()` | ✅ Generic helpers |
| `notification:new` event | ✅ Standardized across codebase |
| Push (FCM) channel | ❌ **Missing** — Socket.io only |
| Event name constants (magic strings at call sites) | ❌ **Missing** |
| Read receipt from client | ✅ Via REST API |

### 2.6 Notification Routes (`src/routes/notificationRoutes.js`) ✅

**Coverage**: ~35% of required 11 API endpoints.

| Endpoint | Status |
|---|---|
| `POST /send` | ✅ |
| `GET /my` | ✅ (no pagination/filtering) |
| `GET /unread-count` | ✅ |
| `PUT /read-all` | ✅ |
| `PUT /:id/read` | ✅ |
| `PUT /:id/unread` | ✅ |
| `DELETE /:id` | ✅ |
| `GET /preferences` | ❌ **Missing** |
| `PUT /preferences` | ❌ **Missing** |
| `GET /templates` (admin) | ❌ **Missing** |
| `POST /templates` (admin) | ❌ **Missing** |
| `PUT /templates/:id` (admin) | ❌ **Missing** |
| `DELETE /templates/:id` (admin) | ❌ **Missing** |
| `POST /push-tokens` | ❌ **Missing** |
| `DELETE /push-tokens/:id` | ❌ **Missing** |

### 2.7 Notification Controller (`src/controllers/notificationController.js`) ✅

7 handler functions, all operational. Covers the 7 existing endpoints.

### 2.8 Cron/Scheduled Jobs (`server.js` + `src/jobs/`)

| Job | Status |
|---|---|
| Refund reminder (daily 08:00 VN) | ✅ Sends `REFUND_REMINDER` and `REFUND_EXPIRED` |
| Renewal cycle activation (every 6h) | ✅ Delegates to `membershipCycleService` |
| Membership expiry reminder (`MEMBERSHIP_EXPIRING_7D`, `_1D`, `EXPIRED`) | ❌ **Missing** — types exist, no cron |
| System monitoring (`BACKUP_FAILED`, `SYSTEM_ERROR`, `DISK_SPACE_LOW`) | ❌ **Missing** — types exist, no cron |

### 2.9 Notification Preferences in User Model (`src/models/User.js`)

**Status**: ❌ **None.** Only `themePreference` field exists. No:
- Per-`NOTIFICATION_TYPE` opt-out toggles
- Per-channel preferences (email/sms/push/in-app)
- Do-not-disturb settings
- Language preference

### 2.10 Call Sites — `createNotification` Usage

**80+ call sites** across:
- 18 controllers (booking, cancellation, checkIn, schedule, PT, workout, planChange, etc.)
- 3 services (membershipService, orderService, trainerReplacementService)
- 2 jobs (refundReminderJob, activateRenewalCyclesJob)

All use the same `createNotification({...})` signature. Adding new channels (SMS, push) or preferences filtering at the `createNotification` level would propagate to ALL call sites automatically.

---

## 3. Business Rules Coverage

| Rule | Status | Gap |
|---|---|---|
| **BR-NTF-001** (30s in-app delivery) | ✅ Partial | Socket.io delivers real-time. No delivery status tracking or FCM fallback. |
| **BR-NTF-002** (max 1 email/hr per member) | ❌ Not implemented | No rate limiting, no batching, no urgent bypass |
| **BR-NTF-003** (no SMS opt-out for transactional) | ❌ Not implemented | No preferences model, no SMS channel, no opt-out system |

---

## 4. Gap Assessment

| Gap | Severity | Build Effort |
|---|---|---|
| Notification status field + state machine | **HIGH** | Model migration + transition guards (1 day) |
| BR-NTF-002: Email batching (1/hr) | **HIGH** | Rate limiter middleware + urgent bypass (1 day) |
| Notification preferences in User model | **HIGH** | User model field + preferences CRUD (1 day) |
| Membership expiry reminder cron | **HIGH** | Cron job + query (half day) |
| SMS channel in `createNotification` | **HIGH** | Uncomment speedSMS + wire into orchestrator (1 day) |
| Pagination/filtering on GET /my | **MEDIUM** | Query params + pagination (half day) |
| BR-NTF-001: Delivery status tracking | **MEDIUM** | Status field + webhook handlers (1 day) |
| Push (FCM) registration + delivery | **MEDIUM** | firebase-admin + pushService + routes (2 days) |
| Notification priority field | **MEDIUM** | Model migration + routing logic (half day) |
| Template management CRUD | **LOW** | New model + admin routes (2 days) |
| System monitoring cron | **LOW** | Cron job + disk space check + backup check (1 day) |
| Event name constants (Socket.io) | **LOW** | Refactor string literals (half day) |
| Twilio cleanup (unused dependency) | **LOW** | Remove from package.json (5 min) |

---

## 5. Recommendation

### Option 3: Only patch existing services (Recommended ✅)

The existing `createNotification` orchestrator at `src/services/notificationService.js` is already the proven single entry point used by 80+ call sites. The best approach is to **extend what already works** rather than rebuilding:

**Rationale**:
- `src/models/Notification.js` already has 67 types, 9 categories, soft delete, dedup — _extend_ it with `status`, `channel`, `priority` fields
- `src/services/notificationService.js` already does DB + Socket + Email — _extend_ it with SMS, push, preferences filtering, batching
- `src/services/emailService.js` already has 12 functional email types — _extend_ with template model (optional)
- `src/routes/notificationRoutes.js` already has 7 CRUD endpoints — _extend_ with preferences + templates + push-tokens
- 80+ call sites already use `createNotification({...})` — _no migration needed_, just add optional fields

**Why NOT Option 1 or 2**:
- The sprint plan expects a complete rewrite under `src/features/notification/` with separate model files — this would **break 80+ call sites** and violate "do not rewrite working code"
- There is no "nothing exists" — the core infrastructure is solid

**Estimated build**: 9 functional gaps (HIGH/MEDIUM priority). All additive — zero existing code paths need rework.

---

## 6. Existing File Inventory

| File | Lines | Status | Needs Change? |
|---|---|---|---|
| `src/models/Notification.js` | ~200 | Production | **Yes** — add `status`, `channel`, `priority` fields |
| `src/services/notificationService.js` | 233 | Production | **Yes** — add SMS/push dispatch, batching, preferences |
| `src/services/emailService.js` | ~450 | Production | **No** — extend only if templates needed |
| `src/services/smsService.js` | ~40 | Stub | **Yes** — activate real SMS + wire into orchestrator |
| `src/services/socketService.js` | ~150 | Production | **No** — minor: add event constants |
| `src/routes/notificationRoutes.js` | ~25 | Production | **Yes** — add preferences/templates/push-token routes |
| `src/controllers/notificationController.js` | ~100 | Production | **Yes** — add new handler functions |
| `src/models/User.js` | ~250 | Production | **Yes** — add `notificationPreferences` field |
| `server.js` | ~40 | Production | **Yes** — add expiry reminder cron |
| `src/jobs/refundReminderJob.js` | ~60 | Production | **No** |
| `src/jobs/activateRenewalCyclesJob.js` | ~20 | Production | **No** |

---

## 7. What MUST NOT Be Modified

Per AI_CODING_CONSTITUTION:
- **80+ existing call sites** — they use `createNotification({ receiverId, notificationType, title, content, ... })` and must continue to work unchanged
- **Existing APIs** — `POST /send`, `GET /my`, `GET /unread-count`, `PUT /read-all`, `PUT /:id/read`, `DELETE /:id` — signatures preserved
- **Auth, JWT, OTP, RBAC, User, Membership, Booking, PT, Freeze** — no changes to unrelated modules
- **Existing cron jobs** — `refundReminderJob`, `activateRenewalCyclesJob` — untouched
- **Socket.io infrastructure** — `initSocketIO`, room structure — untouched
