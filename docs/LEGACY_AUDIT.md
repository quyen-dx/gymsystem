# Legacy Code Audit — MVP Codebase

> **Audit Date:** 2026-07-20
> **Scope:** Full MVP codebase (64 models, 32 services, 41 controllers, 40+ routes, 11 AI modules, 4 middlewares, 2 jobs)
> **Assessment Against:** New Sprint 0 architecture, BUSINESS_RULES.md, STATE_MACHINES.md, AI_CODING_CONSTITUTION.md

---

## Classification System

| Category | Definition | Action |
|----------|-----------|--------|
| **A** | Compatible — can be reused without modification | Keep as-is |
| **B** | Compatible with Refactoring — needs internal cleanup but architectural pattern is correct | Refactor in target sprint |
| **C** | Temporary Legacy — works but violates new architecture; must be replaced | Keep for now, replace in target sprint |
| **D** | Must Be Removed — conflicts with architecture, dead code, or empty | Remove immediately |

---

## 1. Models (64 files)

| Category | Count | Files |
|----------|-------|-------|
| **A** | 47 | Address, AiChatHistory, AiUserMemory, AuditLog, Booking, CheckIn, Class, ClassEnrollment, DailyQRCode, DiscountCode, Feedback, Floor, HealthLog, LandingContent, Membership, MembershipCancellationRequest, MembershipCycle, MembershipPeriod, MembershipRegistration, MembershipRenewal, Notification, Otp, Plan, PlanFeature, Product, PTAssignment, PTAssignmentEndRequest, RefundRequest, ScheduleOverride, SessionFeedback, ShiftSwapItem, ShiftSwapRequest, Shipping, Specialization, SystemSettings, Transaction, TrainingAssignment, TrainingClass, TrainingRequest, UserActivity, Waitlist, Wallet, Workout, WorkoutImprovementRequest, WorkoutReport, Zone, PlanChangeHistory |
| **B** | 15 | Faq, GroupClass, Order, PartnershipRequest, Payment, PTSchedule, PT, Policy, PolicyConsent, Shop, TrainerSchedule, User, VectorDocument, WorkoutSchedule, PlanChangeHistory (duplicate fields) |
| **D** | 2 | PTReview (empty file, 0 lines), TrainingGroup (self-declared DEPRECATED) |

### Key Issues (Category B)

| File | Issue | Impact | Target Sprint |
|------|-------|--------|---------------|
| `User.js` | `isActive`, `status`, `isLocked` — three overlapping boolean/status fields | Confusion on which field determines account state | Sprint 1 (Identity) |
| `Payment.js` | Status enum duplicates: `'PENDING'` and `'pending'` both valid | Query: find by status returns inconsistent results depending on which enum was used | Sprint 2 (Revenue) |
| `Payment.js` | `paymentMethod` and `method` — redundant fields | Data duplication | Sprint 2 (Revenue) |
| `Order.js` | `discountCode` and `discountAmount` defined twice each (lines 83-87 + 93-97, 88-92 + 98-102) | Second definition shadow-wins; first definition is dead code | Sprint 5 (Commerce) |
| `PTSchedule.js` + `TrainerSchedule.js` | Near-identical schemas — two models for same concept | Two code paths for trainer schedule management | Sprint 3 (Scheduling) |
| `PT.js` + `User.js` | PT profile fields duplicated across two models | Duplicate data; risk of sync issues | Sprint 3 (Scheduling) |
| `PlanChangeHistory.js` | `changeType` and `type` are overlapping enums | Two fields tracking same concept | Sprint 2 (Revenue) |
| `PartnershipRequest.js`, `Shop.js` | Snake_case field names (`user_id`, `brand_name`) | Inconsistent with camelCase convention | Sprint 5 (Commerce) |
| `Faq.js`, `Policy.js` | `console.log` in production models + auto-migration on import | Side effects at import time; unreliable deployment | Sprint 1 (Identity) |
| `PolicyConsent.js` | `console.error` on every import if `syncIndexes()` fails | Noise in logs | Sprint 1 (Identity) |
| `WorkoutSchedule.js` | Index references non-existent top-level `date` field (line 38) | Invalid index — silently ignored by MongoDB | Sprint 4 (Wellness) |
| `VectorDocument.js` | `EXERCISE_REGEX` defined but never used | Dead code | Sprint 6 (AI) |

---

## 2. Services (32 files)

| Category | Count | Files |
|----------|-------|-------|
| **A** | 17 | addressService, auditLogService, classEnrollmentService, floorZoneService, ghnService, membershipCycleService, orderService, planService, productService, ptService, socketService, systemSettingsService, toolRegistry (old), trainingClassService, userActivityService, vnpayService, walletService |
| **B** | 13 | bookingService, checkInService, emailService, membershipService, notificationService, otpService, ptAssignmentService, refundRequestService, shiftSwapService, trainerReplacementService, trainerScheduleService, trainingGroupService, trainingRequestService |
| **C** | 1 | smsService (entire real implementation commented out — mock only) |
| **D** | 1 | trainingAssignmentService (self-declared DEPRECATED stub) |

