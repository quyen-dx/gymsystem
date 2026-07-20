# 00_EXECUTION_OVERVIEW — GymPro Master Execution Plan

> **Document Type:** Master Execution Overview
> **Version:** 1.0
> **Last Updated:** 2026-07-20
> **Status:** Active
> **Audience:** Development Team, AI Contributors, Technical Leads
> **Depends On:** [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md), [PHASE_2_COMPLETION_REPORT.md](../PHASE_2_COMPLETION_REPORT.md)

---

## 1. Purpose

This document translates the approved [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) (the "what, when, and phases") into actionable, sprint-scoped execution instructions. Each sprint delivers concrete, working, tested, and documented code. This document is the single entry point for all implementation execution.

---

## 2. Relationship to Other Documents

| Document | Role | Relationship |
|---|---|---|
| [IMPLEMENTATION_ROADMAP.md](../IMPLEMENTATION_ROADMAP.md) | Master plan | Defines **what** to build, **when**, and **phases**. This file translates those phases into sprints. |
| [PHASE_2_COMPLETION_REPORT.md](../PHASE_2_COMPLETION_REPORT.md) | Documentation audit results | Confirms zero CRITICAL/HIGH documentation conflicts. Implementation may proceed. |
| `00_EXECUTION_OVERVIEW.md` (this file) | Sprint orchestration | Orchestrates all sprints; defines sprint structure, principles, risk summary, and success metrics. |
| `IMPLEMENTATION_SEQUENCE.md` (sibling) | Dependency-ordered build order | Exact feature-by-feature implementation order within and across sprints. |
| `01_SPRINT_0.md` through `08_SPRINT_7.md` | Per-sprint execution | Detailed deliverables, acceptance criteria, test strategies, and review checklists per sprint. |
| [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) | Rules governing all code | Every line of code in every sprint must conform to this constitution. |
| [AI_DEVELOPMENT_WORKFLOW.md](../AI_DEVELOPMENT_WORKFLOW.md) | Process AI must follow per task | Every task within a sprint must follow this workflow: classify, plan, approve, implement, test, document, review. |
| [BUSINESS_RULES.md](../BUSINESS_RULES.md) | Business rule source of truth | All BR-MEM-\*, BR-BKG-\*, BR-PAY-\*, BR-WAL-\*, BR-SHP-\*, BR-CHK-\*, BR-NTF-\*, BR-ADM-\*, BR-AUD-\* rules. |
| [STATE_MACHINES.md](../STATE_MACHINES.md) | State machine definitions | Membership cycle, booking, payment, order, notification state machines. |
| [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) | Role-based access control | All RBAC decisions for GUEST, MEMBER, PT, STAFF, SELLER, ADMIN, SUPER_ADMIN. |
| [DATABASE.md](../DATABASE.md) | Database schema reference | 64 collections across all modules. |
| [DATABASE_CONVENTIONS.md](../DATABASE_CONVENTIONS.md) | Mongoose patterns | Naming, indexing, transaction conventions. |
| [API_STANDARDS.md](../API_STANDARDS.md) | API endpoint conventions | RESTful patterns, pagination, filtering, response formats. |
| [EDGE_CASES.md](../EDGE_CASES.md) | Known edge cases | EC-MEM-\*, EC-BKG-\*, EC-CHK-\*, EC-PAY-\*, EC-WAL-\*, EC-SHP-\*, EC-SYS-\*. |
| [ERROR_HANDLING.md](../ERROR_HANDLING.md) | Error taxonomy | Error codes, formats, handling patterns. |
| [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) | Architecture blueprint | Monorepo layout, layer separation, dependency direction. |
| [AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md) | AI subsystem design | Provider chains, intent classification, tool routing, RAG pipeline. |
| [AI_WORKFLOW.md](../AI_WORKFLOW.md) | AI conversation flows | Intent definitions, permission scopes, tool layers. |
| [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) | Project context | Tech stack, module list, mission/vision. |

---

## 3. Sprint Structure

Implementation is organized into **8 sprints** (numbered 0 through 7). Sprint 0 establishes the foundation; all subsequent sprints build on it. Sprint order is **non-negotiable** due to hard technical and business dependencies (see Section 6).

