# GymPro — README_FOR_AI.md

> **⚠️ CRITICAL: This is the most important file in the project.**
> Every AI model **MUST** read this file **FIRST** before reading any other file or writing any code.
> Non-compliance will produce incorrect, unsafe, or rejected code.

---

## 1. Project Identity

**GymPro** is a production-grade gym management system built with:

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite + TypeScript + Antd + TailwindCSS v4 |
| **State / Data** | TanStack React Query v5, React Router v7, Axios, Zod |
| **Backend** | Express (ESM) + MongoDB (Mongoose v9) + Socket.IO |
| **Auth** | JWT (access/refresh), Passport (Google, Facebook) |
| **Payments** | Stripe, VNPay, Wallet |
| **AI** | Custom GymPro AI Agent (gymProAgent + gymTools + service layer) |
| **Real-time** | Socket.IO for notifications, check-in, PT scheduling |
| **Infrastructure** | Docker, Cloudinary, Nodemailer, Twilio SMS |

**Repository structure:**

```
gymsystem/
├── gym-frontend/          # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/    # Shared UI components
│   │   ├── pages/         # Route pages (auth, dashboard/*, public)
│   │   ├── services/      # API client calls
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context providers
│   │   ├── types/         # TypeScript type definitions
│   │   ├── utils/         # Utility functions
│   │   └── config/        # Environment configuration
│   └── ...
├── gym-backend/           # Express API (ESM)
│   ├── src/
│   │   ├── models/        # Mongoose schemas (64 models)
│   │   ├── services/      # Business logic layer (32 services)
│   │   ├── controllers/   # Request handlers (41 controllers)
│   │   ├── routes/        # Express route definitions (40 route files)
│   │   ├── middlewares/   # Auth, maintenance, ownership guards
│   │   ├── jobs/          # Cron jobs (refund reminders, renewal activation)
│   │   ├── modules/       # AI module definitions (tool.js + ai.json)
│   │   ├── config/        # DB, Cloudinary, Passport, etc.
│   │   └── utils/         # AppError, dateUtils, featureCheck, etc.
│   └── ...
├── docs/                  # All project documentation
│   ├── README_FOR_AI.md   # ← THIS FILE
│   ├── MEMBERSHIP_SYSTEM_ARCHITECTURE.md
│   ├── modules/           # Module-specific documentation
│   └── adr/               # Architecture Decision Records
├── docker-compose.yml
└── package.json           # Root workspace scripts
```

---

## 2. AI Instructions — Mandatory Rules

When working on this project, every AI model **SHALL** obey the following rules without exception:

### 2.1 NEVER Invent Business Rules

Business rules are **not** derived from common sense, prior knowledge, or guesswork. They are documented in:

- **`BUSINESS_BLUEPRINT.md`** — High-level business model and domain invariants
- **`BUSINESS_RULES.md`** — Formal, enumerated business rules (R1, R2, ...)

If a business rule is not documented there, **ask the team** before implementing anything.

### 2.2 NEVER Invent API Endpoints

- All endpoints must match **existing implementation** in `gym-backend/src/routes/` and `gym-backend/src/controllers/`.
- If a new endpoint is required, it must be **explicitly designed** in a corresponding `docs/modules/*.md` or ADR before implementation.
- The AI Agent (GymPro) uses a **service-based architecture**: `gymTools.js` calls `services/`, NOT models directly.

### 2.3 NEVER Invent Database Schemas

- All MongoDB models are documented in **`DATABASE.md`** and **`DATABASE_CONVENTIONS.md`**.
- Each model file in `gym-backend/src/models/` is the **source of truth** for its schema.
- Mongoose schema patterns (timestamps, soft-delete, indexing strategy) are defined in `DATABASE_CONVENTIONS.md`.
- **Do not add, remove, or rename fields** without reading these documents and the actual model file.

### 2.4 NEVER Change Workflows

- All state machines and workflow transitions are documented in **`STATE_MACHINES.md`**.
- Membership lifecycle, cancellation flow, check-in activation, PT scheduling, class enrollment, and all other workflows are defined there.
- **Do not add, remove, or reorder transitions** without reading `STATE_MACHINES.md`.

### 2.5 ALWAYS Check Permissions Before Authorization

