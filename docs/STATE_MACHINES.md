# State Machines — GymPro Gym Management System

This document defines every state machine in the system. Each machine is
described by its states, transitions (with trigger, guard, and action), invalid
transitions, and an ASCII diagram.

---

## 1. Membership Cycle State Machine

Manages the lifecycle of a member's subscription from purchase through
expiration, cancellation, and refund.

### States

| State              | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `PENDING_ACTIVATION` | Membership purchased but not yet active; waiting for first check-in or admin activation. |
| `ACTIVE`             | Membership is current; member can access the gym.                |
| `FROZEN`             | Membership temporarily paused at the member's request.           |
| `EXPIRED`            | Membership end date has passed; access revoked.                  |
| `CANCELLED`          | Membership terminated before its natural end date.              |
| `REFUNDED`           | Money returned to the member; membership is fully void.          |

### Transitions

| From                | To                  | Trigger                                       | Guard                                                       | Action                                                     |
| ------------------- | ------------------- | ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| `PENDING_ACTIVATION` | `ACTIVE`            | First check-in **OR** admin manually activates | Payment must be received (`payment_status = PAID`)          | Start membership period; record activation date            |
| `ACTIVE`            | `FROZEN`            | Member requests freeze                         | Max 2 freezes per cycle; max 30 total frozen days; min 7 days between freeze periods | Record freeze request; pause membership clock              |
| `FROZEN`            | `ACTIVE`            | Freeze period expires (automatic)              | None                                                        | Resume membership clock; extend end date by freeze days    |
| `ACTIVE`            | `EXPIRED`           | End date reached (cron job)                    | None                                                        | Revoke access; send expiry notification                    |
| `ACTIVE`            | `CANCELLED`         | Member requests + admin approves               | Refund policy determines amount (if any)                    | Calculate refund; revoke access; notify member             |
| `PENDING_ACTIVATION` | `CANCELLED`         | Member requests cancellation                   | Within 7 days of purchase (no admin needed)                 | Full refund (if paid); void membership                     |
| `CANCELLED`         | `REFUNDED`          | Admin processes refund                         | Refund policy applies; payment was collected                | Issue payment via gateway; record refund date              |
| `EXPIRED`           | `ACTIVE`            | Member purchases a renewal                     | New payment received                                       | Create new membership period; reactivate access            |

### Invalid Transitions

- `FROZEN → EXPIRED` (freeze pauses the clock; expiry cannot fire during freeze)
- `FROZEN → CANCELLED` (must unfreeze first, then cancel)
- `EXPIRED → FROZEN` (cannot freeze an already-expired membership)
- `EXPIRED → CANCELLED` (transition is redundant; expired is terminal for access)
- `CANCELLED → ACTIVE` (a new purchase creates a fresh membership)
- `REFUNDED → *` (terminal state)

### Diagram

