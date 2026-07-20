# GymPro Gym Management System — Business Blueprint

> **Version:** 1.0.0  
> **Status:** Active  
> **Maintainer:** Product & Engineering  
> **This document is the SINGLE SOURCE OF TRUTH for all business logic.**  
> Any code, rule, or workflow that contradicts this blueprint must be corrected to align with it.

---

## Table of Contents

1. [Business Domain Overview](#1-business-domain-overview)
2. [Business Objectives](#2-business-objectives)
3. [Role Definitions](#3-role-definitions)
4. [Core Business Processes](#4-core-business-processes)
5. [Revenue Streams](#5-revenue-streams)
6. [Business Constraints](#6-business-constraints)
7. [Key Business Rules Summary](#7-key-business-rules-summary)
8. [Cross-Module Dependencies](#8-cross-module-dependencies)
9. [Glossary of Business Terms](#9-glossary-of-business-terms)

---

## 1. Business Domain Overview

GymPro is a full-stack gym management system that digitalizes all operational, financial, and member-facing workflows of a modern fitness center. The system serves **seven distinct roles**: Guest, Member, PT (Personal Trainer), Staff, Seller, Admin, and Super Admin.

### Core Modules

| Module       | Responsibility |
|--------------|---------------|
| **Membership**  | Plan definitions, purchases, activation, renewal, freeze, cancellation, lifecycle tracking |
| **Booking**     | PT session booking, availability management, waitlist, cancellation, attendance |
| **Check-in**    | QR-based entry, membership verification, auto-activation, streak tracking |
| **Workout**     | Workout plan creation, assignment, progress tracking, exercise library |
| **Schedule**    | PT availability, time slots, session calendar, conflict detection |
| **Payment**     | Transaction processing, idempotent operations, refunds, payment gateway integration |
| **Wallet**      | Member wallets, top-up, deductions, escrow holds, balance queries |
| **Shop**        | Product catalog, inventory, cart, orders, shipping integration (GHN) |
| **Product**     | Product CRUD, variants, pricing, stock management |
| **Notification**| Email, SMS, in-app push, template management, event-driven dispatch |
| **Report**      | Dashboards, financial reports, member analytics, revenue summaries, exports |
| **Content**     | CMS pages, banners, announcements, blog posts, SEO metadata |
| **Auth**        | Authentication, authorization (RBAC), session management, OAuth, MFA |
| **AI**          | Conversational AI assistant (Gemini 2.5 Flash) — membership queries, booking help, nutrition advice, exercise guidance, policy questions, chitchat. Uses RAG + tool calling + trusted search |

---

## 2. Business Objectives

### 2.1 Zero Revenue Leakage
Every membership purchase, booking fee, shop order, and wallet transaction must be accounted for. No operation that generates a financial obligation may proceed without a corresponding payment or wallet deduction. All payment flows are idempotent — duplicate requests produce exactly one charge.

### 2.2 No-Show Elimination
A three-layer deterrent system eliminates no-shows:
- **Cancellation policies** with tiered deadlines (2h free, penalty within 2h)
- **Waitlist auto-promotion** to fill vacated PT slots
- **Penalty scoring** with escalating consequences (warning → fee → booking suspension)

### 2.3 Member Retention
Retention is driven through positive reinforcement:
- **Streak tracking** rewards consecutive check-ins
- **Health progress dashboards** visualize member improvement
- **Engagement notifications** triggered by inactivity, milestones, or plan expirations

### 2.4 Staff Efficiency
Staff workflows are optimized for speed:
- **QR check-in** sub-second entry validation
- **Bulk operations** for member registration, membership activation, and plan renewals
- **Automated renewal** with wallet auto-debit and pre-expiry reminders

### 2.5 Financial Integrity
All money movement follows strict guarantees:
- **Atomic wallet transactions** — debit or credit never partially succeeds
- **Idempotent payments** — retry-safe with idempotency keys
- **Full transaction audit trail** — every financial event is immutable and traceable
- **Seller escrow** — shop revenue held until delivery confirmation, then released

---

## 3. Role Definitions

### 3.1 Guest

| Attribute | Value |
|-----------|-------|
| **Purpose** | Unauthenticated visitor exploring the gym's offerings |
| **Responsibilities** | Browse public pages, register a new account |
| **Permissions** | Read public content only |
| **Accessible Modules** | Content (public pages), Auth (register/login) |
| **Hidden Modules** | All dashboards, all management interfaces |
| **Business Actions** | Register account, log in, view public site |

### 3.2 Member

| Attribute | Value |
|-----------|-------|
| **Purpose** | Core consumer of gym services — workouts, PT, shop |
| **Responsibilities** | Manage own profile, purchase plans, book PT, check in, shop, use wallet |
| **Permissions** | Read/Write on own data only |
| **Accessible Modules** | Membership (own), Booking (own), Check-in, Workout (own), Schedule (view public), Payment (own), Wallet (own), Shop, Product (view), Notification (own), Content (public) |
| **Hidden Modules** | Other members' data, admin functions, reports, user management, financial dashboards |
| **Business Actions** | Purchase membership, book PT session, check in, create workout log, place shop order, view own wallet, cancel own booking, freeze membership, view own reports |

### 3.3 PT (Personal Trainer)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Fitness professional delivering training services to assigned members |
| **Responsibilities** | Manage own schedule, view assigned members' training data, confirm/reject bookings, create workout plans |
| **Permissions** | Read/Write on own schedule and workout plans; Read on assigned members' training data |
| **Accessible Modules** | Booking (own sessions), Schedule (own), Workout (own + assigned), Member (read training profile only), Notification (own) |
| **Hidden Modules** | Payments, Memberships, Shop, Product, Wallet, Report (financial), Admin, other PTs' assignments |
| **Business Actions** | Set availability, confirm/reject booking, create workout plan, view assigned member progress, update session status |

### 3.4 Staff

| Attribute | Value |
|-----------|-------|
| **Purpose** | Front-desk and operational personnel handling daily gym operations |
| **Responsibilities** | Check-in members, search member records, register new members, view payments |
| **Permissions** | Read/Write on check-in; Read on member search and payments |
| **Accessible Modules** | Check-in, Member (search, create), Payment (read-only), Notification (own) |
| **Hidden Modules** | Admin functions, user management, financial dashboards, shop management, membership plan editing, reports |
| **Business Actions** | Scan QR check-in, manually check in member, register new member, search member by name/phone, view payment history, process walk-in registration |

### 3.5 Seller

| Attribute | Value |
|-----------|-------|
| **Purpose** | Third-party or in-house vendor selling products through the gym shop |
| **Responsibilities** | Manage own shop, products, orders; track own revenue |
| **Permissions** | Read/Write on own shop, products, and orders; Read on own revenue |
| **Accessible Modules** | Shop (own), Product (own), Order (own), Wallet (own revenue view), Notification (own) |
| **Hidden Modules** | Other sellers' data, memberships, member data, admin functions, financial dashboards (global) |
| **Business Actions** | Create/edit products, manage inventory, fulfill orders, view revenue reports, update order status |

### 3.6 Admin

| Attribute | Value |
|-----------|-------|
| **Purpose** | Day-to-day system administrator managing operations and non-financial configuration |
| **Responsibilities** | User management (non-super, non-admin), content management, operational reports, financial dashboards (read-only) |
| **Permissions** | Read/Write on all non-financial modules; Read on financial dashboards |
| **Accessible Modules** | All modules except Super Admin–exclusive |
| **Hidden Modules** | Super Admin configuration, system logs, Super Admin user management |
| **Business Actions** | Manage users (members, PTs, staff, sellers), create/edit content, view financial dashboards, manage membership plans, manage product catalog, process refund approvals, view reports |

### 3.7 Super Admin

| Attribute | Value |
|-----------|-------|
| **Purpose** | System owner with absolute access for configuration, audit, and governance |
| **Responsibilities** | Full system oversight, all actions, all modules |
| **Permissions** | Read/Write on everything |
| **Accessible Modules** | All modules |
| **Hidden Modules** | None |
| **Business Actions** | All actions across all modules, manage admins, system configuration, audit log review, financial reconciliation, AI model configuration |

---

## 4. Core Business Processes

### 4.1 Membership Purchase → Payment → Activation → Check-in

A member selects a membership plan, initiates purchase, and completes payment (via gateway or wallet). Upon successful payment, the membership enters Pending Activation status. The member's first check-in triggers activation — the membership cycle begins, the streak counter starts, and a welcome notification is dispatched. Subsequent check-ins verify active membership status and continue streak tracking. Expiration leads to a grace period, then auto-suspend if not renewed.

### 4.2 Booking → Confirmation → Payment → Attendance → Completion → Review

A member browses available PT time slots and requests a booking. PT confirmation (auto or manual per PT preference) triggers payment (booking fee or session package deduction). The booked slot is locked in the schedule. On the session date, the member checks in and the session is marked Attended. The PT marks the session Complete after delivery. Both parties may submit a review. Missed sessions (no-show) incur a penalty per the cancellation policy.

### 4.3 Check-in → Membership Verification → Auto-Activation → Streak Update → Notification

At the gym entrance, the member scans a QR code. The system verifies the member has an active or pending membership. If Pending Activation, the membership is activated immediately (cycle start date recorded). The daily streak counter increments (consecutive check-in days). A check-in notification is sent to the member. Failed check-in (no active membership, expired, or frozen) shows a clear rejection reason with upsell/renewal prompt.

### 4.4 Order → Payment → Inventory Reservation → Shipping → Delivery → Escrow Release → Payout

A member browses the shop, adds products to cart, and places an order. Upon payment, inventory is reserved (reducing available stock). The order enters Processing status. The seller prepares the package and updates status to Shipped with tracking via GHN integration. On delivery confirmation (GHN webhook), the order is marked Delivered. Escrowed funds are released from the wallet hold to the seller's available balance. A payout notification is sent to the seller.

### 4.5 Cancellation → Policy Validation → Admin Review → Refund Calculation → Processing → Notification

A cancellation request is submitted (member for booking; admin for membership). The system validates against the applicable cancellation policy (timing, penalty tiers, refund eligibility). For bookings, cancellation within the free window is instant with full refund; late cancellation incurs a fee with partial refund. For memberships, an admin review determines refund type (full for unactivated within 7 days, prorated for activated). The refund amount is calculated, processed through the payment gateway or wallet credit, and a notification is dispatched to all affected parties.

---

## 5. Revenue Streams

| Stream | Description | Recognition Point | Platform Economics |
|--------|------------|-------------------|-------------------|
| **Membership Plans** | Core revenue — monthly, quarterly, annual plans with tiered pricing | Payment confirmation; first check-in activates | 100% to gym |
| **PT Session Fees** | Per-session billing or session package purchase | Booking confirmation or session attendance | 100% to gym |
| **Shop Product Sales** | Product sales by sellers through the gym shop | Delivery confirmation (escrow release) | Platform fee: **2%** of sale; 98% to seller |
| **Late Cancellation Fees** | Penalty fees charged for no-shows and late cancellations | Fee assessed on missed/cancelled booking | 100% to gym |
| **Future: Class Pass** | Planned — pay-per-class bundles | Purchase confirmation | TBD |

---

## 6. Business Constraints

| Constraint | Rule | Enforcement Point |
|-----------|------|------------------|
| **Active Membership Limit** | A member may have at most **1 membership in active, pending_activation, or frozen status** at any given time. Expired, cancelled, or refunded memberships are excluded. | Membership purchase, activation |
| **Pending Renewal Cycles** | Max **3 pending renewal cycles** per member (concurrent renewals awaiting payment) | Renewal initiation |
| **Booking Window** | Bookings permitted max **30 days ahead** from current date | Booking creation |
| **PT Max Assignments** | A PT may have at most **10 active member assignments** | PT–member assignment |
| **PT Daily Sessions** | A PT may conduct max **8 sessions per day** | Slot booking, schedule creation |
| **Refund — Unactivated** | Full refund within **7 days** of purchase if membership not yet activated | Admin refund processing |
| **Refund — Activated** | Prorated refund only; requires **admin approval** | Admin refund processing |
| **Freeze Limit** | Max **2 freeze requests per membership cycle** | Freeze initiation |
| **Freeze Duration** | Max **30 days per freeze** | Freeze initiation |
| **Minimum Check-in Age** | Member must be at least **12 years old** for check-in | Check-in, registration |

---

## 7. Key Business Rules Summary

This section provides a high-level catalog of business rules. For the complete, detailed rule definitions (including formulas, conditions, and edge cases), refer to **[BUSINESS_RULES.md](./BUSINESS_RULES.md)**.

| Rule ID | Name | Summary |
|---------|------|---------|
| BR-MEM-001 | One Active Membership | At most 1 membership in active, pending_activation, or frozen status at any time |
| BR-MEM-002 | Auto-Activation | Pending membership activates on first check-in or after payment received |
| BR-MEM-003 | Renewal Queue Limit | Max 3 pending renewal cycles per member |
| BR-MEM-004 | Freeze Limits | Max 2 freezes per cycle, max 30 days per freeze, min 7 days between freezes |
| BR-MEM-005 | Cancellation Approval | Admin approval required if membership was activated; auto-cancel if pending |
| BR-MEM-006 | Refund Calculation | Full refund if unactivated within 7 days; prorated if activated; no refund after 50% consumed |
| BR-MEM-007 | Expiry Notifications | Automated notifications sent 7, 3, and 1 day before expiry |
| BR-MEM-008 | Trial Period Rules | No PT booking during trial; max 3 check-ins; one trial per lifetime |
| BR-BKG-001 | Booking Window | Max 30 days ahead |
| BR-BKG-002 | Active Membership Required | Member must have active or pending membership to book |
| BR-BKG-003 | One Booking Per Slot | Max 1 booking per slot per PT per time; prevents double-booking |
| BR-BKG-004 | Cancellation Refund | Free cancellation up to 2h before session; 50% penalty within 2h of session |
| BR-BKG-005 | No-Show Penalty | 1 violation point per no-show; 3 violations in 90 days → booking suspended 30 days |
| BR-BKG-006 | PT Confirmation | PT has 1 hour to confirm/reject booking; auto-confirm on timeout |
| BR-BKG-007 | Recurring Booking Rules | Max 4 weeks, same day-of-week/time, membership must cover all dates |
| BR-PT-001 | Max Member Assignments | Max 10 active member assignments per PT |
| BR-PT-002 | Daily Session Cap | Max 8 sessions per PT per day |
| BR-PT-003 | Self-Booking Prohibited | PT cannot book a session with themselves |
| BR-PT-004 | Schedule Modification | PT can modify own schedule with min 24h advance notice |
| BR-CHK-001 | QR Code Required | QR token with HMAC signature; 30-second expiry; single-use per day |
| BR-CHK-002 | Auto-Activation on Check-in | First check-in activates a pending membership cycle |
| BR-CHK-003 | Streak Tracking | Consecutive calendar days only; resets to 0 on missed day |
| BR-CHK-004 | Daily Check-in Limit | Once per membership per calendar day |
| BR-CHK-005 | Gym Operating Hours | Check-in only during published operating hours per branch |
| BR-PAY-001 | Atomic Transactions | All financial operations (wallet + order/membership) in single DB transaction |
| BR-PAY-002 | Payment Idempotency | Idempotency key (UUID) required; deduplicate within 24 hours |
| BR-PAY-003 | Refund to Original Method | Refund goes back to original payment method or wallet as fallback |
| BR-PAY-004 | Gateway Timeouts | VNPAY: 15 minutes; Stripe: 30 minutes |
| BR-PAY-005 | Minimum Payment | Minimum 1,000 VND per transaction |
| BR-WAL-001 | Non-Negative Balance | Wallet balance must never go negative |
| BR-WAL-002 | Withdrawal Verification | Identity verification required; max 10M VND/transaction, 50M VND/month |
| BR-WAL-003 | Immutable Transactions | All wallet transactions append-only; corrections via offsetting entries |
| BR-WAL-004 | Dual-Entry Bookkeeping | Every transaction records both debit and credit ledger entries |
| BR-SHP-001 | Inventory Reservation | Stock reserved on order creation; released on cancel/timeout (30 min) |
| BR-SHP-002 | Platform Fee | 2% of product price, displayed as separate line item |
| BR-SHP-003 | Seller Escrow | Funds held until delivery confirmed; release after 7-day dispute window |
| BR-SHP-004 | Return Window | 7 calendar days from delivery confirmation for returns |

---

## 8. Cross-Module Dependencies

```
                    ┌─────────────────────────────────────────────────────┐
                    │                    Notification                     │
                    │  (listens to every module — event-driven dispatch)  │
                    └──┬──────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┬────────────────┐
        ▼              ▼              ▼              ▼                │
┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐             │
│   Auth    │──▶   All    │  │Schedule  │  │ Workout  │             │
│           │   │ Modules  │  │          │  │          │             │
└───────────┘   └──────────┘  └────┬─────┘  └────┬─────┘             │
                                   │             │                    │
                                   ▼             │              ┌─────┴──────┐
                            ┌───────────┐        │              │  Booking   │
                            │  Check-in │◀───────┼──────────────│            │
                            │           │        │              │  Requires  │
                            └─────┬─────┘        │              │  PT, Sched │
                                  │               │              │  Pay, Walle│
                                  ▼               │              │  Member    │
                            ┌───────────┐        │              └─────┬──────┘
                            │Membership │◀───────┼────────────────────┘
                            │           │        │
                            │ Requires  │        │
                            │ Pay, Wall │        │
                            │ Chk-in,   │        │
                            │ Book      │        │
                            └─────┬─────┘        │
                                  │               │
                                  ▼               ▼
                            ┌───────────────────────────┐
                            │         Payment           │
                            │                           │
                            │  Requires Wallet,         │
                            │  updates Membership,      │
                            │  Booking, Shop            │
                            └─────┬─────────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    ▼             ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │  Wallet  │  │   Shop   │  │ Product  │
              │          │  │          │  │          │
              │ Payouts  │  │ Requires │  │Used by   │
              │ to Seller│  │ Pay,     │  │Shop only │
              └──────────┘  │ Prod,    │  └──────────┘
                            │ Shipping │
                            │ (GHN),   │
                            │ Wallet   │
                            └──────────┘
```

### Dependency Summary

| Source Module | Depends On | Nature of Dependency |
|--------------|-----------|---------------------|
| **Auth** | — | All modules depend on Auth for authentication and authorization |
| **Membership** | Payment, Wallet, Check-in, Booking | Purchase requires payment; activation via check-in; freeze affects bookings |
| **Booking** | PT, Schedule, Payment, Wallet, Membership | PT availability in schedule; payment on confirmation; wallet for refunds; membership check for eligibility |
| **Check-in** | Membership, Booking, Schedule | Validates active membership; updates booking attendance; checks PT schedule |
| **Payment** | Wallet, Membership, Booking, Shop | Deducts from or credits wallet; updates membership status; settles bookings; processes shop orders |
| **Wallet** | Payment, Shop | Receives top-ups from payment; holds escrow for shop; disburses payouts |
| **Shop** | Product, Payment, Shipping (GHN), Wallet | Lists products; processes payments; integrates GHN for tracking; uses wallet for seller escrow |
| **Workout** | PT, Member, Schedule | PT assigns to members; scheduled sessions reference workout plans |
| **Schedule** | PT, Booking, Check-in | PT sets availability; bookings occupy slots; check-in confirms session start |
| **Notification** | Every module | Listens to all domain events and dispatches appropriate notifications |

---

## 9. Glossary of Business Terms

| Term | Definition |
|------|-----------|
| **Membership Cycle** | The active period of a membership from activation date to expiration date. One cycle = one purchased term. |
| **Pending Activation** | Status of a newly purchased membership that has not yet been activated via first check-in. Payment has been received. |
| **Free Trial** | A limited-time, zero-cost membership granting full gym access for a predefined period (typically 3–7 days). Converts to paid plan on expiry or first check-in. |
| **Prorated Refund** | A refund calculated as (remaining days / total cycle days) × paid amount, minus applicable fees. Used for activated membership cancellations. |
| **Escrow** | A holding mechanism in the seller's wallet where funds from a shop order are locked until delivery is confirmed by the shipping carrier (GHN). |
| **Streak** | The count of consecutive days a member has checked in. A missed day resets the streak to zero unless a valid freeze or gym holiday applies. |
| **Violation Penalty** | A sanction applied when a member or PT violates gym policies (no-show, late cancel, conduct). Escalates from warning → fee → temporary suspension. |
| **Idempotency Key** | A unique string sent with each payment request to ensure that retrying a failed request does not result in duplicate charges. The system deduplicates by key. |
| **Grace Period** | The number of days after membership expiry during which the member may still check in. Default: 7 days. After grace period, membership is suspended. |
| **Auto-Activation** | The process by which a Pending Activation membership becomes Active upon the member's first QR check-in. |
| **Platform Fee** | A 2% fee deducted from each shop order's gross amount at escrow release. Represents the gym's commission on seller transactions. |
| **Waitlist** | A queue of members requesting a PT slot that is currently booked. When the slot opens (via cancellation), the first waitlisted member is auto-promoted with a 2-hour confirmation window. |
| **Booking Window** | The maximum future date (30 days from today) for which a PT session booking can be created. |
| **Freeze** | A temporary pause of a membership during which the member cannot check in. The membership expiry date extends by the freeze duration. Max 2 per cycle, 30 days each. |
| **Renewal Queue** | A list of pending renewal attempts for a membership. When auto-renewal fails (insufficient wallet balance, expired card), the renewal is queued and retried. Max 3 pending at once. |
| **QR Token** | A time-limited (30-second), single-use Quick Response code generated at check-in time. Contains encrypted member ID and timestamp. |
| **Bulk Registration** | A staff workflow allowing multiple new members to be registered simultaneously via CSV import or batch form, with optional plan assignment. |
| **Seller Payout** | The release of escrowed funds to the seller's available wallet balance, triggered by delivery confirmation (GHN webhook). |
| **Check-in Verification** | The process of validating a member's QR token, membership status, age, and freeze status at the gym entrance before granting access. |
| **Session Package** | A prepaid bundle of PT sessions (e.g., 5-pack, 10-pack) purchased upfront and consumed one session at a time. |
| **Cash Walk-in** | A non-member who pays a one-time fee at the front desk for single-session gym access. Processed by staff; no membership created. |
| **Auto-Renewal** | An opt-in setting that triggers automatic payment (via saved wallet or payment method) on the membership expiration date to start a new cycle. |
| **RBAC** | Role-Based Access Control — the authorization model that maps each role to permitted actions and modules as defined in Section 3. |
