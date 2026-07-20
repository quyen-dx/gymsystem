# Sprint 0 — Foundation

> **Sprint:** 0 (Foundation)
> **Duration:** 1–2 weeks
> **Phase:** Bootstrapping
> **Status:** Not Started

---

## 1. Sprint Goal

Establish the project infrastructure, development environment, shared utilities, and CI/CD pipeline that all subsequent sprints depend on. Every team member must be able to clone, install, start, and contribute code with zero manual environment fiddling by the end of this sprint.

---

## 2. Business Objectives

- Eliminate environment-related onboarding delays for new developers.
- Create a single source of truth for environment configuration across all environments (dev, staging, production).
- Guarantee that every pushed commit passes automated quality gates (lint, build, test) before code review.
- Provide a stable Express + MongoDB backbone with production-grade error handling, logging, and health checks.
- Wire up the Gemini AI provider so that the AI subsystem has a living integration point from day one.

---

## 3. Modules Included

| Module | Role in Sprint 0 |
|---|---|
| **System** | Repository scaffolding, environment config, Docker Compose, CI/CD pipeline. |
| **Shared** | Cross-cutting utilities: AppError, catchAsync, logger, Zod validators. |
| **AI Core** | Gemini provider config, tool-router skeleton, health-check endpoint. |

No end-user modules (`Auth`, `Membership`, `Payment`, etc.) are touched. This sprint delivers the **foundation layer** only.

---

## 4. Dependencies

None. Sprint 0 is the root sprint. Every other sprint depends on it.

---

## 5. Prerequisites

| Item | Description |
|---|---|
| **Node.js** | v20 LTS (or latest LTS matching `engines` in `package.json`) |
| **MongoDB** | v7.x, local instance or Docker container; replica set enabled for transaction support in later sprints |
| **Docker Desktop** | For `docker-compose.yml` (MongoDB + Mongo Express) |
| **GitHub Account** | With push access to the GymPro repository |
| **Google Cloud Account** | Gemini API key provisioned (for AI Core) |
| **npm / yarn** | Package manager (npm preferred per existing lockfile) |
| **Environment variables** | `.env` file created from `.env.example` or `docs/ENV_GUIDE.md` |

---

## 6. Documents to Read

### Mandatory — Read before writing any code

| Document | Rationale |
|---|---|
| `docs/README_FOR_AI.md` | Project identity, tech stack, repository structure. The single most important document. |
| `docs/PROJECT_OVERVIEW.md` | Mission, vision, tech stack details. |
| `docs/SYSTEM_ARCHITECTURE.md` | Layer responsibilities, folder structure, middleware stack. |
| `docs/DATABASE.md` §1 (Database Technology, Connection Configuration) | MongoDB version, connection URI format, replica-set requirement, pool sizing. |
| `docs/DATABASE_CONVENTIONS.md` (all sections) | Schema structure, field naming, index patterns, soft-delete, timestamps. |
| `docs/CODING_STANDARDS.md` | Language (TS 5.9 strict), Prettier config, ESLint rules. |
| `docs/TYPESCRIPT_STANDARDS.md` | TypeScript conventions, interfaces vs types, generics usage. |
| `docs/NAMING_CONVENTION.md` | File naming, variable casing, route naming. |
| `docs/ERROR_HANDLING.md` §1–§3 | Standard error response format (`AppError` class), taxonomy, HTTP mapping. |
| `docs/adr/ADR-001.md` | MongoDB decision and rationale. |
| `docs/adr/ADR-002.md` | Express framework decision. |
| `docs/adr/ADR-003.md` | JWT bearer token decision. |
| `docs/adr/ADR-004.md` | Gemini AI provider decision. |
| `docs/adr/ADR-010.md` | Socket.io decision (initial config only; full implementation in later sprint). |
| `docs/AI_CODING_CONSTITUTION.md` | Engineering philosophy, quality standards, maintainability goals. |
| `docs/AI_DEVELOPMENT_WORKFLOW.md` | Development lifecycle, context loading, task classification. |

### Reference — Skim before starting each sub-task