```
                          ┌──────────────────────────────────────────┐
                          │                                          │
                          │  ┌──────────────────┐                    │
                          │  │                  │                    │
                          ▼  │                  │                    │
               ┌──────────────────────┐        │                    │
      ┌────────│  PENDING_ACTIVATION  │────────│───┐                │
      │        └──────────────────────┘        │   │                │
      │          │                             │   │                │
      │          │  first check-in /           │   │                │
      │          │  admin activation           │   │                │
      │          │  [payment received]         │   │                │
      │          ▼                             │   │                │
      │  ┌───────────┐     freeze request      │   │                │
      │  │           │──────────────────────┐  │   │                │
      │  │   ACTIVE  │                      │  │   │                │
      │  │           │◄─────────────────────│──┘   │                │
      │  └───────────┘     freeze ends       │      │                │
      │    │    │         (auto)             │      │                │
      │    │    │                            │      │                │
      │    │    │ end date      member       │      │ member        │
      │    │    │ reached     cancels +      │      │ cancels       │
      │    │    │ (cron)      admin approves │      │ (≤7 days)     │
      │    │    │            [refund policy] │      │                │
      │    │    ▼                            │      │                │
      │    │  ┌──────────┐                   │      │                │
      │    │  │  EXPIRED  │                   │      │                │
      │    │  └──────────┘                    │      │                │
      │    │    │                             │      │                │
      │    │    │ renewal purchase            │      │                │
      │    │    │ (new payment)               │      │                │
      │    │    ▼                             │      │                │
      │    │  ┌──────────┐                   │      │                │
      │    └─▶│  ACTIVE  │ (re-entry)        │      │                │
      │       └──────────┘                   │      │                │
      │                                      │      │                │
      │       ┌────────────┐                 │      │                │
      └──────▶│  CANCELLED  │◄────────────────┘      │                │
              └────────────┘                        │                │
                   │                                │                │
                   │ refund processed                │                │
                   │ [refund policy]                 │                │
                   ▼                                │                │
              ┌────────────┐                        │                │
              │  REFUNDED   │                        │                │
              └────────────┘                        │                │
                                                    │                │
              ┌───────────┐                         │                │
              │   FROZEN   │◄────────────────────────┘                │
              └───────────┘                                          │
                   │                                                 │
                   │ freeze ends (auto)                              │
                   ▼                                                 │
              ┌───────────┐                                          │
              │   ACTIVE   │─────────────────────────────────────────┘
              └───────────┘
```

---

## 2. Booking State Machine

Manages personal-training session bookings from creation through completion,
cancellation, or no-show.

### States

| State       | Description                                                         |
| ----------- | ------------------------------------------------------------------- |
| `PENDING`   | Booking created; awaiting confirmation (PT or payment).             |
| `CONFIRMED` | Slot locked; both parties committed.                                |
| `COMPLETED` | Session has taken place successfully.                               |
| `CANCELLED` | Session terminated before taking place.                             |
| `NOSHOW`    | Member did not attend and did not cancel within check-in window.    |

### Transitions

| From        | To           | Trigger                                    | Guard                                               | Action                                              |
| ----------- | ------------ | ------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| `PENDING`   | `CONFIRMED`  | PT confirms **OR** payment received         | Slot is available; no scheduling conflicts          | Lock slot; send confirmation to both parties        |
| `PENDING`   | `CANCELLED`  | Member cancels                              | ≥ 2h before session → free; < 2h → 50% penalty (BR-BKG-004) | Release slot; apply penalty if within 2h; notify PT |
| `PENDING`   | `CANCELLED`  | Admin cancels                               | Any time                                            | Release slot; notify both parties; full refund      |
| `CONFIRMED` | `COMPLETED`  | Session end time reached (automatic)        | None                                                 | Mark attendance; release slot; trigger billing      |
| `CONFIRMED` | `NOSHOW`     | Attendance not marked in check-in window    | Check-in window elapsed (cron)                      | Mark no-show; apply penalty to member; release slot |
| `CONFIRMED` | `CANCELLED`  | Member **or** PT cancels                    | ≥ 2h before session → free; < 2h → 50% penalty (BR-BKG-004) | Release slot; apply penalty if within 2h; notify other |
| `NOSHOW`    | `CANCELLED`  | No-show violation processed (automatic)     | None                                                 | Finalise penalty; archive record                    |

### Invalid Transitions

- `PENDING → COMPLETED` (must be confirmed first)
- `PENDING → NOSHOW` (no-show applies only to confirmed bookings)
- `CONFIRMED → PENDING` (irreversible; cancellation is the only way back)
- `COMPLETED → *` (terminal)
- `NOSHOW → CONFIRMED` (irreversible)
- `CANCELLED → *` (terminal)

### Diagram