### Top Issues

| Issue | Affected Services | Impact |
|-------|------------------|--------|
| **Plain `Error` instead of `AppError`** | 13/32 services | No `isOperational` flag. Error handler can't distinguish expected errors from bugs. No error codes. |
| **`console.log`/`console.error`** | 17/32 services | Debug output in production. No structured logging. Impossible to search production logs. |
| **BR-MEM-004 (freeze rules) missing** | `membershipService.js` | No freeze limit enforcement (max 2/cycle, 30 days max, 7 days between) |
| **BR-MEM-008 (trial rules) missing** | `membershipService.js` | Trial members can book PT sessions, exceeding 3 check-ins |
| **BR-AUD-005 (OTP rate limit) missing** | `otpService.js` | No 5-attempts/15-min lockout. Brute force possible on OTP. |
| **BR-NTF-002 (email batching) missing** | `emailService.js`, `notificationService.js` | Members receive unlimited emails per hour — spam risk |
| **BR-BKG-001 (30-day window) missing** | `bookingService.js` | Bookings can be created >30 days ahead |
| **BR-PT-001/002 (PT limits) missing** | `ptAssignmentService.js` | No enforcement of 10-member max or 8-session/day max |

### Service Pattern Violations

| Pattern | Count | Example |
|---------|-------|---------|
| Service imports models directly | 30/32 | `bookingService.js` imports `Booking` model — correct, this IS the pattern |
| Service contains business logic that should be split | 3 | `membershipService.js` handles purchase, cancellation, renewal, PT data cleanup — too many responsibilities |

---

## 3. Controllers (41 files)

| Category | Count | Files |
|----------|-------|-------|
| **A** | 14 | address, floorZone, membership, notification, order, ptAssignmentEnd, refundRequest, shiftSwap, systemSettings, trainerReplacement, trainerSchedule, trainingClass, trainingGroup, trainingRequest |
| **B** | 23 | auditLog, auth, booking, cancellation, checkIn, dailyQRCode, health, member, partnershipRequest, planChange, plan, planFeature, policyConsent, product, ptAssignment, pt, schedule, shop, specialization, wallet, workout, workoutImprovement, workoutReport |
| **C** | 3 | groupClass (legacy model only), systemExperience (no try-catch on 12+ endpoints), trainingAssignment (DEPRECATED stub) |
| **D** | 1 | reportController (6 empty stub functions, `getRevenueReport` imports model directly) |

### Key Issues

| Issue | Affected Controllers | Impact |
|-------|---------------------|--------|
| **Direct model imports** | 27/41 controllers | Violates MVC+Service layer architecture. Controllers query MongoDB directly bypassing business logic validation in services. |
| **No try-catch** | `systemExperienceController.js` (12+ endpoints) | Any thrown error crashes the request — no error response sent. |
| **`console.log`/`console.error`** | 15/41 controllers | Production logging noise. No structured output. |
| **Empty stub functions** | `reportController.js` (6 stubs) | API returns nothing or crashes. Routes exist but do nothing. |
| **Inline permission checks** | `authController`, `bookingController`, `workoutController` | Permission logic mixed with request handling — hard to test, hard to audit. |

---

## 4. Routes (41+ files)

**Overall:** Route files are structurally sound. All use `express.Router()`. All apply `protect` + `authorize` middleware correctly. Public routes (login, register) are excluded. The issue is in the controllers they call — 27/41 controllers import models directly.

**Category: A (structure) / B (controllers they call)**

No route files need modification — the refactoring target is the controllers and services.

---

## 5. AI Modules (11 module folders)

| Module | Status | Tools | Category |
|--------|--------|-------|----------|
| membership | Active | 3 tools | **A** |
| booking | Active | 2 tools | **A** |
| checkin | Active | 1 tool | **A** |
| product | Active | 1 tool | **A** |
| pt | Active | 1 tool | **A** |
| challenge | Dead — empty export | 0 tools | **D** |
| diet | Dead — empty export | 0 tools | **D** |
| faq | Dead — empty export | 0 tools | **D** |
| knowledge | Dead — empty export | 0 tools | **D** |
| nutrition | Dead — empty export | 0 tools | **D** |
| workout | Dead — empty export | 0 tools | **D** |

**Total: 5 active (8 tool functions), 6 dead (0 tools)**

All active modules follow the correct pattern: `tool.js` imports `services/`, never models directly.

### Key Issues

| Issue | Impact |
|-------|--------|
| 6/11 modules are dead code | Wastes 55% of module directory. Confuses developers. Will cause import errors during migration if not cleaned up. |
| Tool registry scans all modules at runtime | Registers 8 active tools + 0 dead tools — wasted work on every startup |

---

## 6. Middlewares (4 existing)

