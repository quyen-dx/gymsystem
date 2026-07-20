# GymPro Gym Management System — System Architecture

> **Document Version:** 1.0
> **Last Updated:** 2026-07-20
> **Audience:** Developers, Technical Leads, Infrastructure Engineers

---

## 1. Architecture Style

| Aspect | Choice |
|--------|--------|
| Repository | **Monorepo** — two top-level applications under one root |
| Frontend | React 19 + TypeScript + Vite 8 (SPA) |
| Backend | Express 5 (Node.js) RESTful API |
| Real-time | Socket.io 4 (bidirectional event emission) |
| Database | MongoDB (Atlas primary + local fallback) |
| API Style | RESTful with JSON responses |
| ODM | Mongoose 9 |
| Auth | JWT (access + refresh tokens) + Passport.js (social OAuth) |
| Payment | Stripe + VNPAY |
| Containerization | Docker (separate Dockerfiles for FE/BE) |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  CLIENT LAYER (React 19 + Vite 8)                │
│                                                                  │
│   Pages → Components → Hooks → Context → Services (Axios)       │
│                         ↓ HTTP / WebSocket                       │
├──────────────────────────────────────────────────────────────────┤
│                  API GATEWAY (Express 5)                         │
│                                                                  │
│   CORS → Cookie Parser → Helmet → Session → Passport → Router   │
│                         ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│                  SERVICE LAYER                                   │
│                                                                  │
│   Controllers → Services → MongoDB Models (Mongoose)            │
│                         ↓                                       │
├──────────────────────────────────────────────────────────────────┤
│              EXTERNAL INTEGRATIONS                               │
│                                                                  │
│   Stripe │ VNPAY │ Cloudinary │ GHN │ Nodemailer │ Twilio       │
│   Google OAuth │ Facebook OAuth │ SpeedSMS                       │
└──────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Client Layer** | React SPA. Renders UI, manages client state (React Query, Context), handles auth token lifecycle, establishes Socket.io connection. Calls backend via Axios. |
| **API Gateway** | Single Express entry point. Applies cross-cutting concerns: CORS (whitelist origins), Helmet (security headers), cookie parsing, session management, Passport initialization, maintenance mode guard. Routes requests to controllers. |
| **Service Layer** | Business logic lives here. Controllers are thin — they parse the request and delegate to services. Services encapsulate domain rules, orchestrate multiple models, and interact with external APIs. Models define Mongoose schemas with validation, indexes, and virtuals. |
| **External Integrations** | Every external dependency is abstracted behind a service module. No direct API calls from controllers or models. This includes payment gateways, shipping, cloud storage, email/SMS, and OAuth providers. |

---

## 3. Folder Structure

### 3.1 Backend (`gym-backend/`)

