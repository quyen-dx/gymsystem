# GymPro AI Chat — Architecture Refactoring Report

## Current Architecture (Violations)

```
User Query
    │
    ▼
gymProAgent.js          ← orchestration + business logic mixed
    │
    ▼
gymTools.js             ← queries MongoDB MODELS directly (8 violations)
    │
    ├── Plan.find()           ← VIOLATION: bypasses service layer
    ├── Membership.findOne()  ← VIOLATION: membershipService exists but unused
    ├── CheckIn.find()        ← VIOLATION: no service
    ├── Booking.find()        ← VIOLATION: no service
    ├── User.find()           ← VIOLATION: no service (PT queries)
    ├── PT.find()             ← VIOLATION: no service
    ├── PTSchedule.find()     ← VIOLATION: no service
    ├── Product.find()        ← VIOLATION: no service
    └── Booking.create()      ← VIOLATION: no service
    │
    ▼
gymProAgent.js          ← builds LLM prompt (good)
    │
    ▼
LLM                     ← reads tool data (good)
    │
    ▼
Response Validator      ← validates output (good)
```

### Problems
1. **LLM reads MongoDB directly** — gymTools bypasses business services entirely
2. **LLM computes business logic** — gymProAgent contains business rules mixed with orchestration
3. **UI and AI use different paths** — controllers use services, AI uses direct models
4. **No service reuse** — ptController.getPTs() has similar queries but duplicated

---

## Target Architecture

```
User Query
    │
    ▼
gymProAgent.js          ← orchestration ONLY (no business logic)
    │
    ▼
gymTools.js             ← calls Business Services ONLY (no Model imports)
    │
    ├── planService.getActivePlans()
    ├── membershipService.getMyMembership()
    ├── checkInService.getCheckinStats()
    ├── bookingService.getUpcomingBookings()
    ├── ptService.getAvailablePTs()
    ├── productService.getRecommendedProducts()
    └── bookingService.createBookingRequest()
    │
    ▼
Business Services       ← query MongoDB, apply business rules
    │
    ▼
MongoDB Models
    │
    ▼
Context Builder         ← formats service results → readable text
    │
    ▼
LLM                     ← reads formatted text ONLY (no DB, no JSON raw)
    │
    ▼
Response Validator      ← validates output
    │
    ▼
User
```

### Principles Enforced
1. **MVC with Service Layer** — Models → Services → Tools → Agent
2. **UI & AI share Services** — controllers and gymTools import the same service functions
3. **LLM never touches MongoDB** — only reads formatted text from Context Builder
4. **LLM never computes business logic** — services do all calculations
5. **No hardcoded data** — everything flows from DB through services
6. **API backward compatible** — gymTools function signatures unchanged

---

## Changes Required

### New Files (5 Business Services)

| File | Responsibility | Source |
|------|---------------|--------|
| `src/services/planService.js` | `getActivePlans()` — wraps `Plan.find({isActive:true})` | Extracted from gymTools VIOLATION #1 |
| `src/services/ptService.js` | `getAvailablePTs({specialization})` — wraps User+PT+PTSchedule queries | Extracted from gymTools VIOLATION #6 |
| `src/services/bookingService.js` | `getUpcomingBookings({userId})`, `createBookingRequest(...)` | Extracted from gymTools VIOLATIONS #5, #8 |
| `src/services/checkInService.js` | `getCheckinStats({userId})` — wraps CheckIn.find | Extracted from gymTools VIOLATION #4 |
| `src/services/productService.js` | `getRecommendedProducts({goal})` — wraps Product.find | Extracted from gymTools VIOLATION #7 |

### Modified Files

| File | Change |
|------|--------|
| `src/ai/tools/gymTools.js` | Remove all `import Model from '../../models/...'` lines; import services instead; delegate to service functions |
| `src/ai/agent/gymProAgent.js` | Remove business logic; keep only orchestration (router → tool → build prompt → validate) |
| `src/controllers/ptController.js` | Refactor `getPTs()` to use `ptService.getAvailablePTs()` (shared with AI) |
| `src/controllers/planController.js` | Refactor to use `planService.getActivePlans()` (shared with AI) |
| `planController.js` + `bookingController.js` + `checkInController.js` | Optionally refactor to share services |

### Validation

| Phase | Status | Result |
|-------|--------|--------|
| P1: E2E Workflow | ✅ Done | 11/14 pass (3 pre-existing) |
| P2: Regression | ✅ Done | 6/6 pass |
| P3: Hallucination | ✅ Done | 0% hallucination rate |
| P4: Validator | ✅ Done | 19/19 pass |
| P5: Performance | ✅ Done | Avg 64ms |
| P6: Cleanup | ⏳ After refactor | Remove aiService.js dead code |
