# 07_SPRINT_6 — Intelligence

> **Document Type:** Sprint Execution Plan
> **Version:** 1.0
> **Last Updated:** 2026-07-20
> **Status:** Ready
> **Sprint Duration:** 2 weeks
> **Depends On:** Sprints 0, 1, 2, 3, 4, 5 (all prior sprints — data from all modules)
> **Related Documents:** [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md), [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md)

---

## 1. Sprint Goal

Implement role-based dashboards with real-time analytics, comprehensive reporting and analytics engine, multi-channel notification system with state machine delivery tracking, QR-based check-in with streak tracking, and public-facing content management — consuming data from all prior sprint modules (S1–S5) to provide intelligence and member engagement capabilities.

---

## 2. Business Objectives

1. **Check-in Automation** — Enable QR-based gym entry with HMAC-signed tokens, auto-activation of pending memberships on first check-in, streak tracking for member engagement, and staff-facing check-in management.
2. **Unified Dashboards** — Provide role-specific dashboards (Admin, Member, PT, Seller, Staff) with real-time KPIs drawn from all modules.
3. **Business Intelligence** — Deliver revenue, membership, check-in, trainer, and product reports with CSV/Excel export, enabling data-driven decision-making.
4. **Multi-Channel Notifications** — Send transactional and marketing notifications via email (Nodemailer), SMS (Twilio/SpeedSMS), in-app (Socket.io), and push (FCM), with admin-configurable templates and per-member channel preferences.
5. **Content Management** — Manage public-facing blog posts, announcements, FAQs, and guides with hierarchical categories and tagging.

---

## 3. Modules Included

| Module | Document | Description |
|---|---|---|
| Check-in | [docs/modules/checkin.md](../modules/checkin.md) | QR-based entry, attendance tracking, streak calculation, membership activation |
| Report | [docs/modules/report.md](../modules/report.md) | Revenue, membership, check-in, trainer, and product reports with export |
| Notification | [docs/modules/notification.md](../modules/notification.md) | Multi-channel delivery (email, SMS, in-app, push) with state machine tracking |
| Content | [docs/modules/content.md](../modules/content.md) | Public blog, announcements, FAQs, guides with categories and tags |
| Dashboard | (cross-cutting — no dedicated module doc) | Role-based dashboards consuming data from all modules |

---

## 4. Dependencies

| Dependency | Source | Why |
|---|---|---|
| User data (profiles, roles) | Sprint 1 (Identity) | Member identity for check-in assignment, notification routing, dashboard personalization |
| Membership data (plans, cycles, status) | Sprint 2 (Revenue) | Check-in validates active membership; dashboards show membership stats; reports include membership metrics |
| Payment/transaction data | Sprint 2 (Revenue) | Revenue reports, dashboard revenue overview, payment reconciliation |
| Booking/schedule data | Sprint 3 (Scheduling) | PT dashboard shows sessions; booking confirm notifications; check-in linked to bookings |
| Workout/health data | Sprint 4 (Wellness) | Member dashboard shows workout progress; training-related notifications |
| Shop/order data | Sprint 5 (Commerce) | Seller dashboard; product reports; order status notifications |
| Socket.io infrastructure | Sprint 0 (Foundation) | ADR-010 Socket.io for real-time in-app notifications and dashboard updates |
| Database connection, shared utilities, Express skeleton | Sprint 0 (Foundation) | Foundation services required by all endpoints |

---

## 5. Prerequisites

1. Sprints 0 through 5 complete, tested, and all Definition of Done conditions verified.
2. Database collections for users, memberships, bookings, payments, workouts, products, and orders populated (at minimum with seed data for development).
3. Socket.io server initialized and attached to the HTTP server (ADR-010).
4. JWT authentication middleware operational (from Sprint 1).
5. RBAC middleware operational for roles MEMBER, PT, STAFF, SELLER, ADMIN, SUPER_ADMIN (from Sprint 1).
6. Email provider (Nodemailer/SMTP) configured in environment variables.
7. SMS provider (Twilio/SpeedSMS) configured in environment variables.
8. QR code HMAC secret configured in environment variables.
9. Gym operating hours defined in system settings.

---

## 6. Documents to Read

**Module Documentation:**
- [docs/modules/checkin.md](../modules/checkin.md) — Check-in models, services, controllers, business rules, API endpoints
- [docs/modules/report.md](../modules/report.md) — Report models, services, report types, API endpoints
- [docs/modules/notification.md](../modules/notification.md) — Notification models, services, state machine, API endpoints
- [docs/modules/content.md](../modules/content.md) — Content models, services, access rules, API endpoints