```
gym-backend/
├── server.js                          # Entry point — Express app, middleware stack,
│                                      #   route mounting, cron scheduling, HTTP server
│                                      #   startup, DB connection
├── Dockerfile
├── package.json
├── .env / .env.production.example
│
└── src/
    ├── config/                        # Application configuration modules
    │   ├── db.js                      #   MongoDB connection (Atlas + local fallback)
    │   ├── passport.js                #   Google + Facebook OAuth strategies
    │   ├── cloudinary.js              #   Multer + Cloudinary storage engine
    │   ├── appUrls.js                 #   Client/backend URL resolution
    │   ├── systemSettingsDefaults.js  #   Default feature flags & system values
    │   └── specializationGoals.js     #   PT specialization goal mappings
    │
    ├── models/                        # Mongoose schemas (64 collections)
    │   ├── User.js                    #   Users, roles, auth, profile
    │   ├── Membership.js              #   Membership container (status, plan ref)
    │   ├── MembershipCycle.js         #   SSOT for activation, expiry, refund eligibility
    │   ├── MembershipPeriod.js        #   Legacy period model (being replaced by Cycle)
    │   ├── MembershipRegistration.js  #   Registration records
    │   ├── MembershipRenewal.js       #   Renewal records
    │   ├── MembershipCancellationRequest.js
    │   ├── Plan.js                    #   Subscription plans & pricing
    │   ├── PlanFeature.js            #   Plan→feature mapping
    │   ├── PlanChangeHistory.js      #   Audit log for plan changes
    │   ├── Payment.js                #   Payment transactions
    │   ├── Wallet.js                 #   User wallet balances
    │   ├── Transaction.js            #   Wallet transaction log
    │   ├── Order.js                  #   Product orders
    │   ├── Product.js                #   Store products
    │   ├── Shop.js                   #   Seller shops
    │   ├── Shipping.js               #   Shipping records
    │   ├── Booking.js                #   PT booking sessions
    │   ├── PT.js                     #   Personal trainer profiles
    │   ├── PTAssignment.js           #   Member↔PT assignment
    │   ├── PTAssignmentEndRequest.js #   PT assignment termination requests
    │   ├── PTReview.js               #   PT rating & review
    │   ├── PTSchedule.js             #   PT availability schedule
    │   ├── TrainerSchedule.js        #   Trainer shift schedules
    │   ├── TrainerReplacementRequest.js
    │   ├── TrainingClass.js          #   Training class definitions
    │   ├── TrainingAssignment.js     #   Member→class assignments
    │   ├── TrainingGroup.js          #   Group training sessions
    │   ├── TrainingRequest.js        #   Training enrollment requests
    │   ├── CheckIn.js                #   Daily check-in records
    │   ├── DailyQRCode.js            #   QR code generation for check-in
    │   ├── Class.js                  #   Class definitions
    │   ├── ClassEnrollment.js        #   Class enrollment records
    │   ├── GroupClass.js             #   Group class sessions
    │   ├── Workout.js                #   Workout plans & sessions
    │   ├── WorkoutSchedule.js        #   Scheduled workouts
    │   ├── WorkoutReport.js          #   Workout progress reports
    │   ├── WorkoutImprovementRequest.js
    │   ├── Floor.js                  #   Gym floor definitions
    │   ├── Zone.js                   #   Zone/area definitions
    │   ├── Notification.js           #   In-app notifications
    │   ├── Address.js                #   User addresses
    │   ├── AuditLog.js               #   Admin audit trail
    │   ├── DiscountCode.js           #   Promotional codes
    │   ├── RefundRequest.js          #   Refund requests
    │   ├── ShiftSwapRequest.js       #   Staff shift swap requests
    │   ├── ShiftSwapItem.js          #   Individual shift swap items
    │   ├── ScheduleOverride.js       #   Schedule exception overrides
    │   ├── Feedback.js               #   User feedback
    │   ├── SessionFeedback.js        #   Session-specific feedback
    │   ├── Faq.js                    #   FAQ entries
    │   ├── Policy.js                 #   System policies
    │   ├── PolicyConsent.js          #   User→policy consent records
    │   ├── PartnershipRequest.js     #   Partnership inquiries
    │   ├── HealthLog.js              #   Member health tracking logs
    │   ├── UserActivity.js           #   User activity logs
    │   ├── SystemSettings.js         #   Dynamic feature flags & settings
    │   ├── LandingContent.js         #   Public landing page content
    │   ├── Otp.js                    #   OTP records (TTL-indexed)
    │   ├── Specialization.js         #   PT specialization tags
    │   ├── Waitlist.js               #   Class waitlist
    │   ├── MembershipCycle.js        #   (duplicated ref — membership cycles)
    │   │
    │   │   # ── Dead AI models ──
    │   ├── AiChatHistory.js          #   UNUSED — legacy AI chat storage
    │   ├── AiUserMemory.js           #   UNUSED — legacy AI user context
    │   └── VectorDocument.js         #   UNUSED — legacy vector embeddings
    │
    ├── controllers/                  # Request handlers (thin — parse, delegate, respond)
    │   ├── authController.js         #   41 action handlers (login, register, OTP, OAuth,
    │   │                             #     password reset, email change, seller mode, admin)
    │   ├── memberController.js       #   Member CRUD & management
    │   ├── membershipController.js   #   Subscription, renewal, plan change
    │   ├── bookingController.js      #   PT booking CRUD
    │   ├── ptController.js           #   PT profile & listing
    │   ├── ptAssignmentController.js
    │   ├── ptAssignmentEndController.js
    │   ├── walletController.js       #   Wallet operations + Stripe webhook
    │   ├── orderController.js        #   Order lifecycle
    │   ├── productController.js      #   Product CRUD
    │   ├── shopController.js         #   Shop management
    │   ├── planController.js         #   Plan CRUD
    │   ├── planFeatureController.js
    │   ├── planChangeController.js
    │   ├── checkInController.js
    │   ├── dailyQRCodeController.js
    │   ├── workoutController.js
    │   ├── workoutReportController.js
    │   ├── workoutImprovementController.js
    │   ├── notificationController.js
    │   ├── addressController.js
    │   ├── auditLogController.js
    │   ├── cancellationController.js
    │   ├── refundRequestController.js
    │   ├── floorZoneController.js
    │   ├── scheduleController.js
    │   ├── shiftSwapController.js
    │   ├── trainerScheduleController.js
    │   ├── trainerReplacementController.js
    │   ├── trainingClassController.js
    │   ├── trainingAssignmentController.js
    │   ├── trainingGroupController.js
    │   ├── trainingRequestController.js
    │   ├── groupClassController.js
    │   ├── memberController.js
    │   ├── partnershipRequestController.js
    │   ├── systemExperienceController.js
    │   ├── systemSettingsController.js
    │   ├── specializationController.js
    │   ├── healthController.js
    │   ├── policyConsentController.js
    │   └── reportController.js
    │
    ├── services/                     # Business logic & external integrations
    │   ├── membershipService.js      #   Core subscription logic
    │   ├── membershipCycleService.js #   Activation, benefit marking
    │   ├── walletService.js          #   Wallet transactions
    │   ├── bookingService.js         #   Booking orchestration
    │   ├── ptService.js              #   PT availability & assignment
    │   ├── ptAssignmentService.js
    │   ├── orderService.js           #   Order processing
    │   ├── productService.js         #   Product queries
    │   ├── planService.js            #   Plan queries
    │   ├── notificationService.js    #   In-app notification dispatch
    │   ├── socketService.js          #   Socket.io init + event emitters
    │   ├── emailService.js           #   Nodemailer integration
    │   ├── smsService.js             #   Twilio/SpeedSMS integration
    │   ├── otpService.js             #   OTP generation, hashing, verification
    │   ├── ghnService.js             #   GHN shipping API client
    │   ├── vnpayService.js           #   VNPAY payment gateway
    │   ├── checkInService.js
    │   ├── classEnrollmentService.js
    │   ├── addressService.js
    │   ├── auditLogService.js
    │   ├── floorZoneService.js
    │   ├── refundRequestService.js
    │   ├── shiftSwapService.js
    │   ├── systemSettingsService.js
    │   ├── trainerScheduleService.js
    │   ├── trainerReplacementService.js
    │   ├── trainingAssignmentService.js
    │   ├── trainingClassService.js
    │   ├── trainingGroupService.js
    │   ├── trainingRequestService.js
    │   ├── userActivityService.js
    │   ├── membershipCycleService.js
    │   ├── membershipService.js
    │   └── toolRegistry.js           #   AI tool registration & dispatch
    │
    ├── modules/                      # AI tool definitions (11 domains)
    │   ├── booking/
    │   │   ├── tool.js               #   AI tool handler for booking domain
    │   │   └── ai.json               #   LLM tool manifest
    │   ├── challenge/
    │   ├── checkin/
    │   ├── diet/
    │   ├── faq/
    │   ├── knowledge/
    │   ├── membership/
    │   ├── nutrition/
    │   ├── product/
    │   ├── pt/
    │   └── workout/
    │
    ├── middlewares/                   # Express middleware
    │   ├── authMiddleware.js          #   JWT verification, role-based authorization
    │   ├── maintenanceMiddleware.js   #   Maintenance mode guard
    │   ├── systemSettingsMiddleware.js
    │   └── productOwnershipMiddleware.js
    │
    ├── routes/                       # Express route definitions (40 route files)
    │   ├── authRoutes.js             #   18 auth endpoints
    │   ├── membershipRoutes.js
    │   ├── bookingRoutes.js
    │   ├── planRoutes.js
    │   ├── walletRoutes.js
    │   ├── workoutRoutes.js
    │   ├── ... (one per resource)
    │   └── cmsRoutes.js              #   CMS content routes
    │
    ├── jobs/                         # Cron scheduled jobs
    │   ├── activateRenewalCyclesJob.js  # Auto-activate pending renewal cycles
    │   └── refundReminderJob.js         # Expire refund eligibility after 7 days
    │
    ├── utils/                        # Helpers & error utilities
    │   ├── generateToken.js          #   JWT access, refresh, reset token generation
    │   ├── appError.js               #   Custom error class with code & status
    │   ├── sendError.js              #   Unified error response formatter
    │   ├── identifier.js             #   Email/phone normalization & validation
    │   ├── memberIdentity.js         #   Member identity normalization
    │   ├── dateUtils.js
    │   ├── featureCheck.js
    │   └── policyConsent.js
    │
    └── scripts/                      # Migration & maintenance scripts
        ├── migrateMemberIdsToShortFormat.js
        ├── normalizeSpecializations.js
        ├── backfillPTAssignments.js
        ├── migrateClassEnrollments.js
        ├── migrateRestoreForceEndedSchedules.js
        ├── cleanupDupPTAssignments.js
        ├── seedPlans.js
        ├── seedPlanFeatures.js
        ├── seedSpecializations.js
        ├── fixMemberCodes.js
        ├── fixPeriodDates.js
        ├── fixWorkoutScheduleClassCodes.js
        ├── upgradeSuperAdmin.js
        ├── dbCheck.js
        ├── auditMemberCodes.js
        ├── verifyCountFix.js
        ├── migrateNotifications.js
        ├── migratePlansToFeatures.js
        └── diagnoseClassCodes.js
```