| Document | Rationale |
|---|---|
| `docs/AI_ARCHITECTURE.md` §1–§2 | AI system purpose, source priority policy (for Gemini config). |
| `docs/AI_WORKFLOW.md` | AI component flow (for tool-router skeleton). |
| `docs/API_STANDARDS.md` §1–§4 | Base URL, URL conventions, HTTP methods, request/response format. |
| `docs/BUSINESS_RULES.md` BR-AUD-001 through BR-AUD-005 | Audit & compliance rules: financial retention, GDPR, reconciliation, session limits, rate limiting. |
| `docs/EDGE_CASES.md` EC-SYS-* | System-level edge cases relevant to infrastructure. |

---

## 7. Business Rules

| Rule ID | Summary |
|---|---|
| **BR-AUD-001** | All financial records retained for 5 years — applies to logging infrastructure design. |
| **BR-AUD-002** | GDPR/data privacy: member data exportable within 72 hours — informs audit log schema. |
| **BR-AUD-003** | Daily reconciliation of payment gateway vs internal records — informs cron infrastructure. |
| **BR-AUD-004** | Concurrent session limit: max 3 devices per member — informs session middleware design. |
| **BR-AUD-005** | Rate limiting: max 5 failed OTP attempts per 15 minutes — informs rate-limit middleware. |

These rules are **not implemented** in Sprint 0 (they require user/auth infrastructure). However, the logging, rate-limiting, and cron infrastructure created here must **support** implementing them in later sprints.

---

## 8. State Machines

No state machines are implemented in Sprint 0. The following state machines are referenced for infrastructure design only:

- Notification State Machine (STATE_MACHINES.md §6): QUEUED → SENT → DELIVERED → READ — informs logger worker design.
- Payment State Machine (STATE_MACHINES.md §4): INITIATED → PROCESSING → COMPLETED/FAILED — informs response middleware design.

---

## 9. Permission Matrix

No permission checks are implemented in Sprint 0. The following rows from `docs/PERMISSION_MATRIX.md` inform middleware scaffolding:

| Resource | Action | Roles | Relevance |
|---|---|---|---|
| System Settings | View settings | Admin, Super Admin | Health-check endpoints should be public or restricted later. |
| System Settings | Update settings | Super Admin | Config endpoints should be Super Admin only. |
| System Settings | View logs | Admin, Super Admin | Log-viewing endpoint (future) needs role guard. |

---

## 10. Database Collections

Sprint 0 does not create any application collections. The following collections from `docs/DATABASE.md` §2 are **referenced for initial connection validation only**:

| Collection | Relevance |
|---|---|
| `logs` (§2.16) | Schema will be implemented for application logging (Winston → MongoDB transport). |
| `system_settings` (§2.14) | Schema referenced for environment config seeding. |
| `maintenance_mode` (§2.14) | Singleton referenced for maintenance-mode middleware. |

**Key activities:**
- Validate MongoDB connection with health check (ping every 30s).
- Implement retry logic with exponential backoff (3 retries, max 30s timeout).
- Create fallback in-memory logger when MongoDB is unreachable.

---

## 11. API Endpoints

