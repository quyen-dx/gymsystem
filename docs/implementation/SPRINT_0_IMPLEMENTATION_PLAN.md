# Sprint 0 Implementation Plan — Foundation

> **Sprint:** 0
> **Status:** Awaiting Approval
> **Parent Documents:** [01_SPRINT_0.md](01_SPRINT_0.md), [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md)
> **Governing Rules:** [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md), [AI_DEVELOPMENT_WORKFLOW.md](../AI_DEVELOPMENT_WORKFLOW.md)
> **Version:** 1.0.0
> **Last Updated:** 2026-07-20

---

## 1. Sprint Objective

Sprint 0 establishes the entire project infrastructure. Every subsequent sprint depends on it. When Sprint 0 completes, any developer must be able to clone the repository, run `npm install && npm run dev` from `gym-backend/`, and have a working Express server connected to MongoDB with health checks, structured logging, error handling, and CI/CD. The AI Core integration (Gemini) is wired up with a health check endpoint. Zero end-user modules are implemented. This sprint produces the foundation layer only — it is the root of the dependency tree.

---

## 2. Deliverables

All 15 deliverables from [01_SPRINT_0.md](01_SPRINT_0.md) §25:

| # | Deliverable | Description | Verification Method | Depends On |
|---|-------------|-------------|---------------------|------------|
| 1 | Repository structure with `.gitignore` | Root-level `.gitignore` covering `.env`, `node_modules/`, `dist/`, `logs/`; `gym-backend/src/` scaffold with all subdirectories. | `git status` shows no ignored files wrongly tracked; all directories in §3 and §4 exist. | None |
| 2 | `gym-backend/package.json` with all dependencies | Complete `package.json` with production and dev dependencies from §12, scripts for `dev`, `build`, `start`, `test`, `lint`. | `npm install` succeeds with zero errors and zero warnings. | Node.js v20, npm |
| 3 | `gym-backend/.env.example` | Template with all environment variables from §7.1, clear comments, placeholder values only. No secrets. | Every variable listed in §7.1 is present. No real API keys or passwords. | Config/env.js design |
| 4 | Root `docker-compose.yml` | MongoDB 7 + Mongo Express, replica-set initialization script. | `docker-compose up -d` → `docker ps` shows both containers running. | Docker Desktop |
| 5 | MongoDB connection with health check | `config/db.js` with connection, retry logic (3 retries, exponential backoff), event listeners, `healthCheck()` function returning latency. | `npm run dev` logs "MongoDB connected". Kill DB → logs "disconnected" → restart → auto-reconnect. `GET /api/v1/health/db` returns status + latency. | `config/env.js`, MongoDB running |
| 6 | Express app skeleton | `server.js` with CORS, Helmet, JSON parsing (10MB limit), cookie-parser, middleware stack, route mounting. | `GET /api/v1/health` returns 200 with valid JSON. CORS headers present. Helmet headers on all responses. | All config modules, all routes |
| 7 | `AppError` class | Custom error class extending `Error` with `statusCode`, `message`, `isOperational`, `errorCode`. | `new AppError('msg', 404)` produces object with correct properties and stack trace. | None |
| 8 | `catchAsync` wrapper | Async route handler wrapper: `fn → (req, res, next) → Promise.resolve(fn(req, res, next)).catch(next)`. | Async handler that rejects has its error forwarded to Express error handler. | None |
| 9 | Winston logger | `config/logger.js` with console transport (colored dev, JSON prod), file transport (`logs/app.log`, rotated daily), MongoDB transport (`logs` collection, graceful fallback). | Log messages appear in all three destinations. `LOG_LEVEL` env var controls verbosity. | `config/env.js` |
| 10 | Zod validators | `validators.js` with `objectIdSchema`, `emailSchema`, `paginationSchema`, `sortSchema`. | `objectIdSchema.parse('abc')` throws. `objectIdSchema.parse(valid24CharHex)` succeeds. Same for email and pagination. | `zod` package |
| 11 | Gemini provider config + tool registry + health check | `config/ai.js` initializes Gemini SDK from env vars. `ai/toolRegistry.js` supports `register(name, handler)` and `getTool(name)`. `ai/aiHealthCheck.js` pings Gemini. | `GET /api/v1/health/ai` returns valid status. Tool registry register/getTool works. | `config/env.js`, `@google/generative-ai` package |
| 12 | GitHub Actions CI/CD | `.github/workflows/ci.yml` triggers on push/PR. Steps: checkout → install → lint → build → test. | Push triggers CI run; all steps pass. Fails if any step fails. | GitHub repo exists |
| 13 | Multi-stage Dockerfile | `gym-backend/Dockerfile` with build stage (TypeScript → JavaScript) and production stage (Node.js Alpine). | `docker build -t gympro-backend .` succeeds. Image size is optimized (production only, no dev deps). | `package.json`, `tsconfig.json` |
| 14 | Unit tests | Tests for `AppError`, `catchAsync`, `validators`, `responseHelper`, `dateUtils`, `toolRegistry`. | `npm run test -- --coverage` shows >80% on `utils/` and `config/`. All tests pass. | All corresponding source files |
| 15 | Integration tests | Tests for health endpoints, DB connection, error handling, CORS. Uses `supertest` + `mongodb-memory-server`. | `npm run test:integration` passes. Covers all scenarios in §17. | All routes, `server.js` |

---

## 3. Repository Strategy

### 3.1 Repository Layout

Monorepo layout based on [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) §3.1:

```
gym-system/                          # Repository root
├── gym-backend/                     # Express API server (Sprint 0 focus)
│   ├── server.js                    # Entry point — Express bootstrap, middleware, routes, DB connect
│   ├── package.json                 # Dependencies + scripts
│   ├── tsconfig.json                # TypeScript 5.9 strict mode, ESM, path aliases
│   ├── .env.example                 # All env vars with placeholders
│   ├── Dockerfile                   # Multi-stage build
│   └── src/
│       ├── config/                  # Application configuration modules
│       │   ├── env.js               # Zod-validated environment variable loader
│       │   ├── db.js                # MongoDB connection, retry, health check
│       │   ├── logger.js            # Winston logger (console + file + MongoDB transports)
│       │   └── ai.js                # Gemini provider config from env
│       ├── middlewares/             # Express middleware
│       │   ├── errorHandler.js      # Global error handler (maps AppError → JSON, Mongoose errors → 4xx)
│       │   ├── requestLogger.js     # Correlation ID generation, request/response logging
│       │   ├── maintenance.js       # Maintenance-mode guard (stub)
│       │   └── rateLimiter.js       # express-rate-limit config (skeleton)
│       ├── utils/                   # Shared utilities (pure functions, no side effects)
│       │   ├── AppError.js          # Custom error class
│       │   ├── catchAsync.js        # Async route handler wrapper
│       │   ├── validators.js        # Zod schemas (ObjectId, email, pagination)
│       │   ├── responseHelper.js    # sendSuccess, sendPaginated response builders
│       │   └── dateUtils.js         # Date manipulation (Asia/Ho_Chi_Minh timezone)
│       ├── routes/                  # Express route definitions
│       │   ├── healthRoutes.js      # /health, /health/db, /health/ai, /version
│       │   └── index.js             # Central route aggregator (mounts all route modules at /api/v1)
│       ├── ai/                      # AI Core integration
│       │   ├── toolRegistry.js      # Tool registry (register/getTool stubs)
│       │   └── aiHealthCheck.js     # Gemini ping function
│       └── types/                   # TypeScript type definitions
│           └── (future: common.ts, health.ts, etc.)
├── gym-frontend/                    # React SPA (NOT modified in Sprint 0)
├── docs/                            # All project documentation
├── .github/workflows/               # CI/CD pipeline configuration
│   └── ci.yml                       # GitHub Actions workflow
├── docker-compose.yml               # MongoDB 7 + Mongo Express for local dev
└── .gitignore                       # Node.js template + .env + logs/ + dist/
```

### 3.2 Backend Strategy

- **Runtime:** Node.js v20 LTS
- **Framework:** Express 5 with ES modules (`"type": "module"` in `package.json`)
- **Language:** TypeScript 5.9, strict mode enabled
- **ODM:** Mongoose 9 (with plan to pin to Mongoose 8 LTS per [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) §9 if v9 proves unstable)
- **Dependency direction:** Routes → Middleware → Utils / Config (no controllers or services exist in Sprint 0)
- **All async handlers:** Wrapped in `catchAsync`
- **File naming:** camelCase for utilities, kebab-case for routes (consistent with [NAMING_CONVENTION.md](../NAMING_CONVENTION.md))
- **Exports:** Named exports for utilities; default exports for Express route modules

### 3.3 Frontend Strategy

The frontend (`gym-frontend/`) exists from the MVP phase and is **NOT modified in Sprint 0**. Only verification that it still builds after any root-level changes is required. The frontend uses React 19 + Vite per [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) §1.

### 3.4 Shared Strategy

- **Types:** Defined in `gym-backend/src/types/`. Future plan: extract to a shared package when frontend needs them.
- **Response formats:** Follow [API_STANDARDS.md](../API_STANDARDS.md) §5 (success) and §6 (pagination).
- **Error codes:** Follow [ERROR_HANDLING.md](../ERROR_HANDLING.md) §2 taxonomy.
- **Constants/Enums:** Co-located with types in `gym-backend/src/` directories dedicated to shared definitions.

---

## 4. Folder Creation Plan

Exact folders to create, their purpose, and dependency order:

| Order | Folder | Purpose | Depends On |
|-------|--------|---------|------------|
| 1 | `.github/workflows/` | CI/CD pipeline configuration | Root directory exists |
| 2 | `gym-backend/src/config/` | Configuration modules (env, db, logger, ai) | `gym-backend/` exists |
| 3 | `gym-backend/src/middlewares/` | Express middleware (error, logging, maintenance, rate limiting) | Config modules for logger |
| 4 | `gym-backend/src/utils/` | Shared utilities (pure functions, no side effects) | None |
| 5 | `gym-backend/src/routes/` | Route definitions (health, index aggregator) | Middleware, utils |
| 6 | `gym-backend/src/ai/` | AI Core integration (tool registry, health check) | Config for ai.js |
| 7 | `gym-backend/src/types/` | TypeScript type definitions | None |