| Middleware | Category | Issue |
|------------|----------|-------|
| `authMiddleware.js` | **B** | `User.findById()` directly on model — should use `userService`. Otherwise well-structured. |
| `maintenanceMiddleware.js` | **B** | `User.findById()` for role check. Settings retrieved via service (correct). |
| `productOwnershipMiddleware.js` | **C** | Pure model access (`Product.findById`). No service layer. |
| `systemSettingsMiddleware.js` | **A** | Clean — `isFeatureEnabled()` from service only. |

---

## 7. Jobs (2 files)

| Job | Category | Issue |
|-----|----------|-------|
| `activateRenewalCyclesJob.js` | **A** | Perfect thin wrapper. Imports one service, calls one function, logs results. |
| `refundReminderJob.js` | **C** | Heavy inline logic. Queries `MembershipCycle`, `User`, `Plan` directly. Contains all refund reminder business logic. Should be refactored into `refundReminderService.js`. |

---

## 8. Utilities (8 existing)

| File | Category | Issue |
|------|----------|-------|
| `sendError.js` | **A** | Works correctly. New `errorHandler.js` middleware complements (does not replace) it. |
| `appError.js` | **A** | Enhanced in Task 0.3. Backward compatible. |
| `dateUtils.js` | **A** | Enhanced in Task 0.3. `startOfTodayVN` alias restored in Task 0.7. |
| `generateToken.js` | **A** | JWT token generation utilities. Correct. |
| `featureCheck.js` | **B** | Checks plan features. Could benefit from centralization in `planService`. |
| `identifier.js` | **A** | Member ID generation. Correct. |
| `memberIdentity.js` | **A** | Identity verification helpers. Correct. |
| `policyConsent.js` | **A** | Policy consent helpers. Correct. |

---

## Summary

### By Category

| Category | Models | Services | Controllers | AI Modules | Middlewares | Jobs | **Total** |
|----------|--------|----------|-------------|------------|-------------|------|-----------|
| **A** (Compatible) | 47 | 17 | 14 | 5 | 1 | 1 | **85** |
| **B** (Needs Refactoring) | 15 | 13 | 23 | 0 | 2 | 0 | **53** |
| **C** (Temporary Legacy) | 0 | 1 | 3 | 0 | 1 | 1 | **6** |
| **D** (Must Remove) | 2 | 1 | 1 | 6 | 0 | 0 | **10** |

### Safe to Keep (A): 85 files (55%)
Immediately reusable in the new architecture without modification.

### Needs Refactoring (B): 53 files (34%)
Can be kept but requires cleanup — `console.log` removal, `AppError` adoption, business rule enforcement, or model duplication resolution.

### Needs Replacement (C): 6 files (4%)
Works for now but violates architecture (direct model access in middleware/controllers, inline business logic in jobs). Must be replaced before production.

### Safe to Remove (D): 10 files (7%)
Dead code, empty files, deprecated stubs. Can be removed immediately without impact.

### By Sprint Migration

| Sprint | Target Files | Key Actions |
|--------|-------------|-------------|
| **Sprint 0 (cleanup)** | 10 (Category D) | Remove empty files, dead AI modules, deprecated stubs |
| **Sprint 1 (Identity)** | `User.js`, `authMiddleware.js`, `otpService.js`, `authController.js`, `Faq.js`, `Policy.js` | Consolidate user state fields. Add OTP rate limiting. Remove console.log from models. |
| **Sprint 2 (Revenue)** | `membershipService.js`, `Payment.js`, `PlanChangeHistory.js` | Add missing business rules (freeze, trial). Cleanup duplicate payment fields. |
| **Sprint 3 (Scheduling)** | `bookingService.js`, `ptAssignmentService.js`, `PTSchedule.js`, `TrainerSchedule.js` | Add PT limits enforcement. Consolidate duplicate schedule models. |
| **Sprint 4 (Wellness)** | `WorkoutSchedule.js` | Fix invalid index. |
| **Sprint 5 (Commerce)** | `Order.js`, `PartnershipRequest.js`, `Shop.js` | Remove duplicate fields. Normalize snake_case to camelCase. |
| **Sprint 6 (AI)** | `VectorDocument.js`, all AI modules | Cleanup dead code. Register real tools. |
| **Cross-cutting** | All Category B services + controllers | Replace `console.log` with Winston. Replace `new Error` with `AppError`. Fix `systemExperienceController.js` no-try-catch. |

### Critical Risks

| Risk | Dependency | Impact if Unresolved |
|------|------------|---------------------|
| `systemExperienceController.js`: 12+ endpoints with zero error handling | None | Any error silently crashes — no response sent to client |
| `reportController.js`: 6 empty stub endpoints returning nothing | None | API routes exist but are non-functional |
| BR-AUD-005: No OTP rate limiting | `otpService.js` | Brute force possible on OTP verification |
| BR-MEM-004/008: Missing freeze + trial rules | `membershipService.js` | Revenue leakage from unlimited freezes. Trial members get PT access. |
| 55% dead AI modules | `src/modules/` | Confusion for new developers. Runtime cost of scanning empty modules. |
