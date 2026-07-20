# IMPLEMENTATION_SEQUENCE — GymPro Dependency-Ordered Build Plan

> **Document Type:** Implementation Sequence
> **Version:** 1.0
> **Last Updated:** 2026-07-20
> **Status:** Active
> **Audience:** Development Team, AI Contributors
> **Parent Document:** [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md)
> **Depends On:** [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md), [BUSINESS_RULES.md](../BUSINESS_RULES.md), [STATE_MACHINES.md](../STATE_MACHINES.md), [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md), [DATABASE.md](../DATABASE.md), [API_STANDARDS.md](../API_STANDARDS.md)

---

## Table of Contents

1. [Purpose](#purpose)
2. [How to Use This Document](#how-to-use-this-document)
3. [Dependency Graph (ASCII)](#dependency-graph-ascii)
4. [Within-Sprint Implementation Order](#within-sprint-implementation-order)
   - [Sprint 0: Foundation](#sprint-0-foundation)
   - [Sprint 1: Identity](#sprint-1-identity)
   - [Sprint 2: Revenue](#sprint-2-revenue)
   - [Sprint 3: Scheduling](#sprint-3-scheduling)
   - [Sprint 4: Wellness](#sprint-4-wellness)
   - [Sprint 5: Commerce](#sprint-5-commerce)
   - [Sprint 6: Intelligence](#sprint-6-intelligence)
   - [Sprint 7: Production](#sprint-7-production)
5. [Cross-Sprint Dependencies](#cross-sprint-dependencies)
6. [Critical Path Analysis](#critical-path-analysis)
7. [Parallelization Opportunities](#parallelization-opportunities)

---

## Purpose

This document defines the **exact dependency-ordered implementation sequence** of every feature within and across sprints. It is the authoritative build order. No feature may be implemented before its dependencies are satisfied. No feature may be implemented in a different order without updating this document first.

**Rule:** Features are listed in the order they MUST be built. If feature B depends on feature A, A appears before B on this list. This rule applies both within a sprint and across sprints.

---

## How to Use This Document

1. Start from the [Dependency Graph](#dependency-graph-ascii) to understand the overall system topology.
2. For each sprint, consult the [Within-Sprint Implementation Order](#within-sprint-implementation-order) section to see the exact feature sequence.
3. Before implementing any feature, verify all its dependencies are satisfied (check [Cross-Sprint Dependencies](#cross-sprint-dependencies)).
4. Each feature entry includes:
   - **Rationale:** Why it must be built at this point in the sequence.
   - **Depends On:** What must exist before this can be built.
   - **Key Documents:** Documents that must be read before implementing.
   - **Key Rules:** Business rules (BR-xxx), state machines, permissions, and edge cases involved.
   - **Deliverables:** Tangible outputs (files, models, endpoints).

---

## Dependency Graph (ASCII)

```
                                SPRINT 0: FOUNDATION
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
         Repository           Environment              CI/CD
         Structure             Configs                Pipeline
         + .gitignore         + .env files           + GitHub Actions
         + README             + config modules       + build/lint/test
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     ▼
                                Shared Utils
                  (AppError, catchAsync, logger, validators, types)
                                     │
                                AI Core Setup
                    (Gemini config, provider chain, tool router skeleton)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 1: IDENTITY              │
                                     ▼
                            User Model + Schema
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
         JWT Utilities          Password Hashing        OTP Generation
      (sign, verify,            (bcrypt, compare)      (generate, verify,
       refresh rotation)                                 expiry)
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     ▼
                              Auth Routes
               (register, login, logout, refresh, forgot/reset password)
                                     │
                              OAuth Routes
                          (Google, Facebook via Passport.js)
                                     │
                            Auth Middleware
                 (protect, authorize, role guards — RBAC)
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
         User CRUD             Profile API            Role Assignment
      (list, search,           (update, avatar,       (super_admin only)
       admin manage)             change password)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 2: REVENUE               │
                                     ▼
                            Membership Plans
                     (CRUD, pricing, duration, trial config)
                                     │
                          Membership Cycles
            (create, activate, freeze, unfreeze, cancel, refund, expire)
                State machine: PENDING_ACTIVATION → ACTIVE → FROZEN
                         → EXPIRED → CANCELLED → REFUNDED
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
     Payment Gateway                            Wallet
     (VNPAY integration,                        (create, balance,
      Stripe integration,                        deposit, withdraw,
      webhook handlers,                          transfer, freeze)
      idempotency keys,
      signature verification)
              │                                             │
              └──────────────────────┬──────────────────────┘
                                     ▼
                            Transaction Ledger
                   (dual-entry, immutable, audit trail, reconciliation)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 3: SCHEDULING            │
                                     ▼
                            PT Management
              (trainer profiles, specializations, assignments, ratings)
                                     │
                         Schedule Management
          (availability slots, recurring patterns, exceptions/blocked time,
                        24h modification window for upcoming slots)
                                     │
                            Booking System
        (slot availability check with atomic reservation, PT confirmation
         flow with auto-confirm timer, cancellation with BR-BKG-004 penalty,
         waitlist with atomic promotion, recurring booking with truncation,
              violation tracking — late cancel + no-show)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 4: WELLNESS              │
                                     ▼
                             Workout Plans
         (plan templates, exercise library, custom workouts, progression)
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
     Nutrition Tracking                        Health Metrics
     (meal plans, daily logs,                 (body composition, measurements,
      macros, calories,                         vitals, goals, progress charts)
      food database)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 5: COMMERCE              │
                                     ▼
                            Product Catalog
              (CRUD, categories, variants/SKUs, pricing, images)
                                     │
                            Inventory System
          (stock tracking, reservation on add-to-cart, release on expiry,
                     low-stock alerts, batch management)
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
     Shop Frontend                             Seller System
     (cart management,                         (seller onboarding, product
      checkout flow with                        listing, order fulfillment,
      stock guard, GHN                          escrow-based payouts,
      shipping integration,                     sales dashboard,
      order tracking,                           settlement reports)
      return/refund workflow
      with 7-day window)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 6: INTELLIGENCE          │
                                     ▼
                            Check-in System
        (QR code generation with HMAC-signed payload, check-in validation
         with membership status check, auto-activation for pending memberships,
         streak tracking with consecutive-day logic, daily deduplication,
                       operating hours validation)
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     Dashboard                     Reports              Notification System
     (role-based views:            (revenue reports,     (state machine:
      member dashboard,             membership analytics,  QUEUED → SENT →
      PT dashboard,                 churn/retention,       DELIVERED → READ
      staff dashboard,              check-in statistics,   → FAILED,
      admin dashboard,              trainer performance,   email via Nodemailer,
      super_admin dashboard)        product sales,         SMS via Twilio/
                                     export to CSV/Excel)   SpeedSMS,
                                                            push via FCM,
                                                            in-app via Socket.io,
                                                            preference management,
                                                            batched delivery)
                                     │
     ════════════════════════════════╪════════════════════════════════
     SPRINT 7: PRODUCTION            │
                                     ▼
                            Security Hardening
     (Helmet middleware, rate limiting — auth 5/min, API 100/min, payment
      10/min, audit logging — all admin actions, CSRF protection for
      cookie-based refresh, CORS whitelist, PII encryption at rest,
                      input sanitization — XSS/NoSQL injection)
                                     │
                            Optimization
     (query optimization — .select(), .lean(), indexes, N+1 elimination,
      Redis caching layer, image optimization via Cloudinary transforms,
                bundle splitting, tree shaking, lazy loading)
                                     │
                            Production Deployment
     (Docker Compose production config — separate FE/BE containers, SSL/TLS
      via Let's Encrypt, CDN via Cloudinary, database backup automation,
      monitoring — API latency, error rates, DB query times, health check
      endpoints, blue-green deployment pipeline, rollback automation)
```

---

## Within-Sprint Implementation Order

### Sprint 0: Foundation

**Sprint Goal:** Establish the repository, environment, shared infrastructure, and CI/CD pipeline. No business features. Everything that follows depends on this sprint being complete and correct.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 0.1 | Repository structure + `.gitignore` + `README.md` | Physical directory layout must exist before any file can be created. `.gitignore` prevents secrets from being committed. | Nothing | [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) (folder structure) | None | `gym-backend/src/` directory tree, `gym-frontend/src/` directory tree, `.gitignore`, root `README.md` |
| 0.2 | Environment configuration | All external services (DB, Stripe, VNPAY, Cloudinary, etc.) need config. Environment variables are the single source of external dependency configuration. | 0.1 (repo must exist) | [DATABASE.md](../DATABASE.md) §1 (connection config), [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) (external integrations) | None | `.env.example`, `src/config/` module (development.ts, production.ts, index.ts) |
| 0.3 | Database connection + health check | Every subsequent sprint reads/writes to MongoDB. Connection must be verified. Health check enables monitoring. | 0.2 (env config must exist) | [DATABASE.md](../DATABASE.md) §1 (connection), [DATABASE_CONVENTIONS.md](../DATABASE_CONVENTIONS.md) | None | `db.ts` (connection with retry logic), `GET /health` endpoint |
| 0.4 | Express app skeleton | All feature routes mount on this app. Error handler, CORS, JSON parsing, cookie parsing are prerequisites for every endpoint. | 0.2 (env config) | [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) §2, [API_STANDARDS.md](../API_STANDARDS.md) | None | `app.ts` (Express app with middleware stack), `server.ts` (entry point), global error handler middleware |
| 0.5 | Shared utilities | Every sprint uses `AppError`, `catchAsync`, logger, validators. These must exist before any business logic is written. | 0.4 (Express skeleton) | [ERROR_HANDLING.md](../ERROR_HANDLING.md), [CODING_STANDARDS.md](../CODING_STANDARDS.md) | None | `utils/AppError.ts`, `utils/catchAsync.ts`, `utils/logger.ts`, `utils/apiFeatures.ts` (pagination, filter, sort), shared TypeScript types |
| 0.6 | CI/CD pipeline (GitHub Actions) | Automated build, lint, type-check, and test must run on every push. Prevents regressions from the first sprint onward. | 0.1 (repo structure) | [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) (CI section) | None | `.github/workflows/ci.yml` (build, lint, test matrix), `.github/workflows/deploy.yml` (staging) |
| 0.7 | AI Core setup | AI Assistant depends on LLM provider configuration and tool router skeleton. Setting up now avoids retrofitting later when the AI module is fully built. | 0.2 (env config for API keys), 0.5 (shared utilities) | [AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md), [AI_WORKFLOW.md](../AI_WORKFLOW.md), [docs/modules/ai-assistant.md](../modules/ai-assistant.md) | None | `config/ai.ts` (Gemini, fallback providers), `modules/ai/toolRouter.ts` (skeleton), provider chain config |

---

### Sprint 1: Identity

**Sprint Goal:** Establish user identity, authentication, and authorization. Every subsequent sprint's endpoints must be protected by auth middleware.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 1.1 | User model + schema validation | Every authenticated action references a user. Schema must match [DATABASE.md](../DATABASE.md) exactly. This is the most-referenced model. | S0 (DB connection, shared types) | [DATABASE.md](../DATABASE.md) §2.1 (users collection), [DATABASE_CONVENTIONS.md](../DATABASE_CONVENTIONS.md), [docs/modules/user-management.md](../modules/user-management.md) | PERMISSION_MATRIX roles: MEMBER, PT, STAFF, SELLER, ADMIN, SUPER_ADMIN | `models/User.ts` (Mongoose schema: name, email, passwordHash, phone, role, avatar, isActive, isVerified) |
| 1.2 | JWT utilities | All authentication depends on token sign/verify. Refresh rotation prevents token replay attacks. | 1.1 (User model for token payload) | ADR-003 (JWT decision), [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §11 (JWT rules) | BR-AUTH rules (token lifecycle) | `utils/jwt.ts` (signAccessToken, signRefreshToken, verifyToken, rotateRefreshToken) |
| 1.3 | Password hashing + OTP generation | Passwords must be bcrypt-hashed before storage. OTP enables password reset and 2FA flows. | 1.1 (User model) | [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §11 (secrets, sensitive data) | BR-AUTH rules (password requirements) | `utils/password.ts` (hashPassword, comparePassword), `utils/otp.ts` (generateOTP, verifyOTP, TTL) |
| 1.4 | Auth routes (register, login, logout, refresh, forgot/reset password) | Core authentication flow. Must be built before OAuth (OAuth reuses the same token issuance). | 1.2 (JWT utils), 1.3 (password + OTP) | [API_STANDARDS.md](../API_STANDARDS.md), [docs/modules/auth.md](../modules/auth.md), [ERROR_HANDLING.md](../ERROR_HANDLING.md) | BR-AUTH rules | `routes/auth.routes.ts`, `controllers/authController.ts`, `services/authService.ts` |
| 1.5 | OAuth routes (Google, Facebook) | Social login reduces signup friction. Passport.js strategies for Google and Facebook OAuth. | 1.4 (auth service for token issuance) | ADR-003, [docs/modules/auth.md](../modules/auth.md) (OAuth section) | BR-AUTH rules (OAuth flow) | `config/passport.ts` (Google + Facebook strategies), OAuth callback handlers in `controllers/authController.ts` |
| 1.6 | Auth middleware (protect, authorize, role guards) | Every protected endpoint must verify JWT and check permissions. This is the gatekeeper for all future sprints. | 1.2 (JWT verify), 1.1 (User model) | [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md), [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §11 (permissions) | All PERMISSION_MATRIX role checks | `middleware/auth.ts` (protect — verify JWT, attach req.user), `middleware/authorize.ts` (role guard — check req.user.role against allowed roles) |
| 1.7 | User CRUD (profile, list, search — admin) | User management is a prerequisite for admin operations in all future sprints (assigning members to PTs, managing seller accounts, etc.). | 1.6 (auth middleware), 1.1 (User model) | [API_STANDARDS.md](../API_STANDARDS.md), [docs/modules/user-management.md](../modules/user-management.md), [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) (User Management section) | BR-ADM rules (user management) | `routes/user.routes.ts`, `controllers/userController.ts`, `services/userService.ts` |
| 1.8 | Role assignment (super_admin only) | Roles control access across the entire system. Role assignment must be restricted to SUPER_ADMIN per PERMISSION_MATRIX. | 1.6 (auth middleware), 1.7 (user CRUD) | [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) (User Management — role change) | BR-ADM rules (role management), BR-AUD rules (audit logging for role changes) | `PATCH /api/v1/users/:id/role` endpoint with SUPER_ADMIN guard, audit log entry on role change |

---

### Sprint 2: Revenue

**Sprint Goal:** Implement membership lifecycle, payment processing, wallet, and transaction ledger. This is the revenue engine of the system.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 2.1 | Membership plan model + CRUD | Plans define what members can purchase. Must exist before membership cycles can be created. | S1 (auth middleware, user model) | [DATABASE.md](../DATABASE.md) §2 (membership plans), [docs/modules/membership.md](../modules/membership.md) | BR-MEM rules | `models/MembershipPlan.ts`, `routes/plan.routes.ts`, `controllers/planController.ts`, `services/planService.ts` |
| 2.2 | Membership cycle model | Core entity tracking each member's membership period. State machine backbone. | 2.1 (plans), S1 (user model) | [DATABASE.md](../DATABASE.md) §2 (membership_cycles), [STATE_MACHINES.md](../STATE_MACHINES.md) §1 (Membership Cycle), [MEMBERSHIP_SYSTEM_ARCHITECTURE.md](../MEMBERSHIP_SYSTEM_ARCHITECTURE.md) | BR-MEM-001 (one active), BR-MEM-002 (auto-activation), BR-MEM-003 through BR-MEM-008 | `models/MembershipCycle.ts` (status: pending_activation | active | frozen | expired | cancelled | refunded) |
| 2.3 | Membership lifecycle service (activate, freeze, unfreeze, cancel, refund, expire) | All membership state transitions with full guard checks. This is the most complex business logic in the system. | 2.2 (cycle model), 2.1 (plan model) | [STATE_MACHINES.md](../STATE_MACHINES.md) §1 (all transitions, invalid transitions), [BUSINESS_RULES.md](../BUSINESS_RULES.md) §1, [EDGE_CASES.md](../EDGE_CASES.md) §1 (EC-MEM-001 through EC-MEM-010) | BR-MEM-001 through BR-MEM-008, all state machine transitions, EC-MEM-001 (double refund), EC-MEM-002 (expire during freeze), EC-MEM-003 (orphan payment) | `services/membershipService.ts` (full lifecycle), `jobs/membershipExpiryCron.ts` (7/3/1 day reminders), `routes/membership.routes.ts` |
| 2.4 | Payment gateway integration (VNPAY + Stripe) | Revenue collection requires payment processing. Both VNPAY (domestic) and Stripe (international) must work. | 2.3 (membership for purchase flow), S1 (user model) | [DATABASE.md](../DATABASE.md) §2 (payments collection), [docs/modules/payment.md](../modules/payment.md), ADR-005 (VNPAY + Stripe) | BR-PAY-001 (atomic transactions), BR-PAY-002 (idempotency), BR-PAY-003 through BR-PAY-006, EC-PAY-001 through EC-PAY-006 | `services/paymentService.ts`, `services/vnpayService.ts`, `services/stripeService.ts`, `routes/payment.routes.ts`, `webhooks/paymentWebhook.ts` |
| 2.5 | Wallet system (balance, deposit, withdraw, transfer) | Members need stored value for bookings, shop purchases, penalties. Wallet is a prerequisite for all financial operations. | S1 (user model), 2.4 (payment for top-up) | [DATABASE.md](../DATABASE.md) §2 (wallets collection), [docs/modules/wallet.md](../modules/wallet.md) | BR-WAL-001 through BR-WAL-005, EC-WAL-001 through EC-WAL-005 | `models/Wallet.ts`, `services/walletService.ts`, `routes/wallet.routes.ts`, `controllers/walletController.ts` |
| 2.6 | Transaction ledger (dual-entry, immutable, audit-trail) | Every financial movement must be recorded with a counterpart. Enables reconciliation and prevents fraud. | 2.4 (payment), 2.5 (wallet) | [DATABASE.md](../DATABASE.md) §2 (transactions collection) | BR-AUD rules (audit trail), BR-PAY-005 (VND integers) | `models/Transaction.ts`, `services/ledgerService.ts`, atomic transaction wrapper for payment+wallet+ledger operations |

---

### Sprint 3: Scheduling

**Sprint Goal:** Implement PT management, schedule, and booking. This is the operational core of the gym.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 3.1 | PT management (profiles, specializations, assignments) | Trainers must exist before creating schedules or bookings. PT assignments link trainers to members. | S1 (user model — PT role) | [DATABASE.md](../DATABASE.md) §2 (pt_profiles collection), [docs/modules/trainer.md](../modules/trainer.md) | BR-PT-001 through BR-PT-006 | `models/PTProfile.ts`, `services/ptService.ts`, `routes/pt.routes.ts` |
| 3.2 | Schedule management (availability slots, recurring patterns, exceptions) | Slots define when PTs are bookable. Must exist before booking creation. 24h modification window for protection. | 3.1 (PT profiles) | [DATABASE.md](../DATABASE.md) §2 (schedule_slots collection), [docs/modules/schedule.md](../modules/schedule.md) | BR-PT rules (schedule constraints) | `models/ScheduleSlot.ts`, `services/scheduleService.ts`, `routes/schedule.routes.ts` |
| 3.3 | Booking system (availability check, create, PT confirmation, cancel, waitlist, recurring, violations) | The full booking lifecycle. Includes atomic slot reservation, PT confirm/reject with auto-confirm timer, cancellation penalty (BR-BKG-004 — 2h window), waitlist promotion, and violation tracking. | 3.2 (schedule slots), S2 (membership for BR-BKG-002, wallet for penalties) | [DATABASE.md](../DATABASE.md) §2 (bookings collection), [STATE_MACHINES.md](../STATE_MACHINES.md) §2 (Booking), [BUSINESS_RULES.md](../BUSINESS_RULES.md) §2, [docs/modules/booking.md](../modules/booking.md), [EDGE_CASES.md](../EDGE_CASES.md) §2 | BR-BKG-001 through BR-BKG-008, EC-BKG-001 (double booking), EC-BKG-002 through EC-BKG-008 | `models/Booking.ts`, `services/bookingService.ts`, `services/waitlistService.ts`, `jobs/autoConfirmBooking.ts`, `routes/booking.routes.ts` |

---

### Sprint 4: Wellness

**Sprint Goal:** Implement workout plans, nutrition tracking, and health metrics. Wellness features enhance member value.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 4.1 | Workout plans (templates, exercise library, custom workouts, progress logs) | Core wellness feature. Trainers assign plans; members log progress. | S1 (user model), S3 (PT assignments for trainer-linked plans) | [DATABASE.md](../DATABASE.md) §2 (workout_plans, exercises, workout_logs), [docs/modules/workout.md](../modules/workout.md) | PERMISSION_MATRIX (Workout section) | `models/WorkoutPlan.ts`, `models/Exercise.ts`, `models/WorkoutLog.ts`, `services/workoutService.ts`, `routes/workout.routes.ts` |
| 4.2 | Nutrition tracking (meal plans, daily logs, macros, calories) | Members log nutrition; trainers provide meal plans. | 4.1 (builds on workout ecosystem), S1 (user model) | [DATABASE.md](../DATABASE.md) §2 (nutrition_logs, meal_plans), [docs/modules/ai-assistant.md](../modules/ai-assistant.md) (nutrition queries) | PERMISSION_MATRIX (Nutrition section) | `models/MealPlan.ts`, `models/NutritionLog.ts`, `services/nutritionService.ts`, `routes/nutrition.routes.ts` |
| 4.3 | Health metrics (body composition, measurements, vitals, goals, progress) | Tracks member health data over time. PII — special privacy requirements. | S1 (user model) | [DATABASE.md](../DATABASE.md) §2 (health_metrics), [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §11 (sensitive data protection) | PERMISSION_MATRIX (Health section), BR-AUD rules (audit logging for health data access) | `models/HealthMetric.ts`, `services/healthService.ts`, `routes/health.routes.ts` |

---

### Sprint 5: Commerce

**Sprint Goal:** Implement product catalog, inventory, shop, orders, and seller payout system with escrow.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 5.1 | Product catalog (CRUD, categories, variants/SKUs, pricing, images) | Products must exist before they can be sold. Categories organize the catalog. Variants handle size/color/etc. | S1 (auth middleware), S0 (shared utils) | [DATABASE.md](../DATABASE.md) §2 (products collection), [docs/modules/product.md](../modules/product.md) | BR-SHP rules | `models/Product.ts`, `models/Category.ts`, `services/productService.ts`, `routes/product.routes.ts` |
| 5.2 | Inventory system (stock tracking, reservation on add-to-cart, release on expiry, alerts) | Stock management prevents overselling. Reservation holds stock during checkout. | 5.1 (products) | [DATABASE.md](../DATABASE.md) §2 (inventory collection), [EDGE_CASES.md](../EDGE_CASES.md) §6 (EC-SHP-001 double purchase) | BR-SHP rules, EC-SHP-001 | `models/Inventory.ts`, `services/inventoryService.ts` (atomic stock deduction, reservation with TTL), `jobs/inventoryReleaseCron.ts` |
| 5.3 | Shop (cart, checkout, orders, GHN shipping, return/refund) | The purchasing flow. Cart → checkout with stock guard → order creation → GHN shipping → return/refund with 7-day window. | 5.2 (inventory), S2 (payment, wallet for checkout) | [DATABASE.md](../DATABASE.md) §2 (orders collection), [docs/modules/shop.md](../modules/shop.md), [docs/modules/order.md](../modules/order.md), ADR-009 (GHN), [STATE_MACHINES.md](../STATE_MACHINES.md) (order state machine) | BR-SHP rules, EC-SHP-001 through EC-SHP-007, order state machine transitions | `models/Cart.ts`, `models/Order.ts`, `services/shopService.ts`, `services/ghnService.ts`, `routes/shop.routes.ts`, `webhooks/ghnWebhook.ts` |
| 5.4 | Seller system (onboarding, product listing, fulfillment, escrow payouts, dashboard) | Sellers manage their own products and orders. Escrow-based payments protect buyers and sellers. | 5.3 (orders), S2 (wallet for escrow/payouts), S1 (SELLER role) | [DATABASE.md](../DATABASE.md) §2 (sellers collection), [docs/modules/shop.md](../modules/shop.md) (seller section) | BR-SHP rules (seller payouts), PERMISSION_MATRIX (SELLER role) | `models/Seller.ts`, `services/sellerService.ts`, `services/escrowService.ts`, `routes/seller.routes.ts` |

---

### Sprint 6: Intelligence

**Sprint Goal:** Implement check-in, dashboards, reports, and notification system. Data from all prior modules surfaces here.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 6.1 | Check-in system (QR generation with HMAC, check-in with membership validation, auto-activation for pending, streak tracking, daily deduplication, operating hours) | Core gym operations. QR code enables self-service check-in. Streaks gamify attendance. Membership validation prevents unauthorized access. | S2 (membership for validation), S1 (user model) | [DATABASE.md](../DATABASE.md) §2 (check_ins collection), [docs/modules/checkin.md](../modules/checkin.md), [EDGE_CASES.md](../EDGE_CASES.md) §3 (EC-CHK-001 through EC-CHK-006) | BR-CHK-001 through BR-CHK-006, EC-CHK-001 through EC-CHK-006 | `models/CheckIn.ts`, `services/checkinService.ts`, `services/qrService.ts`, `services/streakService.ts`, `routes/checkin.routes.ts` |
| 6.2 | Dashboard (role-based: member, PT, staff, admin, super_admin) | Different roles see different data. Aggregates data from membership, booking, check-in, payment, and shop modules. | S1–S5 (data from all modules) | [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) (Dashboard section), [docs/modules/report.md](../modules/report.md) | PERMISSION_MATRIX (role-based view restrictions) | `services/dashboardService.ts` (aggregation queries per role), `routes/dashboard.routes.ts` |
| 6.3 | Reports (revenue, membership analytics, churn/retention, check-in statistics, trainer performance, product sales, CSV/Excel export) | Financial compliance requires accurate reports. Export enables offline analysis. | S2 (payment + membership data), S3 (booking data), S5 (shop data), S6.1 (check-in data) | [docs/modules/report.md](../modules/report.md) | BR-AUD rules (financial reporting compliance) | `services/reportService.ts`, `services/exportService.ts` (CSV/Excel), `routes/report.routes.ts` |
| 6.4 | Notification system (state machine: QUEUED → SENT → DELIVERED → READ → FAILED, email/Nodemailer, SMS/Twilio+SpeedSMS, push/FCM, in-app/Socket.io, preferences, batching) | All modules need notifications. Must support multiple channels and per-user preferences. | S1 (user model for preferences), all prior modules (notification triggers) | [DATABASE.md](../DATABASE.md) §2 (notifications collection), [STATE_MACHINES.md](../STATE_MACHINES.md) (notification state machine), [docs/modules/notification.md](../modules/notification.md) | BR-NTF-001 through BR-NTF-003, notification state machine | `models/Notification.ts`, `services/notificationService.ts`, `services/emailService.ts`, `services/smsService.ts`, `services/pushService.ts`, `jobs/notificationBatcher.ts`, `routes/notification.routes.ts`, Socket.io event handlers |

---

### Sprint 7: Production

**Sprint Goal:** Harden security, optimize performance, and deploy to production.

| # | Feature | Rationale | Depends On | Key Documents | Key Rules | Deliverables |
|---|---|---|---|---|---|---|
| 7.1 | Security hardening (Helmet, rate limiting, audit logging, CSRF, CORS, PII encryption, input sanitization) | All features must be secured before production. Rate limits prevent abuse. Audit logs provide traceability. | S0–S6 (all endpoints must exist to be secured) | [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §11 (full security rules), [ERROR_HANDLING.md](../ERROR_HANDLING.md) | All BR-AUD rules (audit logging), security rules from Constitution §11 | `middleware/helmetConfig.ts`, `middleware/rateLimiter.ts` (auth 5/min, API 100/min, payment 10/min), `middleware/auditLog.ts`, `middleware/csrf.ts`, `middleware/corsConfig.ts`, `utils/sanitizer.ts` |
| 7.2 | Performance optimization (query optimization, Redis caching, image optimization, bundle splitting, lazy loading) | Must meet performance targets (p95 < 500ms) before production. N+1 queries eliminated. Redis caching for hot data. | S0–S6 (all queries exist to be optimized) | [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) §12 (performance rules), [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) | Performance targets from Constitution §1 | `utils/cache.ts` (Redis client), `.select()` + `.lean()` on all read queries, Cloudinary transform URLs, `React.lazy()` + `Suspense` for route-level components, Vite code-splitting config |
| 7.3 | Production deployment (Docker Compose, SSL/TLS, CDN, monitoring, backup, blue-green deploy, rollback) | Final production readiness. Docker containers for FE/BE. SSL via Let's Encrypt. CDN via Cloudinary. Monitoring dashboards. Automated backups. | 7.1 (security), 7.2 (performance) | [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md), [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) §2 | EC-SYS-001 through EC-SYS-007 | `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf` (SSL), `scripts/backup.sh`, `scripts/deploy.sh`, `scripts/rollback.sh`, Prometheus/Grafana configs |

---

## Cross-Sprint Dependencies

Each sprint explicitly declares what it depends on from prior sprints.

### Sprint 1 depends on Sprint 0 for:

| Dependency | From Sprint 0 Feature | Required By Sprint 1 For |
|---|---|---|
| MongoDB connection | 0.3 (DB connection) | User model persistence, session storage for refresh tokens |
| Environment config | 0.2 (env configuration) | JWT_SECRET, DB_URI, OAuth client IDs/secrets |
| AppError, catchAsync, logger | 0.5 (shared utilities) | Standardized error handling in auth controllers, structured logging in auth service |
| Express app skeleton + error handler | 0.4 (Express skeleton) | Mounting auth routes, global error formatting |
| Shared TypeScript types | 0.5 (shared utilities) | User role enum, token payload interface |

### Sprint 2 depends on Sprint 1 for:

| Dependency | From Sprint 1 Feature | Required By Sprint 2 For |
|---|---|---|
| User model (MEMBER, ADMIN roles) | 1.1 (User model) | Membership ownership (`memberId` foreign key), admin management of plans and refunds |
| Auth middleware (protect, authorize) | 1.6 (auth middleware) | Protecting all membership, payment, and wallet endpoints |
| JWT token with user role | 1.2 (JWT utilities) | Identifying the authenticated user for payment attribution and wallet access |
| Role guards | 1.6 (authorize middleware) | Restricting plan management to ADMIN, refunds to ADMIN/SUPER_ADMIN |

### Sprint 3 depends on Sprint 2 for:

| Dependency | From Sprint 2 Feature | Required By Sprint 3 For |
|---|---|---|
| Active membership check | 2.3 (membership lifecycle) | BR-BKG-002: "Member must have active membership to book" |
| Payment gateway | 2.4 (payment integration) | Charging for PT sessions, processing cancellation penalties |
| Wallet (balance deduction) | 2.5 (wallet system) | Deducting booking fees, penalty charges (BR-BKG-004: 50% penalty < 2h) |
| Transaction ledger | 2.6 (transaction ledger) | Recording all booking-related financial movements |

### Sprint 4 depends on Sprint 1 + Sprint 3 for:

| Dependency | From Sprint | Required By Sprint 4 For |
|---|---|---|
| User model (profile data) | S1 (Identity) | Linking workout plans, nutrition logs, and health metrics to members |
| PT assignments | S3 (Scheduling) | Trainer-assigned workout plans, trainer review of member progress |
| Schedule access | S3 (Scheduling) | Scheduling workout sessions aligned with booked PT slots |

### Sprint 5 depends on Sprint 2 + Sprint 0 for:

| Dependency | From Sprint | Required By Sprint 5 For |
|---|---|---|
| Payment gateway (Stripe, VNPAY) | S2 (Revenue) | Checkout payment processing for shop orders |
| Wallet (balance, escrow) | S2 (Revenue) | Wallet-based purchases, escrow holding for seller payouts |
| Transaction ledger | S2 (Revenue) | Recording shop transactions, seller payouts |
| Auth middleware | S1 (Identity) | Protecting shop, product, inventory, and seller endpoints |
| Shared utilities (AppError, catchAsync, logger) | S0 (Foundation) | Error handling, logging in all commerce services |
| SELLER role | S1 (Identity) | Seller-specific endpoints and dashboard access |

### Sprint 6 depends on Sprint 1 through Sprint 5 for:

| Dependency | From Sprint | Required By Sprint 6 For |
|---|---|---|
| User model (profile, roles) | S1 (Identity) | Check-in identification, role-based dashboard views, notification recipients |
| Membership (active check) | S2 (Revenue) | BR-CHK-001: check-in validates active membership; BR-CHK-002: auto-activate pending membership |
| Payment data | S2 (Revenue) | Revenue reports, financial dashboards |
| Booking data | S3 (Scheduling) | Check-in verification against bookings, trainer performance reports |
| Workout/health data | S4 (Wellness) | Member wellness dashboards, progress reports |
| Shop/order data | S5 (Commerce) | Product sales reports, seller dashboards |

### Sprint 7 depends on Sprint 0 through Sprint 6 for:

| Dependency | From Sprint | Required By Sprint 7 For |
|---|---|---|
| All API endpoints | S1–S6 | Rate limiting, audit logging, CSRF protection target all endpoints |
| All database queries | S0–S6 | Query optimization targets all slow queries regardless of module |
| All frontend components | S1–S6 | Bundle splitting, lazy loading, image optimization apply to all pages |
| All configuration | S0–S6 | Production Docker Compose, nginx SSL config, monitoring targets all services |
| All features | S0–S6 | Blue-green deployment requires all features to be tested and stable |

---

## Critical Path Analysis

The **critical path** determines the minimum timeline. Any delay on the critical path delays the entire project.

```
S0  ──►  S1  ──►  S2  ──►  S3  ──►  S6  ──►  S7
                           │
                           └──►  S4 (parallel after S3)
                 S2  ──►  S5 (parallel after S2)

Critical Path:     S0 → S1 → S2 → S3 → S6 → S7  =  14 weeks
Non-Critical:      S4 (starts after S3 completes, 2 weeks — fits within S6 window)
                   S5 (starts after S2 completes, 2 weeks — fits within S3+S6 window)
```

**Longest sequential chain:** S0 (2w) + S1 (2w) + S2 (3w) + S3 (3w) + S6 (2w) + S7 (2w) = **14 weeks minimum** assuming zero delays.

---

## Parallelization Opportunities

While sprints are sequential, within a sprint there are limited parallelization opportunities:

### Sprint 0 Parallel Work

| Parallel Group | Features |
|---|---|
| Group A (can start together after 0.1) | 0.2 (env config), 0.6 (CI/CD pipeline) |
| Group B (can start after 0.2 + 0.4) | 0.5 (shared utilities), 0.7 (AI Core setup) |

### Sprint 1 Parallel Work

| Parallel Group | Features |
|---|---|
| Group A (can start after 1.1) | 1.2 (JWT utils), 1.3 (password + OTP) |
| Group B (can start after 1.4 + 1.6) | 1.5 (OAuth routes), 1.7 (user CRUD) |

### Sprint 2 Parallel Work

| Parallel Group | Features |
|---|---|
| Group A (after 2.2) | 2.4 (payment gateway), 2.5 (wallet) — these are independent of each other |
| Group B (after 2.4 + 2.5) | 2.6 (transaction ledger) — depends on both |

### Sprint 6 Parallel Work

| Parallel Group | Features |
|---|---|
| Group A (after 6.1) | 6.2 (dashboard), 6.3 (reports), 6.4 (notifications) — all three are independent |

**Note:** Parallel work within a sprint requires coordination to avoid merge conflicts on shared models and services. All parallel tracks must merge and pass integration tests before the sprint is considered complete.

---

## File Modification Order (Per Feature)

When implementing any single feature, follow this exact file modification order per [AI_CODING_CONSTITUTION.md Part 6 Section 1 File Modification Rules](../AI_CODING_CONSTITUTION.md#file-modification-rules):

1. **Types/Interfaces** — Define the shape of data (e.g., `types/membership.ts`)
2. **Models** — Mongoose schema matching [DATABASE.md](../DATABASE.md) (e.g., `models/MembershipCycle.ts`)
3. **Services** — Business logic, state machine guards, validation (e.g., `services/membershipService.ts`)
4. **Controllers** — Thin request handlers calling services (e.g., `controllers/membershipController.ts`)
5. **Routes** — Endpoint definitions with middleware (e.g., `routes/membership.routes.ts`)
6. **Tests** — Unit, integration, business rule, permission tests (e.g., `__tests__/membership.test.ts`)
7. **Documentation** — Update [DATABASE.md](../DATABASE.md), [API_STANDARDS.md](../API_STANDARDS.md), [BUSINESS_RULES.md](../BUSINESS_RULES.md), [EDGE_CASES.md](../EDGE_CASES.md), [docs/modules/](../modules/) as needed per the Documentation Update Matrix in [AI_CODING_CONSTITUTION.md Part 13](../AI_CODING_CONSTITUTION.md#part-13-documentation-update-matrix).