```
              ┌──────────────────────────────────────────┐
              │                                          │
              │  ┌───────────────────────────────────┐   │
              │  │                                   │   │
              │  ▼                                   │   │
              ┌─────────┐                            │   │
     ┌───────│  PENDING  │                            │   │
     │       └─────────┘                            │   │
     │         │    │                               │   │
     │         │    │  PT confirms /                │   │
     │         │    │  payment received              │   │
     │         │    │  [slot available]             │   │
     │         │    ▼                               │   │
     │         │  ┌───────────┐                     │   │
     │         │  │ CONFIRMED  │                     │   │
     │         │  └───────────┘                     │   │
     │         │    │    │        │                  │   │
     │         │    │    │        │ session ends     │   │
     │         │    │    │        │ (auto)           │   │
     │         │    │    │        ▼                  │   │
     │         │    │    │   ┌───────────┐           │   │
     │         │    │    │   │ COMPLETED  │           │   │
     │         │    │    │   └───────────┘           │   │
     │         │    │    │                           │   │
     │         │    │    │ attendance not            │   │
     │         │    │    │ marked (cron)             │   │
     │         │    │    ▼                           │   │
     │         │    │  ┌─────────┐                   │   │
     │         │    │  │  NOSHOW  │                   │   │
     │         │    │  └─────────┘                   │   │
     │         │    │    │                           │   │
     │         │    │    │ violation processed       │   │
     │         │    │    ▼                           │   │
     │         │    │  ┌───────────┐                 │   │
     │         │    └─▶│ CANCELLED  │                │   │
     │         │       └───────────┘                 │   │
     │         │                                     │   │
     │         │  member / PT cancels                │   │
     │         │  [late → penalty]                   │   │
     │         └─────────────────────────────────────┘   │
     │                                                   │
     │  member cancels                                   │
     │  [free window]                                    │
     └───────────────────────────────────────────────────┘
```

---

## 3. Order State Machine

Manages merchandise / supplement orders from checkout through delivery, return,
and refund.

### States

| State       | Description                                                 |
| ----------- | ----------------------------------------------------------- |
| `PENDING`   | Order created; waiting for payment confirmation.            |
| `CONFIRMED` | Payment captured; awaiting fulfilment.                      |
| `SHIPPING`  | Package handed to carrier; in transit.                      |
| `DELIVERED` | Buyer has received the shipment.                            |
| `CANCELLED` | Order terminated before shipping (or after special case).   |
| `RETURNED`  | Buyer sent the item back.                                   |
| `REFUNDED`  | Money returned to the buyer.                                |

### Transitions

| From         | To           | Trigger                                     | Guard                                              | Action                                        |
| ------------ | ------------ | ------------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| `PENDING`    | `CONFIRMED`  | Payment received (webhook)                  | None                                                | Capture payment; notify seller to fulfil      |
| `PENDING`    | `CANCELLED`  | Payment timeout OR buyer cancels            | Payment not yet received                            | Release inventory; no charge                  |
| `CONFIRMED`  | `SHIPPING`   | Seller ships                                | Has GHN tracking code                               | Attach tracking; notify buyer                 |
| `CONFIRMED`  | `CANCELLED`  | Admin cancels                               | Not yet shipped                                     | Full refund; release inventory                |
| `SHIPPING`   | `DELIVERED`  | Buyer confirms delivery **OR** auto-confirm | 7 days elapsed since shipping (auto)                | Mark delivered; release payment to seller     |
| `DELIVERED`  | `RETURNED`   | Buyer requests return                       | Within 7 days of delivery                           | Provide return label; receive item            |
| `RETURNED`   | `REFUNDED`   | Admin processes refund                      | Item received and inspected                         | Issue refund via gateway; notify buyer        |

### Invalid Transitions

- `PENDING → SHIPPING` (must be confirmed first)
- `PENDING → DELIVERED` (skips fulfilment)
- `CONFIRMED → DELIVERED` (must ship first)
- `SHIPPING → CANCELLED` (already in transit; must wait for return flow)
- `DELIVERED → CANCELLED` (must use return → refund path)
- `REFUNDED → *` (terminal)
- `CANCELLED → *` (terminal, except refund if payment was already collected; see exception in policy)