**Notes:**
- `gym-backend/` and `gym-frontend/` already exist from the MVP phase. Sprint 0 adds structure **inside** `gym-backend/src/`.
- Each folder must be verified as existing after creation. No file is created before its parent folder exists.
- `gym-backend/src/controllers/` and `gym-backend/src/services/` are NOT created in Sprint 0 (empty directories are not committed; they will be created when Sprint 1 begins).
- `gym-backend/src/models/` is NOT created in Sprint 0 (no database collections are created in this sprint, only the connection is validated).

---

## 5. Architecture Decisions

### 5.1 Backend Architecture

- **Pattern:** MVC with Service Layer (`Routes → Controllers → Services → Models`). In Sprint 0, only the Routes layer is implemented (health routes). No Controllers, Services, or Models exist.
- **ESM:** Use `import`/`export` throughout. `package.json` sets `"type": "module"`.
- **ESLint:** `@typescript-eslint` with import ordering rules from [CODING_STANDARDS.md](../CODING_STANDARDS.md).
- **Error handling:** Central error middleware registered as the LAST middleware in Express. All errors subclass `AppError`. Async errors forwarded via `catchAsync`.
- **No barrel files:** Per [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) Part 7 (Imports), `index.js` is allowed ONLY in `routes/` as the route aggregator. No other `index.js` re-export files.

### 5.2 Frontend Architecture

Not modified in Sprint 0. React 19 SPA with Vite. Verify the existing build still works after root-level changes (e.g., `.gitignore`, `docker-compose.yml`).

### 5.3 Shared Architecture

- All shared utilities live in `gym-backend/src/utils/` — each with a single responsibility.
- Response helpers (`sendSuccess`, `sendPaginated`) enforce consistent API response format across all future endpoints.
- Zod validators (`objectIdSchema`, `emailSchema`, `paginationSchema`) are shared across all future routes.
- Date utilities (`dateUtils.js`) are timezone-aware using `Asia/Ho_Chi_Minh` as the default.

### 5.4 Configuration Architecture

- **Single source of truth:** `config/env.js` loads and validates ALL environment variables via Zod. No other module reads `process.env` directly.
- **`.env.example`:** The authoritative list of required and optional variables with documentation.
- **Environment profiles:** `NODE_ENV` switches between `development`, `staging`, and `production` behaviors.
  - Development: Colored console logs, CORS allows `localhost:5173`, stack traces in errors
  - Staging: JSON logs, CORS allows staging domain, no stack traces, monitoring enabled
  - Production: JSON logs, CORS restricted to production domain, no stack traces, full monitoring
- **Secrets:** NEVER committed. All secrets in `.env` (gitignored). Production secrets injected via Docker environment or secret manager.

### 5.5 Logging Architecture

- **Logger:** Winston with 3 transports:
  - **Console:** Colorized via `winston.format.combine(colorize, timestamp, printf)` in dev; JSON in staging/production
  - **File:** `logs/app.log`, daily rotation (max 5 files, max 10MB each), via `winston-daily-rotate-file` or manual rotation
  - **MongoDB:** `logs` collection (if DB connected; graceful fallback to console+file only if DB is down)
- **Log format:** `{ timestamp, level, message, correlationId, userId?, metadata? }`
- **Configuration:** `LOG_LEVEL` env var controls verbosity. `NODE_ENV` controls format.
- **Privacy:** NEVER log passwords, full tokens, payment details, or PII. Mask sensitive data per [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) Part 11.

### 5.6 Validation Architecture

- **Library:** Zod v3 for ALL validation — env vars, request bodies, query params, path params.
- **Shared schemas:** Defined in `validators.js` — `objectIdSchema`, `emailSchema`, `paginationSchema`, `sortSchema`.
- **Domain-specific schemas:** Co-located with their services in future sprints (not in `validators.js`).
- **Validation at startup:** `config/env.js` validates all env vars via Zod. Server refuses to start with invalid configuration.
- **Validation at runtime:** Query params validated per-route. Future sprints add middleware that parses `req.query`, `req.body`, `req.params` against Zod schemas.

### 5.7 Error Handling Architecture

- **`AppError` class:** `constructor(message, statusCode, errorCode?)`. Sets `isOperational = true`. Captures stack trace.
- **`catchAsync` wrapper:** `fn → (req, res, next) → Promise.resolve(fn(req, res, next)).catch(next)`.
- **Global error handler middleware:** Last middleware in Express stack. Four-parameter signature `(err, req, res, next)`.
  - Maps `AppError` instances → standard error JSON response
  - Maps Mongoose `ValidationError` → 422 with field details
  - Maps Mongoose `CastError` (invalid ObjectId) → 400
  - Maps `SyntaxError` (JSON parse failure) → 400
  - Maps unexpected errors → 500 with generic message