### 3.2 Frontend (`gym-frontend/`)

```
gym-frontend/
├── index.html                        # SPA entry HTML
├── vite.config.ts                    # Vite build configuration
├── tailwind.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── Dockerfile
├── package.json
├── .env / .env.development / .env.production
│
└── src/
    ├── main.tsx                      # React root — BrowserRouter, providers (Auth,
    │                                 #   Wallet, Cart), renders <App />
    ├── App.tsx                       # Route definitions (~80 routes), theme config,
    │                                 #   private route wrapper, maintenance redirect
    │
    ├── config/
    │   └── env.ts                    # Environment variable constants (API_URL, etc.)
    │
    ├── types/                        # TypeScript type definitions
    │   ├── admin/
    │   ├── member/
    │   └── aichat/
    │       └── aichat.ts
    │
    ├── services/                     # API client functions (30 service modules)
    │   ├── api.ts                    #   Axios instance, interceptors, auth token
    │   │                            #     lifecycle, refresh scheduler
    │   ├── authService.ts
    │   ├── membershipService.ts
    │   ├── bookingService.ts
    │   ├── walletService.ts
    │   ├── productService.ts
    │   ├── orderService.ts
    │   ├── memberService.ts
    │   ├── notificationService.ts
    │   ├── socketService.ts          #   Socket.io client connection
    │   ├── addressService.ts
    │   ├── checkInService.ts
    │   ├── floorZoneService.ts
    │   ├── workoutService.ts
    │   ├── scheduleService.ts
    │   ├── trainerService.ts
    │   ├── trainerScheduleService.ts
    │   ├── trainerReplacementService.ts
    │   ├── ptAssignmentService.ts
    │   ├── ptAssignmentEndService.ts
    │   ├── trainingAssignmentService.ts
    │   ├── trainingGroupService.ts
    │   ├── trainingRequestService.ts
    │   ├── shiftSwapService.ts
    │   ├── planFeatureService.ts
    │   ├── systemSettingsService.ts
    │   ├── systemExperienceService.ts
    │   ├── shopService.ts
    │   ├── partnershipRequestService.ts
    │   └── reportService.ts
    │
    ├── context/                      # React context providers
    │   ├── AuthProvider.tsx          #   Auth state, login/logout, token refresh
    │   ├── auth.context.ts
    │   ├── CartProvider.tsx          #   Shopping cart state
    │   ├── useCart.ts
    │   ├── WalletProvider.tsx        #   Wallet balance state
    │   ├── SystemSettingsContext.tsx  #   Feature flags, maintenance mode
    │   ├── ThemeContext.tsx
    │   ├── ThemeProvider.tsx
    │   └── theme.ts                  #   Theme token definitions
    │
    ├── hooks/                        # Custom React hooks
    │   ├── useAuth.tsx               #   Auth state consumption hook
    │   ├── useDeposit.ts
    │   ├── useScrollReveal.ts
    │   ├── useWorkoutManagement.tsx
    │   ├── useDraggable.js           #   Drag-and-drop hook (JS legacy)
    │   └── useDraggable.d.ts         #   Type declarations for legacy hook
    │
    ├── components/                   # UI components
    │   ├── common/                   #   (EMPTY — planned but not implemented)
    │   ├── layout/                   #   Layout shells, headers, sidebars, footer
    │   ├── chat/                     #   AI chat components (14 files — mostly dead)
    │   │   ├── AdminAIChatWidget.tsx
    │   │   ├── AiChatWidget.tsx
    │   │   ├── AssistantMessageBubble.tsx
    │   │   ├── BodyAnalysisCard.tsx
    │   │   ├── ComboRecommendCard.tsx
    │   │   ├── CompareTwoPlansCard.tsx
    │   │   ├── InBodyAnalysisCard.tsx
    │   │   ├── MembershipPlanCards.tsx
    │   │   ├── PlanCompactList.tsx
    │   │   ├── PlanCompareTable.tsx
    │   │   ├── PlanDetailCard.tsx
    │   │   ├── PlanRecommendCard.tsx
    │   │   ├── PTCard.tsx
    │   │   └── WorkoutAnalyzeCard.tsx
    │   ├── membership/               #   Membership-specific components
    │   ├── checkout/                 #   Checkout flow components
    │   ├── wallet/                   #   Wallet UI components
    │   ├── notifications/            #   Notification display components
    │   ├── partnership/              #   Partnership request components
    │   ├── system/                   #   System settings & feature toggle components
    │   │   ├── FeatureDisabled.tsx
    │   │   └── ...
    │   └── ...
    │
    ├── pages/                        # Route-level page components
    │   ├── auth/                     #   Authentication pages
    │   │   ├── LoginPage.tsx
    │   │   ├── Registerpage.tsx
    │   │   ├── ForgotPasswordPage.tsx
    │   │   ├── AccountProfilePage.tsx
    │   │   ├── AccountProfileModal.tsx
    │   │   └── OauthSuccessPage.tsx
    │   │
    │   ├── public/                   #   Public (unauthenticated) pages
    │   │   ├── AboutPage.tsx
    │   │   ├── HelpCenterPage.tsx
    │   │   ├── MaintenancePage.tsx
    │   │   ├── PolicyPage.tsx
    │   │   ├── RefundPolicyPage.tsx
    │   │   ├── DepositPolicyPage.tsx
    │   │   ├── PartnershipPage.tsx
    │   │   ├── BankTransferPage.tsx
    │   │   ├── BankTransferDemoPage.tsx
    │   │   ├── BankTransferSimulator.tsx
    │   │   └── DepositScanPage.tsx
    │   │
    │   └── dashboard/                #   Authenticated dashboards by role
    │       ├── admin/                #     Admin pages (~30 pages)
    │       ├── member/               #     Member pages (~20 pages)
    │       ├── pt/                   #     PT pages (~10 pages)
    │       ├── seller/               #     Seller pages (~7 pages)
    │       ├── staff/                #     Staff pages (~8 pages)
    │       └── trainer/              #     Trainer pages
    │
    └── utils/                        # Client-side utilities
        ├── delivery.ts
        ├── errorMessages.ts
        ├── localization.ts
        ├── policyConsent.ts
        └── userDisplay.ts
```