- **`PERMISSION_MATRIX.md`** defines every role's permissions (super_admin, admin, pt, staff, member, seller).
- The `authMiddleware.js` file provides `protect`, `authorize`, `adminOnly`, `sellerOnly`, etc.
- Before adding `authorize(...)` to any route, check `PERMISSION_MATRIX.md`.

### 2.6 ALWAYS Check Edge Cases Before Finalizing

- **`EDGE_CASES.md`** documents all known edge cases (EC1, EC2, ...).
- Add new edge cases to this file when you discover them.
- Do not mark a feature complete until every documented edge case is handled.

### 2.7 ALWAYS Follow Coding Standards

| Document | Purpose |
|----------|---------|
| `NAMING_CONVENTION.md` | File naming, variable casing, folder structure conventions |
| `CODING_STANDARDS.md` | Error handling patterns, async conventions, import style |
| `TYPESCRIPT_STANDARDS.md` | Type definitions, generics, strict mode rules |
| `COMPONENT_GUIDELINES.md` | React component patterns, hooks, prop conventions |

### 2.8 Security Rules

- **NEVER commit secrets, API keys, or credentials.** All secrets go in `.env` files (`.env`, `.env.production`). `.env` files are in `.gitignore`.
- **NEVER hardcode URLs or tokens.** Use `config/env.ts` (frontend) or `process.env` (backend).
- **NEVER log sensitive data.** No `console.log` of passwords, tokens, payment data.

### 2.9 Code Quality Rules

- **NEVER add `console.log` to production code.** Use the `sendError` utility (backend) or `message` from Antd (frontend) for user-facing feedback.
- **NEVER skip error handling.** Every `async` operation must have `.catch()` or `try/catch`.
- **NEVER skip input validation.** Use Zod schemas (shared across frontend and backend) to validate all user-facing inputs.
- **NEVER add comments to code unless the logic is non-obvious.** The code should be self-documenting.
- **NEVER import libraries not already in `package.json`.** If a library is missing, ask the team.
- **NEVER change database schema without reading `DATABASE.md` first.**
- **NEVER implement features marked as `FUTURE` or `TODO` in the docs** unless explicitly assigned.
- **NEVER add unused exports, dead code, or commented-out code.**

---

## 3. Reading Order

Every AI model **MUST** read documentation files in the order specified below.

### 3.1 MANDATORY — Read First (In This Order)

1. `docs/README_FOR_AI.md` ← this file
2. `docs/PROJECT_OVERVIEW.md`
3. `docs/SYSTEM_ARCHITECTURE.md`

### 3.2 MANDATORY — Read Before Writing Any Code

4. `docs/BUSINESS_RULES.md`
5. `docs/STATE_MACHINES.md`
6. `docs/PERMISSION_MATRIX.md`
7. `docs/EDGE_CASES.md`
8. `docs/ERROR_HANDLING.md`
9. `docs/API_STANDARDS.md`

### 3.3 MANDATORY — Read the Module You Are Working On

10. `docs/modules/[MODULE_NAME].md`

Examples: `docs/modules/membership.md`, `docs/modules/pt.md`, `docs/modules/booking.md`, `docs/modules/checkin.md`, `docs/modules/workout.md`, etc.

### 3.4 MANDATORY — Read Style Guides Before Implementing

11. `docs/CODING_STANDARDS.md`
12. `docs/TYPESCRIPT_STANDARDS.md`
13. `docs/NAMING_CONVENTION.md`
14. `docs/COMPONENT_GUIDELINES.md`

### 3.5 Optional (Read As Needed)

15. `docs/ROADMAP.md`
16. `docs/CURRENT_PHASE.md`
17. `docs/DEPLOYMENT_GUIDE.md`

---

## 4. Critical Warnings

These are the most common mistakes AI models make on this project. **Do not repeat them.**