| Sprint | Name | Duration | Modules |
|---|---|---|---|
| **0** | Foundation | 2 weeks | Repository structure, environment configuration, database connection, Express skeleton, shared utilities, CI/CD pipeline, AI Core setup |
| **1** | Identity | 2 weeks | Authentication (JWT, OAuth, OTP), authorization (RBAC middleware), user management, profile, role assignment |
| **2** | Revenue | 3 weeks | Membership (plans, cycles, freeze, cancel, refund), payment (VNPAY, Stripe, idempotency), wallet (balance, deposit, withdraw, transfer), transaction ledger |
| **3** | Scheduling | 3 weeks | PT management (profiles, assignments, specializations), schedule (availability, slots, exceptions), booking (create, confirm, cancel, waitlist, recurring, violations) |
| **4** | Wellness | 2 weeks | Workout (plans, exercises, logs, progress), nutrition (meal plans, tracking), health (metrics, body composition, goals) |
| **5** | Commerce | 2 weeks | Shop (cart, orders, GHN shipping), inventory (stock management, reservation), seller (payouts, escrow, dashboard), product catalog (CRUD, categories, variants) |
| **6** | Intelligence | 2 weeks | Check-in (QR, activation, streak), dashboard (role-based analytics), reports (revenue, members, check-ins), notification (email, SMS, push, in-app via state machine) |
| **7** | Production | 2 weeks | Security hardening (Helmet, rate limit, audit, CSRF, CORS), optimization (queries, caching, bundle, images), production deployment (Docker, SSL, CDN, monitoring, backup) |

**Total Timeline: 18 weeks** across all sprints.

---

## 4. Implementation Principles

These principles are binding on all sprints:

### 4.1 Sprint Sequencing

- One sprint at a time. Sprint N must be **complete** (all Definition of Done conditions met) before Sprint N+1 begins.
- No parallel sprints. No overlapping sprint work. This prevents integration chaos.

### 4.2 Within-Sprint Ordering

