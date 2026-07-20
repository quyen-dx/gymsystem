# Notification Module

- **Owner**: Core Services Team
- **Dependencies**: Auth Module, User Module, Template Engine
- **Related Documents**: STATE_MACHINES.md

## Purpose

Deliver real-time and batch notifications across multiple channels (in-app, email, SMS, push) to users based on system events, administrative broadcasts, or scheduled triggers. Supports configurable templates and per-user preference controls.

## Models

- **Notification**: Stores individual notification records. Fields include recipient, channel, title, body, metadata, status, timestamps. Tracks delivery state through a finite state machine.
- **NotificationTemplate**: Admin-defined templates with variable placeholders, channel-specific content variants (subject, body, SMS text, push payload), and active/inactive status.
- **NotificationPreference**: Per-user channel opt-in/opt-out settings. Determines which channels (email, SMS, push, in-app) a user permits for each notification category.
- **PushToken**: Device registration tokens for push notifications. Supports multiple tokens per user (web, iOS, Android). Includes token expiry and refresh handling.

## Services

- **notificationService**: Core orchestrator. Accepts notification requests, resolves user preferences, selects appropriate channel(s), invokes channel services, and persists notification records. Manages retry logic for failed deliveries.
- **emailService**: Sends transactional and bulk emails via configured provider (SMTP or third-party API). Handles HTML rendering from templates, attachments, and bounce/complaint feedback.
- **smsService**: Sends SMS messages via SMS gateway provider. Handles message segmentation, delivery receipts.
- **pushService**: Sends push notifications to registered device tokens via FCM/APNs. Manages token invalidation and re-registration.

## Key Flows

1. **Notification Send**: Trigger → resolve recipients → filter by preferences → template rendering → dispatch per channel → persist record → publish delivery event.
2. **Read Receipt**: User opens in-app notification → client calls `PUT /notifications/:id/read` → status transitions to READ.
3. **Broadcast**: Admin creates broadcast → system partitions users into batches → parallel channel dispatch → aggregated delivery report.

### Notification State Machine

```
QUEUED → SENT → DELIVERED → READ
                  ↘ FAILED
```

- **QUEUED**: Notification created, pending dispatch.
- **SENT**: Dispatched to channel provider.
- **DELIVERED**: Confirmed delivery (read receipt, delivery report, or SMTP callback).
- **READ**: User has opened/read the notification (in-app only).
- **FAILED**: Delivery failed after retry exhaustion. Logged for admin review.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /notifications | User | List current user's notifications (paginated, filterable by read/unread) |
| PUT | /notifications/:id/read | User | Mark notification as read |
| PUT | /notifications/read-all | User | Mark all notifications as read |
| GET | /notifications/preferences | User | Get current user's notification preferences |
| PUT | /notifications/preferences | User | Update notification preferences |
| POST | /notifications/send | Admin | Send notification to user(s) or broadcast |
| GET | /notifications/templates | Admin | List notification templates |
| POST | /notifications/templates | Admin | Create notification template |
| PUT | /notifications/templates/:id | Admin | Update notification template |
| DELETE | /notifications/templates/:id | Admin | Delete notification template |
| POST | /notifications/push-tokens | User | Register push token |
| DELETE | /notifications/push-tokens/:id | User | Unregister push token |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| NOTIF_001 | Channel not configured | Requested channel has no provider configuration |
| NOTIF_002 | Invalid template | Template not found or inactive |
| NOTIF_003 | No eligible channels | All channels blocked by user preferences |
| NOTIF_004 | Provider error | Downstream provider returned an error |
| NOTIF_005 | Rate limited | Notification dispatch rate exceeded |

## Future

- Email digest (daily/weekly summary of unread notifications)
- Scheduled/delayed notification delivery
- Rich push with action buttons and deep links
- Multi-language notification templates
- Read receipt tracking for email (pixel tracking)