| # | Warning |
|---|---------|
| 1 | **Do not add comments to code unless the logic is non-obvious.** The codebase is self-documenting. Comments that restate the code are rejected. |
| 2 | **Do not import libraries not already in `package.json`.** If you need a library, discuss with the team first. |
| 3 | **Do not change database schema without reading `DATABASE.md` and the actual model file.** Schema changes are high-risk and require team review. |
| 4 | **Do not implement features marked as `FUTURE` or `TODO` in the docs.** These are not yet approved for development. |
| 5 | **Do not add unused exports, dead code, or commented-out code.** Every export must have a consumer. |
| 6 | **Do not generate placeholder UI or mock data in production code.** Routes, pages, and components must render real data from API calls. |
| 7 | **Do not skip error handling on async operations.** Every async function must have `try/catch` or `.catch()`. |
| 8 | **Do not access MongoDB models directly from AI tools.** The AI Agent (gymProAgent) must go through `gymTools.js` → `services/` → models. Direct model access in AI code is a VIOLATION. |
| 9 | **Do not mix business logic with orchestration.** `gymProAgent.js` handles orchestration only; business logic belongs in service files. |
| 10 | **Do not invent authorization rules.** Always check `PERMISSION_MATRIX.md` and use the pre-built `authorize()` middleware. |
| 11 | **Do not edit both frontend and backend in a single commit unless the feature explicitly requires it.** The codebase has separate packages. |
| 12 | **Do not import from `models/` inside `controllers/`.** Controllers must call services, never models directly. This is a strict architectural rule. |

---

## 5. File Purpose Table

Every documentation file in the `docs/` directory, its purpose, and whether it currently exists.

| File | Purpose | Status |
|------|---------|--------|
| `docs/README_FOR_AI.md` | This file — AI entry point, rules, reading order, validation | ✅ Existing |
| `docs/PROJECT_OVERVIEW.md` | High-level project description, goals, stakeholders | ✅ Existing |
| `docs/SYSTEM_ARCHITECTURE.md` | System architecture, layer diagram, tech stack decisions | ✅ Existing |
| `docs/BUSINESS_BLUEPRINT.md` | Domain model, business model, revenue streams | ✅ Existing |
| `docs/BUSINESS_RULES.md` | Formal enumerated business rules (BR-MEM-001–BR-SHP-004) | ✅ Existing |
| `docs/AI_ARCHITECTURE.md` | AI system architecture, intent classifier, tool router, LLM strategy | ✅ Existing |
| `docs/AI_WORKFLOW.md` | AI conversation flow, per-request-type workflows, retry policy | ✅ Existing |
| `docs/AI_CODING_CONSTITUTION.md` | Highest-authority engineering rules for all code | ✅ Existing |
| `docs/AI_DEVELOPMENT_WORKFLOW.md` | Mandatory AI development process from task to merge | ✅ Existing |
| `docs/DATABASE.md` | Complete database schema documentation (64 collections) | ✅ Existing |
| `docs/DATABASE_CONVENTIONS.md` | Mongoose conventions, indexing strategy, migration patterns | ✅ Existing |
| `docs/STATE_MACHINES.md` | All state machines and workflow transitions (6 machines) | ✅ Existing |
| `docs/PERMISSION_MATRIX.md` | Role-based access control matrix (13 resources × 7 roles) | ✅ Existing |
| `docs/EDGE_CASES.md` | Known edge cases (EC-MEM-001–EC-SYS-007, 49 total) | ✅ Existing |
| `docs/ERROR_HANDLING.md` | Error handling patterns, error codes, response format | ✅ Existing |
| `docs/API_STANDARDS.md` | API conventions, pagination, filtering, endpoint catalog | ✅ Existing |
| `docs/CODING_STANDARDS.md` | General coding conventions for the project | ✅ Existing |
| `docs/TYPESCRIPT_STANDARDS.md` | TypeScript-specific conventions, strict mode rules | ✅ Existing |
| `docs/NAMING_CONVENTION.md` | File, folder, variable, component naming conventions | ✅ Existing |
| `docs/COMPONENT_GUIDELINES.md` | React component patterns, hooks, state management | ✅ Existing |
| `docs/IMPLEMENTATION_ROADMAP.md` | Development phases, sprint breakdown, risk assessment | ✅ Existing |
| `docs/DOCUMENTATION_MIGRATION_PLAN.md` | Documentation issue analysis and phased fix plan | ✅ Existing |
| `docs/ROADMAP.md` | Project roadmap, milestones, future phases | ✅ Existing |
| `docs/CURRENT_PHASE.md` | Current development phase, active priorities, blockers | ✅ Existing |
| `docs/DEPLOYMENT_GUIDE.md` | Deployment instructions, Docker, CI/CD, security checklist | ✅ Existing |
| `docs/MEMBERSHIP_SYSTEM_ARCHITECTURE.md` | Detailed membership module architecture, ERD, state machines, sequence diagrams, migration plan | ✅ Existing |
| `docs/modules/*.md` | Per-module documentation (19 modules: auth, booking, membership, etc.) | ✅ Existing |
| `docs/adr/*.md` | Architecture Decision Records (ADR-001 through ADR-010) | ✅ Existing |