- **Error response format per [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1:**
  - `{ success: false, message: string, error: { code: string, statusCode: number, timestamp: string, requestId: string } }`
  - Development mode: includes `error.details` and `error.stack`.
  - Production mode: no stack trace, no internal details.

### 5.8 Dependency Injection

Not implemented in Sprint 0. Future approach per [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) Part 3: service functions accept dependencies as parameters (functional DI). Config modules (`db.js`, `logger.js`, `ai.js`) are the exception — they export initialized instances for direct import.

---

## 6. Shared Foundation

### 6.1 Shared Types

All types defined in `gym-backend/src/types/` under a `types/` directory. Follow [TYPESCRIPT_STANDARDS.md](../TYPESCRIPT_STANDARDS.md) conventions (PascalCase interfaces, discriminated unions).

- **`common.ts`:**
  - `PaginationParams`: `{ page: number, limit: number }`
  - `SortParams`: `{ sort: string }`
  - `ApiResponse<T>`: `{ success: true, data: T, message?: string }`
  - `PaginatedResponse<T>`: `{ success: true, data: T[], pagination: IPaginationMeta }`
  - `ApiError`: `{ success: false, message: string, error: { code: string, statusCode: number, details?: string, field?: string, timestamp: string, requestId: string } }`

- **`health.ts`:**
  - `HealthStatus`: `{ uptime: number, memoryUsage: { rss: number, heapTotal: number, heapUsed: number, external: number }, dbStatus: string, aiStatus: string, timestamp: string }`
  - `DbStatus`: `{ status: 'connected' | 'disconnected' | 'reconnecting' | 'error', latencyMs?: number, error?: string }`
  - `AiStatus`: `{ status: 'healthy' | 'degraded' | 'skipped' | 'unhealthy', model?: string, latencyMs?: number, error?: string }`
  - `MemoryUsage`: `{ rss: number, heapTotal: number, heapUsed: number, external: number }`

### 6.2 Shared Constants

- **`constants/httpStatus.ts`:**
  ```
  OK = 200, CREATED = 201, ACCEPTED = 202, NO_CONTENT = 204
  BAD_REQUEST = 400, UNAUTHORIZED = 401, FORBIDDEN = 403, NOT_FOUND = 404
  METHOD_NOT_ALLOWED = 405, CONFLICT = 409, UNPROCESSABLE_ENTITY = 422
  TOO_MANY_REQUESTS = 429
  INTERNAL_SERVER_ERROR = 500, BAD_GATEWAY = 502, SERVICE_UNAVAILABLE = 503
  ```

- **`constants/logLevels.ts`:**
  ```
  ERROR = 'error', WARN = 'warn', INFO = 'info', DEBUG = 'debug'
  ```

- **`constants/timeouts.ts`:**
  ```
  DB_CONNECTION_TIMEOUT = 30000 (30 seconds)
  HEALTH_CHECK_INTERVAL = 30000 (30 seconds)
  AI_REQUEST_TIMEOUT = 15000 (15 seconds)
  ```

### 6.3 Shared Enums

- **`enums/Environment.ts`:**
  ```
  DEVELOPMENT = 'development'
  STAGING = 'staging'
  PRODUCTION = 'production'
  ```

- **`enums/LogLevel.ts`:**
  ```
  ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3
  ```

- **`enums/DbStatus.ts`:**
  ```
  CONNECTED = 'connected'
  DISCONNECTED = 'disconnected'
  RECONNECTING = 'reconnecting'
  ERROR = 'error'
  ```

### 6.4 Shared Utilities

All utilities in `gym-backend/src/utils/`. Each is a standalone, pure-function module where possible.

- **`AppError.js`:**
  - Class extending `Error`
  - Constructor: `(message: string, statusCode: number, errorCode?: string)`
  - Properties: `statusCode`, `message`, `isOperational = true`, `errorCode`, `stack`
  - `Error.captureStackTrace(this, this.constructor)` for clean stack traces

- **`catchAsync.js`:**
  - Function: `(fn: Function) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`
  - Wraps any async Express route handler or middleware

- **`validators.js`:**
  - `objectIdSchema`: `z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')`
  - `emailSchema`: `z.string().email().toLowerCase().trim()`
  - `paginationSchema`: `z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })`
  - `sortSchema`: `z.string().optional()`

- **`responseHelper.js`:**
  - `sendSuccess(res, data, statusCode = 200)`: Sets status + `{ success: true, data }`
  - `sendPaginated(res, data, pagination)`: Sets status 200 + `{ success: true, data, pagination: { page, limit, total, totalPages } }`

- **`dateUtils.js`:**
  - `startOfDay(date, timezone = 'Asia/Ho_Chi_Minh')`: Returns start of day in specified timezone
  - `endOfDay(date, timezone = 'Asia/Ho_Chi_Minh')`: Returns end of day in specified timezone
  - `diffInDays(start, end)`: Computes day difference accounting for DST

### 6.5 Shared Interfaces

- **`IAppError`:** `{ statusCode: number, message: string, isOperational: boolean, errorCode?: string, stack?: string }`
- **`IHealthResponse`:** `{ uptime: number, memoryUsage: MemoryUsage, dbStatus: string, aiStatus: string, timestamp: string }`
- **`IPaginationMeta`:** `{ page: number, limit: number, total: number, totalPages: number }`
- **`ILogEntry`:** `{ timestamp: string, level: string, message: string, correlationId: string, userId?: string, metadata?: Record<string, unknown> }`

### 6.6 Shared DTOs

Not needed in Sprint 0. Will be defined per-module in future sprints (e.g., `CreateMembershipDTO`, `UpdateBookingDTO`). The DTO pattern will use Zod schemas for validation and TypeScript `z.infer<typeof schema>` for type inference.

### 6.7 Shared Response Objects

All response objects conform to [API_STANDARDS.md](../API_STANDARDS.md) §5 and [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1:

- **Success (single item):**
  ```json
  { "success": true, "data": { ... }, "message": "Optional message" }
  ```

- **Success (paginated list):**
  ```json
  {
    "success": true,
    "data": [ ... ],
    "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
  }
  ```

- **Error:**
  ```json
  {
    "success": false,
    "message": "Human-readable error message",
    "error": {
      "code": "ERROR_CODE",
      "statusCode": 400,
      "details": "Optional (development only)",
      "field": "Optional (validation errors only)",
      "timestamp": "2026-07-20T10:30:00.000Z",
      "requestId": "uuid"
    }
  }
  ```

---

## 7. Configuration Strategy

### 7.1 Environment Variables

Complete list of environment variables loaded by `config/env.js`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment: `development`, `staging`, `production` |
| `PORT` | No | `3000` | HTTP server port |
| `MONGODB_URI` | Yes | — | Primary MongoDB Atlas connection URI |
| `MONGODB_LOCAL_URI` | No | `mongodb://localhost:27017/gympro` | Local fallback MongoDB URI |
| `MONGODB_OPTIONS` | No | `{}` | JSON-stringified Mongoose connection options override |
| `GEMINI_API_KEY` | No | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model identifier |
| `GEMINI_MAX_TOKENS` | No | `1024` | Max tokens per Gemini request |
| `GEMINI_TEMPERATURE` | No | `0.7` | Gemini temperature setting |
| `LOG_LEVEL` | No | `info` | Winston log level (`error`, `warn`, `info`, `debug`) |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `JWT_SECRET` | No | `dev-secret-change-me` | JWT signing secret (not used in Sprint 0) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token expiry |
| `JWT_REFRESH_SECRET` | No | `dev-refresh-secret-change-me` | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |
| `MAINTENANCE_MODE` | No | `false` | Global maintenance mode flag |

### 7.2 Configuration Loading

- **`config/env.js`:** Loaded FIRST, before any other module. Uses `dotenv` to populate `process.env` from `.env` file, then validates all variables against a Zod schema.
- **Validation failure behavior:** Logs detailed error message (e.g., "Missing required env var: MONGODB_URI"), calls `process.exit(1)`.
- **All other config modules:** Import from `config/env.js` and never read `process.env` directly.
- **Default values:** Safe for development. Never include production secrets as defaults.

### 7.3 Secrets Management

- All secrets in `.env` (gitignored). The `.env.example` file has placeholder values (`your-api-key-here`).
- Production: Secrets injected via Docker environment variables, Kubernetes secrets, or cloud secret manager.
- **No default secret values** in code that could be accidentally used in production.
- All secrets starting with `dev-` are explicitly development-only and should never be used in production (enforced by a check in `config/env.js` if `NODE_ENV=production`).

### 7.4 Environment Profiles

The profile is determined by `NODE_ENV`. All behavior switches live in config modules, not scattered through application code:

| Behavior | Development | Staging | Production |
|----------|-------------|---------|------------|
| Console logs | Colored, human-readable | JSON | JSON |
| CORS origins | `localhost:5173` | Staging domain | Production domain |
| Stack traces in errors | Yes | No | No |
| Error details in response | Yes | No | No |
| MongoDB transport | Optional (graceful fail) | Required (log warning) | Required (log error) |
| Rate limiting | Lenient (1000/min) | Standard (100/min) | Strict (100/min) |
| Winston file transport | Enabled | Enabled | Enabled |
| Helmet | Enabled | Enabled | Enabled |
| Maintenance mode check | Disabled | Reads env var | Reads env var |

---

## 8. Logging Strategy

### 8.1 Logger (Winston)

Configured in `config/logger.js`:

- **Console transport:**
  - Development: `winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.printf(...))` — colorized, human-readable
  - Staging/Production: `winston.format.combine(winston.format.timestamp(), winston.format.json())` — structured JSON
- **File transport:**
  - Path: `logs/app.log`
  - Rotation: Daily, max 5 files, max 10MB each (via `winston-daily-rotate-file` or manual implementation)
  - Format: JSON (all environments for file transport — machine-parseable)
- **MongoDB transport:**
  - Collection: `logs`
  - Graceful fallback: If MongoDB is not connected, warn and continue without MongoDB transport
  - Does NOT block server startup if MongoDB is unavailable
- **Log levels:** `error` (0), `warn` (1), `info` (2), `debug` (3) — configurable via `LOG_LEVEL`

### 8.2 Request Logging

Middleware in `middlewares/requestLogger.js`:

- **Correlation ID:** From `X-Request-Id` request header, or generated UUID v4. Attached to `req.correlationId`.
- **Logged at start of request (info):** `{ method, path, correlationId, userAgent, ip, timestamp }`
- **Logged at end of request (info):** `{ method, path, statusCode, responseTime, correlationId }`
- **Does NOT log:** Request body (may contain PII), full tokens, passwords.
- Uses `res.on('finish', ...)` to capture response status and timing.

### 8.3 Error Logging

Handled in `middlewares/errorHandler.js`:

- **Log level rules:** `error` for 5xx status codes, `warn` for 4xx status codes.
- **Logged fields:** `{ correlationId, userId?, errorMessage: err.message, errorStack: err.stack, errorCode: err.errorCode, statusCode: err.statusCode, timestamp }`
- **Does NOT log:** Request body (may contain PII), full tokens, passwords, API keys.
- **Stack traces:** Logged at `error`/`warn` level. Only sent to client in development mode.

### 8.4 Audit Logging

Not implemented in Sprint 0 (requires user identity from Sprint 1). Infrastructure is prepared:

- Winston logger has `userId` field in metadata for future use
- MongoDB `logs` collection supports querying by `userId`, `type`, `timestamp`
- Audit events in future sprints will be logged at `info` level with `type: 'audit'` metadata

### 8.5 Security Logging

The following events are logged in Sprint 0:

| Event | Level | Rationale |
|-------|-------|-----------|
| Server startup | `info` | Track restarts and startup time |
| MongoDB connection established | `info` | Confirm connectivity |
| MongoDB connection lost | `warn` | Alert on degradation |
| MongoDB reconnection attempt | `info` | Track retry count |
| MongoDB connection failure (exhausted retries) | `error` | Alert on critical failure |
| Configuration validation failure | `error` | Server refuses to start — critical |
| Gemini health check failure | `warn` | AI subsystem degraded, not critical |
| Unknown/uncaught error | `error` | Critical — potential bug |
| Health endpoint hit | `debug` | Debugging only |
| Rate limit hit | `warn` | Potential abuse (future sprints) |

---

## 9. Validation Strategy

### 9.1 Zod Schemas

All schemas defined in `validators.js`:

- **`objectIdSchema`:** `z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')` — validates 24-character hex strings
- **`emailSchema`:** `z.string().email().toLowerCase().trim()` — standard email validation with normalization
- **`paginationSchema`:** `z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })` — coerces query string values to numbers, applies bounds
- **`sortSchema`:** `z.string().optional()` — placeholder for sort parameter validation

### 9.2 DTOs (Data Transfer Objects)

Not needed in Sprint 0. Starting from Sprint 1, each module defines its own DTOs using Zod schemas co-located with the module's service. Types are inferred via `z.infer<typeof schema>`.

### 9.3 Runtime Validation

- **Startup:** `config/env.js` validates all environment variables. Server exits with `process.exit(1)` on failure.
- **Request validation:** Health routes have no request body or query parameters. No runtime Zod middleware is needed in Sprint 0.
- **Future pattern:** A `validate(schema, source = 'body')` middleware that parses `req[source]` against a Zod schema and throws `AppError(400)` on failure.

### 9.4 Input Validation

In Sprint 0, the only input is the optional `X-Request-Id` header (correlation ID) — validated by checking it's a non-empty string or generating a UUID. Future sprints add full input validation:

- **Server-side:** Zod schemas per endpoint. Client validation is UX-only and never trusted.
- **Sanitization:** Trim strings, lowercase emails, strip control characters via Zod transforms.
- **Reject unexpected fields:** Zod `strict()` mode in production to prevent unvalidated input processing.

### 9.5 Environment Validation

- **`config/env.js`:** Uses Zod `z.object({...}).parse(process.env)` after `dotenv.config()`.
- **Failure output example:**
  ```
  [FATAL] Environment validation failed:
    - MONGODB_URI: Required
    - NODE_ENV: Invalid enum value. Expected 'development' | 'staging' | 'production', received 'prod'
  ```
- **Runs BEFORE any other module loads** — import order in `server.js` ensures `config/env.js` is the first `import`.

---

## 10. Error Handling Strategy

### 10.1 Global Errors

Central error handler in `middlewares/errorHandler.js`:

- Registered as the **LAST** middleware in the Express app.
- Four-parameter function: `(err, req, res, next)`.
- Catches and processes:
  - `AppError` instances → standard error response with `err.statusCode`
  - Mongoose `ValidationError` → 422 with field-level details
  - Mongoose `CastError` (invalid ObjectId) → 400 with message "Invalid ID format"
  - `SyntaxError` from JSON body parsing → 400 with message "Invalid JSON"
  - Generic `Error` → 500 with "Internal server error"
- Calls `logger.error(err)` or `logger.warn(err)` depending on status code.
- Sends standardized response per [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1.

### 10.2 Business Errors

Throw `new AppError(message, statusCode, errorCode)` from any route handler:

- **Example:** `throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND')`
- `isOperational` defaults to `true` — signals this is an expected error, not a bug.
- `errorCode` from [ERROR_HANDLING.md](../ERROR_HANDLING.md) §2 taxonomy.
- Returned with the specified `statusCode` (typically 4xx).

### 10.3 Validation Errors

- **Mongoose `ValidationError`:** Caught in error handler, mapped to `{ message: 'Validation failed', error: { code: 'VALIDATION_ERROR', statusCode: 422, details: fieldErrors } }`.
- **Zod `ZodError`:** Caught in error handler (future), mapped to `{ message: 'Validation failed', error: { code: 'VALIDATION_ERROR', statusCode: 400, details: formattedErrors } }`.
- **Mongoose `CastError`:** Caught when an invalid ObjectId is provided. Mapped to 400.
- **Custom validation:** Throw `AppError` with relevant status code and field name.

### 10.4 Authentication Errors

Not implemented in Sprint 0 (auth routes in Sprint 1). Error codes are prepared for future use:

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `AUTH_TOKEN_EXPIRED` | Token has passed its expiry | 401 |
| `AUTH_INVALID_TOKEN` | Token is malformed or tampered | 401 |
| `AUTH_INSUFFICIENT_PERMISSIONS` | User lacks required role | 403 |
| `AUTH_USER_NOT_FOUND` | User record does not exist | 404 |

Middleware stubs are in place for future attachment to protected routes.

### 10.5 Authorization Errors

Not implemented in Sprint 0. Error code `AUTH_INSUFFICIENT_PERMISSIONS` is prepared. Response format:
```
{ "success": false, "message": "Insufficient permissions", "error": { "code": "AUTH_INSUFFICIENT_PERMISSIONS", "statusCode": 403 } }
```

### 10.6 Unknown Errors

Any error not matched by a specific handler branch:

- **Logged** at `error` level with full stack trace.
- **Response in production:** `{ "success": false, "message": "Internal server error", "error": { "code": "SYSTEM_INTERNAL_ERROR", "statusCode": 500 } }`
- **Response in development:** Includes `error.details` (the `err.message` for unexpected errors), no stack trace in response body (stack is only in logs).

### 10.7 Unhandled Rejections and Exceptions

In `server.js`, register global handlers:

- **`process.on('unhandledRejection', ...)`:** Log the error, gracefully shut down server, then `process.exit(1)`.
- **`process.on('uncaughtException', ...)`:** Log the error, gracefully shut down server, then `process.exit(1)`.
- **Graceful shutdown:** Close HTTP server, disconnect Mongoose, flush Winston transports.

---

## 11. API Standards

### 11.1 Response Format

All responses follow [API_STANDARDS.md](../API_STANDARDS.md) §5 and §6:

- **Success (single):** `{ success: true, data: { ... } }` — status code 200 (default) or 201 for creation.
- **Success (list):** `{ success: true, data: [ ... ], pagination: { page, limit, total, totalPages } }` — status code 200.
- **Error:** `{ success: false, message: "...", error: { code: "...", statusCode: N } }` — status code matches error.
- **Version:** `{ success: true, data: { version, commit? , buildTimestamp? } }` — custom format for version endpoint.

### 11.2 Pagination

- **Default:** `page=1`, `limit=20`
- **Maximum limit:** `100` (enforced by Zod schema)
- **Query parameters:** `?page=1&limit=20` — validated by `paginationSchema`
- **Response metadata:** `{ page, limit, total, totalPages }` in `pagination` envelope
- **Not applicable in Sprint 0:** Health endpoints return single objects, no pagination needed.

### 11.3 Filtering

Not needed in Sprint 0. Pattern established for future sprints:
- `?field=value` — exact match
- `?dateFrom=ISO&dateTo=ISO` — date range
- `?status=active` — enum filter

### 11.4 Sorting

Not needed in Sprint 0. Pattern established for future sprints:
- `?sort=-createdAt` — descending
- `?sort=createdAt` — ascending
- Multiple sort fields separated by comma

### 11.5 Cursor-Based Pagination

Not needed in Sprint 0. Pattern for future (real-time data):
- `?cursor=<base64-encoded-token>&limit=20`
- Response includes `nextCursor` and `hasMore` instead of `page` and `totalPages`.

### 11.6 Error Response

Standard format per [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1, implemented in `responseHelper.js` error branch and `errorHandler.js` middleware:
- `message`: Human-readable, safe for client
- `error.code`: Machine-readable, from error taxonomy
- `error.statusCode`: HTTP status code
- `error.details`: Only in development mode
- `error.field`: Only for validation errors
- `error.timestamp`: ISO 8601 UTC
- `error.requestId`: Correlation ID

### 11.7 Success Response

Standard format per [API_STANDARDS.md](../API_STANDARDS.md) §5, implemented in `responseHelper.js`:
- `sendSuccess(res, data, statusCode = 200)`: Sets response status, sends `{ success: true, data }`.
- `sendPaginated(res, data, paginationMeta)`: Sets status 200, sends `{ success: true, data, pagination }`.
- Health endpoints use only `sendSuccess` (single objects, not paginated).

---

## 12. Dependencies

Every npm dependency required by Sprint 0, categorized with rationale:

### Production Dependencies

| Package | Version | Rationale |
|---------|---------|-----------|
| `express` | `^5.0.0` | HTTP framework providing routing, middleware, and request/response handling for the entire API server. |
| `mongoose` | `^9.0.0` | MongoDB ODM providing schema validation, connection management, and query building (plan to pin to 8 LTS if 9 proves unstable). |
| `cors` | `^2.8.5` | CORS middleware that restricts cross-origin requests to the configured whitelist, preventing unauthorized domain access. |
| `helmet` | `^8.0.0` | Security middleware that sets HTTP response headers (CSP, X-Frame-Options, HSTS, etc.) to protect against common web vulnerabilities. |
| `cookie-parser` | `^1.4.6` | Parses Cookie header and populates `req.cookies` — needed for JWT refresh tokens in Sprint 1 auth. |
| `morgan` | `^1.10.0` | HTTP request logger middleware (or replaced by custom `requestLogger.js` if more control is needed). |
| `winston` | `^3.17.0` | Structured logging library supporting multiple transports (console, file, MongoDB), log levels, and format customization. |
| `winston-mongodb` | `^6.0.0` | Winston transport that writes log entries directly to a MongoDB `logs` collection for centralized queryable logging. |
| `dotenv` | `^16.4.0` | Loads environment variables from `.env` file into `process.env` at application startup. |
| `zod` | `^3.24.0` | Runtime schema validation library used to validate all environment variables, request bodies, query params, and API responses. |
| `@google/generative-ai` | `^0.21.0` | Google Gemini SDK providing the API client for generative AI requests — used by the AI Core health check and future AI features. |
| `uuid` | `^11.0.0` | Generates RFC-compliant UUID v4 strings for correlation IDs (`X-Request-Id` header) enabling request tracing across logs. |
| `express-rate-limit` | `^7.5.0` | Rate limiting middleware protecting the API from abuse by capping request frequency per IP (foundation for BR-AUD-005). |
| `compression` | `^1.7.4` | Gzip/deflate compression middleware reducing response payload sizes for JSON and text responses. |
| `http-errors` | `^2.0.0` | Optional helper for creating HTTP error objects — may be used as an alternative to throwing `AppError` directly. |

### Dev Dependencies

| Package | Version | Rationale |
|---------|---------|-----------|
| `typescript` | `^5.9.0` | TypeScript compiler enabling static type checking, ESNext features, and strict mode enforcement for the entire codebase. |
| `@types/express` | `^5.0.0` | TypeScript type definitions for Express 5, providing type safety for request, response, and middleware signatures. |
| `@types/node` | `^22.0.0` | TypeScript type definitions for Node.js built-in modules (`fs`, `path`, `http`, `process`, etc.). |
| `@types/cors` | `^2.8.0` | TypeScript type definitions for the `cors` middleware. |
| `@types/morgan` | `^1.9.0` | TypeScript type definitions for the `morgan` HTTP request logger. |
| `@types/uuid` | `^10.0.0` | TypeScript type definitions for the `uuid` library. |
| `@types/compression` | `^1.7.0` | TypeScript type definitions for the `compression` middleware. |
| `@types/cookie-parser` | `^1.4.0` | TypeScript type definitions for `cookie-parser`. |
| `tsx` | `^4.0.0` | TypeScript execution engine (powered by esbuild) enabling `npm run dev` with hot-reload — no separate compilation step needed in development. |
| `jest` | `^30.0.0` | Test framework providing test runner, assertion library, mocking, coverage reporting, and snapshot testing. |
| `@types/jest` | `^30.0.0` | TypeScript type definitions for Jest globals (`describe`, `it`, `expect`, `jest.fn()`, etc.). |
| `ts-jest` | `^29.0.0` | Jest transformer that compiles TypeScript test files on-the-fly, enabling Jest to run `.ts` tests directly. |
| `eslint` | `^9.0.0` | Static analysis tool that enforces coding standards, catches potential bugs, and ensures consistent code style. |
| `@typescript-eslint/parser` | `^8.0.0` | ESLint parser that understands TypeScript syntax, enabling ESLint to lint `.ts` files. |
| `@typescript-eslint/eslint-plugin` | `^8.0.0` | ESLint rules specifically for TypeScript (no-unused-vars with type-aware, no-explicit-any, strict boolean expressions, etc.). |
| `prettier` | `^3.0.0` | Opinionated code formatter ensuring consistent formatting (quotes, semicolons, indentation, line width) across all files. |
| `eslint-config-prettier` | `^9.0.0` | Disables ESLint rules that conflict with Prettier, ensuring the two tools work together without rule clashes. |
| `mongodb-memory-server` | `^10.0.0` | Spins up an in-memory MongoDB instance for integration tests in CI — no external MongoDB service container required. |
| `supertest` | `^7.0.0` | HTTP assertion library that creates a test server from Express app, sends requests, and asserts on responses — used for integration tests. |
| `@types/supertest` | `^6.0.0` | TypeScript type definitions for `supertest`. |
| `winston-daily-rotate-file` | `^5.0.0` | Winston transport providing automatic daily log file rotation with configurable max files and max size. |

---

## 13. Package Installation Order

Exact installation order with rationale for each group:

### Step 1: Initialize package.json
```bash
cd gym-backend && npm init -y
```
Creates the package manifest if it doesn't already exist from the MVP phase.

### Step 2: TypeScript toolchain
```bash
npm i -D typescript @types/node tsx
```
TypeScript compiler, Node.js type definitions, and tsx for development hot-reload. These are needed before any other tooling because ESLint and ts-jest depend on TypeScript.

### Step 3: Linting and formatting
```bash
npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier
```
Code quality tools. Installed early so linting can be applied to all subsequent code.

### Step 4: Express framework and middleware
```bash
npm i express cors helmet cookie-parser morgan compression
```
The web framework and its core middleware. Must be installed before route or middleware files can be created.

### Step 5: Express type definitions
```bash
npm i -D @types/express @types/cors @types/morgan @types/compression @types/cookie-parser
```
TypeScript types for Express and middleware. Installed immediately after the packages they type.

### Step 6: MongoDB connection
```bash
npm i mongoose
```
Database ODM. Installed before config modules that depend on it (config/db.js).

### Step 7: Logging
```bash
npm i winston winston-mongodb dotenv winston-daily-rotate-file
```
Structured logging library with transports. dotenv for loading .env files. Installed before logger config.

### Step 8: Validation
```bash
npm i zod
```
Schema validation. Installed before validators.js and config/env.js.

### Step 9: Utilities
```bash
npm i uuid express-rate-limit
```
Correlation ID generation and rate limiting. Installed before middleware that depends on them.

### Step 10: Utility type definitions
```bash
npm i -D @types/uuid
```
Type definitions for uuid. Installed after the uuid package.

### Step 11: AI integration
```bash
npm i @google/generative-ai
```
Gemini SDK. Installed before AI config and health check modules.

### Step 12: Testing framework
```bash
npm i -D jest @types/jest ts-jest supertest @types/supertest mongodb-memory-server
```
Complete test toolchain. Installed last because tests are created last, but must be installed before writing any test code.

### Verification after each group:
- Run `npm install` after each group to verify clean installation.
- Check `package.json` reflects correct dependency types (`dependencies` vs `devDependencies`).
- No audit warnings or errors (or document known exceptions).

---

## 14. File Creation Order

Exact order of file creation with rationale. Each file is created only after its dependencies (npm packages and sibling modules) are in place.

### Phase 1: Project Scaffolding

No code compilation required — pure configuration files:

| # | File | Rationale |
|---|------|-----------|
| 1 | `.gitignore` (root) | Must exist before any commits. Excludes `node_modules/`, `dist/`, `logs/`, `.env`, `.env.local`, `.env.*.local`, `*.log`, `.DS_Store`, `coverage/`. Prevents accidental commit of secrets and build artifacts. |
| 2 | `gym-backend/tsconfig.json` | TypeScript configuration per [TYPESCRIPT_STANDARDS.md](../TYPESCRIPT_STANDARDS.md): `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `esModuleInterop: true`, `skipLibCheck: true`, `outDir: "./dist"`, `rootDir: "./src"`, path aliases (`@/` → `./src/`). |
| 3 | `gym-backend/.env.example` | Template with all environment variables from §7.1, clear comments explaining each variable, and placeholder values. No real secrets. Serves as the authoritative list of required configuration. |
| 4 | `.github/workflows/ci.yml` | GitHub Actions workflow defined early. Initially a minimal "hello world" job. Filled progressively as lint/build/test scripts are added. |

### Phase 2: Config Modules

Bootstrapping foundation — determines whether the application can even start:

| # | File | Rationale |
|---|------|-----------|
| 5 | `gym-backend/src/config/env.js` | **MUST be the first source module.** All other config modules depend on it. Loads `.env` via `dotenv`, validates all variables against a Zod schema, and exports a typed config object. Server refuses to start on invalid config. |
| 6 | `gym-backend/src/config/db.js` | Depends on `env.js` for `MONGODB_URI`. Implements Mongoose connection with event listeners (`connected`, `error`, `disconnected`, `reconnected`), retry logic (3 retries, exponential backoff: 1s, 2s, 4s), and `healthCheck()` function that pings the database and returns latency. |
| 7 | `gym-backend/src/config/logger.js` | Depends on `env.js` for `LOG_LEVEL` and `NODE_ENV`. Configures Winston with console transport (colored dev, JSON prod), file transport (daily rotation), and MongoDB transport (graceful fallback). Exports the `logger` instance. |
| 8 | `gym-backend/src/config/ai.js` | Depends on `env.js` for `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_TOKENS`, and `GEMINI_TEMPERATURE`. Initializes the Gemini generative model instance from `@google/generative-ai`. If API key is missing, logs a warning and exports `null` — AI enters degraded mode. |

### Phase 3: Shared Utilities

Pure functions with no dependencies on anything above except config for logging:

| # | File | Rationale |
|---|------|-----------|
| 9 | `gym-backend/src/utils/AppError.js` | Standalone class extending `Error`. Constructor sets `statusCode`, `message`, `isOperational = true`, and optional `errorCode`. Uses `Error.captureStackTrace` for clean stack traces. Zero external dependencies. |
| 10 | `gym-backend/src/utils/catchAsync.js` | Standalone wrapper function. Takes an async Express handler, returns a function that catches promise rejections and forwards them to `next()`. Zero external dependencies. |
| 11 | `gym-backend/src/utils/validators.js` | Depends on `zod` package. Exports `objectIdSchema`, `emailSchema`, `paginationSchema`, `sortSchema` — all Zod schemas used across the application. No dependency on project config. |
| 12 | `gym-backend/src/utils/responseHelper.js` | Standalone utility. Exports `sendSuccess(res, data, statusCode)` and `sendPaginated(res, data, paginationMeta)`. Formats responses to match [API_STANDARDS.md](../API_STANDARDS.md) §5 and §6. Zero external dependencies beyond Express `Response` type. |
| 13 | `gym-backend/src/utils/dateUtils.js` | Standalone utility. Exports `startOfDay(date, timezone)`, `endOfDay(date, timezone)`, `diffInDays(start, end)`. Timezone-aware using `Intl.DateTimeFormat` with `Asia/Ho_Chi_Minh` default. No npm dependencies beyond Node.js built-ins. |

### Phase 4: Middleware

Depends on config modules (logger) and utils (AppError):

| # | File | Rationale |
|---|------|-----------|
| 14 | `gym-backend/src/middlewares/requestLogger.js` | Depends on `config/logger.js`. Implements correlation ID generation (from `X-Request-Id` header or UUID v4), attaches to `req.correlationId`, logs request start and completion with method, path, status, duration. Uses `res.on('finish')` for completion logging. |
| 15 | `gym-backend/src/middlewares/errorHandler.js` | Depends on `config/logger.js` and `utils/AppError.js`. Four-parameter Express error handler. Maps AppError → JSON response, Mongoose ValidationError → 422, Mongoose CastError → 400, SyntaxError → 400, unexpected → 500. Formats response per [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1. |
| 16 | `gym-backend/src/middlewares/maintenance.js` | Skeleton middleware. Reads `MAINTENANCE_MODE` from `config/env.js`. If enabled, returns 503 with maintenance message. In Sprint 0, reads only from env var. Future sprints will read from `maintenance_mode` database collection. |
| 17 | `gym-backend/src/middlewares/rateLimiter.js` | Depends on `express-rate-limit` package and `config/env.js`. Exports a configured rate limiter middleware with `windowMs` and `max` from env vars. Serves as foundation for BR-AUD-005. |

### Phase 5: AI Core

Depends on config for AI settings:

| # | File | Rationale |
|---|------|-----------|
| 18 | `gym-backend/src/ai/toolRegistry.js` | Standalone module. Implements a Map-based tool registry with `register(name, handler, schema?)` and `getTool(name)`. Throws on duplicate registration. Returns `undefined` for unknown tool names. Pure in-memory data structure — no persistence. |
| 19 | `gym-backend/src/ai/aiHealthCheck.js` | Depends on `config/ai.js` and `config/logger.js`. Exports `checkAiHealth()` function that pings Gemini with a lightweight prompt (e.g., "Respond with 'ok'") and returns `{ status, model, latencyMs }`. If Gemini is not configured (no API key), returns `{ status: 'skipped' }`. On failure, returns `{ status: 'unhealthy', error }`. |

### Phase 6: Routes

Depends on middleware, utils, and AI:

| # | File | Rationale |
|---|------|-----------|
| 20 | `gym-backend/src/routes/healthRoutes.js` | Depends on `config/db.js`, `ai/aiHealthCheck.js`, `utils/responseHelper.js`. Defines four routes: `GET /health` (full status), `GET /health/db` (DB status), `GET /health/ai` (AI status), `GET /version` (API version info). Each handler uses `catchAsync` and `sendSuccess`. |
| 21 | `gym-backend/src/routes/index.js` | Central route aggregator. Imports `healthRoutes` and mounts it at `/api/v1`. Exports a single router for `server.js` to consume. Future sprints add more route modules here. |

### Phase 7: Entry Point

Depends on everything above:

| # | File | Rationale |
|---|------|-----------|
| 22 | `gym-backend/server.js` | The Express application assembly point. Imports in order: `config/env.js` (FIRST), `config/logger.js`, `config/db.js`. Creates Express app, applies middleware stack (helmet → cors → compression → cookie-parser → express.json → requestLogger → rateLimiter → maintenance → routes → errorHandler). Connects to MongoDB, starts HTTP server on `PORT`. Registers `unhandledRejection` and `uncaughtException` handlers. |

### Phase 8: Infrastructure

Independent of source code, depends on system-level tools:

| # | File | Rationale |
|---|------|-----------|
| 23 | `docker-compose.yml` (root) | Defines MongoDB 7 service with replica set configuration and Mongo Express admin interface. Includes health check, volume mounts for data persistence, and network configuration. Independent of application code. |
| 24 | `gym-backend/Dockerfile` | Multi-stage build: Stage 1 (build) — `node:20-alpine`, copies source, runs `npm ci`, compiles TypeScript. Stage 2 (production) — `node:20-alpine`, copies only `dist/` and production `node_modules/`, sets `NODE_ENV=production`, exposes port, runs `node dist/server.js`. Depends on `package.json` and `tsconfig.json`. |

### Phase 9: Tests

Created as corresponding source files are created:

| # | File | Rationale |
|---|------|-----------|
| 25 | `gym-backend/src/utils/AppError.test.ts` | Unit test for AppError class: verifies statusCode, message, isOperational, errorCode, stack capture. |
| 26 | `gym-backend/src/utils/catchAsync.test.ts` | Unit test for catchAsync wrapper: verifies successful handler invocation, rejected promise forwarded to next(). |
| 27 | `gym-backend/src/utils/validators.test.ts` | Unit test for Zod schemas: valid/invalid ObjectId, valid/invalid email, pagination defaults and boundaries. |
| 28 | `gym-backend/src/utils/responseHelper.test.ts` | Unit test for response helpers: correct status codes, body shape, pagination metadata. |
| 29 | `gym-backend/src/utils/dateUtils.test.ts` | Unit test for date utilities: timezone correctness, DST edge cases, leap year handling. |
| 30 | `gym-backend/src/ai/toolRegistry.test.ts` | Unit test for tool registry: register, getTool, duplicate registration error, missing tool returns undefined. |
| 31 | `gym-backend/src/__tests__/health.test.ts` | Integration test (supertest): all health endpoints return correct status codes and response shapes. |
| 32 | `gym-backend/src/__tests__/db.test.ts` | Integration test: MongoDB connection health check with connected and disconnected scenarios. |

---

## 15. Risks

### Technical Risks

| Risk | Probability | Impact | Description |
|------|-------------|--------|-------------|
| Mongoose 9 API incompatibility with docs | MEDIUM | HIGH | Breaking changes from Mongoose 8 may cause connection patterns, schema APIs, or event names to differ from those documented in [DATABASE.md](../DATABASE.md). Mitigation: pin to Mongoose 8 LTS as planned. |
| TypeScript path aliases not resolving | LOW | MEDIUM | `tsconfig.json` `paths` configuration (e.g., `@/` → `./src/`) may not resolve correctly with `tsx` or `ts-jest`, causing build or test failures. Mitigation: verify path alias resolution immediately after creating `tsconfig.json`. |
| MongoDB replica set not configured locally | MEDIUM | HIGH | Transactions in Sprint 2 require a replica set. If the `docker-compose.yml` single-node replica set init script fails, future payment/wallet/workout atomicity is blocked. Mitigation: document the replica-set setup in `docker-compose.yml` with a verified initialization script. |
| Gemini API quota exhausted or key missing | LOW | LOW | AI health check fails, but server starts normally with AI returning `status: 'skipped'` or `status: 'unhealthy'`. Mitigation: design AI health check to gracefully degrade — missing key = `skipped`, failure = `unhealthy`, success = `healthy`. |
| Docker Desktop license restrictions | MEDIUM | MEDIUM | Some team members cannot run Docker Desktop due to recent license changes. Mitigation: provide fallback instructions for installing MongoDB directly via `choco`/`brew`/`apt`. Docker Compose is a convenience, not a requirement. |
| CI runner does not support MongoDB service container | LOW | MEDIUM | GitHub Actions free-tier runners may have issues with MongoDB service containers. Mitigation: use `mongodb-memory-server` as a fallback for integration tests in CI — it runs entirely in-memory. |
| Winston MongoDB transport blocks server startup | LOW | MEDIUM | If MongoDB is down, the Winston MongoDB transport may throw an error during initialization, preventing logging from working. Mitigation: wrap MongoDB transport setup in try-catch, log warning, continue with console + file transports only. |

### Business Risks

| Risk | Probability | Impact | Description |
|------|-------------|--------|-------------|
| Incorrect environment configuration | LOW | CRITICAL | A wrong `MONGODB_URI` or missing required env var would block all development across all sprints. Mitigation: Zod validation at startup with clear error messages. `.env.example` as definitive reference. |
| `.env` accidentally committed to repository | LOW | CRITICAL | Real secrets (API keys, passwords) leaked to Git history. Mitigation: `.env` in `.gitignore` from the very first commit. Verify with `git status` after initial commit. If committed, rebase to remove from history and rotate all secrets. |

### Architecture Risks

| Risk | Probability | Impact | Description |
|------|-------------|--------|-------------|
| Express 5 beta instability | LOW | MEDIUM | Unexpected behavior in async error handling or middleware ordering could cause silent failures. Mitigation: test all middleware ordering thoroughly. Downgrade to Express 4 LTS if issues arise. |
| Monorepo structure inconsistencies | LOW | LOW | Frontend and backend builds could interfere with each other if root-level configs (e.g., root `tsconfig.json`, root `package.json` with workspaces) cause unexpected behavior. Mitigation: keep configurations fully separate — no root `tsconfig.json`, no npm workspaces. |
| Inconsistent Node.js versions across team | MEDIUM | LOW | "Works on my machine" issues if developers use different Node.js versions. Mitigation: specify `engines: { "node": ">=20.0.0 <23.0.0" }` in `package.json`. Add `.nvmrc` file with `20`. Verify Node version in `config/env.js`. |

---

## 16. Rollback Plan

| Scenario | Rollback Procedure |
|----------|--------------------|
| MongoDB connection fails in production configuration | Verify `MONGODB_URI`, check network access / IP whitelist, test with local MongoDB, check Atlas status. Server starts in degraded mode — health endpoint reports DB as `disconnected`. |
| Gemini API quota exhausted | AI health check returns `status: 'degraded'` or `status: 'unhealthy'`. Server starts normally without AI. No rollback needed — AI is a non-critical subsystem in Sprint 0. |
| CI pipeline blocks all PRs | Disable the failing step temporarily in `.github/workflows/ci.yml`, investigate, fix, re-enable. No code changes required. |
| `.env` committed to repository | Interactive rebase to remove the commit containing `.env` from history. Rotate ALL secrets immediately: API keys, JWT secrets (if real values used). Force-push the cleaned branch. |
| `package.json` corrupted | Revert to the previous commit: `git checkout HEAD~1 -- gym-backend/package.json gym-backend/package-lock.json`. Re-run `npm install`. |
| Winston crashes on startup | Temporarily comment out the MongoDB transport in `config/logger.js`. Server starts with console + file transports only. Re-enable MongoDB transport after debugging. |
| `docker-compose up` fails | Provide a local MongoDB setup script as fallback. Document exact steps for installing MongoDB 7.x directly on Windows/macOS/Linux. |
| Entire Sprint 0 needs rollback | Revert ALL initial commits. Since Sprint 0 has no downstream dependencies (no other sprint has begun), rollback is trivial: `git reset --hard` to the pre-Sprint-0 commit. No migration needed. No data to preserve. |

---

## 17. Testing Strategy

### Unit Tests (`file.test.ts` co-located with source)

| Test File | What It Tests | Key Scenarios |
|-----------|---------------|---------------|
| `AppError.test.ts` | Error creation, property assignment, stack capture | `statusCode` correctly set; `message` correctly set; `isOperational` defaults to `true`; `errorCode` set when provided; `stack` is a non-empty string; instance is `instanceof Error` |
| `catchAsync.test.ts` | Async wrapper behavior | Resolved promise → handler is called with `(req, res, next)`; rejected promise → `next(error)` is called; synchronous thrown error → `next(error)` is called; `req`, `res`, `next` objects are passed through correctly |
| `validators.test.ts` | Zod schemas for ObjectId, email, pagination | Valid 24-char hex string → accepted; invalid string → rejected with "Invalid MongoDB ObjectId"; valid email → accepted; invalid email → rejected; empty email → rejected. Pagination: defaults to `{ page: 1, limit: 20 }`; coerces string `"5"` to number `5`; rejects `page: 0` (min 1); rejects `limit: 101` (max 100) |
| `responseHelper.test.ts` | Success and paginated response builders | `sendSuccess(res, { id: 1 }, 201)` → status 201, body `{ success: true, data: { id: 1 } }`; `sendSuccess(res, data)` → status 200 (default); `sendPaginated(res, [], { page: 1, limit: 20, total: 0, totalPages: 0 })` → status 200, body includes `pagination` envelope |
| `dateUtils.test.ts` | Date helpers with timezone support | `startOfDay(new Date('2026-07-20T15:30:00Z'), 'Asia/Ho_Chi_Minh')` → returns 2026-07-20T00:00:00+07:00; `endOfDay` → returns 2026-07-20T23:59:59+07:00; `diffInDays` handles DST transitions correctly; `diffInDays` handles leap year (2024-02-28 to 2024-03-01 = 2 days) |
| `toolRegistry.test.ts` | Registry register and retrieval operations | `register('toolA', handler)` → tool stored; `getTool('toolA')` → returns the handler; `getTool('unknown')` → returns `undefined`; `register('toolA', anotherHandler)` → throws error for duplicate; registry counts are correct after multiple registrations |

### Integration Tests (`supertest` + `mongodb-memory-server`)

| Scenario | Endpoint | Assertions |
|----------|----------|------------|
| Server is healthy | `GET /api/v1/health` | Status 200; `success: true`; `data` has `uptime` (number), `memoryUsage` (object with `rss`, `heapTotal`, `heapUsed`), `dbStatus` (string), `aiStatus` (string), `timestamp` (ISO string) |
| DB is connected | `GET /api/v1/health/db` | Status 200; `data.status === 'connected'`; `data.latencyMs` is a non-negative number |
| DB is disconnected | `GET /api/v1/health/db` (with DB stopped) | Status 200 or 503; `data.status === 'disconnected'`; `data.error` contains a message |
| AI is healthy or skipped | `GET /api/v1/health/ai` | Status 200; `data.status` is one of `'healthy'`, `'skipped'`, `'unhealthy'`; `data.model` is a string if healthy; `data.latencyMs` is a number if healthy |
| Version endpoint | `GET /api/v1/version` | Status 200; `data.version` matches `package.json#version`; `data.node` is a string; `data.environment` is a string |
| 404 for unknown route | `GET /api/v1/nonexistent` | Status 404 (or 500 with message); `success: false`; `error.code` is set; `error.statusCode` is 404 (or 500 depending on Express fallback) |
| CORS headers present | `OPTIONS /api/v1/health` | `Access-Control-Allow-Origin` header present; `Access-Control-Allow-Methods` header present |
| Server starts with valid config | — | `npm run dev` starts without errors; server listens on expected `PORT`; health endpoint responds |
| Server fails with bad config | — | If `MONGODB_URI` is missing, `process.exit(1)` with clear error message (unit test for `config/env.js`) |

### Business Rule Tests

No business rules are directly implemented in Sprint 0. Structural verification:

| Rule Reference | Verification |
|----------------|-------------|
| BR-AUD-001 | The `logs` collection schema (created implicitly by Winston MongoDB transport) has a `timestamp` field usable for TTL indexing. Verify the log document structure includes a date field suitable for retention policies. |
| BR-AUD-005 | The rate limiter middleware (`express-rate-limit`) is configurable with `max: 5, windowMs: 15 * 60 * 1000` parameters. Verify that the exported rate limiter can accept custom configurations. |

---

## 18. Documentation Updates

After Sprint 0 implementation is complete, update these documents:

| Document | Change Required | Priority |
|----------|-----------------|----------|
| [README_FOR_AI.md](../README_FOR_AI.md) | Update "Repository structure" section if actual directory layout differs from the plan. Add note about new `src/` subdirectories (`config/`, `middlewares/`, `utils/`, `routes/`, `ai/`, `types/`). | MANDATORY |
| [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) | Verify §3.1 (Folder Structure) matches actual implementation. Update if any file paths differ from the documented structure. | MANDATORY |
| [CURRENT_PHASE.md](../CURRENT_PHASE.md) | Update "Active Priorities" section: mark Sprint 0 as Complete. Update "Next Steps" to point to Sprint 1. Update "Recently Completed" with Sprint 0 completion date. | MANDATORY |
| [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) | Mark Sprint 0 as completed in the sprint timeline. Update any status indicators. | HIGH |
| [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) | Add or update local development setup section with exact steps: clone repo → `npm install` → copy `.env.example` to `.env` → `docker-compose up` → `npm run dev`. | HIGH |
| [01_SPRINT_0.md](01_SPRINT_0.md) | Mark status as "Complete". Update "Last Updated" date. Verify all Definition of Done items in §16 are checked. | MANDATORY |
| [DOCUMENTATION_MIGRATION_PLAN.md](../DOCUMENTATION_MIGRATION_PLAN.md) | Add entry noting that `SPRINT_0_IMPLEMENTATION_PLAN.md` was created as a new document in the `docs/implementation/` directory. | LOW |
| [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md) | No changes expected (overview is static). Verify sprint status is consistent. | LOW |

---

## 19. Acceptance Criteria

All 24 acceptance criteria from [01_SPRINT_0.md](01_SPRINT_0.md) §17:

### Repository & Environment (AC-0.1 to AC-0.4)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.1 | Cloning the repository and running `npm install && npm run dev` in `gym-backend/` starts a working Express server. | Fresh clone on clean machine. `npm install` completes with 0 errors, 0 warnings. `npm run dev` outputs "Server listening on port 3000". |
| AC-0.2 | Server starts even if MongoDB is unavailable (graceful degradation, health check reports DB as DOWN). | Stop MongoDB. Start server. `GET /api/v1/health` returns 200 with `dbStatus: 'disconnected'`. |
| AC-0.3 | `.env.example` contains every required variable with clear comments, no secret values. | Compare `.env.example` against §7.1 table. All variables present. API keys = `your-api-key-here`. |
| AC-0.4 | `docker-compose up` starts MongoDB 7 and Mongo Express on the configured ports. | `docker-compose up -d` → `docker ps` shows `mongodb` and `mongo-express` containers running. Mongo Express accessible at `http://localhost:8081`. |

### Express App (AC-0.5 to AC-0.8)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.5 | `GET /api/v1/health` returns `{ success: true, data: { uptime, memoryUsage, dbStatus, aiStatus, timestamp } }`. | `curl http://localhost:3000/api/v1/health`. Response body matches format. All fields present and correctly typed. |
| AC-0.6 | CORS is configured with a whitelist (localhost origins only in dev). | OPTIONS preflight request returns `Access-Control-Allow-Origin: http://localhost:5173`. Other origins blocked. |
| AC-0.7 | JSON body parsing works for requests up to 10 MB. | `curl -X POST -H "Content-Type: application/json" -d '{"test": "data"}' http://localhost:3000/api/v1/health` — body parsed even if endpoint doesn't use it (no crash). Large payload > 10MB returns 413. |
| AC-0.8 | Helmet security headers are applied to all responses. | Check response headers for `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`. |

### Error Handling (AC-0.9 to AC-0.11)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.9 | Throwing `new AppError('message', 404)` in any route handler returns the standard error response format per [ERROR_HANDLING.md](../ERROR_HANDLING.md) §1. | Create a test route that throws AppError. `curl` the endpoint. Response: `{ success: false, message: 'message', error: { code, statusCode: 404 } }`. |
| AC-0.10 | Unhandled promise rejections and uncaught exceptions are caught globally and logged before process exit. | Trigger `Promise.reject('test')` in an async route without catchAsync. Verify Winston logs the error. Process handles error gracefully (logs, does not crash silently). |
| AC-0.11 | `catchAsync` correctly catches rejected promises and forwards errors to the Express error handler. | Write test: async handler that throws, wrapped in catchAsync. Verify `next(error)` is called and error handler middleware processes it. |

### Logging (AC-0.12 to AC-0.14)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.12 | All HTTP requests are logged with correlation ID, method, path, status code, and duration. | Make several requests, check console output and `logs/app.log`. Each request has: `correlationId`, `method`, `path`, `statusCode`, `responseTime`. |
| AC-0.13 | Winston logger writes to console (colored in dev, JSON in production), file (`logs/app.log`), and MongoDB (`logs` collection). | Set `NODE_ENV=development` → console has ANSI color codes. Set `NODE_ENV=production` → console has JSON. Check `logs/app.log` exists and contains log entries. Check MongoDB `logs` collection for entries. |
| AC-0.14 | Log level is configurable via `LOG_LEVEL` env var. | Set `LOG_LEVEL=debug` → debug messages appear. Set `LOG_LEVEL=error` → only error messages appear. |

### MongoDB Connection (AC-0.15 to AC-0.17)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.15 | MongoDB connection succeeds with the URI from `MONGODB_URI` env var. | Start server with valid `MONGODB_URI`. Winston logs "MongoDB connected". `GET /api/v1/health/db` returns `{ status: 'connected', latencyMs: <number> }`. |
| AC-0.16 | `GET /api/v1/health/db` returns `{ dbStatus: 'connected', latencyMs }` or `{ dbStatus: 'disconnected', error }`. | Test both scenarios: with DB running and with DB stopped. |
| AC-0.17 | Connection retries up to 3 times with exponential backoff (1s, 2s, 4s) before logging fatal error. | Stop MongoDB. Start server. Verify timing: ~1s, ~2s, ~4s between retry attempts. After 3 failures, logs "MongoDB connection failed after 3 retries". Server continues running. |

### AI Core (AC-0.18 to AC-0.20)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.18 | Gemini provider is configured from env vars (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_TOKENS`, `GEMINI_TEMPERATURE`). | Set env vars. Verify `config/ai.js` exports a Gemini model instance configured with the provided values. |
| AC-0.19 | `GET /api/v1/health/ai` sends a lightweight prompt and returns `{ aiStatus: 'healthy', model, latencyMs }`. | With valid API key: response includes `status: 'healthy'`, `model` name, non-zero `latencyMs`. Without API key: response includes `status: 'skipped'`. With invalid key: response includes `status: 'unhealthy'`, error message. |
| AC-0.20 | Tool registry supports `register(name, handler)` and `getTool(name)` calls. | Unit test: register tool → getTool returns handler. Duplicate registration throws. Unknown tool → returns undefined. |

### CI/CD (AC-0.21 to AC-0.24)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-0.21 | GitHub Actions workflow triggers on every push to any branch and every PR. | Push a commit. Verify workflow starts automatically. Open a PR. Verify workflow runs on the PR. |
| AC-0.22 | Workflow steps: checkout → install → lint → build → test. | Inspect the workflow log on GitHub Actions. All four steps (plus setup-node) are present and execute in order. |
| AC-0.23 | Workflow fails if any step fails. | Intentionally introduce a lint error. Push. Verify the workflow fails at the lint step. Fix the lint error. Push. Verify all steps pass. |
| AC-0.24 | Workflow runs on Node.js v20 with MongoDB service. | Inspect workflow YAML. `node-version: 20` is set. `mongodb-memory-server` or a MongoDB service container is configured for integration tests. |

---

## 20. Definition of Ready

Before Sprint 0 work begins, ALL of the following must be true. Per [01_SPRINT_0.md](01_SPRINT_0.md) §15 and [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md) §5:

- [ ] All documents listed in [01_SPRINT_0.md](01_SPRINT_0.md) §6 (Mandatory + Reference) have been read by every developer.
- [ ] MongoDB 7.x is installed locally or accessible via Docker. Replica set configuration verified.
- [ ] Node.js v20 LTS is installed on all development machines. Verify with `node --version`.
- [ ] Git is configured with correct user name and email. Verify with `git config --list`.
- [ ] GitHub repository exists and all team members have push access.
- [ ] GCP Gemini API key is provisioned and accessible OR acknowledged that AI will start in degraded mode (`skipped`).
- [ ] `.env.example` specification has been reviewed and signed off by the team.
- [ ] Sprint 0 task board created (GitHub Projects, Jira, Linear, or Trello) with all tasks broken down.
- [ ] Branch naming convention agreed: `feature/sprint-0/<task>`, `fix/sprint-0/<task>`, `docs/sprint-0/<task>`.
- [ ] Docker Desktop installed OR fallback local MongoDB setup documented.
- [ ] This implementation plan (`SPRINT_0_IMPLEMENTATION_PLAN.md`) has been reviewed and approved.
- [ ] All developers understand the dependency order: Sprint 0 → Sprint 1 → Sprint 2 → ..., no skipping.
- [ ] Development environment workspaces (VS Code, Cursor, or equivalent) configured with ESLint + Prettier extensions.

---

## 21. Definition of Done

All items from [01_SPRINT_0.md](01_SPRINT_0.md) §16 and [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) Part 16. Sprint 0 is NOT complete until EVERY item is verified:

### Build & Compilation
- [ ] `npm install` succeeds with zero errors and zero warnings (in `gym-backend/`).
- [ ] `npm run build` compiles all TypeScript to JavaScript without errors (`tsc` exits with code 0).
- [ ] `npm run lint` passes with zero errors and zero warnings (ESLint).
- [ ] `npm run format` (Prettier) produces no changes (all code already formatted correctly).

### Testing
- [ ] `npm run test` passes all unit tests with >80% coverage on `utils/` and `config/`.
- [ ] `npm run test:integration` passes all integration tests (health, DB connection, error handling, CORS).
- [ ] All 24 acceptance criteria (AC-0.1 through AC-0.24) are verified and passing.

### Runtime
- [ ] `npm run dev` starts the server with hot-reload (`tsx watch`), connects to MongoDB.
- [ ] Server starts even when MongoDB is unavailable (graceful degradation).
- [ ] `GET /api/v1/health` returns 200 with `{ success: true, data: { uptime, memoryUsage, dbStatus, aiStatus, timestamp } }`.
- [ ] `GET /api/v1/health/db` returns DB connectivity status with latency.
- [ ] `GET /api/v1/health/ai` returns AI status (healthy, skipped, or unhealthy).
- [ ] `GET /api/v1/version` returns version info.
- [ ] `GET /api/v1/nonexistent` returns standard error JSON with `success: false`.
- [ ] Throwing `new AppError('test', 418)` from any route returns standard error format.

### Infrastructure
- [ ] CI/CD pipeline (GitHub Actions) succeeds on the default branch — all steps pass.
- [ ] `docker-compose up -d` starts MongoDB 7 + Mongo Express without errors.
- [ ] `docker build -t gympro-backend .` in `gym-backend/` succeeds.
- [ ] `.gitignore` prevents `.env`, `node_modules/`, `dist/`, `logs/`, `coverage/`, `*.log` from being committed. Verify with `git status`.

### Code Quality
- [ ] No `console.log` statements in production code (only Winston logger).
- [ ] No TODO/FIXME markers in any committed code.
- [ ] No commented-out code in any committed file.
- [ ] All files are under 300 lines. Split if exceeded.
- [ ] All files listed in §14 (File Creation Order) exist with correct content.
- [ ] `.env.example` has no real secrets — all API keys show `your-api-key-here`.
- [ ] No unused imports or variables (enforced by ESLint).

### Documentation
- [ ] All documentation updates in §18 are complete.
- [ ] Code and documentation changes are in the same commit(s).
- [ ] [01_SPRINT_0.md](01_SPRINT_0.md) is marked as Complete.
- [ ] `CHANGELOG.md` (or equivalent) has a "Sprint 0: Foundation infrastructure deployed" entry.

### Review
- [ ] Code review completed and approved by at least one other developer.
- [ ] All review comments are resolved.
- [ ] AI self-review (§22) completed with all items verified.

---

## 22. AI Self-Review

Before marking Sprint 0 complete, the implementing AI (or reviewing developer) must verify each item per [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) Part 14:

### Architecture
- [ ] Dependency direction is correct: routes → middleware → utils/config. No reverse dependencies. No config module imports from utils. No utils module imports from middlewares/routes.
- [ ] No circular dependencies between config modules. `env.js` is imported by all config modules; no config module imports another config module that imports it back.
- [ ] All external APIs are behind service/config modules. `config/ai.js` wraps the Gemini SDK. `config/db.js` wraps Mongoose. No direct `@google/generative-ai` imports in routes.
- [ ] No model imports in routes (no models exist in Sprint 0). No controller or service files exist (correct — not needed in Sprint 0).
- [ ] Layer separation maintained: config modules handle configuration only; middleware handles cross-cutting concerns; utils are pure functions with no side effects; routes define endpoints.

### Business Rules
- [ ] No business rules violated. BR-AUD-001, BR-AUD-002, BR-AUD-004, BR-AUD-005 are *supported* by the infrastructure (logging, rate limiting) but not fully implemented — correct for Sprint 0.
- [ ] No new business rules invented. All implemented behavior is technical infrastructure, not business logic.
- [ ] All health endpoints are public (no auth required) — correct for Sprint 0 per [01_SPRINT_0.md](01_SPRINT_0.md) §11.

### Security
- [ ] Helmet middleware is applied globally before all routes.
- [ ] CORS whitelist restricts origins. In development, only `localhost` origins are allowed.
- [ ] No secrets in source code. All API keys, connection strings, and secrets are read from environment variables.
- [ ] `.env` is in `.gitignore`. Verified by checking `git status` shows `.env` as ignored.
- [ ] No sensitive data logged. Winston configuration excludes passwords, full tokens, and PII fields from log metadata.
- [ ] Rate limiter middleware is available (skeleton). Not yet enforcing limits is acceptable — Sprint 0 is configuration, not enforcement.
- [ ] Error responses in production hide stack traces. Only `error.message`, `error.code`, and `error.statusCode` are exposed.

### Performance
- [ ] MongoDB connection pool is configured with reasonable limits: `minPoolSize: 5`, `maxPoolSize: 20`.
- [ ] Health checks are lightweight: DB health check is a `db.admin().ping()` operation. AI health check is a single lightweight prompt. No heavy computation.
- [ ] No unnecessary middleware adds latency. The middleware stack is: helmet → cors → compression → cookie-parser → json → requestLogger → rateLimiter → maintenance → routes → errorHandler. All are standard, lightweight middleware.
- [ ] Winston file transport uses daily rotation to prevent disk fill. Max 5 files, max 10MB each.

### Scalability
- [ ] API is stateless — no in-memory session storage, no server-side state. All state is in MongoDB.
- [ ] Health check endpoint supports load balancer probes (returns 200, lightweight, no dependencies beyond the server itself).
- [ ] Database connection string supports replica set URIs (`mongodb://host1:27017,host2:27017/db?replicaSet=rs0`).
- [ ] Docker multi-stage build reduces image size by excluding dev dependencies and TypeScript source from the production image.

### Maintainability
- [ ] All configuration is centralized in `config/` directory. No configuration is scattered across route or utility files.
- [ ] All shared utilities are in `utils/` directory with clear, single responsibilities. Each utility file does exactly one thing.
- [ ] All files are under 300 lines. Boundaries: `server.js` may be the largest file (~150-200 lines expected); config modules ~50-80 lines each; middleware ~30-60 lines each; utils ~20-50 lines each.
- [ ] No commented-out code anywhere. No `/* old implementation */` blocks.
- [ ] No TODO/FIXME markers. If something is not implemented, it either doesn't exist or exists as a clean stub with a clear purpose (e.g., `maintenance.js` reads from env var as a stub for future DB-based check).
- [ ] All exports have consumers. No exported-but-unused functions, classes, or constants. Verified by ESLint `no-unused-vars` rule.
- [ ] TypeScript strict mode is enabled from the first commit. No `any` types without explicit justification. No `@ts-ignore` or `@ts-expect-error` comments.

---

## Appendix A: File List Summary

Complete list of every file created in Sprint 0:

| # | File | Phase | Type |
|---|------|-------|------|
| 1 | `.gitignore` | 1 | Configuration |
| 2 | `gym-backend/tsconfig.json` | 1 | Configuration |
| 3 | `gym-backend/.env.example` | 1 | Configuration |
| 4 | `.github/workflows/ci.yml` | 1 | CI/CD |
| 5 | `gym-backend/src/config/env.js` | 2 | Config Module |
| 6 | `gym-backend/src/config/db.js` | 2 | Config Module |
| 7 | `gym-backend/src/config/logger.js` | 2 | Config Module |
| 8 | `gym-backend/src/config/ai.js` | 2 | Config Module |
| 9 | `gym-backend/src/utils/AppError.js` | 3 | Utility |
| 10 | `gym-backend/src/utils/catchAsync.js` | 3 | Utility |
| 11 | `gym-backend/src/utils/validators.js` | 3 | Utility |
| 12 | `gym-backend/src/utils/responseHelper.js` | 3 | Utility |
| 13 | `gym-backend/src/utils/dateUtils.js` | 3 | Utility |
| 14 | `gym-backend/src/middlewares/requestLogger.js` | 4 | Middleware |
| 15 | `gym-backend/src/middlewares/errorHandler.js` | 4 | Middleware |
| 16 | `gym-backend/src/middlewares/maintenance.js` | 4 | Middleware |
| 17 | `gym-backend/src/middlewares/rateLimiter.js` | 4 | Middleware |
| 18 | `gym-backend/src/ai/toolRegistry.js` | 5 | AI Core |
| 19 | `gym-backend/src/ai/aiHealthCheck.js` | 5 | AI Core |
| 20 | `gym-backend/src/routes/healthRoutes.js` | 6 | Route |
| 21 | `gym-backend/src/routes/index.js` | 6 | Route |
| 22 | `gym-backend/server.js` | 7 | Entry Point |
| 23 | `docker-compose.yml` | 8 | Infrastructure |
| 24 | `gym-backend/Dockerfile` | 8 | Infrastructure |
| 25 | `gym-backend/src/utils/AppError.test.ts` | 9 | Unit Test |
| 26 | `gym-backend/src/utils/catchAsync.test.ts` | 9 | Unit Test |
| 27 | `gym-backend/src/utils/validators.test.ts` | 9 | Unit Test |
| 28 | `gym-backend/src/utils/responseHelper.test.ts` | 9 | Unit Test |
| 29 | `gym-backend/src/utils/dateUtils.test.ts` | 9 | Unit Test |
| 30 | `gym-backend/src/ai/toolRegistry.test.ts` | 9 | Unit Test |
| 31 | `gym-backend/src/__tests__/health.test.ts` | 9 | Integration Test |
| 32 | `gym-backend/src/__tests__/db.test.ts` | 9 | Integration Test |

**Total: 32 files created.** Zero files modified (Sprint 0 creates the initial codebase per [01_SPRINT_0.md](01_SPRINT_0.md) §14).

---

## Appendix B: Dependency Graph

Visual representation of module dependency order (arrows point from dependent to dependency):

```
server.js
  ├── config/env.js (MUST be first import)
  ├── config/logger.js → config/env.js
  ├── config/db.js → config/env.js
  ├── config/ai.js → config/env.js
  ├── routes/index.js
  │   └── routes/healthRoutes.js
  │       ├── config/db.js
  │       ├── ai/aiHealthCheck.js → config/ai.js, config/logger.js
  │       ├── utils/catchAsync.js
  │       └── utils/responseHelper.js
  ├── middlewares/requestLogger.js → config/logger.js
  ├── middlewares/errorHandler.js → config/logger.js, utils/AppError.js
  ├── middlewares/maintenance.js → config/env.js
  ├── middlewares/rateLimiter.js → config/env.js
  └── utils/AppError.js (no deps)
  └── utils/validators.js → zod
  └── utils/dateUtils.js (no deps)
  └── ai/toolRegistry.js (no deps)
```

---

## Appendix C: Express Middleware Stack Order

The exact order middleware is applied in `server.js`. Order matters — each middleware processes the request in the listed order:

```
1.  helmet()                       # Security headers — must be first
2.  cors(corsOptions)              # CORS — must be before routes
3.  compression()                  # Response compression
4.  cookieParser()                 # Parse cookies — before routes that read cookies
5.  express.json({ limit: '10mb' })# JSON body parsing — before routes
6.  express.urlencoded({ extended: true }) # URL-encoded body parsing
7.  requestLogger                  # Correlation ID + request logging
8.  rateLimiter                    # Rate limiting — before routes but after logging
9.  maintenance                    # Maintenance mode guard — before routes
10. routes (index.js)              # All API routes — /api/v1/*
11. (404 handler)                 # Catch-all for unmatched routes → throws AppError(404)
12. errorHandler                   # Global error handler — MUST be last
```

---

*END OF SPRINT_0_IMPLEMENTATION_PLAN*

> **This document is PLANNING ONLY.** It contains no source code, no pseudo-implementation, and no executable code blocks. It specifies what must be built, in what order, with what dependencies, and how to verify correctness. Any developer (human or AI) should be able to follow this plan to implement Sprint 0 without additional questions.
