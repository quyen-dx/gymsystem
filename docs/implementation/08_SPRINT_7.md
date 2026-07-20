# 08_SPRINT_7 — Production

> **Document Type:** Sprint Execution Plan
> **Version:** 1.0
> **Last Updated:** 2026-07-20
> **Status:** Ready
> **Sprint Duration:** 2 weeks
> **Depends On:** Sprints 0, 1, 2, 3, 4, 5, 6 (all prior sprints — all features complete)
> **Related Documents:** [00_EXECUTION_OVERVIEW.md](00_EXECUTION_OVERVIEW.md), [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md)

---

## 1. Sprint Goal

Harden the complete GymPro system for production: conduct a full security audit and implementation including Helmet, rate limiting, CORS, CSRF, input validation, webhook verification, audit logging, and PII encryption; optimize database queries, implement Redis caching, and reduce frontend bundle size; deploy to production with Docker, SSL, CDN, monitoring, and automated daily backups; finalize all documentation for developer onboarding and operational handover.

---

## 2. Business Objectives

1. **Security Certification** — Achieve OWASP Top 10 compliance. Pass dependency vulnerability scan. No CRITICAL or HIGH vulnerabilities remain.
2. **Production Readiness** — Deploy a production-optimized system with HTTPS, CDN, health checks, process monitoring, and automated failover.
3. **Performance Benchmarking** — Meet all performance metrics: API p95 <500ms, query p95 <20ms, frontend bundle <300KB gzipped, Lighthouse >90.
4. **Operational Reliability** — Automated daily backups with 7-daily/4-weekly/3-monthly retention, cron job catch-up on restart, heartbeat monitoring.
5. **Audit & Compliance** — Complete audit logging for all admin actions. GDPR data export within 72 hours. Financial record retention for 5 years.
6. **Developer Handover** — Complete API documentation, README with local setup guide, support runbook, and production credential management.

---

## 3. Modules Included

| Module | Document | Description |
|---|---|---|
| System (cross-cutting) | All module and reference docs | Security hardening, performance optimization, monitoring, and backup applied across all modules |
| System Settings | [docs/modules/system-settings.md](../modules/system-settings.md) | Feature flags, maintenance mode, system configuration management |

---

## 4. Dependencies

| Dependency | Source | Why |
|---|---|---|
| All 16 modules complete | Sprints 0–6 | Security hardening, optimization, and monitoring apply to all existing endpoints and services |
| All database collections (64 total) | Sprints 0–6 | Index optimization, query audit, backup configuration need all collections |
| All API endpoints | Sprints 0–6 | Rate limiting, input validation retrofits, and audit logging apply to all endpoints |
| Frontend application | Sprints 0–6 | Bundle optimization, code splitting, and image optimization need complete frontend |
| Redis infrastructure | Sprint 0 (Foundation) | Caching layer for sessions, rate limit counters, frequently queried data |
| CI/CD pipeline | Sprint 0 (Foundation) | GitHub Actions workflow extension for production deploy |

---

## 5. Prerequisites