> **Key**: ✅ Existing = file is present in the repo and verified.

---

## 6. Validation Checklist

**Before submitting ANY code**, the AI model MUST verify every item in this checklist.

```
[ ] No secrets committed — no API keys, tokens, passwords, or credentials in source files
[ ] All business rules followed — cross-reference BUSINESS_RULES.md for every business decision
[ ] All states handled — cross-reference STATE_MACHINES.md for every state transition
[ ] All permissions checked — cross-reference PERMISSION_MATRIX.md for every route/action
[ ] All edge cases handled — cross-reference EDGE_CASES.md for every feature
[ ] Error handling present on all async operations — every async function has try/catch or .catch()
[ ] Input validation present on all user-facing endpoints — Zod schemas used where applicable
[ ] No console.log in production code — all logging uses proper utilities
[ ] Imports use project conventions — ESM imports (backend), barrel exports where appropriate
[ ] No dead code or commented-out code — every line serves a purpose
[ ] No placeholder UI or mock data — pages render from real API responses
[ ] No model imports in controllers — controllers call services, not models
[ ] No direct model access in AI tools — gymTools calls services, not models
[ ] No new libraries added to package.json — unless explicitly approved
```

---

## 7. Architecture Invariants

These rules **must never be violated**, regardless of the feature being implemented:

1. **MVC with Service Layer**: `Routes → Controllers → Services → Models`. Controllers call services. Services call models. Never skip a layer.
2. **AI shares services with UI**: `gymTools.js` imports the same service functions that controllers use. No duplicate logic.
3. **LLM never touches MongoDB**: The AI Agent reads formatted text only, never raw database results.
4. **LLM never computes business logic**: All calculations and business rules are computed in service files.
5. **Error handling is uniform**: Backend uses `AppError` class + `sendError()` utility. Frontend uses Axios interceptor + Antd `message`.
6. **Auth is uniform**: Backend uses `protect` + `authorize()` middleware. Frontend uses Axios interceptor with token refresh.

---

## 8. Quick Reference

### Backend Commands

```bash
cd gym-backend
npm run dev              # Start with --env-file=.env
npm run dev:watch        # Start with nodemon
npm run start            # Production start
```

### Frontend Commands

```bash
cd gym-frontend
npm run dev              # Vite dev server
npm run build            # Production build
npm run lint             # ESLint check
npm run preview          # Preview production build
```

### Key Backend Files

| File | Purpose |
|------|---------|
| `server.js` | Express app entry point |
| `src/models/*.js` | Mongoose models (64) |
| `src/services/*.js` | Business logic services (32) |
| `src/controllers/*.js` | Request handlers (41) |
| `src/routes/*.js` | Route definitions (40) |
| `src/middlewares/authMiddleware.js` | Auth guards (protect, authorize, role shortcuts) |
| `src/utils/appError.js` | Standard error class |
| `src/utils/sendError.js` | Error response helper |
| `src/utils/featureCheck.js` | Plan feature authorization |
| `src/ai/agent/gymProAgent.js` | AI orchestration agent |
| `src/ai/tools/gymTools.js` | AI tools (must call services, not models) |

### Key Frontend Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component with routing |
| `src/services/api.ts` | Axios instance with interceptors, token refresh |
| `src/config/env.ts` | Environment variables (VITE_API_URL) |
| `src/context/AuthProvider.tsx` | Auth context provider |
| `src/context/ThemeContext.tsx` | Theme context (light/dark) |
| `src/pages/dashboard/member/` | Member-facing pages |
| `src/pages/dashboard/admin/` | Admin-facing pages |
| `src/pages/dashboard/staff/` | Staff-facing pages |
| `src/pages/dashboard/pt/` | PT-facing pages |
| `src/types/` | TypeScript type definitions |

---

> **Final reminder**: This file is the FIRST thing every AI reads. If you are an AI model, STOP now and proceed to read the files listed in Section 3 in the exact order specified.