---

## 4. Data Flow

### 4.1 Request Lifecycle (Frontend → Backend → Database)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│ React Router │────▶│ Page         │────▶│ Service      │
│  (User)      │     │ (path match) │     │ Component    │     │ (API client) │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │ Axios        │
                                                               │ Instance     │
                                                               └──────────────┘
                                                                      │
                                                              HTTP POST/GET
                                                              Authorization:
                                                              Bearer <JWT>
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Express      │────▶│ Middleware    │────▶│ Controller   │────▶│ Service      │
│ (route)      │     │ Stack        │     │ (thin)       │     │ (logic)      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
  cors()                                                             │
  cookieParser()                                                     ▼
  express.json()                                              ┌──────────────┐
  session()                                                   │ Mongoose     │
  passport.initialize()                                       │ Model        │
  passport.session()                                          │ (ODM)        │
  maintenanceModeGuard                                         └──────────────┘
  authMiddleware.protect()                                           │
  authMiddleware.authorize()                                         ▼
                                                               ┌──────────────┐
                                                               │ MongoDB      │
                                                               │ (Atlas /     │
                                                               │  Local)      │
                                                               └──────────────┘
                                                                      │
                                                                      ▼
                                                               ┌──────────────┐
                                                               │ Controller   │
                                                               │ → res.json() │
                                                               └──────────────┘
                                                                      │
                                                              JSON Response
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Axios        │────▶│ React State  │────▶│ UI Re-render │
│ Interceptor  │     │ (Context /   │     │              │
│ (unwrap)     │     │  React Query)│     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 4.2 Step-by-Step Walkthrough