**Reference Documentation:**
- [docs/BUSINESS_RULES.md](../BUSINESS_RULES.md) — BR-CHK-001 through BR-CHK-005, BR-NTF-001 through BR-NTF-003
- [docs/STATE_MACHINES.md](../STATE_MACHINES.md) — §6 Notification State Machine (QUEUED → SENT → DELIVERED → READ / FAILED)
- [docs/PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) — Check-in, Reports & Analytics, Notifications, Content rows
- [docs/DATABASE.md](../DATABASE.md) — Collections: check_ins, attendance_logs, check_in_streaks, notifications, notification_templates, notification_preferences, push_tokens, report_definitions, report_audit_logs, contents, content_categories, content_tags
- [docs/API_STANDARDS.md](../API_STANDARDS.md) — §14.6 Check-in, §14.14 Notifications, §14.16 Reports, §14.19 Content
- [docs/EDGE_CASES.md](../EDGE_CASES.md) — EC-CHK-001 through EC-CHK-006, EC-SYS-001 through EC-SYS-007
- [docs/adr/ADR-010.md](../adr/ADR-010.md) — Socket.io over SSE (real-time notifications)
- [docs/AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) — All parts (binding on all code)
- [docs/AI_DEVELOPMENT_WORKFLOW.md](../AI_DEVELOPMENT_WORKFLOW.md) — Task classification and process

---

## 7. Business Rules

| Rule ID | Module | Type | Summary |
|---|---|---|---|
| **BR-CHK-001** | Check-in | validation | QR code required for check-in; single-use within 30-second window; HMAC-signed payload with memberId + date + expiry |
| **BR-CHK-002** | Check-in | workflow | Auto-activates pending membership on first check-in (PENDING_ACTIVATION → ACTIVE transition) |
| **BR-CHK-003** | Check-in | calculation | Streak tracking: consecutive calendar days only; reset to 1 on missed day; milestone rewards at 7, 14, 30, 60, 90, 180, 365 |
| **BR-CHK-004** | Check-in | constraint | Daily check-in limit: once per membership per day |
| **BR-CHK-005** | Check-in | validation | Check-in window: gym operating hours only per branch |
| **BR-NTF-001** | Notification | constraint | In-app notification delivery within 30 seconds of triggering event |
| **BR-NTF-002** | Notification | constraint | Email notifications batched to max 1 per hour per member; urgent events (security, payment) bypass the batch limit |
| **BR-NTF-003** | Notification | constraint | Opt-out channels: email and push may be opted out for marketing; SMS is always transactional (no opt-out) |

---

## 8. State Machines

### 8.1 Notification State Machine