### Diagram

```
              ┌──────────────────────────────────────────────────────┐
              │                                                      │
              │  ┌───────────────────────────────────────────────┐   │
              │  │                                               │   │
              │  ▼                                               │   │
              ┌─────────┐                                        │   │
     ┌───────│  PENDING  │────────────────────┐                  │   │
     │       └─────────┘                      │                  │   │
     │         │                              │                  │   │
     │         │ payment received             │                  │   │
     │         ▼                              │                  │   │
     │       ┌───────────┐                    │                  │   │
     │       │ CONFIRMED  │                    │                  │   │
     │       └───────────┘                    │                  │   │
     │         │          \                   │                  │   │
     │         │           \                  │                  │   │
     │         │ seller      \ admin cancels  │                  │   │
     │         │ ships        \ [not shipped] │                  │   │
     │         │ [GHN code]    \              │                  │   │
     │         │                \             │                  │   │
     │         ▼                 \            │                  │   │
     │       ┌───────────┐       └──┐         │                  │   │
     │       │  SHIPPING  │         │         │                  │   │
     │       └───────────┘         │         │                  │   │
     │         │                    │         │                  │   │
     │         │ buyer confirms     │         │                  │   │
     │         │ or auto (7d)      │         │                  │   │
     │         ▼                    │         │                  │   │
     │       ┌───────────┐         │         │                  │   │
     │       │ DELIVERED  │         │         │                  │   │
     │       └───────────┘         │         │                  │   │
     │         │                    │         │                  │   │
     │         │ return request    │         │                  │   │
     │         │ (within 7d)      │         │                  │   │
     │         ▼                    │         │                  │   │
     │       ┌───────────┐         │         │                  │   │
     │       │  RETURNED  │         │         │                  │   │
     │       └───────────┘         │         │                  │   │
     │         │                    │         │                  │   │
     │         │ admin refund       │         │                  │   │
     │         ▼                    │         │                  │   │
     │       ┌───────────┐         │         │                  │   │
     │       │  REFUNDED  │         │         │                  │   │
     │       └───────────┘         │         │                  │   │
     │                              │         │                  │   │
     │  payment timeout /           │         │                  │   │
     │  buyer cancels              │         │                  │   │
     └──────────────────────────────┘         │                  │   │
                                              │                  │   │
               ┌───────────┐                  │                  │   │
               │ CANCELLED  │◄─────────────────┘                  │   │
               └───────────┘                                     │   │
                                                                │   │
               ┌───────────┐                                     │   │
               │ CANCELLED  │◄────────────────────────────────────┘   │
               └───────────┘                                         │
                                                                     │
               ┌───────────┐                                         │
               │ CANCELLED  │◄────────────────────────────────────────┘
               └───────────┘
```

---

## 4. Payment State Machine

Tracks individual payment transactions from initiation through completion,
failure, or refund.

### States

| State             | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `INITIATED`       | Payment record created; gateway not yet called.                  |
| `PROCESSING`      | Request sent to gateway; awaiting response.                      |
| `COMPLETED`       | Gateway confirmed successful capture.                            |
| `FAILED`          | Gateway rejected or request timed out.                           |
| `REFUNDED`        | Full amount returned to the payer.                               |
| `PARTIAL_REFUND`  | Portion of the amount returned to the payer.                     |

### Transitions

| From          | To               | Trigger                        | Guard        | Action                                        |
| ------------- | ---------------- | ------------------------------ | ------------ | --------------------------------------------- |
| `INITIATED`   | `PROCESSING`     | Gateway API called             | None          | Lock amount; record gateway request ID        |
| `PROCESSING`  | `COMPLETED`      | Gateway success webhook        | Signature valid; idempotency key not replayed | Release funds; trigger order/membership activation |
| `PROCESSING`  | `FAILED`         | Gateway failure **OR** timeout | None          | Release hold; notify user; increment retry counter |
| `COMPLETED`   | `REFUNDED`       | Full refund processed          | Refund policy allows | Issue full refund via gateway; notify user    |
| `COMPLETED`   | `PARTIAL_REFUND` | Partial refund processed       | Refund policy allows | Issue partial refund; update ledgers; notify user |