- Within a sprint, implement in **dependency order** as specified in [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md).
- Models/types → Services → Controllers → Routes → Tests → Documentation.
- See [AI_CODING_CONSTITUTION.md Part 6 Section 1](../AI_CODING_CONSTITUTION.md#part-6-implementation-workflow) for the file modification order rules.

### 4.3 Delivery Requirements

Every sprint delivers:
- **Working code:** Compiles, lints, and all tests pass.
- **Tested code:** Business rule tests reference BR-xxx rule IDs. Permission tests cover every role. Edge case tests reference EC-xxx IDs.
- **Documented code:** All affected documentation updated per the Documentation Update Matrix ([AI_CODING_CONSTITUTION.md Part 8](../AI_CODING_CONSTITUTION.md#part-8-documentation-rules)).

### 4.4 Quality Standards

- Zero tolerance for dead code, commented-out code, TODO/FIXME markers.
- All business rules from [BUSINESS_RULES.md](../BUSINESS_RULES.md) must be implemented and tested.
- All state machines from [STATE_MACHINES.md](../STATE_MACHINES.md) must be correctly handled.
- All permissions from [PERMISSION_MATRIX.md](../PERMISSION_MATRIX.md) must be enforced.
- All edge cases from [EDGE_CASES.md](../EDGE_CASES.md) must be handled.
- All API endpoints must conform to [API_STANDARDS.md](../API_STANDARDS.md).
- All database operations must conform to [DATABASE.md](../DATABASE.md) and [DATABASE_CONVENTIONS.md](../DATABASE_CONVENTIONS.md).

### 4.5 Documentation Synchronization

Documentation and code are updated in **the same commit**. Outdated documentation is treated as a bug per [AI_CODING_CONSTITUTION.md Part 8](../AI_CODING_CONSTITUTION.md#documentation-outdated--bug).

---

## 5. How to Use Sprint Documents

Each sprint document (`01_SPRINT_0.md` through `08_SPRINT_7.md`) follows this structure:

| Section | Contents |
|---|---|
| **Sprint Goal** | One-sentence mission statement for the sprint. |
| **Business Objectives** | What business capability the sprint enables. |
| **Modules** | All modules delivered by this sprint. |
| **Dependencies & Prerequisites** | What must be complete before starting (from prior sprints). |
| **Pre-Reading** | Exact documents that MUST be read before executing any task in this sprint. |
| **Business Rules** | All BR-xxx rules implemented in this sprint, with rule IDs. |
| **State Machines** | All state machines implemented or transitioned in this sprint. |
| **Permissions** | All permission configurations for the sprint's endpoints. |
| **Database Collections** | All collections created or modified in this sprint. |
| **API Endpoints** | All endpoints delivered in this sprint. |
| **Files Expected** | List of files expected to be created or modified. |
| **Definition of Ready** | Conditions that must be true before starting the sprint. |
| **Definition of Done** | Conditions that must be true before the sprint is complete. |
| **Acceptance Criteria** | Observable, testable conditions proving the sprint succeeds. |
| **Testing Strategy** | Unit, integration, business rule, permission, edge case, and regression test plan. |
| **Rollback Strategy** | How to undo the sprint if something goes wrong. |
| **Risks** | Specific risks for this sprint with mitigation strategies. |
| **Implementation Order** | Estimated feature implementation order within the sprint (referencing [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md)). |
| **Review Checklist** | Items verified during sprint review (mirrors [AI_CODING_CONSTITUTION.md Part 9](../AI_CODING_CONSTITUTION.md#part-9-review-checklist)). |
| **Documentation Update Checklist** | All documentation files that must be updated. |
| **Deliverables** | Tangible outputs of the sprint. |

---

## 6. Critical Dependencies

The sprint order is non-negotiable because of these hard dependencies:

| Sprint | Depends On | Why |
|---|---|---|
| **S0: Foundation** | Nothing | Infrastructure, shared code, and environment must exist before any feature code. |
| **S1: Identity** | Sprint 0 | Needs database connection, environment config, error handling middleware, shared utilities. |
| **S2: Revenue** | Sprint 1 | Member identity (users collection, auth middleware) required for membership ownership and payment attribution. |
| **S3: Scheduling** | Sprint 2 | Active membership required for booking (BR-BKG-002). Wallet required for penalty deductions (BR-BKG-004). Payment processing required for PT sessions. |
| **S4: Wellness** | Sprints 1 + 3 | User profiles from Sprint 1. PT assignments and schedule access from Sprint 3 (workout plans linked to trainers). |
| **S5: Commerce** | Sprints 2 + 0 | Payment gateway and wallet from Sprint 2 for checkout and escrow. Shared utilities from Sprint 0. |
| **S6: Intelligence** | Sprints 1–5 | Data from all modules: user data (S1), membership/payment data (S2), booking data (S3), workout/health data (S4), shop/order data (S5). |
| **S7: Production** | Sprints 0–6 | All features must exist and be tested before production hardening and deployment. |

### Dependency Chain Summary

```
S0 (Foundation)
 └─ S1 (Identity)
     └─ S2 (Revenue)
         └─ S3 (Scheduling)
             └─ S4 (Wellness) ───┐
     ┌───────────────────────────┘
     ├─ S5 (Commerce)
     └─ S6 (Intelligence) ← depends on S1–S5 data
         └─ S7 (Production) ← depends on S0–S6
```

**Violation of this dependency order will cause:**
- Missing database collections leading to runtime errors.
- Missing middleware leading to unauthenticated/unvalidated endpoints.
- Missing business-rule enforcement leading to data corruption.
- Inability to write integration tests (missing upstream services).

---

## 7. Risk Summary Per Sprint

| Sprint | Top Risk | Severity | Mitigation |
|---|---|---|---|
| **S0** | Incorrect environment configuration blocks all subsequent sprints | CRITICAL | Verify `.env` files against [DATABASE.md](../DATABASE.md) connection config. Run health check endpoint before proceeding to Sprint 1. |
| **S1** | Authentication flaw compromises entire system | CRITICAL | Follow [AI_CODING_CONSTITUTION.md Part 11](../AI_CODING_CONSTITUTION.md#part-11-security-rules) JWT rules exactly. Implement refresh token rotation. Test all auth flows with expired/invalid tokens. |
| **S2** | Payment bug causes revenue leakage | CRITICAL | Implement idempotency keys per BR-PAY-002. Use MongoDB transactions for all payment+membership operations per [AI_CODING_CONSTITUTION.md Part 7 Section: Transactions](../AI_CODING_CONSTITUTION.md#transactions). Test with concurrent payment requests (EC-PAY-001). |
| **S3** | Booking race condition causes double bookings | HIGH | Use atomic `findOneAndUpdate` with slot availability guard. Implement pessimistic locking or Mongoose transactions. Test EC-BKG-001 (double booking). |
| **S4** | Health data privacy violation | HIGH | Encrypt PII fields per [AI_CODING_CONSTITUTION.md Part 11](../AI_CODING_CONSTITUTION.md#sensitive-data-protection). Enforce PERMISSION_MATRIX health resource permissions. Audit log all health data access. |
| **S5** | Inventory overselling | HIGH | Use atomic stock deduction with `$inc: -quantity` guarded by `{ stock: { $gte: quantity } }`. Implement reservation timeout. Test EC-SHP-001 (double purchase of last item). |
| **S6** | Report inaccuracy for financial compliance | HIGH | Cross-validate report numbers against raw transaction data. Implement dual-entry ledger in Sprint 2. Test revenue reconciliation (sum of payments = report total). |
| **S7** | Production deployment failure | CRITICAL | Test Docker configurations in staging first. Implement blue-green deployment. Verify backup/restore pipeline. Test rollback procedure. |

---

## 8. Success Metrics

### 8.1 Completeness Metrics

| Metric | Target |
|---|---|
| Business rules (BR-xxx) implemented and tested | 100% |
| State machine transitions handled correctly | 100% |
| Permission matrix enforced on all endpoints | 100% |
| Edge cases (EC-xxx) handled | 100% |
| Documentation conflicts (CRITICAL + HIGH) | 0 |
| Documentation conflicts (MEDIUM) | 0 |

### 8.2 Performance Metrics

| Metric | Target |
|---|---|
| API response time (p95) | < 500ms |
| API response time (p99) | < 2s |
| Database query time (p95) | < 20ms |
| Max queries per request | 10 |
| Initial JS bundle (gzipped) | < 300KB |
| Lighthouse Performance score | > 90 |
| Lighthouse Accessibility score | > 90 |

### 8.3 Quality Metrics

| Metric | Target |
|---|---|
| TypeScript compilation errors | 0 |
| ESLint errors | 0 |
| ESLint warnings | 0 |
| Test coverage on business logic | 100% |
| Regression test failures | 0 |
| Dead code (commented-out, TODO, FIXME) | 0 |
| Unused imports/variables | 0 |

### 8.4 Security Metrics

| Metric | Target |
|---|---|
| Unauthenticated protected endpoints | 0 |
| Unauthorized accessible resources | 0 |
| Missing input validation | 0 |
| Secrets in code | 0 |
| Missing rate limiting | 0 |
| Missing audit logging for sensitive ops | 0 |

---

## 9. Governance

### 9.1 Sprint Approval

- Each sprint begins only after the previous sprint's Definition of Done is verified.
- Sprint documents (`01_SPRINT_0.md` through `08_SPRINT_7.md`) serve as the sprint contract.
- Deviation from a sprint plan requires an updated sprint document and re-approval.

### 9.2 Change Control

- Scope changes mid-sprint require a revised sprint document.
- Architecture changes require a new ADR in [docs/adr/](../adr/).
- Cross-sprint dependency changes require updating both affected sprint documents.

### 9.3 Progress Tracking

- Sprint completion is binary: Done or Not Done.
- Partial credit is not recognized. All Definition of Done conditions must be met.
- Tracked in [CURRENT_PHASE.md](../CURRENT_PHASE.md) (update the "Active Priorities" section).

---

## 10. Next Steps

1. Review and approve this execution overview.
2. Review and approve [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md).
3. Generate `01_SPRINT_0.md` (Foundation sprint — first to execute).
4. Execute Sprint 0 per [AI_DEVELOPMENT_WORKFLOW.md](../AI_DEVELOPMENT_WORKFLOW.md) with [AI_CODING_CONSTITUTION.md](../AI_CODING_CONSTITUTION.md) as the governing rules.
