# ARCHITECTURE_DIFF — Task 0.7

> **Date:** 2026-07-20
> **Sprint:** 0 (Foundation)
> **Task:** 0.7 — Application Bootstrap & Entry Point Integration

---

## Bootstrap Components Added

| Component | Location | Purpose |
|-----------|----------|---------|
| `createApp()` | `src/app.js` | Express application factory — assembles full middleware pipeline + all route mounts |
| Startup sequence | `server.js` | Structured boot: validate config → connect DB → start HTTP server |
| Graceful shutdown | `server.js` | SIGTERM/SIGINT: drain → close DB → exit. 10s drain timeout. |
| Crash handlers | `server.js` | unhandledRejection + uncaughtException → structured log → exit(1) |

## Startup Flow Changes

**BEFORE (server.js monolithic):**
```
dotenv → express() → cors → json → urlencoded → cookie → session → passport
  → maintenance → 40+ routes → 404 inline → error inline → httpServer
  → socketIO → cron → listen → connectDB
```

**AFTER (app.js factory + server.js):**
```
[app.js] helmet → cors → raw routes → json → urlencoded → cookie
  → requestId → requestLogger → rateLimiter → session → passport → maintenance
  → infraRoutes (/api/v1) → 40+ routes → system status → notFound → errorHandler

[server.js] dotenv → createApp() → httpServer → socketIO → cron
  → await connectDB() → listen → logger.info('listening')
  → register SIGTERM/SIGINT/unhandledRejection/uncaughtException handlers
```

### Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Helmet | Not present | Added FIRST in middleware stack |
| requestId | Not present | Correlation ID on every request |
| requestLogger | Not present (only morgan in scripts) | Structured Winston logging per request |
| rateLimiter | Not present | `express-rate-limit` with env-configured limits |
| 404 handler | `res.status(404).json({ message })` inline | `notFound` middleware → throws AppError('ROUTE_NOT_FOUND') |
| Error handler | `sendError(res, err)` with console.error | `errorHandler` — 5 error types, structured logging, production-safe |
| System endpoints | /api/system/status, /api/system/reconnect | Preserved + new /api/v1/health, /ready, /live, /metrics, /version, /info |
| Startup logging | `console.log` | Winston structured logger |
| Shutdown | None (process killed) | Graceful: drain → close DB → exit |
| Crash handling | None (default Node behavior) | unhandledRejection + uncaughtException with structured logging |

## Dependency Changes

### New Dependencies

```
server.js
  → src/app.js                       (Express factory)
  → src/config/logger.js             (Winston)
  → src/config/env.js                (env config)

src/app.js
  → src/middlewares/requestId.js     (NEW)
  → src/middlewares/requestLogger.js (NEW)
  → src/middlewares/rateLimiter.js   (NEW)
  → src/middlewares/notFound.js      (NEW)
  → src/middlewares/errorHandler.js  (NEW)
  → src/routes/infraRoutes.js        (NEW — mounted at /api/v1)
  → helmet                          (NEW — from node_modules)
  + all existing route/controller/middleware imports (unchanged)
```

### Removed from server.js

```
- express() → moved to app.js
- cors() → moved to app.js
- cookieParser() → moved to app.js
- session() → moved to app.js
- passport.initialize/session() → moved to app.js
- maintenanceModeGuard → moved to app.js
- All route mounts → moved to app.js
- Inline 404 handler → replaced by notFound middleware
- Inline error handler → replaced by errorHandler middleware
- console.log calls → replaced by Winston logger
```

## ADR Required

**No.** Task 0.7 adds application bootstrap only. No architectural decisions beyond ADR-002 (Express) and ADR-010 (Socket.io).

## Technical Debt Introduced

**None.** All existing code preserved.
- `sendError.js` still exists (not removed — other files may import it directly)
- Legacy `/api/system/status` and `/api/system/reconnect` preserved in app.js
- All 40+ route mounts unchanged
- Stripe webhook raw body routes preserved (before JSON parser)
- `express-session` + `passport.session()` preserved

## Future Extension Points

| Extension | Where | When |
|-----------|-------|------|
| New business route module | Add to `app.js` route mounting section | Sprint 1+ |
| Compression middleware | Add to middleware stack in `app.js` | Task 0.8 (Infrastructure) |
| Redis session store | Replace in-memory session store config in `app.js` | Sprint 7 |
| HTTPS server | Replace `http.createServer` with `https.createServer` in `server.js` | Sprint 7 |
| Graceful shutdown → AI provider dispose | Add provider dispose() call before DB close in shutdown handler | Sprint 6 |
| Metrics endpoint → Prometheus | Add `prom-client` collector to `/metrics` handler | Sprint 7 |

## Regression Fix

| File | Issue | Task | Fix |
|------|-------|------|-----|
| `src/utils/dateUtils.js` | Task 0.3 renamed `startOfTodayVN` → `startOfDayVN`, breaking existing `membershipService.js` import | 0.3 → fixed in 0.7 | Added `export const startOfTodayVN = startOfDayVN` as backward-compatible alias |