### Invalid Transitions

- `INITIATED → COMPLETED` (must go through PROCESSING)
- `INITIATED → FAILED` (gateway must be called first)
- `FAILED → COMPLETED` (must re-initiate a new payment)
- `FAILED → REFUNDED` (nothing to refund)
- `REFUNDED → *` (terminal; partial refund may follow COMPLETED→PARTIAL_REFUND only)
- `PARTIAL_REFUND → REFUNDED` (allowed — follow-up full refund of remainder)
- `PROCESSING → PARTIAL_REFUND` (partial refund only valid on completed payments)

### Diagram

```
              ┌──────────────┐
              │              │
              ▼              │
        ┌───────────┐        │
        │ INITIATED  │        │
        └───────────┘        │
              │               │
              │ gateway       │
              │ API called    │
              ▼               │
        ┌────────────┐        │
        │ PROCESSING  │        │
        └────────────┘        │
          │       │           │
          │       │           │
          │       ▼           │
          │  ┌────────┐      │
          │  │ FAILED  │      │
          │  └────────┘      │
          │                   │
          ▼                   │
    ┌───────────┐             │
    │ COMPLETED  │             │
    └───────────┘             │
        │         \           │
        │          \          │
        │ full       \ partial│
        │ refund      \ refund│
        ▼             \       │
    ┌──────────┐      └──┐    │
    │ REFUNDED  │         │    │
    └──────────┘          │    │
                          │    │
                   ┌────────────────┐
                   │ PARTIAL_REFUND │
                   └────────────────┘
                              │
                          (may later
                           full refund
                           → REFUNDED)
```

---

## 5. Freeze State Machine

Manages individual freeze requests on a membership (a sub-machine of the
Membership Cycle).

### States

| State      | Description                                                     |
| ---------- | --------------------------------------------------------------- |
| `REQUESTED` | Member submitted freeze request; awaiting approval.             |
| `APPROVED`  | Request accepted; waiting for the freeze start date to arrive.  |
| `ACTIVE`    | Freeze is in effect; membership clock is paused.                |
| `EXPIRED`   | Freeze period has ended naturally.                              |
| `CANCELLED` | Freeze request or active freeze was terminated early.           |

### Transitions

| From        | To          | Trigger                               | Guard                 | Action                                    |
| ----------- | ----------- | ------------------------------------- | --------------------- | ----------------------------------------- |
| `REQUESTED` | `APPROVED`  | Admin **OR** system auto-approves     | Freeze policy valid   | Schedule freeze period; notify member     |
| `APPROVED`  | `ACTIVE`    | Freeze start date reached (automatic) | None                   | Pause membership clock; notify member     |
| `ACTIVE`    | `EXPIRED`   | Freeze end date reached (automatic)   | None                   | Resume membership clock; extend end date  |
| `ACTIVE`    | `CANCELLED` | Member cancels freeze early           | Min 1 day already frozen | Resume membership clock; adjust end date  |

### Invalid Transitions

- `REQUESTED → ACTIVE` (must be approved first)
- `REQUESTED → EXPIRED` (cannot skip approval and activation)
- `APPROVED → EXPIRED` (start date must be reached first)
- `APPROVED → CANCELLED` (admin may cancel before start; currently no rule — add if needed)
- `EXPIRED → *` (terminal)
- `CANCELLED → *` (terminal)

### Diagram