1. Sprints 0 through 6 complete, tested, and all Definition of Done conditions verified.
2. All 64 database collections created and properly structured.
3. All API endpoints operational with correct responses.
4. Frontend application fully functional with all routes and features.
5. Redis server provisioned and accessible (cloud or local).
6. Production server (or cloud VM) provisioned with Docker and Docker Compose installed.
7. Domain name configured with DNS pointing to the production server.
8. Cloud storage bucket provisioned for database backups (AWS S3, GCP Cloud Storage, or equivalent).
9. Email and SMS provider accounts active with production API keys.
10. Stripe and VNPAY production accounts active with webhook endpoints configured.
11. Monitoring service account created (Sentry, Datadog, or self-hosted).
12. SSL certificate provider account (Let's Encrypt / Certbot) ready.

---

## 6. Documents to Read

**Module Documentation:**
- [docs/modules/system-settings.md](../modules/system-settings.md) — System settings, feature flags, maintenance mode, API endpoints

**Reference Documentation:**
- [docs/BUSINESS_RULES.md](../BUSINESS_RULES.md) — BR-AUD-001 through BR-AUD-005 (all audit/compliance rules)
- [docs/PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) — System Settings rows
- [docs/DATABASE.md](../DATABASE.md) — Collections: system_settings, feature_flags, maintenance_mode, backup_records, audit_logs, logs
- [docs/API_STANDARDS.md](../API_STANDARDS.md) — §14.18 Settings endpoints
- [docs/EDGE_CASES.md](../EDGE_CASES.md) — EC-SYS-001 through EC-SYS-007 (system edge cases)
- [docs/AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) — Part 11 (Security Rules: SSRF, XSS, injection, PII encryption, audit logging, webhook verification), Part 12 (Performance Rules: N+1 queries, indexing, caching, bundle size, image optimization), Part 9 (Review Checklist)
- [docs/adr/ADR-001.md](../adr/ADR-001.md) through [docs/adr/ADR-010.md](../adr/ADR-010.md) — All ADRs for compliance verification
- [docs/DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) — Deployment procedures
- [docs/SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) — Architecture verification against implementation
- [docs/AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md) — AI subsystem architecture verification
- [docs/PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) — Tech stack, mission verification
- [docs/ERROR_HANDLING.md](../ERROR_HANDLING.md) — Error handling consistency check

---

## 7. Business Rules

| Rule ID | Module | Type | Summary |
|---|---|---|---|
| **BR-AUD-001** | Audit | constraint | All financial records (transactions, invoices, refunds, wallet logs, payment gateway responses) retained for minimum 5 years from creation date. Soft-delete and hard-delete prohibited at database level. After 5 years, archival to cold storage permitted but must remain retrievable within 72 hours. |
| **BR-AUD-002** | Audit | constraint | GDPR data privacy: member's complete personal data exportable in machine-readable format (JSON) within 72 hours upon request. Deletion requests fulfilled within 30 days. Financial records anonymized (not deleted) per BR-AUD-001. Export includes: profile, membership history, booking history, payment history, wallet transactions, check-in history, notification preferences. |
| **BR-AUD-003** | Audit | workflow | Daily reconciliation of payment gateway vs. internal records at 03:00 AM system time. Automated job compares all previous-day transactions between internal database and each gateway (VNPAY, Stripe). Discrepancies flagged and reported to finance admin. Unmatched transactions quarantined for manual review. |
| **BR-AUD-004** | Audit | constraint | Maximum 3 concurrent sessions per member across all devices (web + mobile). When 4th device logs in, oldest session invalidated. Applies to both JWT access tokens and refresh tokens. |
| **BR-AUD-005** | Audit | constraint | Maximum 5 failed OTP attempts per 15-minute rolling window. After 5th failure, account temporarily locked for 30 minutes. Scoped per action type (login OTP, payment OTP, identity verification OTP). |

---

## 8. State Machines

No new state machines are introduced in Sprint 7. This sprint verifies that all existing state machines from Sprints 1–6 correctly handle:

- **Membership Cycle** (Sprint 2): PENDING_ACTIVATION → ACTIVE → FROZEN → EXPIRED / COMPLETED / CANCELLED / REFUNDED
- **Booking** (Sprint 3): PENDING → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED / NO_SHOW
- **Payment** (Sprint 2): INITIATED → PENDING → COMPLETED / FAILED / REFUNDED
- **Order** (Sprint 5): CHỜ XÁC NHẬN → ĐANG CHUẨN BỊ HÀNG → ĐANG GIAO HÀNG → GIAO THÀNH CÔNG / ĐÃ HỦY / HOÀN TRẢ
- **Notification** (Sprint 6): QUEUED → SENT → DELIVERED → READ / FAILED

Compliance verification: confirm each state machine's guard conditions, invalid transitions, and side effects match [docs/STATE_MACHINES.md](../STATE_MACHINES.md).

---

## 9. Permission Matrix

### System Settings

| Action | Guest | Member | PT | Staff | Seller | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| View settings | - | - | - | - | - | R | R |
| Update settings | - | - | - | - | - | - | U |
| View logs | - | - | - | - | - | R | R |

### Additional Enforcement Notes

- Audit log viewing restricted to ADMIN and SUPER_ADMIN.
- Backup management (trigger, restore, delete) restricted to SUPER_ADMIN.
- Feature flag toggling restricted to SUPER_ADMIN (ADMIN may view only).
- Maintenance mode enable/disable restricted to SUPER_ADMIN.
- GDPR data export/delete requests require ADMIN or SUPER_ADMIN with re-authentication.

---

## 10. Database Collections

### 10.1 Settings (3 collections)

| Collection | Key Fields |
|---|---|
| `system_settings` | key (unique), value (Mixed/JSON), description, group (general/payment/booking/notification/appearance), isEncrypted, updatedBy |
| `feature_flags` | key (unique), name, description, isEnabled, rolloutPercent (0–100), rules `[{ field, operator, value }]`, updatedBy |
| `maintenance_mode` | isActive, message, allowedIPs, allowedRoles, startedAt, expectedEndAt, updatedBy (singleton — single document) |

### 10.2 Audit & Logging (2 collections)

| Collection | Key Fields |
|---|---|
| `audit_logs` | userId (actor), action, resourceType, resourceId, before (snapshot), after (snapshot), changes `[{ field, from, to }]`, ip, userAgent, metadata |
| `logs` | level (debug/info/warn/error/fatal), module, action, userId, ip, userAgent, message, metadata, stackTrace (TTL index optional: 90-day auto-delete) |

### 10.3 Backup (1 collection)

| Collection | Key Fields |
|---|---|
| `backup_records` | filename, size, type (full/incremental/oplog), status (running/completed/failed), storagePath, checksum (SHA-256), startedAt, completedAt, errorMessage |

---

## 11. API Endpoints

### 11.1 System Settings

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/settings` | Required | admin, super_admin | Get all settings (grouped by group) |
| GET | `/settings/:group` | Required | admin, super_admin | Get settings by group (general, payment, booking, notification, appearance) |
| PUT | `/settings` | Required | super_admin | Update settings (batch) |
| GET | `/settings/public` | Public | — | Get public settings (gym name, address, contact, operating hours) |
| GET | `/settings/maintenance` | Required | admin, super_admin | Get maintenance mode status |
| PUT | `/settings/maintenance` | Required | super_admin | Enable/disable maintenance mode |
| GET | `/settings/features` | Required | admin, super_admin | List all feature flags |
| PUT | `/settings/features/:key` | Required | super_admin | Toggle a feature flag |
| POST | `/settings/features` | Required | super_admin | Create a new feature flag |
| DELETE | `/settings/features/:key` | Required | super_admin | Delete a feature flag |

### 11.2 Health & Monitoring

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/health` | Public | — | Health check: DB connectivity, Redis status, memory usage, uptime |
| GET | `/api/health/detailed` | Required | admin, super_admin | Detailed health: all service checks, version info, dependency status |

### 11.3 Audit & Compliance

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/audit/logs` | Required | admin, super_admin | Query audit logs (filterable by userId, action, resourceType, date range, cursor paginated) |
| GET | `/audit/logs/:id` | Required | admin, super_admin | Get specific audit log entry with full before/after snapshots |
| POST | `/gdpr/export` | Required | admin, super_admin | Request member data export (queues job, notifies when ready) |
| GET | `/gdpr/export/:jobId` | Required | admin, super_admin | Check export job status and download URL |
| POST | `/gdpr/delete` | Required | admin, super_admin | Request member data deletion (anonymization per BR-AUD-001, BR-AUD-002) |

### 11.4 Backup

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/backups` | Required | super_admin | List backup records (filterable by type, status, date range) |
| POST | `/backups/trigger` | Required | super_admin | Trigger manual full backup |
| GET | `/backups/:id` | Required | super_admin | Get backup record details |
| POST | `/backups/:id/restore` | Required | super_admin | Restore from backup (with confirmation) |
| DELETE | `/backups/:id` | Required | super_admin | Delete backup file from storage |

---

## 12. AI Components

### 12.1 AI Input Sanitization & Prompt Injection Prevention

- AI chat input sanitization: strip control characters, enforce max input length, validate UTF-8 encoding.
- System prompt boundary enforcement: AI system prompt placed after user context; user input wrapped with delimiters to prevent prompt injection.
- Sensitive data filter: AI response scanner detects and redacts potential PII (email, phone, address patterns) before delivery to the client.
- AI permission engine verification: confirm all AI tool routes respect [docs/PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) (admin override requires re-authentication, member data access scoped to own records).

### 12.2 AI Architecture Compliance

- Verify all AI components conform to [docs/AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md): provider chains, intent classification, tool routing, RAG pipeline.
- Verify all AI workflows conform to [docs/AI_WORKFLOW.md](../AI_WORKFLOW.md): intent definitions, permission scopes, tool layers.

---

## 13. Files Expected Created

### Security
```
src/middleware/security/
  helmet.config.ts (Helmet with strict CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
  rate-limit.config.ts (express-rate-limit: auth 5/min/IP, API 100/min/user, payment 10/min/user)
  cors.config.ts (restricted origins, methods, credentials)
  csrf.middleware.ts (CSRF token validation for non-API routes)
  input-sanitizer.ts (general input sanitization: trim, escape, xss filter)

src/utils/security/
  pii-encryption.ts (AES-256-GCM encrypt/decrypt for email, phone, address)
  webhook-verification.ts (Stripe constructEvent, VNPAY secure hash, GHN token)
  audit-logger.ts (write audit log entries with actor, action, resource, before/after, IP, user agent)

src/middleware/
  audit.middleware.ts (auto-wrap admin routes with audit logging)
```

### Optimization
```
src/config/
  redis.config.ts (Redis client setup, connection pooling, retry strategy)
  cache.config.ts (cache TTL, key patterns, invalidation rules)

src/middleware/
  cache.middleware.ts (response caching middleware for GET endpoints)

scripts/
  n-plus-1-audit.js (scan all .populate() and .find() calls for N+1 patterns)
  index-advisor.js (verify all query patterns have appropriate database indexes)
```

### Production
```
docker/
  docker-compose.prod.yml (production-optimized: multi-stage builds, health checks, resource limits, restart policies)
  Dockerfile.backend (multi-stage Node.js production build)
  Dockerfile.frontend (multi-stage Nginx + React build serving)

scripts/
  backup.sh / backup.ps1 (mongodump to cloud storage, retention rotation)
  restore.sh (mongorestore from backup)
  crons.yaml / crons.js (bull job queue definitions: backup, reconciliation, membership expiry, streak reset)
  load-test/
    login-test.js (k6 script: concurrent login)
    membership-purchase-test.js (k6 script: payment flow)
    booking-test.js (k6 script: booking race condition)
    checkin-test.js (k6 script: concurrent check-ins)

src/jobs/
  backup.job.ts (daily full backup at 02:00)
  reconciliation.job.ts (daily payment gateway reconciliation at 03:00 per BR-AUD-003)
  membership-expiry.job.ts (daily membership expiry check at 00:00)
  notification-cleanup.job.ts (weekly cleanup of old notifications and push tokens)

src/
  health.controller.ts (health check endpoints)
  health.service.ts

.github/workflows/
  deploy-prod.yml (CI/CD: build → test → deploy staging → smoke test → deploy production)
```

### Documentation
```
docs/
  DEPLOYMENT_GUIDE.md (existing, verify and update)
  API_CATALOG.md (complete endpoint catalog with examples — new)
  SUPPORT_RUNBOOK.md (common issues, troubleshooting, escalation — new)
  DEVELOPER_ONBOARDING.md (local setup, architecture walkthrough, first contribution guide — new)

README.md (update with local setup guide, architecture diagram, contributing guide)
```

---

## 14. Files Expected Modified

```
src/
  app.ts (register security middleware: Helmet, rate limit, CORS, CSRF; register new routes)
  server.ts (attach Socket.io before listen; configure graceful shutdown)

src/middleware/
  auth.middleware.ts (verify BR-AUD-004: max 3 concurrent sessions)
  error.handler.ts (add security error codes)

src/features/
  */**.controller.ts (retrofit Zod input validation on ALL endpoints)
  */**.routes.ts (add rate limit middleware per endpoint category)
  */**.service.ts (add audit logging for admin actions)

frontend/
  vite.config.ts / webpack.config.ts (code splitting, tree shaking, bundle analysis)
  src/App.tsx (lazy load routes, Suspense boundaries)
  src/components/ (lazy load images, responsive srcset, WebP format)

.env.example (add all new environment variables: REDIS_URL, BACKUP_BUCKET, SENTRY_DSN, etc.)
package.json (add scripts: audit, load-test, backup, restore; add dependencies: helmet, express-rate-limit, cors, zod, ioredis, bull, winston, compression)
```

---

## 15. Definition of Ready

- [ ] All prerequisites (Section 5) verified complete.
- [ ] All documents in Section 6 read and understood by the team.
- [ ] All 5 business rules (BR-AUD-001 through BR-AUD-005) clarified with stakeholders.
- [ ] Production server provisioned: OS, Docker, Docker Compose, DNS, firewall rules.
- [ ] Redis server provisioned: connection URL, authentication, maxmemory policy configured.
- [ ] Cloud storage bucket for backups provisioned: access key, secret key, bucket name, region.
- [ ] SSL certificate provider configured (Let's Encrypt email, domain verified).
- [ ] Monitoring service account provisioned (Sentry DSN or equivalent, alert channels).
- [ ] OWASP Top 10 checklist printed and understood by the team.
- [ ] Performance targets agreed (p95 <500ms, query <20ms, bundle <300KB, Lighthouse >90).
- [ ] Backup retention policy agreed (7 daily + 4 weekly + 3 monthly).
- [ ] CI/CD secrets configured in GitHub: DOCKER_REGISTRY, SSH_KEY, ENV_PRODUCTION.
- [ ] Load test scenarios defined and approved.

---

## 16. Definition of Done

- [ ] All 5 business rules (BR-AUD-001 through BR-AUD-005) implemented with automated tests.
- [ ] Helmet middleware applied with strict CSP, HSTS (max-age=31536000; includeSubDomains), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy configured.
- [ ] Rate limiting applied to ALL endpoints: auth routes (5 req/min/IP), general API (100 req/min/user), payment/wallet routes (10 req/min/user).
- [ ] CORS restricted to known frontend origins only (no wildcard `*`).
- [ ] CSRF protection: SameSite=Strict on cookies, CSRF token middleware for non-API routes.
- [ ] Zod input validation schemas on ALL endpoints (retrofit every controller).
- [ ] Webhook signature verification on all webhook endpoints (Stripe `constructEvent`, VNPAY `vnp_SecureHash`, GHN token).
- [ ] Audit logging on ALL admin actions (userId, action, resourceType, resourceId, before snapshot, after snapshot, IP, userAgent).
- [ ] PII encryption at rest: email, phone, address encrypted with AES-256-GCM; decrypted only at read time for authorized consumers.
- [ ] SQL/NoSQL injection prevention verified: all queries use parameterized queries, `$where` prohibited, ObjectId validated before query.
- [ ] XSS prevention: React default escaping, DOMPurify for any `dangerouslySetInnerHTML`, CSP header with no `unsafe-inline`.
- [ ] SSRF prevention: URL whitelist for any server-side HTTP fetches, internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x) blocked.
- [ ] AI prompt injection prevention: input sanitization, system prompt boundary markers, max input length enforced.
- [ ] N+1 query audit complete: all `.populate()` and `.find()` in loops reviewed and optimized; batch queries and `.lean().select()` used.
- [ ] Database indexes verified for all query patterns; compound indexes added where missing; no full collection scans.
- [ ] Slow query logging enabled (>100ms logged to `logs` collection with query explain plan).
- [ ] Redis caching implemented for: session store, rate limit counters, frequent queries (plans, categories, public content, system settings) with appropriate TTL.
- [ ] Frontend bundle <300KB gzipped; code splitting by route; tree-shaking Ant Design; lazy loading for images and heavy libraries.
- [ ] Image optimization via Cloudinary transformations: auto-resize, auto-format (WebP), auto-quality; responsive `srcset` with multiple breakpoints.
- [ ] All API endpoints respond within p95 <500ms, p99 <2s.
- [ ] All database queries execute within p95 <20ms.
- [ ] Docker Compose production file: multi-stage builds, health checks, resource limits (CPU/memory), restart policies (unless-stopped), non-root user.
- [ ] HTTPS only: SSL/TLS via Let's Encrypt with auto-renewal (certbot cron); HTTP → HTTPS redirect.
- [ ] HSTS preload headers configured.
- [ ] CDN: Cloudinary for media delivery; Cloudflare (optional) for static asset caching.
- [ ] PM2 process manager configured: cluster mode, max memory restart, log rotation, startup script.
- [ ] Health endpoint `GET /api/health` returns DB connectivity, Redis status, memory usage, uptime.
- [ ] Winston structured logging: JSON format, log levels, correlation IDs, log rotation, error alerting to Sentry.
- [ ] Automated daily `mongodump` to cloud storage at 02:00; retention: 7 daily + 4 weekly + 3 monthly; backup record logged to `backup_records`.
- [ ] Oplog-based point-in-time recovery (PITR) configured.
- [ ] Database-backed job queue (bull with Redis) for all cron jobs: backup, reconciliation, membership expiry, notification cleanup.
- [ ] Missed-window catch-up on server startup: scan `CronJobLog` for gaps and rerun missed jobs (EC-SYS-002).
- [ ] Heartbeat monitoring with alerting for jobs that haven't run in the expected window.
- [ ] GitHub Actions CI/CD deploy workflow: build Docker images → push to registry → deploy to staging → smoke test → deploy to production.
- [ ] Feature flags: toggle features without deployment (maintenance mode, beta features, rollout percentage).
- [ ] Load testing scripts (k6): login, membership purchase, booking, check-in — all pass under expected load (100 concurrent users).
- [ ] OWASP Top 10 penetration testing checklist completed with no CRITICAL/HIGH findings.
- [ ] `npm audit` passes with zero CRITICAL or HIGH vulnerabilities.
- [ ] All 10 ADRs verified for compliance: architecture matches ADR decisions; deviations documented as amendment ADRs.
- [ ] All documentation audited for accuracy: no stale references, all BR-xxx, EC-xxx, and collection schemas match code.
- [ ] API documentation (API_CATALOG.md) complete: all endpoints with method, path, auth, roles, request body, response body, and examples.
- [ ] README.md updated: local setup guide, environment variables table, architecture diagram, contributing guide.
- [ ] SUPPORT_RUNBOOK.md created: common issues, troubleshooting steps, escalation paths, emergency contacts.
- [ ] Production credentials documented: admin access, database access, SSH keys, SSH access, vendor contacts (Stripe, VNPAY, Twilio, cloud provider).
- [ ] Zero TypeScript compilation errors, zero ESLint errors, zero ESLint warnings.
- [ ] All documentation files updated (Section 24 verified).

---

## 17. Acceptance Criteria

| # | Criterion | Verification Method |
|---|---|---|
| AC-1 | Helmet headers present on all responses | curl -I → verify CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| AC-2 | Rate limiting rejects after threshold | Send 6 POST /auth/login within 1 min → 429 Too Many Requests |
| AC-3 | CORS rejects unauthorized origin | Send request with Origin: https://evil.com → CORS error, no response body |
| AC-4 | CSRF token required for non-API state-changing requests | POST without CSRF token → 403 |
| AC-5 | All endpoints have Zod validation | Send invalid body to any endpoint → 400 with structured error |
| AC-6 | Webhook with invalid signature rejected | POST to Stripe webhook with fake signature → 401 |
| AC-7 | Admin action logged to audit_logs | Admin updates membership → audit_logs entry with before/after, IP, userAgent |
| AC-8 | PII encrypted at rest in database | Query MongoDB directly → email/phone/address fields are ciphertext, not plaintext |
| AC-9 | No $where in any query | grep -r "\$where" src/ → no results |
| AC-10 | SSRF blocked for internal IPs | Server fetches http://10.0.0.1 → rejected with 400 |
| AC-11 | Dashboard query <20ms | Query performance test → p95 <20ms |
| AC-12 | Frontend bundle <300KB gzipped | Build analysis: npx vite-bundle-visualizer → total gzip <300KB |
| AC-13 | Image served as WebP with srcset | Inspect production → img has srcset with multiple sizes, type=image/webp |
| AC-14 | Health endpoint returns 200 | GET /api/health → 200 with DB, Redis, uptime |
| AC-15 | Docker containers healthy | docker ps → all containers status: healthy |
| AC-16 | HTTPS redirect works | curl http://domain.com → 301 → https://domain.com |
| AC-17 | HSTS header present with preload | curl -I https://domain.com → Strict-Transport-Security: max-age=31536000; includeSubDomains |
| AC-18 | Daily backup completes | Check backup_records collection → today's entry with status: completed, checksum present |
| AC-19 | Backup restorable | Run restore script → all collections restored, application functions correctly |
| AC-20 | Cron job catches up after restart | Stop server during 00:00, restart at 00:10 → membership expiry job runs within 5 min |
| AC-21 | CI/CD deploys to production | Push to main → GitHub Actions builds, tests, deploys → production updated |
| AC-22 | Feature flag disables feature without deploy | Toggle feature flag off → feature unavailable; toggle on → feature available |
| AC-23 | Load test: 100 concurrent check-ins | k6 script with 100 VUs → all succeed, no duplicates, p95 <500ms |
| AC-24 | npm audit clean | npm audit → 0 CRITICAL, 0 HIGH |
| AC-25 | GDPR export returns complete data | POST /gdpr/export → JSON export includes all member data within 72h |
| AC-26 | Concurrent session limit enforced | Login on 4 devices → oldest session invalidated (BR-AUD-004) |
| AC-27 | OTP rate limit enforced | 6 failed OTP attempts in 15 min → account locked 30 min (BR-AUD-005) |
| AC-28 | API documentation complete | API_CATALOG.md contains every endpoint with examples |
| AC-29 | README local setup works from cold clone | Fresh clone → follow README → app runs locally with all features |
| AC-30 | Support runbook has escalation paths | SUPPORT_RUNBOOK.md has: DB down, payment failure, login outage, backup restore procedures |

---

## 18. Testing Strategy

### 18.1 Security Tests

- **Helmet headers**: Assert all 6 security headers present on every response.
- **Rate limiting**: Exceed rate limit thresholds for auth, API, payment categories → assert 429 with Retry-After header.
- **CORS**: Send requests from unauthorized origins → assert CORS rejection; send from authorized origins → assert success.
- **CSRF**: Send state-changing requests without CSRF token → assert 403; with valid token → assert success.
- **Input validation**: Send invalid/malicious payloads to every endpoint → assert 400 with validation error, not 500.
- **Webhook verification**: Send fake webhook payloads to Stripe, VNPAY, GHN endpoints → assert 401.
- **NoSQL injection**: Send `{ "$gt": "" }` as input values → assert validation rejection or safe handling.
- **XSS**: Store `<script>alert(1)</script>` in content body → assert sanitized output, no script execution.
- **SSRF**: Attempt server-side fetch to `http://169.254.169.254/latest/meta-data/` → assert rejection.

### 18.2 Performance Tests

- **Query performance**: Using MongoDB explain plans, verify all queries use indexes; measure execution time.
- **API response time**: Run `autocannon` or k6 against all critical endpoints; assert p95 <500ms, p99 <2s.
- **Bundle size**: Run bundle analyzer; assert gzipped bundle <300KB.
- **Image optimization**: Verify production images served via Cloudinary with transformation parameters.
- **Cache hit ratio**: Verify Redis has cached values for frequent queries after first request; TTL expirations work.

### 18.3 Business Rule Tests

| Test | Rule ID |
|---|---|
| Attempt to hard-delete financial transaction → blocked | BR-AUD-001 |
| Financial record >5 years old archived (not deleted) → retrievable within 72h | BR-AUD-001 |
| GDPR export contains all 7 data categories → JSON format | BR-AUD-002 |
| GDPR export completed within 72 hours | BR-AUD-002 |
| Deletion anonymizes PII, retains financial records | BR-AUD-002 |
| Daily reconciliation runs at 03:00, compares internal vs. gateway | BR-AUD-003 |
| Discrepancy flagged and finance admin notified | BR-AUD-003 |
| Login on 4th device → oldest session invalidated | BR-AUD-004 |
| 5 failed OTP attempts in 15 min → account locked 30 min | BR-AUD-005 |
| 6th OTP attempt → rejected with lock message | BR-AUD-005 |
| OTP lock scoped per action type (login lock doesn't block payment OTP) | BR-AUD-005 |

### 18.4 Edge Case Tests

| Test | Edge Case ID |
|---|---|
| Database connection lost mid-transaction → 503 within 5s, no orphan documents | EC-SYS-001 |
| Cron job missed window → catch-up routine fires on startup | EC-SYS-002 |
| 1000 WebSocket connections → no memory leak, cleanup within 60s | EC-SYS-003 |
| Two simultaneous token refresh requests → exactly 1 succeeds, old token invalidated | EC-SYS-004 |
| Member JWT accessing admin endpoint → 403 Forbidden, no data leaked | EC-SYS-005 |
| 200 requests from 200 distinct IPs → per-user rate limit triggers, CAPTCHA after 10 failures | EC-SYS-006 |
| Two admins toggle same setting → optimistic concurrency rejects second write with 409 | EC-SYS-007 |

### 18.5 Deployment Tests

- Docker build succeeds for both backend and frontend (multi-stage).
- Docker Compose brings all services up with health checks passing.
- Database backup script creates valid dump; restore script loads it correctly.
- CI/CD pipeline: test that a push to main triggers build → test → deploy.
- Rollback test: deploy broken version, verify rollback to previous version restores service.

### 18.6 Regression Tests

- All Sprint 1–6 tests must continue to pass after security hardening and optimization changes.
- Rate limiting and CORS must not break legitimate API usage (authorized origin + within rate limit = success).
- Caching must not serve stale data where freshness is critical (wallet balance, membership status).

---

## 19. Rollback Strategy

1. **Git Rollback**: Revert the Sprint 7 merge commit. Security middleware, caching, and monitoring code is removed. Existing functionality from Sprints 1–6 is unaffected because Sprint 7 primarily adds cross-cutting concerns, not business logic changes.
2. **Database Rollback**: Drop collections: `audit_logs` (Sprint 7 entries), `backup_records` (Sprint 7 entries), `logs` (if created in Sprint 7). Settings collections (`system_settings`, `feature_flags`, `maintenance_mode`) retain their documents but new fields are ignored by rolled-back code.
3. **Infrastructure Rollback**:
   - **Redis**: Disconnect Redis; sessions fall back to in-memory store (from Sprint 1). Rate limiting falls back to in-memory (less effective but functional).
   - **Docker**: Revert to previous `docker-compose.yml` (non-production).
   - **SSL/CDN**: Revert DNS to point to previous server if dedicated production server was provisioned for Sprint 7.
   - **CI/CD**: Disable production deploy workflow; keep staging deployment active.
   - **Backups**: Existing backups in cloud storage are retained; rollback does not delete them.
4. **Monitoring Rollback**: Disable Sentry/Winston transport; standard console logging resumes.
5. **Partial Rollback Options**: If a specific hardening causes issues (e.g., CSP too strict, breaks third-party widget), relax the specific header via environment variable override without a full rollback.

---

## 20. Risks

| # | Risk | Severity | Likelihood | Impact |
|---|---|---|---|---|
| R1 | Production deployment failure: Docker build fails, container won't start, or health checks fail | CRITICAL | Medium | System unavailable; all users affected |
| R2 | Security middleware breaks legitimate functionality: CSP too strict blocks frontend resources, CORS blocks API calls, rate limiting blocks normal usage | HIGH | Medium | Partial or complete application breakage for legitimate users |
| R3 | Database backup corruption: `mongodump` produces incomplete or corrupt backup that cannot be restored | CRITICAL | Low | Complete data loss in disaster recovery scenario |
| R4 | Redis failure cascades: cache miss storm overwhelms database, rate limit counters lost allowing abuse | HIGH | Low | Performance degradation or security bypass |
| R5 | Performance regression from audit logging: wrapping all admin actions with before/after snapshots doubles write latency | MEDIUM | Medium | Admin operations become noticeably slow |
| R6 | SSL certificate expiration: Let's Encrypt auto-renewal fails and certificate expires | CRITICAL | Low | HTTPS broken; browsers show "not secure"; API clients fail |
| R7 | npm audit reveals unfixable vulnerability in a critical dependency | MEDIUM | Low | Must fork or replace dependency; delays deployment |
| R8 | Load test reveals performance bottleneck requiring architecture change | MEDIUM | Medium | Sprint scope increase; may delay launch |
| R9 | CI/CD pipeline misconfiguration exposes secrets or deploys to wrong environment | CRITICAL | Low | Secrets leak; production data overwritten |
| R10 | GDPR implementation error: data not fully anonymized, or export includes other members' data | HIGH | Low | Legal liability; GDPR non-compliance penalties |

---

## 21. Risk Mitigation

| Risk | Mitigation |
|---|---|
| R1 | Test Docker build and compose in staging environment first. Implement blue-green deployment. Have rollback script ready. Verify health checks before routing traffic. |
| R2 | Implement security headers with per-environment configuration (staging: relaxed, production: strict). Test all frontend resources load with production CSP. Set rate limits high initially, tighten gradually while monitoring. Add allow-list for known legitimate high-traffic clients (e.g., kiosk devices). |
| R3 | Verify backup integrity after every run: `mongorestore --dryRun` or checksum comparison. Test full restore in staging monthly. Monitor backup file size against expected range. Alert if backup <50% of expected size. |
| R4 | Implement Redis circuit breaker: if Redis unreachable, degrade gracefully (in-memory cache fallback, skip rate limiting for authenticated users, disable non-critical cache). Monitor Redis memory and connection count. |
| R5 | Audit log writes use fire-and-forget pattern (not blocking the main response). Batch audit log inserts. Use capped collection size or TTL for audit_logs to control growth. Audit log query performance is monitored but writes are non-blocking. |
| R6 | Configure certbot auto-renewal cron (daily). Set up renewal failure alerting (email to ops). Monitor certificate expiry with automated check (alert at 30 days, critical at 7 days). Keep manual renewal procedure documented in runbook. |
| R7 | Maintain dependency update schedule (monthly). For unfixable vulnerabilities, assess exploitability in our context (are we using the vulnerable code path?). If critical and reachable, fork and patch or swap library. Document decisions in ADR. |
| R8 | Run load tests early in Sprint 7 (Day 3–4) to identify bottlenecks. Have optimization sprints (caching, indexing, query tuning) before retesting. Accept that p99 targets may be relaxed for complex reports (background generation with async download). |
| R9 | Use GitHub Environments with protection rules (require approval for production). Secrets scoped to environments. Use OpenID Connect (OIDC) instead of long-lived credentials where possible. Review pipeline logs before enabling production deployment. |
| R10 | GDPR export and deletion flows reviewed by legal counsel if applicable. Test export with full member data set; verify no cross-contamination. Implement request verification (re-authenticate admin, email confirmation to member). Log all GDPR operations to immutable audit trail. |

---

## 22. Estimated Implementation Order

Reference: [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md) for detailed ordering.

### Phase 1: Security Foundation (Day 1–3)
1. `helmet.config.ts` → apply to `app.ts`
2. `cors.config.ts` → apply to `app.ts`
3. `rate-limit.config.ts` → apply to auth routes, API routes, payment routes
4. `csrf.middleware.ts` → apply to non-API routes
5. `pii-encryption.ts` → integrate into user schema pre-save/post-find hooks
6. `webhook-verification.ts` → retrofit Stripe, VNPAY, GHN webhook endpoints
7. `audit-logger.ts` → integrate into all admin service methods

### Phase 2: Input Validation Retrofit (Day 3–5)
8. Zod schemas for all modules: auth, user, membership, payment, wallet, booking, schedule, PT, workout, health, shop, product, order, check-in, report, notification, content, settings
9. Retrofit all controllers with Zod validation middleware
10. `input-sanitizer.ts` → general sanitization middleware
11. Prompt injection prevention for AI endpoints

### Phase 3: Query & Performance Optimization (Day 5–8)
12. Run N+1 query audit script → fix all found issues
13. Run index advisor → add missing indexes
14. Enable slow query logging (>100ms)
15. Redis client setup → session store, rate limit store
16. Implement response caching for frequent GET queries
17. Frontend: code splitting, tree shaking, lazy loading
18. Image optimization: Cloudinary transformation URLs

### Phase 4: Production Infrastructure (Day 8–11)
19. `docker-compose.prod.yml` + `Dockerfile.backend` + `Dockerfile.frontend`
20. SSL/TLS: certbot setup with auto-renewal
21. PM2 configuration: cluster mode, log rotation, startup script
22. Health endpoint implementation
23. Winston structured logging + Sentry transport
24. Health check integration into Docker compose
25. Bull job queue setup: backup, reconciliation, expiry, cleanup jobs
26. Backup script + cron schedule + retention rotation

### Phase 5: CI/CD & Testing (Day 11–13)
27. GitHub Actions deploy-prod.yml workflow
28. k6 load test scripts + execution
29. OWASP penetration testing
30. `npm audit` resolution
31. ADR compliance verification

### Phase 6: Documentation & Handover (Day 13–14)
32. API_CATALOG.md
33. SUPPORT_RUNBOOK.md
34. DEVELOPER_ONBOARDING.md
35. README.md update
36. Documentation accuracy audit
37. Production credential handover

---

## 23. Review Checklist

Mirrors [docs/AI_CODING_CONSTITUTION.md Part 9](../AI_CODING_CONSTITUTION.md#part-9-review-checklist) plus Sprint-7-specific items:

### Security Checklist (per AI_CODING_CONSTITUTION.md Part 11)
- [ ] All 7 security headers present and correctly configured on every response.
- [ ] Rate limiting on all API endpoints; auth endpoints most restrictive.
- [ ] CORS allows only known origins; no `*` wildcard in production.
- [ ] CSRF protection on all non-API state-changing routes.
- [ ] All user input validated with Zod schemas; schema is not `.passthrough()`.
- [ ] No raw user input passed to database queries; all queries use parameterized paths.
- [ ] `$where`, `$function`, and `$accumulator` operators not used anywhere.
- [ ] ObjectId validated with `mongoose.Types.ObjectId.isValid()` before any findById.
- [ ] Webhook endpoints verify signatures before processing payload.
- [ ] PII fields (email, phone, address) encrypted at rest with AES-256-GCM.
- [ ] No secrets, API keys, or tokens in source code, config files, or logs.
- [ ] HTTPS enforced; HTTP redirects to HTTPS; HSTS header with preload.
- [ ] CSP does not contain `unsafe-inline` or `unsafe-eval` (or justified with nonce/hash).
- [ ] Server-side HTTP fetches validated against URL whitelist; internal IPs blocked.
- [ ] AI input sanitized: control characters stripped, length limited, UTF-8 validated.
- [ ] AI system prompt boundaries enforced with delimiter wrappers.

### Performance Checklist (per AI_CODING_CONSTITUTION.md Part 12)
- [ ] No N+1 queries: every `.find()` inside a loop replaced with batch query or aggregation.
- [ ] All `.populate()` calls reviewed; `.lean()` used where document methods not needed.
- [ ] `.select()` used to limit fields returned for large documents.
- [ ] Database indexes cover all query filter/sort patterns; compound indexes for multi-field queries.
- [ ] Slow query logging enabled; no query exceeds 100ms without explicit justification.
- [ ] Redis caching for: sessions, rate limit counters, system settings, plans, categories, public content.
- [ ] Frontend bundle <300KB gzipped; code split by route with `React.lazy` + `Suspense`.
- [ ] Images served with Cloudinary `f_auto,q_auto` transformations and `srcset`.
- [ ] API response time p95 <500ms, p99 <2s under normal load.
- [ ] PM2 cluster mode using all available CPU cores.

### Production Deployment Checklist
- [ ] Docker multi-stage build produces minimal images (<300MB for backend, <100MB for frontend Nginx).
- [ ] Docker compose health checks on all services; restart policy: unless-stopped.
- [ ] Resource limits set (CPU, memory) on all containers.
- [ ] Non-root user in all containers (USER node).
- [ ] SSL certificate valid and auto-renewing.
- [ ] Database backups automated, verifiable, and restorable.
- [ ] Monitoring dashboards configured; alerts for: CPU >80%, memory >80%, error rate >1%, DB connection failures.
- [ ] CI/CD pipeline: build, test, deploy staging, smoke test, deploy production — all automated.
- [ ] Feature flags operational: toggling a flag does not require deployment.
- [ ] Graceful shutdown: server closes connections before exiting; bull jobs complete or requeue.

### Documentation Checklist
- [ ] All 10 ADRs verified: implemented as specified; deviations documented.
- [ ] API_CATALOG.md: every endpoint documented with method, path, auth, roles, request, response, and curl example.
- [ ] DEPLOYMENT_GUIDE.md updated with production steps, environment variables, rollback procedure.
- [ ] SUPPORT_RUNBOOK.md covers: database connection failure, Redis failure, payment gateway outage, email delivery failure, backup restore, SSL expiry, rate limiting triage.
- [ ] DEVELOPER_ONBOARDING.md: prerequisites, local setup (clone to running in <15 min), architecture overview, first bug fix walkthrough.
- [ ] README.md: project description, tech stack, quick start, environment variables table, architecture diagram link, contributing guide.
- [ ] Zero dead links in any documentation (verify with markdown link checker).
- [ ] All BR-xxx, EC-xxx, state machine references in docs match code implementation.

### Quality Checklist
- [ ] TypeScript compilation: 0 errors.
- [ ] ESLint: 0 errors, 0 warnings.
- [ ] Test suite: all tests pass (unit, integration, business rule, permission, edge case, security, performance).
- [ ] Test coverage on business logic: 100%.
- [ ] `npm audit`: 0 CRITICAL, 0 HIGH.
- [ ] No TODO, FIXME, HACK, or commented-out code anywhere.
- [ ] No `console.log` in production code; use Winston logger.

---

## 24. Documentation Update Checklist

| Document | Update Required | Details |
|---|---|---|
| [docs/modules/system-settings.md](../modules/system-settings.md) | Verify accuracy | Confirm API endpoints, permission matrix, error codes match implementation |
| [docs/BUSINESS_RULES.md](../BUSINESS_RULES.md) | Verify accuracy | Confirm all BR-AUD rules implemented correctly |
| [docs/STATE_MACHINES.md](../STATE_MACHINES.md) | Verify accuracy | Confirm all 5 state machines correctly handled in code |
| [docs/PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) | Verify accuracy | Confirm System Settings rows enforced; add Audit and Backup rows if missing |
| [docs/DATABASE.md](../DATABASE.md) | Verify accuracy | Confirm settings, audit, backup collections match Mongoose schemas; index listing verified |
| [docs/API_STANDARDS.md](../API_STANDARDS.md) | Add sections | Add §14.x Settings, Health, Audit, GDP, Backup endpoint sections |
| [docs/EDGE_CASES.md](../EDGE_CASES.md) | Verify resolved | Mark EC-SYS-001 through EC-SYS-007 as handled; update mitigation to reflect Sprint 7 implementation |
| [docs/DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) | Update | Add production specifics: Docker paths, SSL setup, backup/restore, monitoring config |
| [docs/CURRENT_PHASE.md](../CURRENT_PHASE.md) | Update | Mark Sprint 7 as complete; project status → Production |
| [docs/IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) | Update | Mark Production phase as done; update status to Complete |
| [docs/PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) | Update | Update status: "In Production"; update last deployment date |
| [docs/SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) | Verify accuracy | Confirm monorepo layout, layer separation, dependency direction match code |
| [docs/AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md) | Verify accuracy | Confirm AI provider chains, intent classification, RAG pipeline match code |
| [docs/ERROR_HANDLING.md](../ERROR_HANDLING.md) | Verify consistency | Confirm all error codes used in code are documented; no undocumented error types |
| [docs/adr/ADR-001.md](../adr/ADR-001.md) through [ADR-010.md](../adr/ADR-010.md) | Verify compliance | Architecture matches all ADR decisions; note any deviations |
| [docs/README_FOR_AI.md](../README_FOR_AI.md) | Final pass | Verify all document references are valid; update "last reviewed" date |
| `API_CATALOG.md` (new) | Create | Complete endpoint catalog with all 100+ endpoints from all sprints |
| `SUPPORT_RUNBOOK.md` (new) | Create | Common issues, troubleshooting, escalation paths |
| `DEVELOPER_ONBOARDING.md` (new) | Create | Local setup, architecture walkthrough, first contribution guide |
| `README.md` (root) | Update | Quick start, env vars table, architecture diagram, contributing, license |

---

## 25. Deliverables

1. **Security Hardening** — Helmet, rate limiting, CORS, CSRF, Zod validation on all endpoints, webhook verification, audit logging, PII encryption, SQL/NoSQL injection prevention, XSS prevention, SSRF prevention, AI prompt injection prevention. OWASP Top 10 compliance verified.
2. **Performance Optimization** — N+1 query audit and remediation, database index verification, query performance tuning (p95 <20ms), Redis caching for sessions/rate limits/frequent queries, frontend bundle <300KB gzipped, code splitting, image optimization via Cloudinary, API response times p95 <500ms / p99 <2s.
3. **Production Infrastructure** — Docker Compose production with multi-stage builds, health checks, resource limits; SSL/TLS via Let's Encrypt with auto-renewal; CDN via Cloudinary + optional Cloudflare; PM2 process manager with cluster mode; Winston structured logging with Sentry alerting.
4. **Backup & Recovery** — Automated daily `mongodump` to cloud storage; 7 daily + 4 weekly + 3 monthly retention; oplog PITR; backup integrity verification; documented restore procedure.
5. **Cron Jobs** — Database-backed job queue (bull/Redis): daily backup, daily payment reconciliation (BR-AUD-003), membership expiry, notification cleanup; missed-window catch-up; heartbeat monitoring.
6. **CI/CD Pipeline** — GitHub Actions: build Docker images → run tests → deploy to staging → smoke test → deploy to production; rollback script; environment protection rules.
7. **Feature Flags** — Toggle features without deployment; maintenance mode; beta feature rollout percentages.
8. **Load Testing** — k6 scripts for login, membership purchase, booking, check-in; results verify performance targets.
9. **Penetration Testing** — OWASP Top 10 checklist completed; dependency vulnerability scan clean (0 CRITICAL/HIGH).
10. **Documentation** — Complete API catalog; developer onboarding guide; support runbook; updated README; verified accuracy of all 20+ documentation files.
11. **Handover Package** — Production credentials inventory; vendor contacts (Stripe, VNPAY, Twilio, cloud provider); access management (SSH keys, admin accounts); escalation matrix.

---

*End of Sprint 7 document. This is the final sprint. Upon completion, GymPro is production-ready.*