Sprint 0 exposes only diagnostic/health endpoints. No CRUD endpoints.

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/health` | Public | — | Server health (uptime, memory, DB status, AI status). |
| `GET` | `/api/v1/health/db` | Public | — | MongoDB connectivity check (ping). |
| `GET` | `/api/v1/health/ai` | Public | — | Gemini AI connectivity check. |
| `GET` | `/api/v1/version` | Public | — | API version, git commit hash, build timestamp. |

All health endpoints conform to the standard response format defined in `docs/API_STANDARDS.md` §5.

---

## 12. AI Components

Only the **AI Core integration layer** is built in Sprint 0. No AI orchestration, RAG, or tool routing is implemented (those belong to the AI sprint, Sprint 5+).

| Component | Sprint 0 Scope | Future Scope |
|---|---|---|
| **Gemini Provider** | Config module (`aiConfig.js`), API key from env, model selection (`gemini-pro`). | Multi-model failover. |
| **Tool Router** | Skeleton only — `toolRegistry.js` with `register()` and `getTool()` stubs. | Full tool resolution with parameter validation. |
| **Health Check** | `/api/v1/health/ai` pings Gemini with a lightweight prompt. | N/A |
| **Gateway** | Not implemented. | Sprint 5+. |
| **Orchestrator** | Not implemented. | Sprint 5+. |
| **Intent Classifier** | Not implemented. | Sprint 5+. |
| **Planner** | Not implemented. | Sprint 5+. |
| **Permission Engine** | Not implemented. | Sprint 5+. |
| **Context Builder** | Not implemented. | Sprint 5+. |
| **RAG Router** | Not implemented. | Sprint 5+. |
| **Search Router** | Not implemented. | Sprint 5+. |
| **Vision Router** | Not implemented. | Sprint 5+. |
| **Calculator** | Not implemented. | Sprint 5+. |
| **Response Builder** | Not implemented. | Sprint 5+. |
| **Output Filter** | Not implemented. | Sprint 5+. |
| **Streaming Layer** | Not implemented. | Sprint 5+. |

---

## 13. Files Expected to be Created

### Repository Root

| File | Description |
|---|---|
| `.gitignore` | Node.js template + `.env` exclusion + logs/ directory. |
| `gym-backend/package.json` | Express 5, Mongoose 9, dependencies, scripts. |
| `gym-backend/tsconfig.json` | TypeScript 5.9 strict mode, ESM output. |
| `gym-backend/.env.example` | Template with all env vars, no secrets. |
| `gym-backend/Dockerfile` | Multi-stage build for production. |
| `docker-compose.yml` | MongoDB 7 + Mongo Express for local dev. |

### Backend — Config (`gym-backend/src/config/`)

| File | Description |
|---|---|
| `config/db.js` | MongoDB connection with retry logic, health check, event listeners (`connected`, `error`, `disconnected`). |
| `config/env.js` | Central env loader with Zod validation and defaults. |
| `config/logger.js` | Winston logger with console + file + MongoDB transports. |
| `config/ai.js` | Gemini provider config: API key, model, max tokens, temperature. |

### Backend — Entry Point

| File | Description |
|---|---|
| `gym-backend/server.js` | Express app bootstrap, middleware stack, route mounting, DB connection, HTTP server startup. |

### Backend — Middleware (`gym-backend/src/middlewares/`)

| File | Description |
|---|---|
| `middlewares/errorHandler.js` | Global error handler: maps AppError to HTTP response per ERROR_HANDLING.md §3. |
| `middlewares/requestLogger.js` | Morgan or custom request logger with correlation ID. |
| `middlewares/maintenance.js` | Maintenance-mode guard (reads `maintenance_mode` collection, placeholder — full logic in future sprint). |
| `middlewares/rateLimiter.js` | `express-rate-limit` with Redis or in-memory store (for BR-AUD-005 foundation). |

### Backend — Utilities (`gym-backend/src/utils/`)

| File | Description |
|---|---|
| `utils/AppError.js` | Custom error class: `statusCode`, `message`, `isOperational` flag. |
| `utils/catchAsync.js` | Async wrapper: catches rejected promises and forwards to `next()`. |
| `utils/validators.js` | Zod schemas for common inputs (MongoDB ObjectId, email, pagination params). |
| `utils/responseHelper.js` | Standard success response builder (`sendSuccess`, `sendPaginated`). |
| `utils/dateUtils.js` | Date helpers (startOfDay, endOfDay, diffInDays for Asia/Ho_Chi_Minh timezone). |

### Backend — Routes (`gym-backend/src/routes/`)

| File | Description |
|---|---|
| `routes/healthRoutes.js` | Health-check endpoints. |
| `routes/index.js` | Central route aggregator. |

### Backend — AI (`gym-backend/src/ai/`)

| File | Description |
|---|---|
| `ai/toolRegistry.js` | Tool registry with `register(name, handler, schema)` and `getTool(name)`. |
| `ai/aiHealthCheck.js` | Lights-out Gemini ping function. |

### CI/CD

| File | Description |
|---|---|
| `.github/workflows/ci.yml` | GitHub Actions: install → lint → build → test on every push/PR. |

### Docker

| File | Description |
|---|---|
| `docker-compose.yml` | MongoDB 7 + Mongo Express + app (optional). |
| `gym-backend/Dockerfile` | Multi-stage: build (TS → JS) + production (Node Alpine). |

---

## 14. Files Expected to be Modified

None. Sprint 0 creates the initial codebase. No existing files are modified.

---

## 15. Definition of Ready

All of the following must be true before Sprint 0 work begins:

- [ ] All documents listed in §6 have been read and understood by every developer.
- [ ] MongoDB 7.x is installed locally or accessible via Docker.
- [ ] Node.js v20 LTS is installed on all developer machines.
- [ ] `git` is configured with correct user name and email.
- [ ] GitHub repository exists and the team has push access.
- [ ] GCP Gemini API key is provisioned and accessible.
- [ ] `.env.example` file specification has been reviewed and signed off.
- [ ] Sprint 0 Jira/Linear/GitHub Project board is created with all tasks defined.
- [ ] Team has agreed on branch naming convention (`feature/sprint-0/*`, `fix/sprint-0/*`).

---

## 16. Definition of Done

All of the following must be true for Sprint 0 to be marked complete:

- [ ] `npm install` succeeds with zero errors and zero warnings.
- [ ] `npm run build` compiles all TypeScript to JavaScript without errors.
- [ ] `npm run lint` passes with zero errors and zero warnings.
- [ ] `npm run test` passes all tests (unit + integration).
- [ ] `npm run dev` starts the server with hot-reload and connects to MongoDB.
- [ ] All health endpoints return `200 OK` with valid JSON.
- [ ] CI/CD pipeline (GitHub Actions) succeeds on the default branch.
- [ ] `docker-compose up` starts MongoDB + Mongo Express without errors.
- [ ] `.gitignore` prevents `.env`, `node_modules/`, `dist/`, and `logs/` from being committed.
- [ ] Code review completed and approved by Tech Lead.
- [ ] All files in §13 exist with correct content.
- [ ] Documentation update checklist (§24) is complete.

---

## 17. Acceptance Criteria

### Repository & Environment

| ID | Criterion |
|---|---|
| AC-0.1 | Cloning the repository and running `npm install && npm run dev` in `gym-backend/` starts a working Express server. |
| AC-0.2 | The server starts even if MongoDB is unavailable (graceful degradation, health check reports DB as DOWN). |
| AC-0.3 | `.env.example` contains every required variable with clear comments, no secret values. |
| AC-0.4 | `docker-compose up` starts MongoDB 7 and Mongo Express on the configured ports. |

### Express App

| ID | Criterion |
|---|---|
| AC-0.5 | `GET /api/v1/health` returns `{ success: true, data: { uptime, memoryUsage, dbStatus, aiStatus } }`. |
| AC-0.6 | CORS is configured with a whitelist (localhost origins only in dev). |
| AC-0.7 | JSON body parsing works for requests up to 10 MB. |
| AC-0.8 | Helmet security headers are applied to all responses. |

### Error Handling

| ID | Criterion |
|---|---|
| AC-0.9 | Throwing `new AppError('message', 404)` in any route handler returns the standard error response format defined in `docs/ERROR_HANDLING.md` §1. |
| AC-0.10 | Unhandled promise rejections and uncaught exceptions are caught globally and logged before process exit. |
| AC-0.11 | `catchAsync` correctly catches rejected promises and forwards errors to the Express error handler. |

### Logging

| ID | Criterion |
|---|---|
| AC-0.12 | All HTTP requests are logged with correlation ID, method, path, status code, and duration. |
| AC-0.13 | Winston logger writes to console (colored in dev, JSON in production), file (`logs/app.log`), and MongoDB (`logs` collection). |
| AC-0.14 | Log level is configurable via `LOG_LEVEL` env var. |

### MongoDB Connection

| ID | Criterion |
|---|---|
| AC-0.15 | MongoDB connection succeeds with the URI from `MONGODB_URI` env var. |
| AC-0.16 | `GET /api/v1/health/db` returns `{ dbStatus: 'connected', latencyMs }` or `{ dbStatus: 'disconnected', error }`. |
| AC-0.17 | Connection retries up to 3 times with exponential backoff (1s, 2s, 4s) before logging fatal error. |

### AI Core

| ID | Criterion |
|---|---|
| AC-0.18 | Gemini provider is configured from env vars (`GEMINI_API_KEY`, `GEMINI_MODEL`). |
| AC-0.19 | `GET /api/v1/health/ai` sends a lightweight prompt (`"Respond with 'ok'"`) and returns `{ aiStatus: 'healthy', model, latencyMs }`. |
| AC-0.20 | Tool registry supports `register(name, handler)` and `getTool(name)` calls. |

### CI/CD

| ID | Criterion |
|---|---|
| AC-0.21 | GitHub Actions workflow triggers on every push to any branch and every PR. |
| AC-0.22 | Workflow steps: checkout → install → lint → build → test. |
| AC-0.23 | Workflow fails if any step fails. |
| AC-0.24 | Workflow runs on Node.js v20 with MongoDB service container. |

---

## 18. Testing Strategy

### Unit Tests

| Module | What to Test | Tool |
|---|---|---|
| `AppError` | Constructor sets `statusCode`, `message`, `isOperational = true`. `err.stack` is captured. | Jest (or Vitest) |
| `catchAsync` | Wrapped function resolves → passes result to `req`/`res`. Wrapped function rejects → calls `next(error)`. | Jest |
| `validators` | ObjectId schema rejects invalid strings, accepts valid 24-char hex. Email schema rejects malformed emails. Pagination schema coerces strings to numbers and clamps to min/max. | Jest + Zod |
| `responseHelper` | `sendSuccess(res, data, 201)` sets correct status and body. `sendPaginated(res, data, { page, limit, total })` includes `pagination` envelope. | Jest |
| `dateUtils` | `startOfDay` returns 00:00:00.000 in Asia/Ho_Chi_Minh. `diffInDays` handles DST transitions correctly. | Jest |
| `toolRegistry` | `register()` adds tool to map. `getTool()` returns undefined for unknown tool. Duplicate registration throws. | Jest |

### Integration Tests

| Scenario | What to Test |
|---|---|
| Server startup | Server listens on configured `PORT`. Health endpoint returns 200. |
| MongoDB connection | `GET /api/v1/health/db` returns `connected` when DB is reachable. |
| MongoDB failure | When DB is stopped, health endpoint reports `disconnected` but server remains responsive. |
| Error response | `GET /api/v1/nonexistent` returns standard error JSON with `success: false`. |
| AI health | `GET /api/v1/health/ai` pings Gemini and returns healthy/unhealthy. |

### Business Rule Tests

No business rules are directly implemented in Sprint 0. The following structural tests apply:

| Rule | Test |
|---|---|
| BR-AUD-001 | Verify that the `logs` collection schema supports a `createdAt` field with a TTL index (optional, configurable). |
| BR-AUD-004 | Verify that the rate limiter middleware can be configured for a `max: 3` limit per user (future). |
| BR-AUD-005 | Verify that the rate limiter middleware can be configured for `max: 5, windowMs: 15 * 60 * 1000` (future). |

### Permission Tests

Not applicable. No RBAC middleware is implemented in Sprint 0.

---

## 19. Rollback Strategy

| Change Type | Rollback Method |
|---|---|
| **New files** | Delete the file. No downstream dependencies exist in Sprint 0. |
| **npm packages** | Revert `package.json` and `package-lock.json` to prior commit. |
| **Docker Compose** | `docker-compose down -v` removes containers and volumes. |
| **CI/CD workflow** | Delete `.github/workflows/ci.yml`. No effect on code. |
| **Environment variables** | Restore `.env.example` from git history. No secrets are committed. |

Since Sprint 0 has no dependencies, rollback is trivial — revert the initial commit.

---

## 20. Risks

| ID | Risk | Probability | Impact |
|---|---|---|---|
| R-0.1 | MongoDB replica set not configured → transactions will be unavailable in later sprints, blocking payment/wallet atomicity. | MEDIUM | HIGH |
| R-0.2 | Gemini API key not provisioned or has quota limits → AI health check fails, AI Core integration blocked. | MEDIUM | LOW |
| R-0.3 | Docker Desktop license restrictions (recent policy changes) → some team members cannot run Docker Compose locally. | MEDIUM | MEDIUM |
| R-0.4 | Mongoose 9 breaking changes vs Mongoose 8 → connection or schema patterns differ from DATABASE.md expectations. | LOW | MEDIUM |
| R-0.5 | TypeScript strict mode reveals type errors in initial scaffolding that slow down bootstrapping. | LOW | LOW |
| R-0.6 | GitHub Actions runner does not support MongoDB service container on free tier → CI builds fail on DB tests. | LOW | MEDIUM |

---

## 21. Risk Mitigation

| Risk ID | Mitigation |
|---|---|
| R-0.1 | Document MongoDB replica-set setup in `docker-compose.yml` with a single-node replica set configuration script. Add a pre-flight check in `server.js` that warns if `replicaSet` is not detected. |
| R-0.2 | Request API key at sprint planning. Add a fallback: if `GEMINI_API_KEY` is missing, the AI health check returns `skipped` instead of `healthy` and logs a warning — server still starts. |
| R-0.3 | Provide a fallback: install MongoDB directly via `brew`/`apt`/`choco` with a setup script (`scripts/setup-mongo.sh` / `scripts/setup-mongo.ps1`). Docker Compose is a convenience, not a requirement. |
| R-0.4 | Pin Mongoose to v8 LTS in `package.json` if v9 proves problematic. The `DATABASE.md` already notes the planned downgrade. Keep an eye on the Mongoose changelog. |
| R-0.5 | Start with `"strict": true` from day one. Fix any type errors as they arise — it's easier now than later. |
| R-0.6 | Use `mongodb-memory-server` as a fallback for CI tests that require a database. It runs in-memory without a service container. |

---

## 22. Estimated Implementation Order

1. **Repository scaffolding**: `.gitignore`, root `README.md` update, `gym-backend/package.json`, `tsconfig.json`.
2. **Environment config**: `config/env.js` with Zod validation, `.env.example`.
3. **Docker Compose**: `docker-compose.yml` with MongoDB 7 + Mongo Express + replica-set init script.
4. **MongoDB connection**: `config/db.js` with retry, event listeners, health-check function.
5. **Shared utilities**: `AppError`, `catchAsync`, `responseHelper`, `validators`, `dateUtils`.
6. **Logger**: `config/logger.js` with Winston transports (console, file, MongoDB).
7. **Express app skeleton**: `server.js` with CORS, Helmet, JSON parsing, cookie parsing.
8. **Middleware**: `errorHandler`, `requestLogger`, `maintenance` (stub), `rateLimiter` (skeleton with configurable limits).
9. **Health routes**: `routes/healthRoutes.js` with `/health`, `/health/db`, `/health/ai`, `/version`.
10. **AI Core**: `config/ai.js` (Gemini config), `ai/toolRegistry.js` (skeleton), `ai/aiHealthCheck.js`.
11. **CI/CD**: `.github/workflows/ci.yml`.
12. **Dockerfile**: Multi-stage `gym-backend/Dockerfile`.
13. **Integration tests**: Server startup, health endpoints, MongoDB connection, AI health check.
14. **Unit tests**: AppError, catchAsync, validators, responseHelper, dateUtils, toolRegistry.
15. **Documentation update**: Update all files listed in §24.
16. **Review & merge**: PR created, code review, merge to main.

---

## 23. Review Checklist

Before marking Sprint 0 complete, verify each item:

- [ ] All files listed in §13 exist with the correct content.
- [ ] `npm install` produces zero warnings.
- [ ] `npm run lint` passes (ESLint + Prettier).
- [ ] `npm run build` produces JavaScript output in `dist/`.
- [ ] `npm run test` passes all tests with >80% coverage on utilities.
- [ ] `docker-compose up -d` starts MongoDB and Mongo Express.
- [ ] `npm run dev` starts Express and connects to MongoDB.
- [ ] `curl http://localhost:{PORT}/api/v1/health` returns `200` with all status fields.
- [ ] `curl http://localhost:{PORT}/api/v1/health/db` returns MongoDB connectivity status.
- [ ] `curl http://localhost:{PORT}/api/v1/health/ai` returns Gemini status (or `skipped` if no key).
- [ ] `curl http://localhost:{PORT}/api/v1/nonexistent` returns standard error JSON with `success: false`.
- [ ] Throwing `new AppError('test', 418)` from any route returns `{ success: false, message: 'test', error: { code: 'INTERNAL_ERROR', statusCode: 418 } }`.
- [ ] Winston logger writes to console with color (dev) or JSON (production).
- [ ] Winston logger writes to `logs/app.log` (file transport).
- [ ] Winston logger writes to MongoDB `logs` collection (if DB is connected).
- [ ] `.gitignore` excludes `.env`, `node_modules/`, `dist/`, `logs/`.
- [ ] `.env.example` has no secret values (API keys = `your-api-key-here`).
- [ ] GitHub Actions CI runs successfully on the feature branch.
- [ ] No `console.log` statements in production code (only via Winston).
- [ ] Code review comments are resolved.

---

## 24. Documentation Update Checklist

After Sprint 0 code is complete, update these documents:

- [ ] `docs/README_FOR_AI.md` — Update "Repository structure" to reflect actual directories created.
- [ ] `docs/PROJECT_OVERVIEW.md` — No changes expected (Sprint 0 doesn't change tech stack).
- [ ] `docs/SYSTEM_ARCHITECTURE.md` — Update "Folder Structure" (§3.1) if actual files differ from planned.
- [ ] `docs/DEPLOYMENT_GUIDE.md` — Add section on local development setup (or create if missing).
- [ ] `docs/CURRENT_PHASE.md` — Update to indicate Sprint 0 completion and readiness for Sprint 1.
- [ ] `docs/IMPLEMENTATION_ROADMAP.md` — Mark Sprint 0 as completed.
- [ ] `docs/DOCUMENTATION_MIGRATION_PLAN.md` — Add entry for any new environment guide created.
- [ ] `CHANGELOG.md` (root) — Add entry: "Sprint 0: Foundation infrastructure deployed."

---

## 25. Deliverables

| # | Deliverable | Verification |
|---|---|---|
| 1 | Repository structure with `.gitignore` | `ls -la` shows expected files; `git status` shows no ignored files wrongly tracked. |
| 2 | `gym-backend/package.json` with all dependencies | `npm install` succeeds. |
| 3 | `gym-backend/.env.example` with all variables documented | `cat .env.example` shows every required var. |
| 4 | Working `docker-compose.yml` | `docker-compose up -d` → `docker ps` shows MongoDB and Mongo Express. |
| 5 | MongoDB connection with health check, retry, event listeners | `npm run dev` logs "MongoDB connected". Kill DB → logs "disconnected" → restart DB → auto-reconnect. |
| 6 | Express app skeleton with CORS, Helmet, JSON parsing | `curl http://localhost:{PORT}/api/v1/health` returns 200. |
| 7 | `AppError` class | `new AppError('msg', 400)` produces a proper error object with stack trace. |
| 8 | `catchAsync` wrapper | Async route handlers that throw/reject are caught and forwarded to error handler. |
| 9 | Winston logger (console + file + MongoDB) | Log messages appear in all three destinations. |
| 10 | Zod validators for ObjectId, email, pagination | `objectIdSchema.parse('abc')` throws ZodError. `objectIdSchema.parse(validHex)` succeeds. |
| 11 | Gemini provider config + health check | `GET /api/v1/health/ai` returns valid status. Tool registry skeleton works. |
| 12 | GitHub Actions workflow (install → lint → build → test) | Push triggers CI run; all steps pass. |
| 13 | Multi-stage Dockerfile | `docker build -t gympro-backend .` succeeds. |
| 14 | Unit tests for all shared utilities | `npm run test -- --coverage` shows >80% on `utils/` and `config/`. |
| 15 | Integration tests for health endpoints | `npm run test:integration` passes. |

---

*Sprint 0 document generated from `docs/BUSINESS_RULES.md`, `docs/DATABASE.md`, `docs/ERROR_HANDLING.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/AI_ARCHITECTURE.md`, `docs/AI_CODING_CONSTITUTION.md`, `docs/AI_DEVELOPMENT_WORKFLOW.md`, and all referenced ADRs and module docs.*
