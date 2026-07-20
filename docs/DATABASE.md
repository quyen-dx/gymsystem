# GymPro — Database Schema Reference

> **Version:** 1.0  
> **Last Updated:** 2026-07-20  
> **Database:** MongoDB 7.x (planned downgrade to Mongoose 8 LTS)  
> **ODM:** Mongoose 9 (planned downgrade to Mongoose 8 LTS)

---

## Table of Contents

1. [Database Technology](#1-database-technology)
2. [Collections List](#2-collections-list)
3. [Schema Patterns](#3-schema-patterns)
4. [Indexing Strategy](#4-indexing-strategy)
5. [Data Relationships](#5-data-relationships)
6. [Migrations Strategy](#6-migrations-strategy)
7. [Backup Strategy](#7-backup-strategy)

---

## 1. Database Technology

| Property          | Value                            |
| ----------------- | -------------------------------- |
| Database Engine   | MongoDB 7.x                      |
| ODM               | Mongoose 9 (→ 8 LTS planned)     |
| Connection Driver | `mongodb` (native driver)        |
| Replica Set       | Required (transaction support)   |
| Storage Engine    | WiredTiger                       |

### Why Mongoose 8 LTS

Mongoose 9 introduces breaking changes in schema validation, query middleware execution order, and TypeScript type inference. The planned downgrade to Mongoose 8 LTS ensures stability until the ecosystem matures. Migration will be handled via `package.json` version pin and a one-time schema audit.

### Connection Configuration

```env
MONGODB_URI=mongodb://<user>:<pass>@<host>:<port>/gympro?replicaSet=rs0&w=majority
MONGODB_OPTIONS={"maxPoolSize":50,"minPoolSize":5,"serverSelectionTimeoutMS":5000}
```

---

## 2. Collections List

64 collections organised by module. Each entry lists purpose, key fields, indexes, and relationships.

---

### 2.1 Auth & Users (6 collections)

#### `users`

| Field        | Type     | Notes                                  |
| ------------ | -------- | -------------------------------------- |
| name         | String   | required, trimmed                      |
| email        | String   | required, unique, lowercase, trimmed   |
| passwordHash | String   | required, bcrypt                       |
| phone        | String   | sparse; unique if present              |
| avatar       | String   | URL to uploaded image                  |
| role         | String   | enum: member, staff, pt, admin, super_admin |
| gender       | String   | enum: male, female, other              |
| dateOfBirth  | Date     |                                        |
| address      | Object   | `{ street, ward, district, city }`     |
| isActive     | Boolean  | defaults true                          |
| lastLoginAt  | Date     |                                        |
| deletedAt    | Date     | soft-delete marker                     |

- unique: `email`, `phone` (sparse)
- index: `{ role: 1, isActive: 1 }`, `{ deletedAt: 1 }` (sparse)
- text index: `{ name: "text", email: "text" }`


#### `otps`

| Field     | Type   | Notes                         |
| --------- | ------ | ----------------------------- |
| userId    | Object | ref: User                     |
| code      | String | required                      |
| type      | String | enum: email_verification, password_reset, phone_verification, login |
| expiresAt | Date   | required                      |
| consumedAt| Date   |                                |
| attempts  | Number | default 0, max 5              |

- index: `{ userId: 1, type: 1 }`
- TTL index: `{ expiresAt: 1 }` — documents expire 5 minutes after `expiresAt`


#### `sessions`

| Field          | Type   | Notes                         |
| -------------- | ------ | ----------------------------- |
| userId         | Object | ref: User                     |
| refreshToken   | String | required                      |
| deviceInfo     | Object | `{ userAgent, ip, platform }` |
| isRevoked      | Boolean| default false                 |
| expiresAt      | Date   | required                      |

- index: `{ userId: 1 }`, `{ refreshToken: 1 }` (unique)
- TTL index: `{ expiresAt: 1 }` — documents expire 24 hours after `expiresAt`


#### `password_reset_tokens`

| Field     | Type   | Notes                         |
| --------- | ------ | ----------------------------- |
| userId    | Object | ref: User                     |
| token     | String | required, unique              |
| expiresAt | Date   | required                      |
| usedAt    | Date   |                                |

- unique: `token`
- TTL index: `{ expiresAt: 1 }` — expires after 1 hour


#### `social_accounts`

| Field     | Type   | Notes                               |
| --------- | ------ | ----------------------------------- |
| userId    | Object | ref: User                           |
| provider  | String | enum: google, facebook, apple       |
| providerId| String | unique per provider                 |
| profileUrl| String |                                     |
| metadata  | Object | raw profile data from provider      |

- unique compound: `{ provider: 1, providerId: 1 }`
- index: `{ userId: 1 }`


#### `refresh_tokens`

| Field       | Type    | Notes                  |
| ----------- | ------- | ---------------------- |
| userId      | Object  | ref: User              |
| token       | String  | required, unique       |
| family      | String  | token rotation family  |
| isRevoked   | Boolean | default false          |
| expiresAt   | Date    | required               |

- unique: `token`
- index: `{ userId: 1, family: 1 }`
- TTL index: `{ expiresAt: 1 }`

---

### 2.2 Membership (5 collections)

#### `membership_plans`

| Field       | Type     | Notes                            |
| ----------- | -------- | -------------------------------- |
| name        | String   | required                         |
| description | String   |                                  |
| durationDays| Number   | required                         |
| price       | Number   | VND, no decimals                 |
| maxFreezes  | Number   | max allowed freezes per cycle    |
| maxCheckInsPerDay | Number |                           |
| features    | [String] | feature code list                |
| isActive    | Boolean  | default true                     |
| deletedAt   | Date     |                                  |
| createdBy   | Object   | ref: User                        |

- unique: `name`
- index: `{ isActive: 1, price: 1 }`


#### `membership_cycles`

| Field         | Type     | Notes                           |
| ------------- | -------- | ------------------------------- |
| userId        | Object   | ref: User                       |
| planId        | Object   | ref: MembershipPlan             |
| startDate     | Date     | required                        |
| endDate       | Date     | required                        |
| status        | String   | enum: pending_activation, active, frozen, expired, cancelled, refunded |
| price         | Number   | snapshot of plan price at purchase |
| discountCode  | String   |                                  |
| discountAmount| Number   | VND                              |
| autoRenew     | Boolean  | default false                    |
| pausedDays    | Number   | accumulated frozen days          |
| activatedAt   | Date     |                                  |
| expiredAt     | Date     |                                  |
| deletedAt     | Date     |                                  |

- index: `{ userId: 1, status: 1, endDate: 1 }`
- index: `{ status: 1, endDate: 1 }`


#### `membership_freezes`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| cycleId      | Object   | ref: MembershipCycle            |
| userId       | Object   | ref: User                       |
| startDate    | Date     | required                        |
| endDate      | Date     | required                        |
| reason       | String   |                                  |
| status       | String   | enum: pending, approved, rejected, active, completed |
| approvedBy   | Object   | ref: User (staff)               |
| deletedAt    | Date     |                                  |

- index: `{ cycleId: 1, status: 1 }`
- index: `{ userId: 1, startDate: 1 }`


#### `membership_cancellation_requests`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| cycleId     | Object   | ref: MembershipCycle            |
| userId      | Object   | ref: User                       |
| reason      | String   | required                        |
| status      | String   | enum: pending, approved, rejected |
| processedBy | Object   | ref: User (staff)               |
| processedAt | Date     |                                  |
| deletedAt   | Date     |                                  |

- index: `{ cycleId: 1 }`
- index: `{ userId: 1, status: 1 }`


#### `membership_discounts`

| Field       | Type     | Notes                            |
| ----------- | -------- | -------------------------------- |
| code        | String   | required, unique                 |
| description | String   |                                  |
| type        | String   | enum: percentage, fixed          |
| value       | Number   | percentage (0-100) or VND amount |
| maxUsage    | Number   | total redemptions limit          |
| usedCount   | Number   | default 0                        |
| minPlanPrice| Number   | minimum plan price to apply      |
| validFrom   | Date     |                                  |
| validUntil  | Date     |                                  |
| isActive    | Boolean  | default true                     |
| createdBy   | Object   | ref: User                        |
| deletedAt   | Date     |                                  |

- unique: `code`
- index: `{ isActive: 1, validFrom: 1, validUntil: 1 }`

---

### 2.3 Booking (5 collections)

#### `bookings`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| userId       | Object   | ref: User                       |
| slotId       | Object   | ref: BookingSlot, unique        |
| type         | String   | enum: class, pt, facility       |
| status       | String   | enum: confirmed, checked_in, completed, cancelled, no_show |
| paymentStatus| String   | enum: unpaid, paid, refunded    |
| checkInAt    | Date     |                                  |
| cancelledAt  | Date     |                                  |
| cancelReason | String   |                                  |
| notes        | String   |                                  |
| deletedAt    | Date     |                                  |

- unique: `slotId`
- index: `{ userId: 1, status: 1, createdAt: -1 }`
- index: `{ slotId: 1, status: 1 }`
- index: `{ type: 1, status: 1, createdAt: -1 }`


#### `booking_slots`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| scheduleId   | Object   | ref: Schedule                   |
| date         | Date     | date of the slot                |
| startTime    | Date     | full datetime                   |
| endTime      | Date     | full datetime                   |
| capacity     | Number   | max attendees                   |
| bookedCount  | Number   | default 0                       |
| status       | String   | enum: available, full, cancelled, completed |
| price        | Number   | VND, 0 = free                  |
| deletedAt    | Date     |                                  |

- index: `{ scheduleId: 1, date: 1 }`
- index: `{ date: 1, status: 1 }`
- index: `{ startTime: 1, endTime: 1 }`


#### `booking_recurring_patterns`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User                       |
| scheduleId  | Object   | ref: Schedule                   |
| frequency   | String   | enum: daily, weekly, biweekly, monthly |
| daysOfWeek  | [Number] | 0-6                             |
| startDate   | Date     | required                        |
| endDate     | Date     | optional                        |
| maxOccurrences| Number  |                                  |
| isActive    | Boolean  | default true                    |
| deletedAt   | Date     |                                  |

- index: `{ userId: 1, isActive: 1 }`
- index: `{ scheduleId: 1 }`


#### `booking_waitlist`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| slotId      | Object   | ref: BookingSlot                |
| userId      | Object   | ref: User                       |
| position    | Number   | queue position                  |
| status      | String   | enum: waiting, promoted, expired, cancelled |
| notifiedAt  | Date     | when slot became available      |
| deletedAt   | Date     |                                  |

- index: `{ slotId: 1, position: 1 }`
- index: `{ userId: 1, status: 1 }`


#### `booking_violations`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User                       |
| bookingId   | Object   | ref: Booking                    |
| type        | String   | enum: no_show, late_cancel, abuse |
| severity    | String   | enum: warning, strike, ban      |
| description | String   |                                  |
| actionTaken | String   |                                  |
| resolvedAt  | Date     |                                  |
| deletedAt   | Date     |                                  |

- index: `{ userId: 1, createdAt: -1 }`
- index: `{ type: 1, severity: 1 }`

---

### 2.4 Check-in (3 collections)

#### `check_ins`

| Field        | Type     | Notes                         |
| ------------ | -------- | ----------------------------- |
| userId       | Object   | ref: User                     |
| bookingId    | Object   | ref: Booking (optional)       |
| method       | String   | enum: qr_code, rfid, manual, face |
| verifiedBy   | Object   | ref: User (staff, for manual) |
| location     | String   | entry gate identifier         |
| checkInTime  | Date     | required, defaults now        |
| deletedAt    | Date     |                                |

- index: `{ userId: 1, checkInTime: -1 }`
- index: `{ bookingId: 1 }` (unique sparse)
- index: `{ checkInTime: -1 }`


#### `check_in_streaks` *(derived)*

| Field          | Type     | Notes                         |
| -------------- | -------- | ----------------------------- |
| userId         | Object   | ref: User, unique             |
| currentStreak  | Number   | default 0                     |
| longestStreak  | Number   | default 0                     |
| lastCheckInDate| Date     |                                |
| updatedAt      | Date     |                                |

- unique: `userId`
- index: `{ currentStreak: -1 }`


#### `attendance_logs`

| Field        | Type     | Notes                         |
| ------------ | -------- | ----------------------------- |
| userId       | Object   | ref: User                     |
| checkInId    | Object   | ref: CheckIn                  |
| date         | Date     | date-only (YYYY-MM-DD)        |
| checkInTime  | Date     |                                |
| checkOutTime | Date     |                                |
| duration     | Number   | minutes                       |
| source       | String   | enum: checkin, import, manual |
| deletedAt    | Date     |                                |

- index: `{ userId: 1, date: -1 }`
- index: `{ date: 1 }`

---

### 2.5 Workout (4 collections)

#### `workout_plans`

| Field         | Type     | Notes                           |
| ------------- | -------- | ------------------------------- |
| userId        | Object   | ref: User (trainee)             |
| trainerId     | Object   | ref: User (trainer, optional)   |
| name          | String   | required                        |
| description   | String   |                                  |
| goal          | String   | enum: strength, hypertrophy, endurance, weight_loss, general |
| difficulty    | String   | enum: beginner, intermediate, advanced |
| durationWeeks | Number   |                                  |
| isPublic      | Boolean  | default false                   |
| isActive      | Boolean  | default true                    |
| deletedAt     | Date     |                                  |

- index: `{ userId: 1, isActive: 1 }`
- index: `{ trainerId: 1 }`
- text index: `{ name: "text", description: "text" }`


#### `exercises`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| name         | String   | required, unique               |
| description  | String   |                                  |
| muscleGroup  | [String] | e.g. chest, back, legs, core, shoulders, arms |
| equipment    | [String] | e.g. barbell, dumbbell, cable, bodyweight, machine |
| difficulty   | String   | enum: beginner, intermediate, advanced |
| mediaUrls    | [String] | video/image demonstration       |
| isActive     | Boolean  | default true                    |
| deletedAt    | Date     |                                  |

- unique: `name`
- index: `{ muscleGroup: 1 }`
- text index: `{ name: "text", description: "text" }`


#### `workout_exercises`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| planId       | Object   | ref: WorkoutPlan                |
| exerciseId   | Object   | ref: Exercise                   |
| dayOfWeek    | Number   | 0-6 or day number               |
| order        | Number   | sequence within day             |
| sets         | Number   |                                  |
| reps         | Number   |                                  |
| restSeconds  | Number   |                                  |
| notes        | String   |                                  |
| deletedAt    | Date     |                                  |

- index: `{ planId: 1, dayOfWeek: 1, order: 1 }`
- index: `{ exerciseId: 1 }`


#### `workout_logs`

| Field          | Type     | Notes                         |
| -------------- | -------- | ----------------------------- |
| userId         | Object   | ref: User                     |
| workoutExerciseId | Object | ref: WorkoutExercise        |
| date           | Date     | workout date                  |
| actualSets     | Number   |                                |
| actualReps     | Number   |                                |
| weight         | Number   | in kg                         |
| durationMinutes| Number   |                                |
| rpe            | Number   | 1-10 rate of perceived exertion |
| notes          | String   |                                |
| deletedAt      | Date     |                                |

- index: `{ userId: 1, date: -1 }`
- index: `{ workoutExerciseId: 1 }`
- index: `{ userId: 1, date: -1, createdAt: -1 }`

---

### 2.6 Schedule (3 collections)

#### `schedules`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| trainerId    | Object   | ref: User                       |
| type         | String   | enum: class, pt, facility       |
| name         | String   | class or session name           |
| description  | String   |                                  |
| defaultCapacity | Number |                                  |
| defaultPrice | Number   | VND                             |
| color        | String   | hex colour for calendar UI      |
| isRecurring  | Boolean  |                                  |
| isActive     | Boolean  | default true                    |
| deletedAt    | Date     |                                  |

- index: `{ trainerId: 1, isActive: 1 }`
- index: `{ type: 1, isActive: 1 }`


#### `schedule_exceptions`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| scheduleId  | Object   | ref: Schedule                   |
| date        | Date     | affected date                   |
| type        | String   | enum: cancelled, rescheduled, time_change |
| newStartTime| Date     |                                  |
| newEndTime  | Date     |                                  |
| reason      | String   |                                  |
| deletedAt   | Date     |                                  |

- index: `{ scheduleId: 1, date: 1 }`


#### `schedule_templates`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| name         | String   | required                        |
| scheduleId   | Object   | ref: Schedule (optional)        |
| slots        | [Object] | `[{ dayOfWeek, startTime, endTime, capacity }]` |
| isActive     | Boolean  | default true                    |
| createdBy    | Object   | ref: User                       |
| deletedAt    | Date     |                                  |

- index: `{ scheduleId: 1 }`
- index: `{ name: 1 }` (unique)

---

### 2.7 Payment (5 collections)

#### `payments`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| userId        | Object   | ref: User                      |
| bookingId     | Object   | ref: Booking (optional)        |
| orderId       | Object   | ref: Order (optional)          |
| membershipCycleId | Object | ref: MembershipCycle (optional) |
| amount        | Number   | VND                            |
| fee           | Number   | gateway processing fee, VND    |
| netAmount     | Number   | amount - fee                   |
| currency      | String   | default VND                    |
| status        | String   | enum: pending, processing, completed, failed, refunded, partially_refunded |
| method        | String   | enum: card, wallet, bank_transfer, momo, vnpay, cash |
| gateway       | String   | enum: vnpay, momo, stripe, internal |
| gatewayTransactionId | String |                          |
| paidAt        | Date     |                                 |
| refundedAt    | Date     |                                 |
| metadata      | Object   | gateway raw response            |
| deletedAt     | Date     |                                 |

- index: `{ userId: 1, status: 1, createdAt: -1 }`
- index: `{ bookingId: 1 }` (unique sparse)
- index: `{ orderId: 1 }` (unique sparse)
- index: `{ status: 1, createdAt: -1 }`
- index: `{ gatewayTransactionId: 1 }` (sparse unique)


#### `payment_transactions`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| paymentId   | Object   | ref: Payment                    |
| type        | String   | enum: charge, refund, reversal, settlement |
| amount      | Number   | VND                             |
| status      | String   | enum: initiated, success, failed |
| gatewayResponse | Object | raw response                   |
| reference   | String   | internal reference ID           |
| deletedAt   | Date     |                                  |

- index: `{ paymentId: 1, createdAt: 1 }`
- index: `{ type: 1, status: 1 }`


#### `payment_webhooks`

| Field         | Type     | Notes                         |
| ------------- | -------- | ----------------------------- |
| gateway       | String   | enum: vnpay, momo, stripe     |
| eventType     | String   | gateway event type string     |
| payload       | Object   | raw webhook payload           |
| headers       | Object   | request headers               |
| ip            | String   | requester IP                  |
| status        | String   | enum: received, processing, processed, failed |
| processedAt   | Date     |                               |
| errorMessage  | String   |                               |
| deletedAt     | Date     |                               |

- index: `{ gateway: 1, status: 1, createdAt: -1 }`
- index: `{ eventType: 1 }`


#### `refunds`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| paymentId   | Object   | ref: Payment                    |
| userId      | Object   | ref: User                       |
| amount      | Number   | VND                             |
| reason      | String   | required                        |
| status      | String   | enum: pending, approved, processed, rejected, failed |
| approvedBy  | Object   | ref: User (staff)               |
| processedAt | Date     |                                  |
| gatewayRefundId | String |                               |
| deletedAt   | Date     |                                  |

- index: `{ paymentId: 1 }`
- index: `{ userId: 1, status: 1 }`


#### `payment_methods`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User                       |
| type        | String   | enum: card, wallet, bank_account |
| provider    | String   | visa, mastercard, momo, etc.    |
| token       | String   | gateway token (masked)          |
| last4       | String   | last 4 digits                   |
| isDefault   | Boolean  | default false                   |
| isExpired   | Boolean  | default false                   |
| metadata    | Object   | expiry, brand, etc.             |
| deletedAt   | Date     |                                  |

- index: `{ userId: 1, isDefault: 1 }`
- index: `{ token: 1 }` (unique sparse)

---

### 2.8 Wallet (2 collections)

#### `wallets`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User, unique               |
| balance     | Number   | VND, default 0                  |
| totalDeposited | Number | VND, lifetime                  |
| totalSpent  | Number   | VND, lifetime                   |
| status      | String   | enum: active, frozen, closed    |
| frozenAt    | Date     |                                  |
| closedAt    | Date     |                                  |

- unique: `userId`


#### `wallet_transactions`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| walletId    | Object   | ref: Wallet                     |
| userId      | Object   | ref: User                       |
| type        | String   | enum: deposit, withdrawal, payment, refund, bonus, adjustment |
| amount      | Number   | signed integer (positive = credit, negative = debit) |
| balanceBefore| Number  |                                  |
| balanceAfter | Number  |                                  |
| referenceType| String  | enum: payment, order, refund, adjustment |
| referenceId  | Object  | polymorphic ref                  |
| description  | String  |                                  |
| deletedAt    | Date    |                                  |
| createdAt    | Date    |                                  |

- index: `{ walletId: 1, createdAt: -1 }`
- index: `{ userId: 1, createdAt: -1 }`
- index: `{ referenceType: 1, referenceId: 1 }`

---

### 2.9 Shop (5 collections)

#### `products`

| Field         | Type     | Notes                            |
| ------------- | -------- | -------------------------------- |
| name          | String   | required                         |
| slug          | String   | required, unique                 |
| description   | String   |                                  |
| categoryId    | Object   | ref: Category                    |
| type          | String   | enum: physical, digital, service |
| basePrice     | Number   | VND                               |
| salePrice     | Number   | VND                               |
| images        | [String] | URLs                             |
| tags          | [String] |                                  |
| isActive      | Boolean  | default true                     |
| isFeatured    | Boolean  | default false                    |
| sortOrder     | Number   |                                  |
| deletedAt     | Date     |                                  |

- unique: `slug`
- index: `{ categoryId: 1, isActive: 1 }`
- index: `{ isFeatured: 1, sortOrder: 1 }`
- text index: `{ name: "text", description: "text" }`


#### `product_variants`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| productId   | Object   | ref: Product                    |
| name        | String   | e.g. "Size L", "Blue"           |
| sku         | String   | unique stock-keeping unit       |
| price       | Number   | override base price, VND        |
| stock       | Number   | inventory count                 |
| reserved    | Number   | reserved for active carts/orders |
| isActive    | Boolean  | default true                    |
| sortOrder   | Number   |                                  |
| deletedAt   | Date     |                                  |

- unique: `sku`
- index: `{ productId: 1, isActive: 1 }`


#### `categories`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| name        | String   | required                        |
| slug        | String   | required, unique                |
| description | String   |                                  |
| parentId    | Object   | ref: Category (self-referencing) |
| image       | String   | URL                             |
| sortOrder   | Number   |                                  |
| isActive    | Boolean  | default true                    |
| deletedAt   | Date     |                                  |

- unique: `slug`
- index: `{ parentId: 1 }`


#### `product_reviews`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| productId   | Object   | ref: Product                    |
| userId      | Object   | ref: User                       |
| rating      | Number   | 1-5                             |
| title       | String   |                                  |
| content     | String   |                                  |
| images      | [String] |                                  |
| isVerifiedPurchase | Boolean | default false            |
| isActive    | Boolean  | default true                    |
| deletedAt   | Date     |                                  |

- unique compound: `{ productId: 1, userId: 1 }`
- index: `{ productId: 1, rating: -1 }`
- index: `{ userId: 1 }`


#### `seller_payouts`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User (seller)              |
| amount      | Number   | VND                             |
| fee         | Number   | platform fee, VND               |
| netAmount   | Number   |                                  |
| status      | String   | enum: pending, processing, completed, failed |
| periodStart | Date     |                                  |
| periodEnd   | Date     |                                  |
| paidAt      | Date     |                                  |
| method      | String   | enum: bank_transfer, wallet     |
| bankInfo    | Object   | `{ bank, accountNumber, holder }` |
| deletedAt   | Date     |                                  |

- index: `{ userId: 1, status: 1, createdAt: -1 }`
- index: `{ status: 1, periodStart: 1 }`

---

### 2.10 Orders (4 collections)

#### `orders`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| userId        | Object   | ref: User                      |
| orderNumber   | String   | human-readable unique          |
| status        | String   | enum: pending, confirmed, processing, shipped, delivered, cancelled, returned |
| subtotal      | Number   | VND                            |
| shippingFee   | Number   | VND                            |
| discount      | Number   | VND                            |
| total         | Number   | VND                            |
| notes         | String   |                                |
| shippingAddress | Object | `{ street, ward, district, city, phone }` |
| cancelledAt   | Date     |                                |
| deliveredAt   | Date     |                                |
| deletedAt     | Date     |                                |

- unique: `orderNumber`
- index: `{ userId: 1, status: 1, createdAt: -1 }`
- index: `{ status: 1, createdAt: -1 }`


#### `order_items`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| orderId       | Object   | ref: Order                     |
| productId     | Object   | ref: Product                   |
| variantId     | Object   | ref: ProductVariant (optional) |
| productName   | String   | snapshot                       |
| variantName   | String   | snapshot                       |
| sku           | String   | snapshot                       |
| quantity      | Number   |                                |
| unitPrice     | Number   | VND                            |
| subtotal      | Number   | quantity × unitPrice           |
| deletedAt     | Date     |                                |

- index: `{ orderId: 1 }`
- index: `{ productId: 1 }`


#### `order_tracking`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| orderId       | Object   | ref: Order, unique             |
| carrier       | String   | shipping carrier name          |
| trackingNumber| String   |                                |
| status        | String   | enum: label_created, picked_up, in_transit, out_for_delivery, delivered, failed |
| estimatedDelivery | Date |                               |
| actualDelivery| Date     |                                |
| events        | [Object] | `[{ timestamp, location, status, description }]` |
| deletedAt     | Date     |                                |

- unique: `orderId`
- index: `{ trackingNumber: 1 }` (sparse unique)


#### `order_returns`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| orderId       | Object   | ref: Order                     |
| userId        | Object   | ref: User                      |
| items         | [Object] | `[{ itemId, quantity, reason }]` |
| reason        | String   |                                |
| status        | String   | enum: requested, approved, picked_up, received, inspected, refunded, rejected |
| refundAmount  | Number   | VND                            |
| requestedAt   | Date     |                                |
| pickedUpAt    | Date     |                                |
| receivedAt    | Date     |                                |
| deletedAt     | Date     |                                |

- index: `{ orderId: 1 }`
- index: `{ userId: 1, status: 1 }`

---

### 2.11 Notification (4 collections)

#### `notifications`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| userId        | Object   | ref: User                      |
| type          | String   | enum key from notification_templates |
| channel       | String   | enum: in_app, email, sms, push  |
| title         | String   |                                |
| body          | String   |                                |
| data          | Object   | payload for deep linking       |
| isRead        | Boolean  | default false                  |
| readAt        | Date     |                                |
| sentAt        | Date     |                                |
| deliveredAt   | Date     |                                |
| failedAt      | Date     |                                |
| errorMessage  | String   |                                |
| deletedAt     | Date     |                                |

- index: `{ userId: 1, isRead: 1, createdAt: -1 }`
- index: `{ type: 1, createdAt: -1 }`
- index: `{ channel: 1, sentAt: 1 }`


#### `notification_templates`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| key         | String   | unique identifier               |
| name        | String   | human-readable                  |
| channel     | String   | enum: email, sms, push, in_app  |
| subject     | String   | email subject                   |
| body        | String   | template with {{placeholders}}  |
| variables   | [String] | expected placeholder keys       |
| isActive    | Boolean  | default true                    |
| deletedAt   | Date     |                                  |

- unique: `key`


#### `notification_preferences`

| Field           | Type     | Notes                       |
| --------------- | -------- | --------------------------- |
| userId          | Object   | ref: User, unique           |
| emailEnabled    | Boolean  | default true                |
| smsEnabled      | Boolean  | default true                |
| pushEnabled     | Boolean  | default true                |
| inAppEnabled    | Boolean  | default true                |
| quietHoursStart | Number   | hour (0-23)                 |
| quietHoursEnd   | Number   | hour (0-23)                 |
| optOuts         | [String] | notification type keys      |

- unique: `userId`


#### `push_tokens`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User                       |
| token       | String   | device push token               |
| platform    | String   | enum: ios, android, web         |
| deviceId    | String   |                                  |
| isActive    | Boolean  | default true                    |
| lastUsedAt  | Date     |                                  |
| expiresAt   | Date     |                                  |

- unique compound: `{ userId: 1, token: 1 }`
- index: `{ token: 1 }` (unique)

---

### 2.12 Content (3 collections)

#### `contents`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| title        | String   | required                        |
| slug         | String   | required, unique                |
| excerpt      | String   | short description               |
| body         | String   | HTML or Markdown                |
| categoryId   | Object   | ref: ContentCategory            |
| authorId     | Object   | ref: User                       |
| tags         | [Object] | ref: ContentTag                 |
| coverImage   | String   | URL                             |
| status       | String   | enum: draft, published, archived |
| publishedAt  | Date     |                                  |
| viewCount    | Number   | default 0                       |
| isFeatured   | Boolean  | default false                   |
| deletedAt    | Date     |                                  |

- unique: `slug`
- index: `{ categoryId: 1, status: 1, publishedAt: -1 }`
- index: `{ status: 1, publishedAt: -1 }`
- index: `{ authorId: 1 }`
- text index: `{ title: "text", excerpt: "text", body: "text" }`


#### `content_categories`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| name        | String   | required                        |
| slug        | String   | required, unique                |
| description | String   |                                  |
| parentId    | Object   | ref: ContentCategory            |
| sortOrder   | Number   |                                  |
| isActive    | Boolean  | default true                    |
| deletedAt   | Date     |                                  |

- unique: `slug`
- index: `{ parentId: 1 }`


#### `content_tags`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| name        | String   | required, unique                |
| slug        | String   | required, unique                |
| usageCount  | Number   | default 0                       |
| deletedAt   | Date     |                                  |

- unique: `name`, `slug`

---

### 2.13 Reports (2 collections)

#### `report_definitions`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| name        | String   | required                        |
| description | String   |                                  |
| type        | String   | enum: revenue, membership, booking, checkin, product, custom |
| config      | Object   | query/filter/group configuration |
| parameters  | [Object] | `[{ key, label, type, defaultValue }]` |
| schedule    | String   | cron expression (optional)      |
| recipients  | [String] | email addresses                 |
| isActive    | Boolean  | default true                    |
| createdBy   | Object   | ref: User                       |
| deletedAt   | Date     |                                  |

- index: `{ type: 1, isActive: 1 }`
- index: `{ createdBy: 1 }`


#### `report_audit_logs`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| reportId    | Object   | ref: ReportDefinition           |
| generatedBy | Object   | ref: User                       |
| type        | String   | enum: scheduled, manual         |
| status      | String   | enum: running, completed, failed |
| outputUrl   | String   | URL to generated file           |
| rowCount    | Number   |                                  |
| durationMs  | Number   | execution time                  |
| parameters  | Object   | parameters used                 |
| errorMessage| String   |                                  |
| deletedAt   | Date     |                                  |

- index: `{ reportId: 1, createdAt: -1 }`
- index: `{ generatedBy: 1 }`

---

### 2.14 Settings (3 collections)

#### `system_settings`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| key         | String   | unique                          |
| value       | Mixed    | any JSON-encodable value        |
| description | String   |                                  |
| group       | String   | enum: general, payment, booking, notification, appearance |
| isEncrypted | Boolean  | default false                   |
| updatedBy   | Object   | ref: User                       |
| deletedAt   | Date     |                                  |

- unique: `key`
- index: `{ group: 1 }`


#### `feature_flags`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| key         | String   | unique                          |
| name        | String   | human-readable                  |
| description | String   |                                  |
| isEnabled   | Boolean  | default false                   |
| rolloutPercent | Number | 0-100 (gradual rollout)        |
| rules       | [Object] | `[{ field, operator, value }]` targeting rules |
| updatedBy   | Object   | ref: User                       |
| deletedAt   | Date     |                                  |

- unique: `key`


#### `maintenance_mode`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| isActive    | Boolean  | default false                   |
| message     | String   | display message to users        |
| allowedIPs  | [String] | IPs that bypass maintenance     |
| allowedRoles| [String] | roles that bypass maintenance   |
| startedAt   | Date     |                                  |
| expectedEndAt | Date   |                                  |
| updatedBy   | Object   | ref: User                       |
| deletedAt   | Date     |                                  |

- single document (singleton pattern)

---

### 2.15 AI (5 collections)

#### `ai_conversations`

| Field        | Type     | Notes                          |
| ------------ | -------- | ------------------------------ |
| userId       | Object   | ref: User                      |
| title        | String   | auto-generated or user-set     |
| contextType  | String   | enum: general, workout, nutrition, membership, support |
| metadata     | Object   | `{ planId, bookingId, ... }`   |
| messageCount | Number   | default 0                      |
| isActive     | Boolean  | default true                   |
| deletedAt    | Date     |                                |

- index: `{ userId: 1, updatedAt: -1 }`
- index: `{ contextType: 1, isActive: 1 }`


#### `ai_messages`

| Field          | Type     | Notes                         |
| -------------- | -------- | ----------------------------- |
| conversationId | Object   | ref: AIConversation           |
| role           | String   | enum: user, assistant, system |
| content        | String   | message text                  |
| tokensUsed     | Number   | prompt + completion tokens    |
| model          | String   | model used for this message   |
| latencyMs      | Number   | response time                 |
| metadata       | Object   | `{ sources, confidence, ...}` |
| deletedAt      | Date     |                               |

- index: `{ conversationId: 1, createdAt: 1 }`
- index: `{ role: 1, createdAt: -1 }`


#### `ai_embeddings`

| Field        | Type     | Notes                           |
| ------------ | -------- | ------------------------------- |
| resourceType | String   | enum: content, exercise, product, faq |
| resourceId   | Object   | polymorphic ref                 |
| text         | String   | original text                   |
| embedding    | [Number] | vector array                    |
| model        | String   | embedding model name            |
| chunkIndex   | Number   | for chunked documents           |
| deletedAt    | Date     |                                  |

- index: `{ resourceType: 1, resourceId: 1 }`
- index: `{ model: 1 }`


#### `ai_feedback`

| Field          | Type     | Notes                         |
| -------------- | -------- | ----------------------------- |
| messageId      | Object   | ref: AIMessage                |
| userId         | Object   | ref: User                     |
| rating         | Number   | 1-5                           |
| feedback       | String   | free text                     |
| category       | String   | enum: helpful, inaccurate, irrelevant, harmful |
| metadata       | Object   | additional context            |
| deletedAt      | Date     |                               |

- index: `{ messageId: 1 }`
- index: `{ userId: 1, createdAt: -1 }`
- index: `{ rating: 1 }`


#### `ai_model_config`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| modelName     | String   | e.g. gpt-4, claude-3, gemini-pro |
| provider      | String   | enum: openai, anthropic, google, custom |
| contextType   | String   | enum: general, workout, nutrition, membership, support |
| config        | Object   | `{ temperature, maxTokens, topP, ... }` |
| isActive      | Boolean  | default true                   |
| priority      | Number   | fallback order                 |
| deletedAt     | Date     |                                |

- unique compound: `{ modelName: 1, contextType: 1 }`
- index: `{ provider: 1, isActive: 1 }`

---

### 2.16 Other (5 collections)

#### `uploads`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| userId      | Object   | ref: User                       |
| originalName| String   |                                  |
| mimeType    | String   |                                  |
| size        | Number   | bytes                           |
| path        | String   | storage path                    |
| url         | String   | public URL                      |
| bucket      | String   | storage bucket/directory        |
| category    | String   | enum: avatar, product_image, content_image, document, other |
| metadata    | Object   | `{ width, height, duration }`   |
| deletedAt   | Date     |                                  |

- index: `{ userId: 1, createdAt: -1 }`
- index: `{ category: 1 }`
- index: `{ url: 1 }` (sparse unique)


#### `logs`

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| level       | String   | enum: debug, info, warn, error, fatal |
| module      | String   | e.g. auth, booking, payment     |
| action      | String   | e.g. user.login, booking.create |
| userId      | Object   | ref: User (optional)            |
| ip          | String   |                                  |
| userAgent   | String   |                                  |
| message     | String   |                                  |
| metadata    | Object   | contextual data                 |
| stackTrace  | String   | for errors                      |
| createdAt   | Date     | (no updatedAt needed)           |

- index: `{ level: 1, createdAt: -1 }`
- index: `{ module: 1, createdAt: -1 }`
- index: `{ action: 1, createdAt: -1 }`
- index: `{ userId: 1, createdAt: -1 }`
- TTL index: `{ createdAt: 1 }` — optional, auto-delete logs older than 90 days


#### `backup_records`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| filename      | String   | backup file name               |
| size          | Number   | bytes                          |
| type          | String   | enum: full, incremental, oplog |
| status        | String   | enum: running, completed, failed |
| storagePath   | String   | cloud storage path             |
| checksum      | String   | SHA-256                        |
| startedAt     | Date     |                                |
| completedAt   | Date     |                                |
| errorMessage  | String   |                                |
| deletedAt     | Date     |                                |

- index: `{ type: 1, startedAt: -1 }`
- index: `{ status: 1 }`


#### `integrations`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| name          | String   | e.g. "VNPay", "Momo", "ZaloPay" |
| provider      | String   | enum key                       |
| type          | String   | enum: payment, sms, email, storage, analytics |
| config        | Object   | encrypted configuration fields |
| credentials   | Object   | encrypted API keys/tokens      |
| isActive      | Boolean  | default true                   |
| lastHealthCheck | Date   |                                |
| isHealthy     | Boolean  | default true                   |
| deletedAt     | Date     |                                |

- unique: `provider`
- index: `{ type: 1, isActive: 1 }`


#### `audit_logs`

| Field         | Type     | Notes                          |
| ------------- | -------- | ------------------------------ |
| userId        | Object   | ref: User (who performed)      |
| action        | String   | e.g. user.delete, payment.refund |
| resourceType  | String   | e.g. User, Payment, Order      |
| resourceId    | Object   | polymorphic ref                |
| before        | Object   | previous state (snapshot)      |
| after         | Object   | new state (snapshot)           |
| changes       | [Object] | `[{ field, from, to }]`       |
| ip            | String   |                                |
| userAgent     | String   |                                |
| metadata      | Object   | additional context             |
| deletedAt     | Date     |                                |

- index: `{ userId: 1, createdAt: -1 }`
- index: `{ resourceType: 1, resourceId: 1, createdAt: -1 }`
- index: `{ action: 1, createdAt: -1 }`
- index: `{ createdAt: -1 }` (default sort for audit trails)

---

## 3. Schema Patterns

### 3.1 Timestamps

Every collection uses Mongoose's built-in `timestamps: true`, which automatically adds:

```javascript
{
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

- `createdAt` is immutable after creation.
- `updatedAt` is updated on every document modification via Mongoose middleware.
- Both are stored in UTC. The application layer handles timezone conversion.

### 3.2 Soft Delete

Soft delete is implemented on all collections via the following convention:

```javascript
deletedAt: { type: Date, default: null }
```

- Documents are never physically removed from the database (except for TTL-indexed collections: `otps`, `sessions`, `password_reset_tokens`, `refresh_tokens`).
- Queries must always filter `{ deletedAt: null }` unless explicitly querying deleted records.
- A Mongoose global plugin handles the automatic filtering:

```javascript
// Schema definition
{
  deletedAt: { type: Date, default: null }
}
```

- The `isDeleted` flag is **derived** — if `deletedAt !== null`, the document is considered deleted. No separate boolean field is stored.
- Indexes on `deletedAt` are **sparse** to minimise index size (only indexing non-null values).

### 3.3 Status Enums

All status fields use Mongoose `enum` validation with predefined string constants:

```javascript
status: {
  type: String,
  enum: ['active', 'inactive', 'pending'],
  default: 'active'
}
```

- Status enums are defined as `const` arrays in a shared constants file (`/src/constants/statuses.js`).
- Each status field has a sensible default.
- Transitions between statuses are enforced at the application layer (not in the schema).

### 3.4 References

Reference fields follow a consistent pattern:

```javascript
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  index: true
}
```

Standard reference field names:
| Field       | Ref    | When Used                      |
| ----------- | ------ | ------------------------------ |
| `userId`    | User   | Owner/subject of the record    |
| `createdBy` | User   | Staff/admin who created it     |
| `updatedBy` | User   | Staff/admin who last modified  |
| `approvedBy`| User   | Approver of the action         |
| `trainerId` | User   | PT/trainer                     |
| `planId`    | MembershipPlan |                      |
| `cycleId`   | MembershipCycle |                     |
| `paymentId` | Payment |                                |
| `orderId`   | Order   |                                |
| `productId` | Product |                                |
| `slotId`    | BookingSlot |                            |

### 3.5 Currency Storage

All monetary values are stored as `Number` (integer) representing **VND in the smallest unit** — no decimal places.

```javascript
price: { type: Number, required: true, min: 0 }
```

- Example: 50,000 VND is stored as `50000`.
- No floating-point rounding errors.
- Display formatting (commas, decimals for other currencies) is handled in the presentation layer.
- Tax and fee calculations use integer arithmetic at the application layer.

### 3.6 Date Handling

- All `Date` fields are stored in **UTC**.
- Mongoose's `timestamps: true` uses UTC by default.
- Date-only fields (e.g., `date`, `startDate`) are stored as `Date` with the time component set to `00:00:00.000Z`.
- The application layer converts to the user's local timezone for display.
- Use `moment-timezone` or `date-fns-tz` for timezone conversions — never perform timezone math in the database layer.

---

## 4. Indexing Strategy

### 4.1 Foreign Key Indexes

Every field that references another collection via `ObjectId` is indexed:

```javascript
// All reference fields MUST have an index:
{ userId: 1 }
{ createdBy: 1 }
{ planId: 1 }
{ cycleId: 1 }
// ... etc.
```

This is non-negotiable — unindexed foreign keys are the most common source of query degradation.

### 4.2 Compound Indexes

Compound indexes are designed to cover the most frequent query patterns:

| Collection         | Index                               | Covers                                     |
| ------------------ | ----------------------------------- | ------------------------------------------ |
| users              | `{ role: 1, isActive: 1 }`          | Admin user listing by role                 |
| membership_cycles  | `{ userId: 1, status: 1, endDate: 1 }` | Member's active cycles                 |
| bookings           | `{ userId: 1, status: 1, createdAt: -1 }` | Member's booking history           |
| bookings           | `{ slotId: 1, status: 1 }`          | Slot occupancy check                       |
| bookings           | `{ type: 1, status: 1, createdAt: -1 }` | Admin view by type                  |
| check_ins          | `{ userId: 1, checkInTime: -1 }`    | Member check-in history                   |
| payments           | `{ userId: 1, status: 1, createdAt: -1 }` | Member payment history            |
| payments           | `{ status: 1, createdAt: -1 }`      | Payment reconciliation dashboard           |
| orders             | `{ userId: 1, status: 1, createdAt: -1 }` | Member order history              |
| notifications      | `{ userId: 1, isRead: 1, createdAt: -1 }` | Unread notifications             |
| ai_conversations   | `{ userId: 1, updatedAt: -1 }`      | User's conversation history               |
| audit_logs         | `{ resourceType: 1, resourceId: 1, createdAt: -1 }` | Audit trail for specific records |

### 4.3 Unique Indexes

| Collection   | Field(s)          | Notes                        |
| ------------ | ----------------- | ---------------------------- |
| users        | `email`           | Case-insensitive via lowercase transform |
| users        | `phone`           | Sparse (optional field)      |
| sessions     | `refreshToken`    |                              |
| otps         | `token`           |                              |
| membership_plans    | `name`     |                              |
| membership_discounts| `code`     |                              |
| products     | `slug`            |                              |
| product_variants    | `sku`      |                              |
| categories   | `slug`            |                              |
| contents     | `slug`            |                              |
| content_tags | `name`, `slug`    |                              |
| orders       | `orderNumber`     | Human-readable unique        |
| wallets      | `userId`          | 1:1 relationship             |
| uploads      | `url`             | Sparse unique                |
| integrations | `provider`        | One config per provider      |

### 4.4 TTL Indexes

Auto-expire documents after a specified period:

| Collection            | Field       | Expire After     | Purpose                        |
| --------------------- | ----------- | ---------------- | ------------------------------ |
| otps                  | `expiresAt` | 5 minutes        | Auto-clean expired OTP codes   |
| sessions              | `expiresAt` | 24 hours         | Remove stale sessions          |
| password_reset_tokens | `expiresAt` | 1 hour           | Clean reset tokens             |
| refresh_tokens        | `expiresAt` | 30 days          | Rotation garbage collection    |
| logs                  | `createdAt` | 90 days (opt)    | Log retention policy           |

```javascript
// Example TTL index
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 });
```

### 4.5 Text Indexes

Full-text search indexes:

| Collection   | Index Definition                     | Use Case                          |
| ------------ | ------------------------------------ | --------------------------------- |
| users        | `{ name: "text", email: "text" }`    | Admin user search                 |
| products     | `{ name: "text", description: "text" }` | Product search (shop)         |
| contents     | `{ title: "text", excerpt: "text", body: "text" }` | Blog/content search |
| exercises    | `{ name: "text", description: "text" }` | Exercise library search       |
| workout_plans| `{ name: "text", description: "text" }` | Plan search                   |

```javascript
// Example text index
userSchema.index({ name: 'text', email: 'text' }, { weights: { name: 3, email: 2 } });
```

### 4.6 Sparse Indexes

Used for optional fields where only a subset of documents have the value:

| Collection   | Field          | Reason                            |
| ------------ | -------------- | --------------------------------- |
| users        | `phone`        | Not all users provide a phone     |
| users        | `deletedAt`    | Only deleted documents have value |
| payments     | `gatewayTransactionId` | Not all payments have gateway ref |
| uploads      | `url`          | URL may not be immediately available |

```javascript
// Example sparse index
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
```

### 4.7 Index Naming Convention

Indexes follow the pattern: `{field}_{direction}[_{field2}_{direction}]`

```javascript
// Auto-generated by Mongoose; explicit names for custom indexes
userSchema.index({ role: 1, isActive: 1 }, { name: 'role_1_isActive_1' });
```

---

## 5. Data Relationships

### 5.1 Entity Relationship Overview

```
User (1) ──────────→ (N) MembershipCycle
User (1) ──────────→ (N) Booking
User (1) ──────────→ (N) CheckIn
User (1) ──────────→ (N) Wallet (1:1, enforced by unique index)
User (1) ──────────→ (N) Order
User (1) ──────────→ (N) Notification
User (1) ──────────→ (N) AIConversation
User (1) ──────────→ (N) WorkoutPlan
User (1) ──────────→ (N) Schedule (as trainer)
User (1) ──────────→ (N) ProductReview

MembershipPlan (1) ─→ (N) MembershipCycle
MembershipCycle (1) ─→ (N) MembershipFreeze
MembershipCycle (1) ─→ (N) MembershipCancellationRequest

Booking (1) ────────→ (1) BookingSlot
Booking (1) ────────→ (1) Payment (optional)
Booking (1) ────────→ (1) CheckIn (optional)

Schedule (1) ───────→ (N) BookingSlot
Schedule (1) ───────→ (N) ScheduleException

Product (1) ────────→ (N) ProductVariant
Product (1) ────────→ (N) ProductReview

Order (1) ──────────→ (N) OrderItem
Order (1) ──────────→ (1) OrderTracking
Order (1) ──────────→ (1) Payment (optional)

Wallet (1) ─────────→ (N) WalletTransaction

Payment (1) ────────→ (N) PaymentTransaction
Payment (1) ────────→ (N) Refund (1 per refund request)

WorkoutPlan (1) ────→ (N) WorkoutExercise
WorkoutExercise (1) ─→ (N) WorkoutLog

AIConversation (1) ─→ (N) AIMessage
AIMessage (1) ──────→ (N) AIFeedback

Category (1) ───────→ (N) Product (via categoryId)
ContentCategory (1) ─→ (N) Content
```

### 5.2 Polymorphic References

Collections that reference multiple resource types use a dual-field pattern:

```javascript
{
  referenceType: { type: String, enum: ['Payment', 'Order', 'Refund'] },
  referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceType' }
}
```

Used in:
- `wallet_transactions` — links to payments, orders, refunds
- `uploads` — links to any resource that owns the file
- `audit_logs` — links to the affected resource

### 5.3 1:1 Relationships

Enforced via **unique indexes** on the foreign key field:

| Left        | Right              | FK Field    |
| ----------- | ------------------ | ----------- |
| User        | Wallet             | `userId`    |
| Booking     | BookingSlot        | `slotId`    |
| Order       | OrderTracking      | `orderId`   |
| User        | NotificationPreferences | `userId` |

### 5.4 Self-Referencing Relationships

Used for hierarchical structures:

- `categories.parentId` → `categories._id` (product categories tree)
- `content_categories.parentId` → `content_categories._id` (content categories tree)

---

## 6. Migrations Strategy

### 6.1 Migration Scripts

All migration scripts live in `/src/scripts/` and follow a strict naming convention:

```
/src/scripts/
├── 001_add_freezefields.js
├── 001_add_freezefields.rollback.js
├── 002_add_booking_violations.js
├── 002_add_booking_violations.rollback.js
├── 003_add_ai_embeddings.js
└── 003_add_ai_embeddings.rollback.js
```

Naming rules:
- Prefix with a zero-padded sequential number: `001_`, `002_`, `003_`, etc.
- Use snake_case descriptive name.
- Each migration has a paired `.rollback.js` file with the same number and name.
- Files are never renamed, deleted, or renumbered after being committed.

### 6.2 Migration Lifecycle

1. **Development** — Write both the forward and rollback scripts.
2. **Review** — Code review verifies both scripts are correct.
3. **Staging** — Run forward script; verify data integrity; run rollback; verify.
4. **Production** — Run forward script during maintenance window.

### 6.3 Execution

Migrations are **never auto-executed on server start**. They are run manually:

```bash
# Apply migration
node src/scripts/001_add_freezefields.js

# Rollback
node src/scripts/001_add_freezefields.rollback.js
```

### 6.4 Migration Logging

Every executed migration is recorded in the `migration_logs` collection:

| Field         | Type     | Notes                        |
| ------------- | -------- | ---------------------------- |
| name          | String   | Script filename              |
| number        | Number   | Sequential number            |
| direction     | String   | enum: up, down               |
| status        | String   | enum: running, completed, failed |
| executedBy    | String   | operator name                |
| executedAt    | Date     |                              |
| durationMs    | Number   |                              |
| errorMessage  | String   |                              |
| checksum      | String   | SHA-256 of script content    |

```javascript
// migration_logs schema (not stored in Mongoose models — raw MongoDB)
{
  name: '001_add_freezefields.js',
  number: 1,
  direction: 'up',
  status: 'completed',
  executedBy: 'devops-team',
  executedAt: ISODate('2026-07-20T10:00:00Z'),
  durationMs: 1234,
  checksum: 'a1b2c3d4e5f6...'
}
```

### 6.5 Migration Script Template

```javascript
// 001_add_freezefields.js
const { connect, disconnect } = require('../config/database');

async function up() {
  const db = await connect();
  const collection = db.collection('membership_cycles');

  await collection.updateMany(
    { maxFreezes: { $exists: false } },
    { $set: { maxFreezes: 3 } }
  );

  console.log('[001] Added maxFreezes field to membership_cycles');
  await disconnect();
}

up().catch((err) => {
  console.error('[001] Migration failed:', err);
  process.exit(1);
});
```

---

## 7. Backup Strategy

### 7.1 Backup Schedule

| Frequency   | Type        | Tool         | Retention      |
| ----------- | ----------- | ------------ | -------------- |
| Daily       | Full        | mongodump    | 7 days         |
| Weekly      | Full        | mongodump    | 4 weeks        |
| Monthly     | Full        | mongodump    | 3 months       |
| Continuous  | Transaction | Oplog        | 24 hours       |

### 7.2 Backup Commands

**Daily backup:**
```bash
mongodump \
  --uri="${MONGODB_URI}" \
  --out="s3://gympro-backups/daily/$(date +%Y-%m-%d)" \
  --gzip \
  --archive="gympro-$(date +%Y%m%d-%H%M%S).gz"
```

**Point-in-time recovery (oplog):**
```bash
mongodump \
  --uri="${MONGODB_URI}" \
  --oplog \
  --out="s3://gympro-backups/oplog/$(date +%Y-%m-%dT%H-%M-%S)" \
  --gzip
```

### 7.3 Retention Policy

| Backup Type | Retention            | Cleanup Rule        |
| ----------- | -------------------- | ------------------- |
| Daily       | 7 most recent        | Delete older than 7 days |
| Weekly      | 4 most recent         | Delete older than 28 days |
| Monthly     | 3 most recent         | Delete older than 90 days |
| Oplog       | 24-hour window        | Auto-purge by TTL   |

### 7.4 Recovery Procedure

1. **Identify target recovery time** — determine the point-in-time.
2. **Restore latest full backup** — from the appropriate retention tier.
3. **Replay oplog** — from the backup time to the target time:

```bash
mongorestore \
  --uri="${MONGODB_URI_RESTORE}" \
  --oplogReplay \
  --archive="gympro-backup.gz" \
  --gzip
```

4. **Verify data integrity** — run consistency checks.
5. **Update connection strings** — point applications to restored database.
6. **Notify stakeholders** — confirm recovery completion.

### 7.5 Storage

- All backups are stored in **cloud object storage** (S3-compatible).
- Backup path format:
  ```
  s3://gympro-backups/
    daily/2026-07-20/gympro-20260720-020000.gz
    weekly/2026-w29/gympro-20260720-020000.gz
    monthly/2026-07/gympro-20260720-020000.gz
    oplog/2026-07-20T02-00-00/gympro-oplog.gz
  ```
- Backups are **encrypted at rest** using server-side encryption (AES-256).
- Transfer is encrypted via TLS.

### 7.6 Monitoring & Alerts

- Backup success/failure is logged to `backup_records` collection.
- Failed backups trigger alerts via:
  - Email to devops team
  - Slack/PagerDuty webhook
  - System notification in admin dashboard
- Monthly restore drill is performed to validate backup integrity.

---

## Appendix A: Mongoose Schema Conventions

```javascript
const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema(
  {
    // Standard fields
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(STATUSES),
      default: STATUSES.ACTIVE,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Soft delete
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,          // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Soft-delete filter plugin
exampleSchema.pre('find', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  }
});

module.exports = mongoose.model('Example', exampleSchema);
```

## Appendix B: Mongoose 9 → 8 Migration Notes

| Area               | Mongoose 9                     | Mongoose 8 LTS                  |
| ------------------ | ------------------------------ | ------------------------------- |
| Query middleware   | Different execution order      | Restore to known behaviour      |
| TypeScript types   | Incompatible `HydratedDocument`| Stable generics                 |
| `save()` hooks     | `validateModifiedOnly` default | Explicit required               |
| `Model.create()`   | Returns single doc for array   | Returns array for array         |
| Schema `loadClass()` | Removed                      | Available                       |

**Migration plan:**
1. Pin `mongoose` to `^8.9.0` in `package.json`.
2. Update import paths if using deep imports.
3. Test all query middleware in integration tests.
4. Remove any Mongoose 9‑specific workarounds.

---

*This document is maintained by the GymPro engineering team. Updates require PR approval.*