1. **Client Initiation** — User interacts with a page component (e.g., clicking "My Membership"). React Router matches the URL path and renders the appropriate page component.

2. **Service Call** — The page component calls a service function (e.g., `membershipService.getMyMembership()`). The service constructs an Axios request with the access token from `sessionStorage`.

3. **Axios Interceptors** — The request interceptor attaches `Authorization: Bearer <token>` to every outgoing request. The response interceptor handles 401 errors by attempting a silent token refresh.

4. **Express Middleware Stack** — The request passes through:
   - `cors()` — validates origin against allowed origins
   - `cookieParser()` — parses httpOnly cookies (refresh token)
   - `express.json()` — parses JSON body (5MB limit)
   - `session()` — Express session (used by Passport)
   - `passport.initialize()` + `passport.session()` — deserializes user from session for Passport-based endpoints
   - `maintenanceModeGuard()` — blocks non-admin requests when maintenance mode is active
   - `protect()` — verifies JWT access token, attaches `req.user`
   - `authorize(roles...)` — checks user role against allowed roles

5. **Controller** — A thin handler extracts validated data from `req.params`, `req.query`, `req.body`, and `req.user`, then delegates to the appropriate service function.

6. **Service** — Contains all business logic: validation, orchestration, external API calls. Queries MongoDB via Mongoose models.

7. **Mongoose Model** — Defines schema, validation, indexes, virtuals, and middleware (pre-save hooks for password hashing, etc.).

8. **MongoDB** — Executes the query and returns results to the service, which returns them to the controller.

9. **Response** — Controller calls `res.json()` with a structured response. On error, `sendError()` returns a consistent error envelope.

10. **Client Update** — Axios response interceptor unwraps the response. React state updates (Context, React Query cache) trigger a re-render of the UI.

---

## 5. Authentication Flow

### 5.1 Strategy Overview

The system uses a **hybrid auth strategy** — primarily JWT-based with Passport.js session for OAuth callbacks:

| Mechanism | Purpose | Status |
|-----------|---------|--------|
| JWT Access Token (15 min) | API authorization | Active |
| JWT Refresh Token (7 day, httpOnly cookie) | Silent token refresh | Active |
| Refresh Token Rotation | New refresh token issued on each refresh | Active |
| Passport Session | OAuth callback flow only | Active |
| OTP via Email/SMS | Registration, password reset, email change | Active |
| Google OAuth | Social login | Active |
| Facebook OAuth | Social login | Active |

### 5.2 Token Lifecycle

```
┌────────────┐                          ┌────────────┐
│   Client   │                          │   Server   │
└─────┬──────┘                          └─────┬──────┘
      │                                        │
      │  POST /api/auth/login                  │
      │  { identifier, password }              │
      │───────────────────────────────────────▶│
      │                                        │
      │  Generate accessToken (15m)            │
      │  Generate refreshToken (7d)            │
      │  Store refreshToken on User model      │
      │                                        │
      │  ◀─────────────────────────────────────│
      │  { accessToken, user }                 │
      │  Set-Cookie: refreshToken (httpOnly)   │
      │                                        │
      │  [Client stores accessToken in         │
      │   sessionStorage, refreshToken in      │
      │   httpOnly cookie]                     │
      │                                        │
      │  ─── Every request ────▶               │
      │  Authorization: Bearer <accessToken>    │
      │                                        │
      │  [After 15m, 401]                      │
      │                                        │
      │  POST /api/auth/refresh                │
      │  Cookie: refreshToken=<token>          │
      │───────────────────────────────────────▶│
      │                                        │
      │  Verify refreshToken                   │
      │  Compare against User.refreshToken     │
      │  Rotate: generate new refreshToken     │
      │  Update User.refreshToken              │
      │                                        │
      │  ◀─────────────────────────────────────│
      │  { accessToken, user }                 │
      │  Set-Cookie: refreshToken (new, httpOnly)
      │                                        │
      │  [Client schedules next refresh        │
      │   1 minute before expiry using          │
      │   jwtDecode().exp]                     │
```

### 5.3 Refresh Token Rotation

```
Client sends refresh token ────▶ Server verifies
                                       │
                          ┌────────────┴────────────┐
                          │ Token matches DB record? │
                          └────────────┬────────────┘
                                       │
                         YES ┌─────────┴─────────┐ NO
                            │                    │
                            ▼                    ▼
                    Generate new RT       Clear cookie
                    Update DB record      Return 401
                    Return new AT+RT      Client logs out
```

### 5.4 Social Login

```
                    ┌──────────────┐
                    │   Client     │
                    └──────┬───────┘
                           │
              GET /api/auth/google
              (or /facebook)
                           │
                           ▼
              ┌────────────────────────┐
              │ Passport.authenticate  │
              │ → OAuth provider       │
              └────────────────────────┘
                           │
            User authorizes on provider
                           │
                           ▼
              OAuth callback → /api/auth/google/callback
                           │
                           ▼
              ┌────────────────────────┐
              │ Find or create User    │
              │ by email / facebookId  │
              │ Backfill profile       │
              │ Generate JWT tokens    │
              │ Set refresh cookie     │
              └────────────────────────┘
                           │
              Redirect → /oauth-success?token=<accessToken>
                           │
                           ▼
              Client reads token from URL
              Stores in sessionStorage
              Redirects to dashboard
```

### 5.5 OTP-Based Flows