```
              ┌──────────────┐
              │              │
              ▼              │
        ┌───────────┐        │
        │ REQUESTED  │        │
        └───────────┘        │
              │               │
              │ admin /       │
              │ auto-approve  │
              │ [policy ok]   │
              ▼               │
        ┌───────────┐        │
        │  APPROVED  │        │
        └───────────┘        │
              │               │
              │ start date    │
              │ reached       │
              ▼               │
        ┌───────────┐        │
        │   ACTIVE   │────────│───┐
        └───────────┘        │   │
          │       │          │   │
          │       │          │   │
          │       │ member   │   │
          │       │ cancels  │   │
          │       │ [≥1 day] │   │
          │       ▼          │   │
          │  ┌───────────┐   │   │
          │  │ CANCELLED  │   │   │
          │  └───────────┘   │   │
          │                  │   │
          ▼                  │   │
    ┌───────────┐            │   │
    │  EXPIRED   │            │   │
    └───────────┘            │   │
                              │   │
                              └───┘
```

---

## 6. Notification State Machine

Tracks the delivery lifecycle of outbound notifications (email, SMS, in-app,
push).

### States

| State      | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `QUEUED`   | Notification created and enqueued for dispatch.                |
| `SENT`     | Handed to the provider (SendGrid, Twilio, Firebase, etc.).     |
| `DELIVERED` | Provider confirmed successful delivery to the device/inbox.   |
| `READ`     | Recipient opened / read the notification (tracked where possible). |
| `FAILED`   | Provider returned a permanent failure (bounce, invalid device). |

### Transitions

| From       | To           | Trigger                              | Guard         | Action                                    |
| ---------- | ------------ | ------------------------------------ | ------------- | ----------------------------------------- |
| `QUEUED`   | `SENT`       | Worker picks up and calls provider   | None           | Record provider message ID; log timestamp |
| `SENT`     | `DELIVERED`  | Provider delivery webhook            | Delivery receipt valid | Record delivery timestamp               |
| `SENT`     | `FAILED`     | Provider error / bounce webhook      | None           | Log error reason; schedule retry if applicable |
| `DELIVERED` | `READ`       | Read receipt (email open, push tap)  | Receipt valid  | Record read timestamp                     |
| `QUEUED`   | `FAILED`     | Queue TTL exceeded (cron)            | Max retries exhausted | Log dead-letter; alert ops                |

### Invalid Transitions

- `QUEUED → DELIVERED` (must be SENT first)
- `QUEUED → READ` (must be delivered first)
- `SENT → READ` (must be delivered first)
- `DELIVERED → SENT` (irreversible)
- `FAILED → *` (terminal unless retry logic re-queues — that creates a new record)
- `READ → *` (terminal)

### Diagram

```
              ┌──────────────────────────────────────────┐
              │                                          │
              ▼                                          │
        ┌─────────┐                                      │
        │  QUEUED  │──────────────────────┐              │
        └─────────┘                      │              │
              │                          │              │
              │ worker picks up          │ TTL expired  │
              │ calls provider           │ [retries     │
              ▼                          │  exhausted]  │
        ┌────────┐                       │              │
        │  SENT   │                       │              │
        └────────┘                       │              │
          │       \                      │              │
          │        \                     │              │
          │ provider \ provider          │              │
          │ success    \ error / bounce  │              │
          ▼             \                │              │
    ┌───────────┐       └──┐             │              │
    │ DELIVERED  │          │             │              │
    └───────────┘          │             │              │
          │                ▼             │              │
          │          ┌────────┐          │              │
          │          │ FAILED  │          │              │
          │          └────────┘          │              │
          │                              │              │
          │ read receipt                 │              │
          ▼                              │              │
        ┌──────┐                         │              │
        │ READ  │                         │              │
        └──────┘                         │              │
                                          │              │
                                          └──────────────┘
```

---

## Revision History

| Date       | Version | Author | Description                        |
| ---------- | ------- | ------ | ---------------------------------- |
| 2026-07-20 | 1.0     | —      | Initial version — all state machines defined |