From [docs/STATE_MACHINES.md §6](../STATE_MACHINES.md#6-notification-state-machine):

| State | Description |
|---|---|
| `QUEUED` | Notification created and enqueued for dispatch |
| `SENT` | Handed to the provider (SendGrid/Nodemailer, Twilio, Firebase, Socket.io) |
| `DELIVERED` | Provider confirmed successful delivery to device/inbox |
| `READ` | Recipient opened/read the notification (tracked where possible) |
| `FAILED` | Provider returned permanent failure (bounce, invalid device) |

**Valid Transitions:**

| From | To | Trigger | Guard | Action |
|---|---|---|---|---|
| `QUEUED` | `SENT` | Worker picks up and calls provider | None | Record provider message ID; log timestamp |
| `SENT` | `DELIVERED` | Provider delivery webhook/callback | Delivery receipt valid | Record delivery timestamp |
| `SENT` | `FAILED` | Provider error / bounce webhook | None | Log error reason; schedule retry if applicable |
| `DELIVERED` | `READ` | Read receipt (in-app open, email open pixel, push tap) | Receipt valid | Record read timestamp |
| `QUEUED` | `FAILED` | Queue TTL exceeded (cron) | Max retries exhausted | Log dead-letter; alert ops |

**Invalid Transitions:** QUEUED → DELIVERED, QUEUED → READ, SENT → READ, DELIVERED → SENT, FAILED → any, READ → any.

### 8.2 Membership Activation via Check-in

Check-in integrates with the Membership Cycle State Machine (`PENDING_ACTIVATION` → `ACTIVE` transition via BR-CHK-002). No dedicated check-in state machine exists — check-in is a triggering event.

---

## 9. Permission Matrix

### Check-in

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View own | - | R | - | - | - | R | R |
| View any | - | - | - | R | - | R | R |
| Create (QR) | - | C | - | C | - | C | C |
| Manual check-in | - | - | - | C | - | C | C |

### Reports & Analytics

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View personal stats | - | R | R | - | R | R | R |
| View gym stats | - | - | - | - | - | R | R |
| Export reports | - | - | - | - | - | R | R |
| View financial reports | - | - | - | - | - | R | R |

### Notifications

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View own | - | R | R | R | R | R | R |
| View all | - | - | - | - | - | R | R |
| Send | - | - | - | - | - | C | C |
| Configure templates | - | - | - | - | - | U | U |

### Content

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View public | R | R | R | R | R | R | R |
| Create | - | - | - | - | - | C | C |
| Update | - | - | - | - | - | U | U |
| Delete | - | - | - | - | - | D | D |

---

## 10. Database Collections

### 10.1 Check-in (3 collections)

| Collection | Key Fields |
|---|---|
| `check_ins` | userId, bookingId, method (qr_code/rfid/manual/face), verifiedBy, location, checkInTime |
| `check_in_streaks` *(derived)* | userId (unique), currentStreak, longestStreak, lastCheckInDate |
| `attendance_logs` | userId, checkInId, date (YYYY-MM-DD), checkInTime, checkOutTime, duration, source |

### 10.2 Notification (4 collections)

| Collection | Key Fields |
|---|---|
| `notifications` | userId, type, channel (in_app/email/sms/push), title, body, data, isRead, readAt, sentAt, deliveredAt, failedAt, errorMessage |
| `notification_templates` | key (unique), name, channel, subject, body (with {{placeholders}}), variables, isActive |
| `notification_preferences` | userId (unique), emailEnabled, smsEnabled, pushEnabled, inAppEnabled, quietHoursStart, quietHoursEnd, optOuts |
| `push_tokens` | userId, token (unique), platform (ios/android/web), deviceId, isActive, lastUsedAt, expiresAt |

### 10.3 Reports (2 collections)

| Collection | Key Fields |
|---|---|
| `report_definitions` | name, type (revenue/membership/booking/checkin/product/custom), config, parameters, schedule (cron), recipients, isActive, createdBy |
| `report_audit_logs` | reportId, generatedBy, type (scheduled/manual), status (running/completed/failed), outputUrl, rowCount, durationMs, parameters, errorMessage |

### 10.4 Content (3 collections)

| Collection | Key Fields |
|---|---|
| `contents` | title, slug (unique), excerpt, body, categoryId, authorId, tags, coverImage, status (draft/published/archived), publishedAt, viewCount, isFeatured |
| `content_categories` | name, slug (unique), description, parentId, sortOrder, isActive |
| `content_tags` | name (unique), slug (unique), usageCount |

---

## 11. API Endpoints

### 11.1 Check-in

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/checkin` | Required | member, staff, admin | Record member check-in via QR or manual entry |
| GET | `/checkin/history` | Required | Any | Get check-in history (cursor paginated) |
| GET | `/checkin/streak` | Required | member | Get current user's streak and milestones |
| GET | `/checkin/qr` | Required | member | Generate QR payload for current member (HMAC-signed, 30s TTL) |
| GET | `/checkin/today` | Required | staff, admin | List today's check-ins (staff-facing log) |
| POST | `/checkin/bulk` | Required | staff, admin | Bulk check-in multiple members |
| GET | `/checkin/leaderboard` | Required | member, staff | Streak leaderboard |

### 11.2 Dashboard

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/dashboard/admin` | Required | admin, super_admin | Admin dashboard: revenue, members, expiries, check-ins today, recent bookings, low-stock |
| GET | `/dashboard/member` | Required | member | Member dashboard: membership status, next booking, streak, workout progress, wallet, orders |
| GET | `/dashboard/pt` | Required | pt | PT dashboard: today's schedule, assigned members, pending confirmations, workout plan progress |
| GET | `/dashboard/seller` | Required | seller | Seller dashboard: product catalog, order queue, revenue summary, payout status |
| GET | `/dashboard/staff` | Required | staff | Staff dashboard: check-in queue, member search, recent registrations, payment history |

### 11.3 Reports

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/reports/revenue` | Required | admin, super_admin | Revenue report (query: startDate, endDate, groupBy, format) |
| GET | `/reports/memberships` | Required | admin, super_admin | Membership report (query: startDate, endDate, membershipType, format) |
| GET | `/reports/checkins` | Required | admin, super_admin, staff | Check-in statistics report (query: startDate, endDate, groupBy, format) |
| GET | `/reports/trainers` | Required | admin, super_admin | Trainer performance report (query: startDate, endDate, trainerId, format) |
| GET | `/reports/products` | Required | admin, super_admin | Product sales report (query: startDate, endDate, categoryId, format) |
| GET | `/reports/definitions` | Required | admin, super_admin | List saved report definitions |
| POST | `/reports/definitions` | Required | admin, super_admin | Save a report definition |
| DELETE | `/reports/definitions/:id` | Required | admin, super_admin | Delete a saved report definition |
| GET | `/reports/audit` | Required | admin, super_admin | View report generation audit log |

### 11.4 Notifications

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/notifications` | Required | Any | List current user's notifications (cursor paginated, filterable by read/unread, channel) |
| PUT | `/notifications/:id/read` | Required | Any | Mark notification as read |
| PUT | `/notifications/read-all` | Required | Any | Mark all notifications as read |
| GET | `/notifications/preferences` | Required | Any | Get current user's notification preferences |
| PUT | `/notifications/preferences` | Required | Any | Update notification preferences (opt-outs, quiet hours) |
| POST | `/notifications/send` | Required | admin, super_admin | Send notification to user(s) or broadcast |
| GET | `/notifications/templates` | Required | admin, super_admin | List notification templates |
| POST | `/notifications/templates` | Required | admin, super_admin | Create notification template |
| PUT | `/notifications/templates/:id` | Required | admin, super_admin | Update notification template |
| DELETE | `/notifications/templates/:id` | Required | admin, super_admin | Delete notification template |
| POST | `/notifications/push-tokens` | Required | Any | Register push token for device |
| DELETE | `/notifications/push-tokens/:id` | Required | Any | Unregister push token |

### 11.5 Content

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/content` | Public | — | List published content (paginated, filterable by type, category) |
| GET | `/content/:slug` | Public | — | Get published content by slug |
| POST | `/content` | Required | admin, super_admin | Create content |
| GET | `/content/admin/list` | Required | admin, super_admin | List all content (including drafts and archived) |
| GET | `/content/admin/:id` | Required | admin, super_admin | Get any content by ID |
| PUT | `/content/:id` | Required | admin, super_admin | Update content |
| DELETE | `/content/:id` | Required | admin, super_admin | Delete content (soft) |
| GET | `/categories` | Public | — | List active categories |
| POST | `/categories` | Required | admin, super_admin | Create category |
| PUT | `/categories/:id` | Required | admin, super_admin | Update category |
| DELETE | `/categories/:id` | Required | admin, super_admin | Delete category |
| GET | `/tags` | Public | — | List tags |
| POST | `/tags` | Required | admin, super_admin | Create tag |
| PUT | `/tags/:id` | Required | admin, super_admin | Update tag |
| DELETE | `/tags/:id` | Required | admin, super_admin | Delete tag |

---

## 12. AI Components

### 12.1 AI-Assisted Notification Content

- AI-powered notification language generation for membership expiry reminders, booking confirmations, and check-in reminders (templates rendered with AI-refined copy).
- AI Assistant chatbot can answer member queries about their check-in streak, attendance history, membership status (reads from check-in and membership data via AI permission engine).

### 12.2 AI-Assisted Report Insights

- AI-generated natural language summaries for report data ("Revenue increased 12% vs. last month; top seller: Whey Protein").
- Anomaly detection: AI flags unusual patterns in report data (spike in cancellations, drop in check-in rate) for admin review.

### 12.3 Intent Classification & Tool Routing

- New AI intents: `CHECK_STREAK`, `CHECK_IN_HISTORY`, `NOTIFICATION_SETTINGS`, `DASHBOARD_SUMMARY`.
- Tool routing updated to include check-in, notification, and report data sources per [docs/AI_WORKFLOW.md](../AI_WORKFLOW.md).

---

## 13. Files Expected Created

### Check-in Module
```
src/features/checkin/
  checkin.model.ts
  checkin.streak.model.ts
  attendance_log.model.ts
  checkin.service.ts
  streak.service.ts
  checkin.controller.ts
  checkin.routes.ts
  checkin.validation.ts (Zod schemas)
  checkin.test.ts
  streak.test.ts
  qr.util.ts (HMAC signing/verification)
```

### Dashboard Module
```
src/features/dashboard/
  dashboard.service.ts
  dashboard.controller.ts
  dashboard.routes.ts
  dashboard.validation.ts
```

### Report Module
```
src/features/report/
  report_definition.model.ts
  report_audit_log.model.ts
  report.service.ts
  analytics.service.ts
  report.controller.ts
  report.routes.ts
  report.validation.ts
  export.util.ts (CSV/Excel generation)
```

### Notification Module
```
src/features/notification/
  notification.model.ts
  notification_template.model.ts
  notification_preference.model.ts
  push_token.model.ts
  notification.service.ts
  email.service.ts
  sms.service.ts
  push.service.ts
  notification.controller.ts
  notification.routes.ts
  notification.validation.ts
  notification.state-machine.ts
  templates/ (HTML email templates)
```

### Content Module
```
src/features/content/
  content.model.ts
  content_category.model.ts
  content_tag.model.ts
  content.service.ts
  content.controller.ts
  content.routes.ts
  content.validation.ts
```

### Socket.io Events
```
src/socket/
  notification.handler.ts
  dashboard.handler.ts
  socket.events.ts
```

---

## 14. Files Expected Modified

```
src/
  app.ts (register new routes, Socket.io event handlers)
  middleware/
    error.handler.ts (add new error codes)
  types/
    errors.ts (add CHECKIN_*, NOTIF_*, CONT_*, RPT_* error types)
  utils/
    index.ts (export QR util, export util)
tests/
  setup.ts (seed data for check-in, notification, content collections)
```

---

## 15. Definition of Ready

- [ ] All prerequisites (Section 5) verified complete.
- [ ] All documents in Section 6 read and understood by the team.
- [ ] All 8 business rules (BR-CHK-001 through BR-CHK-005, BR-NTF-001 through BR-NTF-003) clarified with stakeholders.
- [ ] Notification state machine transitions (Section 8.1) agreed and documented.
- [ ] API contract for all 47+ endpoints agreed (method, path, request/response shapes).
- [ ] Email and SMS provider accounts provisioned and API keys available.
- [ ] QR code HMAC secret generated and stored in environment.
- [ ] Gym operating hours configured in seed data.
- [ ] Socket.io infrastructure verified operational from Sprint 0.
- [ ] Database collections (12 total) designed and indexed per [docs/DATABASE.md](../DATABASE.md).
- [ ] Test data seeded for all dependent collections (users, memberships, bookings, payments, products, orders).

---

## 16. Definition of Done

- [ ] All 8 business rules implemented with automated tests that reference `BR-CHK-xxx` and `BR-NTF-xxx` rule IDs.
- [ ] Notification state machine correctly handles all valid and invalid transitions; test covers every transition path.
- [ ] All 47+ API endpoints implemented, tested, and conforming to [docs/API_STANDARDS.md](../API_STANDARDS.md).
- [ ] All permission matrix rows enforced with automated permission tests per role.
- [ ] All 6 check-in edge cases (EC-CHK-001 through EC-CHK-006) handled with automated tests.
- [ ] All 7 system edge cases (EC-SYS-001 through EC-SYS-007) handled with automated tests.
- [ ] Socket.io real-time notifications delivered within 30 seconds (BR-NTF-001 verified).
- [ ] Email batching enforces max 1/hour per member with urgent bypass (BR-NTF-002 verified).
- [ ] SMS always transactional, no opt-out (BR-NTF-003 verified).
- [ ] QR code generation uses HMAC signing with 30-second TTL, single-use per day (BR-CHK-001 verified).
- [ ] QR replay across days rejected (EC-CHK-006 verified).
- [ ] Double check-in race condition prevented (EC-CHK-001 verified via idempotency).
- [ ] Streak calculation correct for consecutive days, reset on miss (BR-CHK-003 verified).
- [ ] All 5 dashboard endpoints return correct role-specific data.
- [ ] All reports export correctly to CSV; Excel format supported where specified.
- [ ] Report audit log records every report generation.
- [ ] Content CRUD works with public/private access rules; slug uniqueness enforced.
- [ ] Zero TypeScript compilation errors, zero ESLint errors, zero ESLint warnings.
- [ ] All relevant documentation sections updated (see Section 24).
- [ ] Code review completed per the review checklist (Section 23).

---

## 17. Acceptance Criteria

| # | Criterion | Verification Method |
|---|---|---|
| AC-1 | Member scans QR → check-in recorded → streak incremented | End-to-end test: POST /checkin with valid QR → 200, streak +1 |
| AC-2 | Expired QR (31s old) rejected | Test: POST /checkin with expired QR → 400 CHECKIN_INVALID_QR |
| AC-3 | Replayed QR across days rejected | Test: submit Monday's QR on Tuesday → 403 |
| AC-4 | Double check-in same day idempotent | Test: two simultaneous POST /checkin → exactly 1 record, second returns 200 with existing |
| AC-5 | First check-in activates pending membership | Test: member with PENDING_ACTIVATION cycle checks in → cycle.status = ACTIVE |
| AC-6 | Check-in outside operating hours rejected | Test: check-in at 23:00 when gym closes at 22:00 → 422 |
| AC-7 | Streak increments on consecutive days | Test: check in Mon, Tue, Wed → streak = 3 |
| AC-8 | Streak resets on missed day | Test: check in Mon, Tue, skip Wed, check in Thu → streak = 1 |
| AC-9 | Admin dashboard shows correct KPIs | Test: GET /dashboard/admin → returns revenue, member count, expiries, check-ins today |
| AC-10 | Member dashboard shows personal data | Test: GET /dashboard/member → returns own membership, streak, bookings, wallet |
| AC-11 | Revenue report returns accurate totals | Test: GET /reports/revenue → sum matches raw payment transaction sum |
| AC-12 | CSV export generates valid CSV | Test: GET /reports/revenue?format=csv → Content-Type: text/csv, valid CSV parsing |
| AC-13 | In-app notification delivered via Socket.io | Test: trigger event → member receives Socket.io event within 30s |
| AC-14 | Email batched to max 1/hour | Test: 3 non-urgent notifications in 60 min → 1 email sent, 2 queued for next window |
| AC-15 | Urgent email bypasses batch | Test: security alert → email sent immediately regardless of batch window |
| AC-16 | SMS sent for transactional, no opt-out | Test: opt out of all channels → password change SMS still sent |
| AC-17 | Marketing email opt-out respected | Test: opt out marketing → marketing email not sent for opted-out member |
| AC-18 | Notification transitions: QUEUED → SENT → DELIVERED → READ | Test: end-to-end notification lifecycle |
| AC-19 | Failed notification recorded correctly | Test: simulate provider error → status = FAILED, errorMessage set |
| AC-20 | Public content visible without auth | Test: GET /content without token → 200 with published content |
| AC-21 | Draft content hidden from public | Test: GET /content/:slug for draft → 404 |
| AC-22 | Admin can CRUD content, categories, tags | Test: full CRUD cycle for each resource → 200/201, 204 |
| AC-23 | Staff can view check-in queue | Test: GET /dashboard/staff → today's check-ins list |
| AC-24 | Bulk check-in supported | Test: POST /checkin/bulk with 5 memberIds → 5 check-ins created |
| AC-25 | Report generation logged to audit | Test: generate any report → report_audit_logs entry created |

---

## 18. Testing Strategy

### 18.1 Unit Tests

- **QR utility** (`qr.util.ts`): HMAC sign/verify, expiry check, date matching, single-use validation. Test: valid token, expired token, tampered payload, replayed date.
- **Streak service** (`streakService.getStreak`): consecutive day counting, reset on miss, milestone detection, gym holiday exemption. Test: 7-day streak, then skip 1 day, then resume.
- **Check-in service** (`checkinService.checkIn`): all 5 business rule gates. Test: each BR-CHK-xxx with assertion referencing the rule ID.
- **Notification state machine**: every valid transition, every invalid transition rejection, retry logic, TTL expiry.
- **Report service** (`reportService`, `analyticsService`): aggregation logic for each report type, date range handling, grouping.
- **Content service** (`contentService`): slug uniqueness, status transitions (draft → published → archived), cache invalidation.

### 18.2 Integration Tests

- Check-in end-to-end: QR generation → scan → membership validation → operating hours check → daily limit check → attendance record → streak update → notification.
- Notification pipeline: trigger event → queued → dispatch → delivery webhook → status transition → read receipt.
- Report generation: query params → analytics query → format output → audit log write.
- Dashboard: each role endpoint returns correct data shape and permissions.

### 18.3 Business Rule Tests

Each test must reference the BR-xxx rule ID in its description:

| Test | Rule ID |
|---|---|
| QR with valid HMAC, within 30s, first use → 200 | BR-CHK-001 |
| QR expired (31s) → 400 CHECKIN_INVALID_QR | BR-CHK-001 |
| QR with invalid HMAC → 400 | BR-CHK-001 |
| First check-in with PENDING_ACTIVATION → ACTIVE | BR-CHK-002 |
| Consecutive check-ins Mon-Sun → streak 7 | BR-CHK-003 |
| Miss Wednesday → streak resets to 1 on Thursday | BR-CHK-003 |
| Double check-in same day → idempotent return | BR-CHK-004 |
| Check-in outside operating hours → 422 | BR-CHK-005 |
| In-app notification delivered to Socket.io room | BR-NTF-001 |
| Socket.io event received within 30s | BR-NTF-001 |
| 3 non-urgent emails in 1 hour → only 1 sent | BR-NTF-002 |
| Urgent email bypasses batch limit | BR-NTF-002 |
| Marketing email opted out → not sent | BR-NTF-003 |
| SMS transactional → sent regardless of opt-out | BR-NTF-003 |

### 18.4 Permission Tests

Test each role's access against the permission matrix rows in Section 9:
- Guest: cannot access any authenticated check-in, dashboard, report, notification, or content admin endpoint.
- Member: can check in (QR), view own check-in history, view own streak, view own dashboard, manage own notifications and preferences, cannot view reports or send notifications.
- PT: can view own dashboard (schedule, members), view own notifications, cannot view reports.
- Staff: can check in members (QR and manual), view check-in history (any), view staff dashboard, view own notifications, cannot view financial reports.
- Seller: can view seller dashboard, view own notifications, cannot access check-in or reports.
- Admin: full access to all dashboards, reports, notification sending, content management, check-in history.
- Super Admin: full access (inherits all).

### 18.5 Edge Case Tests

| Test | Edge Case ID |
|---|---|
| Two simultaneous check-in requests for same member → exactly 1 record | EC-CHK-001 |
| Check-in at exact midnight → checkinDate correct (not date rollover) | EC-CHK-002 |
| Expired membership check-in attempt → 403 | EC-CHK-003 |
| Gym holiday closure → check-in rejected | EC-CHK-004 |
| Multiple pending cycles, first check-in activates correct one | EC-CHK-005 |
| QR code from Monday used on Tuesday → rejected | EC-CHK-006 |
| Database connection lost mid-check-in → rollback, no orphan | EC-SYS-001 |
| Socket.io memory leak from unclosed connections → heartbeat cleanup | EC-SYS-003 |
| Token refresh race condition during notification fetch | EC-SYS-004 |
| Unauthorized member accessing admin report endpoint → 403 | EC-SYS-005 |
| Rate limiting bypass attempt on notification endpoint | EC-SYS-006 |
| Concurrent notification preference update → optimistic lock | EC-SYS-007 |

### 18.6 Regression Tests

- All Sprint 1–5 tests must continue to pass. Run full test suite before declaring Done.
- Member creation/deletion must not affect dependent check-in and notification records (cascade handling).

---

## 19. Rollback Strategy

1. **Git Rollback**: Revert the merge commit for Sprint 6. All Sprint 6 files are new and don't modify core shared infrastructure.
2. **Database Rollback**: Drop collections: `check_ins`, `attendance_logs`, `check_in_streaks`, `notifications`, `notification_templates`, `notification_preferences`, `push_tokens`, `report_definitions`, `report_audit_logs`, `contents`, `content_categories`, `content_tags`. No prior-sprint collections are structurally modified.
3. **Socket.io Rollback**: Remove notification and dashboard event handlers from the Socket.io server. Existing Socket.io infrastructure from Sprint 0 remains intact.
4. **Route Rollback**: Remove check-in, dashboard, report, notification, and content route registrations from `app.ts`.
5. **Service Degradation**: If partial rollback is needed (e.g., SMS provider fails), disable the failing channel via feature flag while keeping in-app notifications and other channels operational.

---

## 20. Risks

| # | Risk | Severity | Likelihood | Impact |
|---|---|---|---|---|
| R1 | Report data inaccuracy due to aggregation logic bugs (revenue does not reconcile with raw transactions) | HIGH | Medium | Financial misreporting, compliance issues, wrong business decisions |
| R2 | Notification delivery failure cascades (provider outage blocks all channels in a synchronous pipeline) | HIGH | Low | Members miss critical alerts (membership expiry, payment failures) |
| R3 | QR code security flaw (weak HMAC, predictable payload, replay across days) | CRITICAL | Low | Unauthorized gym access, fraudulent check-ins, streak manipulation |
| R4 | Socket.io connection overload under peak check-in times (hundreds of members simultaneously) | MEDIUM | Medium | Delayed in-app notifications, dashboard real-time updates freeze |
| R5 | Check-in race condition allowing double check-in despite idempotency guard | HIGH | Low | Inflated attendance stats, duplicate streaks |
| R6 | Email provider rate limiting or spam classification blocking bulk notifications | MEDIUM | Medium | Batch emails undelivered, member complaints |
| R7 | SMS cost overrun for high-frequency transactional notifications | LOW | Low | Unexpected operational cost, provider bill shock |
| R8 | Content XSS injection via rich text body | HIGH | Low | Session hijacking, data exfiltration through stored XSS |
| R9 | Dashboard query performance degradation as data grows (full collection scans) | MEDIUM | Medium | Slow dashboard load times, gateway timeouts |
| R10 | Report export timeout for large datasets (>100K rows) | MEDIUM | Low | Failed exports, UI hangs, 504 errors |

---

## 21. Risk Mitigation

| Risk | Mitigation |
|---|---|
| R1 | Cross-validate report totals against raw transaction sums in integration tests. Implement dual-entry ledger verification. Add `report_audit_logs` for traceability. |
| R2 | Implement channel isolation: each channel (email/SMS/push/in-app) dispatches independently. Use bull job queue with per-channel retry. One channel failure does not block others. |
| R3 | Use HMAC-SHA256 with server-side secret. QR payload includes `memberId`, `date`, `expiry` (ISO timestamp). Server verifies signature, compares date to today, and enforces single-use via `(memberId, date)` unique index on `check_ins`. |
| R4 | Horizontal scaling of Socket.io with Redis adapter. Connection pooling. Load test with k6 simulating 500 concurrent connections before launch. |
| R5 | Unique compound index on `(userId, checkinDate)` at database level. Use `findOneAndUpdate` with upsert for idempotent check-in. Frontend disables scan button until response. |
| R6 | Implement email warm-up (gradual volume increase). Use dedicated sending domain with SPF/DKIM/DMARC. Monitor bounce rate and sender reputation. Implement exponential backoff on rate limit responses. |
| R7 | Set per-member daily SMS limit. Monitor usage with alerts at 80% of monthly quota. Use in-app notification as primary channel; SMS only for truly transactional events. |
| R8 | Sanitize all content body HTML with DOMPurify server-side before storage. Render content with React's default escaping. CSP header prohibits inline scripts. |
| R9 | Add compound indexes for all dashboard query patterns. Cache frequent dashboard queries in Redis with 30-second TTL. Use `.lean()` and `.select()` to minimize document size. Implement query time logging (>100ms = slow). |
| R10 | Stream CSV export (not buffer in memory). Set max row limit (100K). For larger datasets, queue as background job with download link delivered via notification. |

---

## 22. Estimated Implementation Order

Reference: [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md) for detailed ordering.

### Phase 1: Models & Services (Day 1–3)
1. `check_ins` model → `attendance_logs` model → `check_in_streaks` model
2. `report_definitions` model → `report_audit_logs` model
3. `notifications` model → `notification_templates` model → `notification_preferences` model → `push_tokens` model
4. `contents` model → `content_categories` model → `content_tags` model
5. `qr.util.ts` (HMAC signing/verification)
6. `export.util.ts` (CSV/Excel)

### Phase 2: Core Logic (Day 4–7)
7. `checkinService` (check-in workflow with all 5 BR-CHK rules)
8. `streakService` (consecutive day calculation)
9. `analyticsService` (pre-built aggregation queries)
10. `reportService` (report generation + export)
11. `notificationService` (orchestrator: queue → channel dispatch → state transitions)
12. `emailService` (Nodemailer with templates, batching per BR-NTF-002)
13. `smsService` (Twilio/SpeedSMS, transactional-only per BR-NTF-003)
14. `pushService` (FCM token management)
15. `contentService` (CRUD + slug + status transitions)

### Phase 3: Controllers & Routes (Day 8–10)
16. `checkinController` → `checkin.routes.ts`
17. `dashboardController` → `dashboard.routes.ts`
18. `reportController` → `report.routes.ts`
19. `notificationController` → `notification.routes.ts`
20. `contentController` → `content.routes.ts`

### Phase 4: Real-time & Integration (Day 11–12)
21. Socket.io event handlers (`notification.handler.ts`, `dashboard.handler.ts`)
22. Wire notification triggers into check-in, booking, membership expiry, and payment flows
23. Dashboard real-time refresh for check-in queue and notification counts
24. Register all routes in `app.ts`

### Phase 5: Testing & Documentation (Day 13–14)
25. Unit tests for all services (business rules, state machine, edge cases)
26. Integration tests for all endpoints (permissions, error codes)
27. Socket.io integration tests (real-time delivery within 30s)
28. QR e2e test (generation → scan → check-in → streak)
29. Report reconciliation tests
30. Documentation updates per Section 24

---

## 23. Review Checklist

Mirrors [docs/AI_CODING_CONSTITUTION.md Part 9](../AI_CODING_CONSTITUTION.md#part-9-review-checklist):

- [ ] All 8 business rules implemented and tested with `BR-xxx` rule IDs in test descriptions.
- [ ] Notification state machine: all valid transitions work, all invalid transitions rejected, retry logic correct.
- [ ] All 47+ API endpoints return correct HTTP status codes and conform to [docs/API_STANDARDS.md](../API_STANDARDS.md) response format.
- [ ] All permission matrix rows enforced; unauthorized requests return 403 (not 404).
- [ ] All 6 EC-CHK-xxx edge cases handled with tests.
- [ ] All 7 EC-SYS-xxx edge cases handled with tests.
- [ ] QR signature verification cannot be bypassed; replay protection works across days.
- [ ] Email batching logic correctly enforces 1/hour with urgent bypass.
- [ ] SMS never opt-outable for transactional events.
- [ ] No secrets in code (HMAC secret, email/SMS provider keys in env vars only).
- [ ] All database queries use parameterized queries; no `$where`, no raw string interpolation.
- [ ] Content body HTML sanitized with DOMPurify before storage.
- [ ] CSP headers configured to prevent XSS in content rendering.
- [ ] Socket.io connections authenticated via JWT on handshake (ADR-010 compliance).
- [ ] No N+1 queries; all `.populate()` calls reviewed; `.lean()` and `.select()` used where appropriate.
- [ ] Database indexes exist for all query patterns (check_ins: `{ userId: 1, checkInTime: -1 }`, attendance_logs: `{ userId: 1, date: -1 }`, notifications: `{ userId: 1, isRead: 1, createdAt: -1 }`, contents: `{ slug: 1 }` unique).
- [ ] Zero TypeScript errors, zero ESLint errors, zero ESLint warnings.
- [ ] Zero dead code, commented-out code, TODO/FIXME markers.
- [ ] All files follow project structure conventions per [docs/SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md).
- [ ] All documentation files updated (Section 24 verified).

---

## 24. Documentation Update Checklist

| Document | Update Required | Details |
|---|---|---|
| [docs/modules/checkin.md](../modules/checkin.md) | Verify accuracy | Confirm API endpoints, error codes match implementation |
| [docs/modules/report.md](../modules/report.md) | Verify accuracy | Confirm report types, API endpoints match implementation |
| [docs/modules/notification.md](../modules/notification.md) | Verify accuracy | Confirm state machine, API endpoints match implementation |
| [docs/modules/content.md](../modules/content.md) | Verify accuracy | Confirm access rules, API endpoints match implementation |
| [docs/BUSINESS_RULES.md](../BUSINESS_RULES.md) | Verify completeness | Confirm all BR-CHK and BR-NTF rules are up-to-date |
| [docs/STATE_MACHINES.md](../STATE_MACHINES.md) | Verify accuracy | Confirm §6 Notification state machine matches implementation |
| [docs/PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) | Verify accuracy | Confirm Check-in, Reports & Analytics, Notifications, Content rows match middleware |
| [docs/DATABASE.md](../DATABASE.md) | Verify accuracy | Confirm all 12 collections match Mongoose schemas; indexes verified |
| [docs/API_STANDARDS.md](../API_STANDARDS.md) | Add dashboard section | Add §14.x Dashboard endpoint catalog |
| [docs/EDGE_CASES.md](../EDGE_CASES.md) | Verify resolved | Mark EC-CHK-001 through EC-CHK-006 and EC-SYS-* as handled/mitigated |
| [docs/CURRENT_PHASE.md](../CURRENT_PHASE.md) | Update | Mark Sprint 6 as complete; update "Active Priorities" |
| [docs/IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) | Update | Mark Intelligence phase as done |

---

## 25. Deliverables

1. **Check-in module** — QR generation/verification, check-in workflow, streak engine, attendance logs, bulk check-in, streak leaderboard.
2. **Dashboard module** — 5 role-specific dashboards (Admin, Member, PT, Seller, Staff) with real-time data.
3. **Report module** — 5 report types (revenue, membership, check-in, trainer, product) with CSV export, saved definitions, audit logging.
4. **Notification module** — Multi-channel delivery (email, SMS, in-app, push) with state machine tracking, admin templates, per-member preferences, batch email with urgent bypass.
5. **Content module** — Public blog/news/FAQ with categories, tags, and admin CRUD.
6. **Socket.io integration** — Real-time notification push, dashboard live updates, JWT-authenticated connections.
7. **Test suite** — Unit, integration, business rule (BR-xxx), permission (per-role), and edge case (EC-xxx) tests with 100% business logic coverage.
8. **Updated documentation** — All files listed in Section 24 verified and updated.

---

*End of Sprint 6 document. Proceed to Sprint 7 (Production) after all Definition of Done conditions are verified.*