**Registration Flow:**
```
1. Client → POST /api/auth/register/send-otp
   { provider: "email"|"phone", name, phone/email, password }
2. Server validates, checks duplicates, hashes password
3. Server sends OTP via Nodemailer (email) or Twilio (SMS)
4. Client → POST /api/auth/register/verify-otp
   { identifier, otp }
5. Server verifies OTP, creates User, generates JWT tokens
6. Response: { accessToken, user } + Set-Cookie: refreshToken
```

**Password Reset Flow:**
```
1. Client → POST /api/auth/forgot-password/send-otp
   { identifier }
2. Server finds user, sends OTP
3. Client → POST /api/auth/forgot-password/verify-otp
   { identifier, otp }
4. Server returns resetToken (JWT, 10m expiry)
5. Client → POST /api/auth/forgot-password/reset
   { resetToken, newPassword }
6. Server verifies resetToken, updates password
```

---

## 6. Real-Time Architecture (Socket.io)

### 6.1 Connection Lifecycle

```
┌──────────────┐                    ┌──────────────┐
│   Client     │                    │   Server     │
│  (socket.io  │                    │  (socket.io  │
│   client)    │                    │   server)    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │  connect()                        │
       │  handshake: { auth: { token } }   │
       │──────────────────────────────────▶│
       │                                   │
       │  io.use(auth middleware)          │
       │  ├── Verify JWT                   │
       │  ├── Find user by decoded.id     │
       │  ├── Attach socket.userId        │
       │  ├── Attach socket.userRole      │
       │  ├── socket.join(userId)         │
       │  │     [Personal room]           │
       │  ├── If role ∈ {staff,admin,     │
       │  │    super_admin}:               │
       │  │    socket.join('staff')       │
       │  │     [Staff broadcast room]    │
       │  └── next()                      │
       │                                   │
       │  ◀───────────────────────────────│
       │  connected                        │
       │                                   │
       │  ── Listen for events ──▶         │
       │  'notification:new'               │
       │  'refund_request_update'          │
       │  'shift_swap:new_request'        │
       │  'shift_swap:count_updated'      │
       │  'pt_end_request:count_updated'  │
       │  'pt_end_request:status_changed' │
       │  'workout_report:count_updated'  │
```

### 6.2 Event Emission Pattern

```
Service Layer                                   Socket Service
     │                                              │
     │  After business logic completes              │
     │                                              │
     │  ──emitRefundRequestUpdate()────▶            │
     │                                    │         │
     │                                    ▼         │
     │                           ┌──────────────────┐
     │                           │ io.to('staff')   │
     │                           │ .emit('refund_   │
     │                           │   request_update',│
     │                           │  { count })      │
     │                           └──────────────────┘
     │                                    │
     │  ──emitNotificationToUser(        │
     │      userId, notification)──▶     │
     │                                    ▼
     │                           ┌──────────────────┐
     │                           │ io.to(userId)    │
     │                           │ .emit('notifica- │
     │                           │  tion:new', notif)│
     │                           └──────────────────┘
```

### 6.3 Channel Architecture

| Channel | Members | Purpose |
|---------|---------|---------|
| `socket.userId` | One user (by MongoDB `_id`) | Personal notifications (new booking, membership expiry, refund status) |
| `'staff'` | All users with role `staff`, `admin`, `super_admin` | Broad alerts (pending refund count, shift swap requests, PT end requests, workout report count) |

---

## 7. Database Architecture

### 7.1 Deployment Topology

```
┌─────────────────────┐     ┌──────────────────────┐
│   MongoDB Atlas     │     │   Local MongoDB       │
│   (Primary)         │     │   (Fallback)          │
│                     │     │   mongodb://127.0.0.1 │
│   process.env.      │     │   :27017/gym          │
│   MONGO_URI         │     │                      │
└─────────┬───────────┘     └──────────┬────────────┘
          │                            │
          │ Primary (read/write)       │ Read-only fallback
          │                            │ (on Atlas failure)
          ▼                            ▼
    ┌──────────────────────────────────────┐
    │        Mongoose Connection           │
    │                                      │
    │  connectDB():                        │
    │    try Atlas                         │
    │    catch → disconnect → connect      │
    │           to local                   │
    │    _isFallback = true/false          │
    │                                      │
    │  GET /api/system/status             │
    │  { database: "atlas"|"local_fallback"│
    │    fallbackActive: bool }            │
    └──────────────────────────────────────┘
```

### 7.2 Connection Strategy

```javascript
// Simplified logic from config/db.js
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, options)
    // Connected to Atlas — normal operation
    _isFallback = false
  } catch (error) {
    // Atlas failed — fall back to local MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/gym', options)
    _isFallback = true
    // Read-only mode (enforced by application logic)
  }
}
```

### 7.3 Collections Overview

The database contains **64 Mongoose model files** mapping to MongoDB collections. Key collection categories:

| Category | Collections | Count |
|----------|-------------|-------|
| **Users & Auth** | `User`, `Otp`, `AuditLog`, `UserActivity` | 4 |
| **Membership & Billing** | `Membership`, `MembershipCycle`, `MembershipPeriod`, `MembershipRegistration`, `MembershipRenewal`, `MembershipCancellationRequest`, `Plan`, `PlanFeature`, `PlanChangeHistory`, `Payment`, `Wallet`, `Transaction` | 12 |
| **PT & Training** | `PT`, `PTAssignment`, `PTAssignmentEndRequest`, `PTReview`, `PTSchedule`, `Booking`, `TrainingClass`, `TrainingAssignment`, `TrainingGroup`, `TrainingRequest`, `TrainerSchedule`, `TrainerReplacementRequest` | 12 |
| **Shop & Products** | `Product`, `Order`, `Shop`, `Shipping`, `DiscountCode`, `RefundRequest` | 6 |
| **Check-in & Classes** | `CheckIn`, `DailyQRCode`, `Class`, `ClassEnrollment`, `GroupClass`, `Floor`, `Zone`, `ScheduleOverride`, `Waitlist` | 9 |
| **Workouts** | `Workout`, `WorkoutSchedule`, `WorkoutReport`, `WorkoutImprovementRequest`, `HealthLog` | 5 |
| **Notifications & Content** | `Notification`, `Feedback`, `SessionFeedback`, `Faq`, `Policy`, `PolicyConsent`, `LandingContent`, `PartnershipRequest`, `Specialization` | 9 |
| **System** | `SystemSettings`, `Address`, `ShiftSwapRequest`, `ShiftSwapItem` | 4 |
| **Dead/Unused AI Models** | `AiChatHistory`, `AiUserMemory`, `VectorDocument` | 3 |

### 7.4 Indexing Strategy

| Index Type | Collections | Purpose |
|-----------|-------------|---------|
| **TTL Index** | `Otp` | Auto-delete OTP records after `expiresAt` |
| **Unique Index** | `User.email`, `User.phone`, `MembershipCycle` (compound) | Enforce data integrity |
| **Compound Index** | `Booking { memberId, date }`, `CheckIn { userId, date }` | Common query patterns |
| **Text Index** | `Product.name`, `Faq` | Full-text search |

### 7.5 Fallback Read-Only Mode

When MongoDB Atlas is unreachable, the system:
1. Automatically connects to a local MongoDB instance
2. Sets `_isFallback = true` (exposed via `/api/system/status`)
3. **Write operations are rejected** (enforced at the application layer — controllers check `isFallbackActive()` before mutating)
4. Provides a reconnect endpoint: `POST /api/system/reconnect` — attempts to switch back to Atlas
5. Logs the fallback error for debugging

---

## 8. External Dependencies

| Service | Library | Purpose | Configuration |
|---------|---------|---------|---------------|
| **Cloudinary** | `cloudinary` + `multer-storage-cloudinary` | Image upload & storage for avatars, cover images, identity documents, products | `config/cloudinary.js` |
| **GHN** | Axios (custom client) | Giao Hàng Nhanh shipping API — address validation, shipping fee calculation, order tracking | `services/ghnService.js` |
| **Stripe** | `stripe` (server) + `@stripe/react-stripe-js` + `@stripe/stripe-js` (client) | Payment processing for wallet top-up and membership purchase | `controllers/walletController.js`, `controllers/membershipController.js` |
| **VNPAY** | Custom integration | Vietnamese payment gateway — QR code and bank transfer payments | `services/vnpayService.js` |
| **Twilio / SpeedSMS** | `twilio` | SMS delivery for OTP verification and notifications | `services/smsService.js` |
| **Nodemailer** | `nodemailer` | Email delivery for OTP, password reset, and notifications | `services/emailService.js` |
| **Google OAuth** | `passport-google-oauth20` | Social login via Google accounts | `config/passport.js` |
| **Facebook OAuth** | `passport-facebook` | Social login via Facebook accounts | `config/passport.js` |
| **QR Code** | `qrcode` (server) + `qrcode.react` + `html5-qrcode` (client) | QR check-in code generation and scanning | `controllers/dailyQRCodeController.js` |

### Integration Architecture Pattern

All external integrations follow a consistent pattern:

```
Controller ──▶ Service ──▶ External API Library
                  │
                  │ (error handling, retry, logging)
                  │
                  ▼
           Returns domain object
           (not raw API response)
```

This ensures that:
- External API changes only affect one service file
- Business logic never touches external APIs directly
- Error handling is centralized per integration
- Mocking for tests is straightforward

---

## 9. Current Architecture Issues

The following issues were identified during the architecture audit of July 2026:

### 9.1 Critical

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Express 5 beta** | `package.json` uses `express: ^5.2.1` | Express 5 is still in beta with potential breaking changes and reduced ecosystem compatibility. | Pin to Express 4 LTS (`^4.21.0`). |
| **Mongoose 9** | `package.json` uses `mongoose: ^9.3.1` | Mongoose 9 is a major version with undocumented breaking changes. | Pin to Mongoose 8 LTS (`^8.9.0`). |
| **Mixed auth strategies** | `passport.session()` + JWT `protect` middleware coexist | Passport session is only used for OAuth callbacks but initialized globally. Session serialization creates confusion between session-based and token-based auth. | Remove Passport session; use JWT-only for all endpoints. Use a short-lived state parameter for OAuth flow instead of sessions. |

### 9.2 High

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Dead AI module infrastructure** | `src/modules/` — 11 module folders with `tool.js` + `ai.json` | These modules define AI tool handlers that call Mongoose models directly, bypassing the service layer entirely. Only 3 of 11 modules are actively used. The `AiChatHistory`, `AiUserMemory`, and `VectorDocument` models are dead code. | Remove unused modules. Refactor remaining tools to call service layer instead of models. Remove dead models. |
| **No caching layer** | Entire application | Every request hits MongoDB — no Redis or in-memory cache. Frequently accessed data (plans, system settings) is re-fetched on every request. | Introduce Redis cache with TTL for plans, system settings, and user profiles. |
| **No rate limiting on auth endpoints** | `authRoutes.js` | Login, register, OTP, and refresh endpoints have no rate limiting. Brute-force and enumeration attacks are possible. | Apply `express-rate-limit` specifically to `/api/auth/*` routes with aggressive limits (e.g., 5 requests/min for OTP, 10 requests/min for login). |

### 9.3 Medium

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **No centralized validation** | All controllers | Validation logic is scattered across controllers and services. Each endpoint duplicates field checks, leading to inconsistency and potential security gaps. | Implement Zod validation schemas per endpoint. Use a validation middleware to check `req.body` against schema before reaching controllers. |
| **No API versioning** | All routes | Routes are mounted at `/api/{resource}` with no version prefix. Backward-incompatible changes will break existing clients. | Adopt URL-based versioning (`/api/v1/{resource}`) or header-based versioning. |
| **Monolithic route files** | `authController.js` (1363 lines), `server.js` (197 lines) | Auth controller handles 41 different actions. `server.js` mounts all 40+ route files manually. | Split auth controller into smaller domain files. Use a route auto-loader pattern. |
| **Hardcoded protected admin email** | `authController.js:1061` | `PROTECTED_ADMIN_EMAIL = 'daoxuanquyen333@gmail.com'` is hardcoded. | Move to environment variable or system settings. |

### 9.4 Low

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| **Empty `common/` component directory** | `gym-frontend/src/components/common/` | Exists but contains no files. Creates confusion about where shared components should live. | Remove or populate with actual shared components. |
| **Legacy `useDraggable.js`** | `gym-frontend/src/hooks/useDraggable.js` | Plain JS file alongside TypeScript hooks. Has a separate `.d.ts` declaration file. | Rewrite in TypeScript and remove the `.d.ts` shim. |
| **Log files in repo** | `server_err.log`, `server_out.log`, `vite-dev.log`, etc. | Runtime log files are tracked in the working directory. | Add to `.gitignore` and clean up. |

---

## 10. Security Architecture

### 10.1 Defense Layers

```
Layer 1: Transport       HTTPS (TLS 1.3)
Layer 2: Headers         Helmet (XSS, CSP, HSTS, etc.)
Layer 3: CORS            Whitelist origins only
Layer 4: Auth            JWT + OAuth
Layer 5: Authorization   Role-based middleware
Layer 6: Input           express.json() (5MB limit)
Layer 7: MongoDB         Mongoose sanitization
```

### 10.2 Token Security

- Access tokens are stored in `sessionStorage` (not `localStorage` — cleared on tab close)
- Refresh tokens are stored in **httpOnly**, `Secure` (in production), `SameSite` cookies
- Refresh token rotation invalidates stolen tokens
- OAuth state parameter prevents CSRF on social login callbacks

### 10.3 Password Policy

- Minimum 8 characters
- Must contain uppercase, lowercase, and digit
- Hashed with bcrypt (`bcrypt ^6.0.0`)
- Password strength validated on both client and server

### 10.4 GDPR / Privacy

- Identity numbers are masked for non-admin users
- Admin audit logs track all role changes and sensitive operations
- Policy consent records track user agreement to terms
- Account locking and deletion supported

---

## 11. Production Deployment

### 11.1 Container Architecture

```
┌────────────────────────────────┐
│   Docker Compose (optional)    │
│                                │
│  ┌──────────┐  ┌──────────┐   │
│  │ Frontend  │  │ Backend  │   │
│  │ Nginx     │  │ Node.js  │   │
│  │ (static)  │  │ (Express)│   │
│  └──────────┘  └────┬─────┘   │
│                     │         │
│                     ▼         │
│              ┌──────────┐     │
│              │ MongoDB  │     │
│              │ (local)  │     │
│              └──────────┘     │
└────────────────────────────────┘
```

### 11.2 Build & Run

| Target | Command | Description |
|--------|---------|-------------|
| Frontend dev | `npm run dev` | Vite dev server on `:5173` |
| Backend dev | `npm run dev` | Node.js with `--env-file` on `:5000` |
| Frontend build | `npm run build` | Vite production build to `dist/` |
| Backend start | `npm start` | `node server.js` |
| Docker FE | `docker build -f Dockerfile -t gym-fe .` | Nginx-served static build |
| Docker BE | `docker build -f Dockerfile -t gym-be .` | Node.js production |

---

## 12. Monitoring & Health

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Basic health check (server running) |
| `GET /api/system/status` | Database connection status, fallback indicator |
| `POST /api/system/reconnect` | Force reconnection to primary Atlas |
| Audit logs | Tracked per-module via `AuditLog` model |
| Console logging | `morgan` HTTP request logging |
| Error handler | Centralized error middleware with stack trace (dev) |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Cycle** | Short for `MembershipCycle`. The single source of truth for a membership's activation, duration, and refund eligibility. |
| **Membership** | A container entity representing a member's subscription. Does not store time-based data. |
| **Pending Initial Activation** | Cycle state — member has purchased but not yet checked in (first time). |
| **Pending Renewal Activation** | Cycle state — member has renewed but current active cycle has not expired yet. |
| **SSOT** | Single Source of Truth — principle ensuring each data element is stored in exactly one place. |
| **JWT** | JSON Web Token for stateless API authentication. |
| **OTP** | One-Time Password sent via email or SMS for verification flows. |
| **Passport** | Node.js authentication middleware used for Google/Facebook OAuth. |
| **GHN** | Giao Hàng Nhanh — Vietnamese shipping carrier. |
| **VNPAY** | Vietnamese payment gateway for QR and bank transfers. |
