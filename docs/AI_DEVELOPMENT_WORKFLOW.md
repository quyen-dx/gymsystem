# AI Development Workflow

> **Document Owner:** Principal Engineering Manager
> **Classification:** Engineering Process — Mandatory for all AI contributors
> **Applies To:** Every AI model contributing code to the GymPro Gym Management System
> **Version:** 1.0.0
> **Last Updated:** 2026-07-20

---

## Table of Contents

1. [Overall Development Lifecycle](#part-1-overall-development-lifecycle)
2. [Context Loading Strategy](#part-2-context-loading-strategy)
3. [Task Classification](#part-3-task-classification)
4. [Task Planning](#part-4-task-planning)
5. [Approval Gates](#part-5-approval-gates)
6. [Implementation Workflow](#part-6-implementation-workflow)
7. [Documentation Workflow](#part-7-documentation-workflow)
8. [Testing Workflow](#part-8-testing-workflow)
9. [Review Workflow](#part-9-review-workflow)
10. [Error Recovery Workflow](#part-10-error-recovery-workflow)
11. [Context Optimization](#part-11-context-optimization)
12. [Parallel Development Rules](#part-12-parallel-development-rules)
13. [Merge Workflow](#part-13-merge-workflow)
14. [Continuous Improvement](#part-14-continuous-improvement)
15. [Templates](#part-15-templates)
16. [Production Workflow](#part-16-production-workflow)
17. [Definition of Ready](#part-17-definition-of-ready)
18. [Definition of Done](#part-18-definition-of-done)

---

## PART 1: Overall Development Lifecycle

Every AI contributor MUST follow this exact lifecycle for every task from the moment it is received until it is merged into production. No step may be skipped, reordered, or merged with another step unless explicitly permitted by this document.

### Lifecycle Diagram

```
TASK RECEIVED
    ↓
TASK CLASSIFICATION
    ↓
CONTEXT LOADING
    ↓
TASK ANALYSIS
    ↓
IMPLEMENTATION PLAN
    ↓
APPROVAL GATE ────→ WAIT FOR APPROVAL (if required)
    ↓                          ↓
IMPLEMENTATION          APPROVED
    ↓                       ↓
SELF-REVIEW ────────────────┘
    ↓
TESTING
    ↓
DOCUMENTATION UPDATE
    ↓
FINAL REVIEW
    ↓
READY FOR MERGE
```

### Step Details

**1. TASK RECEIVED**

The AI receives a task description. The task may come from a human user, an upstream Planner agent, or a project management system. The AI MUST NOT begin any work at this point. The first action is to acknowledge receipt and confirm understanding of the task.

- **Input:** A task description, issue link, or user request
- **Output:** Acknowledgment and request for clarification if any detail is ambiguous

**2. TASK CLASSIFICATION**

The AI classifies the task into exactly one type using the classification table in PART 3. Classification determines which documents must be loaded, what review is required, and what gates apply.

- **Input:** Task description
- **Output:** Classification result (type, priority, affected modules)

**3. CONTEXT LOADING**

The AI loads all required documents based on the task type and affected modules. Context is loaded in priority order as defined in PART 2. The AI MUST verify that all required documents exist and are accessible before proceeding.

- **Input:** Classification result
- **Output:** Confirmation that all required context is loaded

**4. TASK ANALYSIS**

The AI analyzes the task in the context of the loaded documents. For bugs, this means identifying root cause. For features, this means understanding what needs to be built and how it fits into the existing system. The AI must reference specific business rules, database models, API endpoints, and architecture decisions during analysis.

- **Input:** Loaded context + task description
- **Output:** Analysis notes including root cause (for bugs) and scope definition

**5. IMPLEMENTATION PLAN**

The AI produces a complete implementation plan following the template in PART 15. The plan MUST be specific enough that another AI could implement it without additional context. Every file that will be modified must be listed with the exact change described.

- **Input:** Task analysis
- **Output:** Implementation Plan document

**6. APPROVAL GATE**

If the implementation plan triggers any Approval Gate from PART 5, the AI MUST STOP and present the plan to the human for approval. The AI MUST NOT proceed past this point until approval is received. If no gates are triggered, the AI proceeds directly to implementation.

- **Input:** Implementation Plan
- **Output:** Approval (or rejection with feedback)

**7. IMPLEMENTATION**

The AI writes code following the AI_CODING_CONSTITUTION.md and the Implementation Workflow defined in PART 6. Code is written in iterative cycles with compile/lint/type-check verification after each cycle. Files are modified in dependency order.

- **Input:** Approved Implementation Plan
- **Output:** Modified source files

**8. SELF-REVIEW**

The AI performs a complete self-review against the constitution checklist, all applicable standards, and the Definition of Done (PART 18). Every item on the checklist must be verified before proceeding.

- **Input:** Modified source files
- **Output:** Self-review report with all issues addressed

**9. TESTING**

The AI runs the complete testing workflow from PART 8 in the specified order. All tests must pass. The AI writes new tests for any new or modified business logic. Business rule tests must reference the specific BR-xxx rule IDs.

- **Input:** Modified source files + self-review results
- **Output:** Test results with all tests passing

**10. DOCUMENTATION UPDATE**

The AI updates all affected documentation per the Documentation Update Matrix in PART 7. Documentation changes are made in the same commit as code changes. The AI verifies documentation quality after updating.

- **Input:** Modified source files + test results
- **Output:** Updated documentation files

**11. FINAL REVIEW**

The AI runs the complete Ready for Merge checklist from PART 13. Every item must be verified. If any item fails, the AI fixes it or returns to the appropriate earlier step.

- **Input:** Updated source files + tests + documentation
- **Output:** Final review report

**12. READY FOR MERGE**

The task is marked as ready for merge. The AI produces a Merge Report (PART 15 template) and hands off to the Merge Manager.

- **Input:** Final review report
- **Output:** Merge Report

### Guiding Principles

- **No shortcuts:** Every step in the lifecycle is mandatory. Skipping a step is a process violation.
- **No assumptions:** If any detail is unclear, ask. Do not assume intent.
- **Traceability:** Every decision must be traceable back to a documented business rule, architecture decision, or explicit approval.
- **One task at a time:** The AI works on exactly one task until it reaches READY FOR MERGE. Context switching between tasks is prohibited.

---

## PART 2: Context Loading Strategy

For every task, the AI MUST determine WHICH documents to load based on task classification and affected modules. Documents are organized into four tiers: Core, Business, Technical, and Architecture.

### Document Tiers

| Tier | Description | Always Loaded? |
|------|-------------|----------------|
| **Core** | Project-wide foundational documents | YES — every task |
| **Business** | Module-specific business rules, state machines, permissions, edge cases | YES — for each affected module |
| **Technical** | Database schemas, API specs, error handling, ADRs | YES — for each affected module |
| **Architecture** | System architecture, AI architecture, ADRs | Only if architecture change |

### Tier Contents

**Core (always loaded for every task):**

| Document | Purpose |
|----------|---------|
| `README_FOR_AI.md` | Project overview and AI onboarding instructions |
| `AI_CODING_CONSTITUTION.md` | Mandatory coding standards and constraints |
| `CURRENT_PHASE.md` | Current development phase and priorities |
| `PROJECT_OVERVIEW.md` | Project structure, tech stack, module list |

**Business (always loaded for each affected module):**

| Document | Purpose |
|----------|---------|
| `docs/modules/{module}.md` | Module overview, responsibilities, key concepts |
| `BUSINESS_RULES.md` (relevant section) | All BR-xxx rules for the module |
| `STATE_MACHINES.md` (if applicable) | State transitions for the module's entities |
| `PERMISSION_MATRIX.md` (relevant section) | Role-based access for the module |
| `EDGE_CASES.md` (relevant section) | Known edge cases for the module |

**Technical (always loaded for each affected module):**

| Document | Purpose |
|----------|---------|
| `DATABASE.md` (relevant models) | Database schema for the module |
| `API_STANDARDS.md` (relevant endpoints) | API specifications for the module |
| `ERROR_HANDLING.md` (relevant section) | Error codes and handling patterns |
| Relevant ADRs | Architecture decisions affecting the module |

**Architecture (loaded only if architecture change):**

| Document | Purpose |
|----------|---------|
| `SYSTEM_ARCHITECTURE.md` | Full system architecture |
| `AI_ARCHITECTURE.md` (if AI change) | AI-specific architecture |
| All relevant ADRs | Full set of architecture decisions |

### Module-Specific Loading Lists

#### Auth Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/auth.md`, BUSINESS_RULES.md (BR-AUTH-* section), PERMISSION_MATRIX.md (Auth section) |
| Technical | DATABASE.md (users, otps, sessions models), API_STANDARDS.md (auth endpoints), ADR-003 (JWT) |

#### Membership Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/membership.md`, BUSINESS_RULES.md (BR-MEM-* section), STATE_MACHINES.md (membership cycle), PERMISSION_MATRIX.md (Membership section), EDGE_CASES.md (EC-MEM-* section) |
| Technical | DATABASE.md (membership_cycles, plans models), API_STANDARDS.md (membership endpoints), ADR-001 (MongoDB) |

#### Booking Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/booking.md`, BUSINESS_RULES.md (BR-BKG-* section), STATE_MACHINES.md (booking section), PERMISSION_MATRIX.md (Booking section), EDGE_CASES.md (EC-BKG-* section) |
| Technical | DATABASE.md (bookings, slots models), API_STANDARDS.md (booking endpoints) |

#### Check-in Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/checkin.md`, BUSINESS_RULES.md (BR-CHK-* section), PERMISSION_MATRIX.md (Check-in section), EDGE_CASES.md (EC-CHK-* section) |
| Technical | DATABASE.md (check_ins model), API_STANDARDS.md (checkin endpoints) |

#### Payment Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/payment.md`, BUSINESS_RULES.md (BR-PAY-* section), STATE_MACHINES.md (payment section), PERMISSION_MATRIX.md (Payment section), EDGE_CASES.md (EC-PAY-* section) |
| Technical | DATABASE.md (payments, transactions models), API_STANDARDS.md (payment endpoints), ADR-005 (VNPAY+Stripe) |

#### Wallet Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/wallet.md`, BUSINESS_RULES.md (BR-WAL-* section), PERMISSION_MATRIX.md (Wallet section), EDGE_CASES.md (EC-WAL-* section) |
| Technical | DATABASE.md (wallets, transactions models), API_STANDARDS.md (wallet endpoints) |

#### Shop Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/shop.md`, BUSINESS_RULES.md (BR-SHP-* section), STATE_MACHINES.md (order section), PERMISSION_MATRIX.md (Shop section), EDGE_CASES.md (EC-SHP-* section) |
| Technical | DATABASE.md (products, orders models), API_STANDARDS.md (shop endpoints), ADR-009 (GHN) |

#### AI Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/ai-assistant.md` |
| Technical | AI_ARCHITECTURE.md, AI_WORKFLOW.md, PERMISSION_MATRIX.md (AI section), DATABASE.md (ai_conversations model), API_STANDARDS.md (AI endpoints), ADR-004 (Gemini) |

#### Notification Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/notification.md` |
| Technical | STATE_MACHINES.md (notification section), DATABASE.md (notifications model), API_STANDARDS.md (notification endpoints) |

#### Report Module

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/report.md` |
| Technical | PERMISSION_MATRIX.md (Reports section), DATABASE.md (relevant collections), API_STANDARDS.md (report endpoints) |

#### User Management

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/user-management.md` |
| Technical | PERMISSION_MATRIX.md (User Management section), DATABASE.md (users model), API_STANDARDS.md (user endpoints) |

#### System Settings

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/system-settings.md` |
| Technical | PERMISSION_MATRIX.md (Settings section), DATABASE.md (settings model), API_STANDARDS.md (settings endpoints) |

#### Content / Upload

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | `docs/modules/content.md`, `docs/modules/upload.md` |
| Technical | PERMISSION_MATRIX.md (Content section), DATABASE.md, API_STANDARDS.md |

#### Cross-Cutting Changes

| Tier | Documents |
|------|-----------|
| Core | README_FOR_AI.md, AI_CODING_CONSTITUTION.md, CURRENT_PHASE.md, PROJECT_OVERVIEW.md |
| Business | All relevant business docs for all affected modules |
| Technical | All relevant ADRs |
| Architecture | SYSTEM_ARCHITECTURE.md |

### Context Loading Priority

Documents MUST be loaded in this order, and the AI MUST confirm each tier is fully loaded before proceeding to the next:

1. **Load Core context first** — always. These are foundational and required for every task.
2. **Load Business context** — for each affected module. Business rules and state machines are critical for understanding what behavior is expected.
3. **Load Technical context** — for each affected module. Database schemas and API specs define the concrete implementation surface.
4. **Load Architecture context** — if the task involves an architecture change. This is loaded last because it is only needed if the first three tiers reveal an architecture impact.
5. **Load cross-module context** — if the change spans multiple modules. This ensures all module boundaries and dependencies are understood.

### Context Loading Verification

After loading, the AI MUST verify:

- Each document is accessible at the expected path
- The document content is parseable and not corrupt
- The document version is current (check LAST_UPDATED or version field)
- Cross-references between documents are resolvable

If any document is missing or outdated, the AI MUST report this before proceeding.

---

## PART 3: Task Classification

Every incoming task MUST be classified into exactly ONE type. Classification determines the required documents, review process, allowed scope, and testing requirements.

### Classification Table

| Task Type | Description | Examples |
|-----------|-------------|---------|
| **Bug Fix** | Incorrect behavior, crash, data inconsistency | "Membership freeze not updating cycle status" |
| **Feature** | New capability, new endpoint, new UI | "Add recurring booking support" |
| **Refactor** | Code restructure without behavior change | "Extract booking validation to service" |
| **Performance** | Speed, memory, query optimization | "Optimize dashboard query (slow)" |
| **Security** | Vulnerability, hardening, compliance | "Add rate limiting to auth endpoints" |
| **Responsive** | Mobile/tablet layout fixes | "Booking calendar broken on mobile" |
| **Accessibility** | A11y improvements | "Add aria labels to navigation" |
| **Database** | Schema change, index, migration | "Add isActive field to users" |
| **API** | Endpoint change, new endpoint, version | "Add batch booking endpoint" |
| **AI** | AI feature, tool, workflow | "Add nutrition query intent" |
| **Documentation** | Doc update, create, fix | "Update booking module docs" |
| **Infrastructure** | CI/CD, Docker, config, deployment | "Setup staging environment" |
| **Migration** | Data migration, schema migration | "Migrate old membership data" |
| **Hotfix** | Urgent production fix | "Fix payment webhook crash" |
| **Emergency** | Critical production incident | "Production down — gateway timeout" |

### Detailed Requirements by Type

#### Bug Fix

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Business + Technical) |
| Required Review | Self-review + Human review (if affects business logic or data) |
| Allowed Scope | Only files directly related to the bug fix |
| Forbidden Scope | Any file not listed in the implementation plan |
| Testing Required | Compile, Lint, Types, Unit (affected), Integration, Regression |

#### Feature

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Business + Technical) + Architecture (if new module) |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | Files in the affected module(s) + new files |
| Forbidden Scope | Modifying unrelated modules |
| Testing Required | Compile, Lint, Types, Unit (new + affected), Integration, Business rule, Permission, Regression |

#### Refactor

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Technical) |
| Required Review | Self-review + Peer review |
| Allowed Scope | Only the files being refactored |
| Forbidden Scope | Any business logic change |
| Testing Required | Compile, Lint, Types, Unit (no behavior change), Regression |

#### Performance

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Technical) |
| Required Review | Self-review + Peer review |
| Allowed Scope | Only performance-critical paths |
| Forbidden Scope | Non-performance code |
| Testing Required | Compile, Lint, Types, Unit (unchanged), Performance benchmark |

#### Security

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (all tiers) + Security-specific docs |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | Security-critical files only |
| Forbidden Scope | Non-security code changes |
| Testing Required | Compile, Lint, Types, Unit, Security tests, Permission tests, Regression |
| Gate Required | Gate 7 (Security Change) |

#### Responsive

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected frontend module |
| Required Review | Self-review |
| Allowed Scope | CSS, layout components, viewport-specific code |
| Forbidden Scope | Business logic, backend code |
| Testing Required | Visual check at 375px, 768px, 1280px, 1920px |

#### Accessibility

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected frontend module |
| Required Review | Self-review + Peer review |
| Allowed Scope | HTML, ARIA, keyboard navigation, focus management |
| Forbidden Scope | Visual design changes (unless accessibility-related) |
| Testing Required | Lint (a11y rules), Keyboard navigation test, Screen reader test |

#### Database

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Technical: DATABASE.md, ADRs) |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | Schema files, migration files, index files |
| Forbidden Scope | Application code changes unrelated to schema |
| Testing Required | Compile, Lint, Migration test (dry run), Query performance test |
| Gate Required | Gate 2 (Database Change) |

#### API

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (Technical: API_STANDARDS.md, Error handling) |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | Route files, controller files, request/response types |
| Forbidden Scope | Business logic changes (unless part of the API change) |
| Testing Required | Compile, Lint, Types, Unit, Integration, Permission, Regression |
| Gate Required | Gate 3 (API Change) |

#### AI

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + AI module (all tiers) |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | AI tools, workflows, providers, conversation handlers |
| Forbidden Scope | Non-AI module code |
| Testing Required | Compile, Lint, Types, Unit, AI conversation flow tests |

#### Documentation

| Requirement | Details |
|-------------|---------|
| Required Documents | Core (verify references) |
| Required Review | Self-review |
| Allowed Scope | Documentation files only |
| Forbidden Scope | Any source code file |
| Testing Required | None (verify markdown renders correctly) |

#### Infrastructure

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + System architecture |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | CI/CD configs, Docker files, deployment scripts |
| Forbidden Scope | Application code |
| Testing Required | Build test, Deploy test (on staging) |

#### Migration

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (DATABASE.md) |
| Required Review | Self-review + Peer review + Human review |
| Allowed Scope | Migration scripts, rollback scripts |
| Forbidden Scope | Application code changes (unless needed for migration) |
| Testing Required | Dry run migration, Verify rollback |
| Gate Required | Gate 6 (Migration) |

#### Hotfix

| Requirement | Details |
|-------------|---------|
| Required Documents | Core + Affected module (minimal) |
| Required Review | Self-review + Human review (expedited) |
| Allowed Scope | Only the minimal fix |
| Forbidden Scope | Any non-critical change |
| Testing Required | Compile, Lint, Unit (affected), Deploy immediately |

#### Emergency

| Requirement | Details |
|-------------|---------|
| Required Documents | Minimal (task description only) |
| Required Review | Human review (ASAP) |
| Allowed Scope | Any file needed for the fix |
| Forbidden Scope | Non-emergency changes |
| Testing Required | Compile, Security tests (if applicable), Deploy immediately |
| Gate Required | Only Security gate (Gate 7) |

### Classification Rules

- A task MUST NOT be classified as multiple types. Choose the PRIMARY type.
- If a task involves multiple types (e.g., a feature that requires a database change), classify as the PRIMARY type (Feature) and note the secondary type (Database) for gate purposes.
- If classification is ambiguous, use the most restrictive type.
- If a task could be classified as both a Bug Fix and Security, classify as Security (the more restrictive type).

---

## PART 4: Task Planning

Before ANY code is written, the AI MUST produce an Implementation Plan. The plan serves as the contract between the AI and the reviewer. It documents what will be done, how, and why.

### Plan Structure

Every Implementation Plan MUST contain all of the following sections:

```
## Implementation Plan

### 1. Problem Statement
Describe what needs to be done in 1-2 sentences.

### 2. Root Cause (for bugs)
What is the root cause of the issue. Empty for features.

### 3. Affected Modules
List all modules affected (even indirectly).

### 4. Files to Modify
Exact list of file paths that will be changed, with a brief description of the change for each.

### 5. Dependencies
List any external dependencies, library changes, or infrastructure changes needed.

### 6. Business Rules
List all BR-xxx rules that are relevant. Note any rules that might be affected.

### 7. Architecture Impact
Explain how this change affects the system architecture. If none, state "None."

### 8. Risks
List specific risks:
- Data loss risk
- Breaking change risk
- Performance risk
- Security risk
- Regression risk
Rate each as HIGH/MEDIUM/LOW.

### 9. Implementation Steps
Numbered list of steps in order. Each step should be a logical unit of work.

### 10. Rollback Plan
How to undo the change if something goes wrong.

### 11. Testing Plan
What tests must be written/modified. What scenarios must be tested.

### 12. Documentation Plan
What documentation must be created/updated.

### 13. Approval Required
YES/NO. If YES, specify which gate.
```

### Plan Quality Standards

- **Specificity:** Every file path must be exact. Every change description must describe WHAT changes and WHY.
- **Completeness:** All affected files must be listed. If a change requires modifying a file that was not in the plan, the plan must be updated first.
- **Traceability:** Every implementation step must trace back to a business rule, architecture decision, or approved requirement.
- **Scope Control:** The plan explicitly states what is IN scope and what is OUT of scope.

### Plan Approval

- If the plan triggers any Approval Gate from PART 5, the plan MUST be presented for human approval
- If no gate is triggered, the plan must still be presented for acknowledgment (the human may choose to reject or request changes)
- The AI MUST NOT begin implementation until the plan is approved
- If the plan is rejected, the AI MUST update it based on feedback and re-submit

---

## PART 5: Approval Gates

These are mandatory STOP points. The AI MUST present the plan and wait for explicit human approval before proceeding past any triggered gate. Implementation is FORBIDDEN without approval.

### Gate 1: Business Rule Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Adding, modifying, or removing any business rule (BR-xxx) |
| **Required** | Present new/modified rule. Explain why. Wait for approval. |
| **Forbidden** | No implementation without approval |
| **Examples** | Changing freeze duration limit, adding new membership type |

### Gate 2: Database Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | New collection, new field, field rename, field removal, index change, migration |
| **Required** | Present exact schema change. Present migration plan. Explain why. Wait for approval. |
| **Forbidden** | No schema change, no migration without approval |
| **Examples** | Adding `isActive` to users, creating a new `promotions` collection |

### Gate 3: API Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | New endpoint, changed endpoint signature, changed response format, endpoint removal |
| **Required** | Present exact API specification (method, path, request, response, auth). Wait for approval. |
| **Forbidden** | No API changes without approval |
| **Examples** | Adding PATCH /bookings/:id, changing response format of GET /memberships |

### Gate 4: Permission Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | New permission, changed role access, removed permission |
| **Required** | Present exact permission matrix change. Explain why. Wait for approval. |
| **Forbidden** | No permission changes without approval |
| **Examples** | Adding `membership:freeze` permission, changing admin access to booking cancellation |

### Gate 5: Architecture Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | New module, new layer, dependency direction change, new external service, new architectural pattern |
| **Required** | Present architecture change proposal. Include rationale, alternatives considered, impact analysis. Wait for approval. |
| **Forbidden** | No architecture changes without approval |
| **Examples** | Adding a new Notification module, introducing a message queue, changing from REST to GraphQL |

### Gate 6: Migration

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Any data migration (backfill, transform, cleanup) |
| **Required** | Present migration plan. Include: purpose, data volume, execution time, rollback strategy, risk assessment. Wait for approval. |
| **Forbidden** | No migration execution without approval |
| **Examples** | Backfilling missing fields, transforming date formats, consolidating duplicate records |

### Gate 7: Security Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Any change to auth, permissions, encryption, rate limiting, or security middleware |
| **Required** | Present security change. Explain why. Include security review. Wait for approval. |
| **Forbidden** | No security changes without approval |
| **Examples** | Modifying JWT expiry, adding rate limiting, changing password hashing algorithm |

### Gate 8: Cross-Module Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Changes spanning 2+ modules, or adding a dependency between previously independent modules |
| **Required** | Present cross-module change plan. Explain why it's necessary. Show that module isolation is maintained. Wait for approval. |
| **Forbidden** | No changes in the secondary module without approval |
| **Examples** | Booking module needs to read membership data, Payment module needs to notify the Wallet module |

### Gate 9: Breaking Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Any change that would require existing clients to update |
| **Required** | Present breaking change analysis. Include: affected clients, migration strategy, deprecation plan. Wait for approval. |
| **Forbidden** | No breaking changes without approval |
| **Examples** | Renaming an API field, changing response status codes, removing an endpoint |

### Gate 10: Dependency Change

| Attribute | Detail |
|-----------|--------|
| **Trigger** | New npm/pip/gem dependency, version upgrade/downgrade of existing dependency |
| **Required** | Present dependency change. Include: reason, version, license check, security check. Wait for approval. |
| **Forbidden** | No dependency changes without approval |
| **Examples** | Adding `date-fns` for date formatting, upgrading `mongoose` to v8 |

### Gate Processing Rules

1. **Single Gate:** If one gate is triggered, present the plan for that gate only.
2. **Multiple Gates:** If multiple gates are triggered, present all triggered gates in a single plan. Each gate must be explicitly addressed.
3. **Nested Gates:** If a change triggers Gate 2 (Database) and Gate 6 (Migration) for the same change, present them together.
4. **Approval Scope:** Approval is for the SPECIFIC plan presented. Any deviation from the approved plan requires re-approval.
5. **Approval Expiry:** If more than 48 hours pass between approval and implementation start, re-confirm the approval.
6. **Rejection:** If a gate is rejected, the AI must document the rejection reason and may not re-submit the same plan unless circumstances change.

---

## PART 6: Implementation Workflow

This section defines the EXACT process the AI follows when writing code.

### Iteration Model

The AI implements code in iterative cycles:

- **Cycle Size:** Each implementation cycle modifies 1-5 files maximum
- **Cycle Verification:** After each cycle, run in order:
  1. Compile check (`npm run build` or `tsc --noEmit`)
  2. Lint check (`npm run lint`)
  3. Type check (TypeScript strict mode)
- **Failure Handling:** If any verification step fails, fix immediately before proceeding to the next cycle
- **Mini Review:** After every 3 cycles OR every 50 lines of new code (whichever comes first), perform a mini self-review

### File Modification Rules

1. **Dependency Order:** Modify files in dependency order:
   - Models / Types first
   - Services second
   - Controllers third
   - Routes / Endpoints fourth
   - Tests last
   - Documentation after all code changes

2. **Single File Focus:** Modify one file at a time. After modifying a file, verify it still compiles before moving to the next.

3. **Plan Fidelity:** Never modify a file that isn't in the approved plan. If the change requires modifying additional files, STOP and update the plan.

4. **Atomic Changes:** Each modification should be a logical unit of work. Do not bundle unrelated changes into a single file edit.

### Module Scope

1. **Single Module Rule:** Stay within ONE module per task unless cross-module change is approved (Gate 8).

2. **Module Isolation:** If you find yourself modifying code in Module B while working on Module A, STOP unless cross-module changes were approved.

3. **Module Dependencies:** Module A code must never directly import Module B models. Use services for cross-module communication.

4. **Shared Code:** If shared code needs to be modified, verify it is in the appropriate shared location (e.g., `shared/`, `common/`, `lib/`).

### When to Stop During Implementation

The AI MUST STOP and present to the user if any of these conditions are encountered:

1. **Business Rule Conflict:** A business rule in the documentation directly conflicts with the required implementation
2. **Architecture Constraint:** The existing architecture does not support the required change
3. **Security Vulnerability:** A security vulnerability is discovered in existing code that must be addressed
4. **Scope Creep:** The task is significantly larger than initially estimated (> 2x the estimated effort)
5. **Unplanned Change:** A change is needed that was not in the approved plan
6. **External Blockage:** An external dependency, third-party service, or infrastructure constraint prevents implementation

When stopping, the AI must clearly state:
- What was happening when the issue was discovered
- What the issue is (exact details)
- What options are available to resolve it
- A recommendation for the best path forward

### When to Split a Task

The AI MUST split the task into sub-tasks if any of these conditions are met:

1. The implementation plan has more than 10 steps
2. The change affects more than 5 modules
3. The change requires more than 2 approval gates
4. The estimated work exceeds 4 hours of coding
5. The change includes both backend AND frontend work

When splitting, produce a parent task (tracking) and N sub-tasks, each with its own implementation plan, approval gates (if applicable), and testing plan.

### When to Rollback

The AI MUST rollback and reconsider if:

1. **Wrong Approach:** Implementation reveals the approach is fundamentally wrong
2. **Incorrect Assumptions:** Tests reveal that fundamental assumptions about the system are incorrect
3. **Performance Degradation:** Performance tests show unacceptable degradation
4. **Security Weakness:** Security review reveals vulnerabilities in the approach that cannot be trivially fixed

When rolling back:
1. Revert all file changes (using `git checkout` or equivalent)
2. Document what was learned
3. Create a revised implementation plan
4. Present for approval again

---

## PART 7: Documentation Workflow

Documentation updates are NOT optional. They are a mandatory part of every task.

### Documentation Update Timing

- **IMMEDIATE:** Documentation is updated immediately after the code change, not at the end of the day/week/sprint
- **SAME COMMIT:** Documentation changes are in the SAME commit/pull request as the code change
- **EXCEPTION:** If documentation creation would take more than 30 minutes, create a separate documentation task (but the documentation task must be created in the same sprint)

### Documentation Update Matrix

| Code Change | Documentation to Update |
|-------------|------------------------|
| New business rule | `BUSINESS_RULES.md` (add rule), `EDGE_CASES.md` (add related edge cases) |
| Modified business rule | `BUSINESS_RULES.md` (update rule), `STATE_MACHINES.md` (if state affected) |
| Removed business rule | `BUSINESS_RULES.md` (mark deprecated or remove with migration note) |
| New model/collection | `DATABASE.md` (add model), `docs/modules/{module}.md` (update models section) |
| Modified model/collection | `DATABASE.md` (update model) |
| New field | `DATABASE.md` (add field to model) |
| Removed field | `DATABASE.md` (remove or mark deprecated) |
| New API endpoint | `API_STANDARDS.md` (add endpoint), `docs/modules/{module}.md` (update endpoints section) |
| Modified API endpoint | `API_STANDARDS.md` (update endpoint) |
| Removed API endpoint | `API_STANDARDS.md` (remove or mark deprecated) |
| New error code | `ERROR_HANDLING.md` (add error code) |
| Modified error code | `ERROR_HANDLING.md` (update error code) |
| Removed error code | `ERROR_HANDLING.md` (remove or mark deprecated) |
| New permission | `PERMISSION_MATRIX.md` (add permission) |
| Modified permission | `PERMISSION_MATRIX.md` (update permission) |
| Removed permission | `PERMISSION_MATRIX.md` (remove permission) |
| New state/transition | `STATE_MACHINES.md` (add state/transition) |
| Modified state/transition | `STATE_MACHINES.md` (update) |
| New edge case | `EDGE_CASES.md` (add edge case) |
| New architecture decision | `docs/adr/ADR-NNN.md` (create new ADR) |
| AI tool/workflow change | `AI_ARCHITECTURE.md`, `AI_WORKFLOW.md`, `docs/modules/ai-assistant.md` |
| Dependency change | `PROJECT_OVERVIEW.md` (update tech stack), ADR (new or update) |
| Module change | `docs/modules/{module}.md` |
| New module | `docs/modules/{new-module}.md` (create), `PROJECT_OVERVIEW.md` (add to module list) |

### Documentation Quality Check

After updating documentation, the AI MUST verify:

- [ ] Does the doc follow the established format and conventions?
- [ ] Are all cross-references correct and resolvable?
- [ ] Are there typos, grammatical errors, or formatting issues?
- [ ] Does the doc still read coherently after the update?
- [ ] Are all code examples and API examples still accurate?
- [ ] Are all version numbers and dates updated?
- [ ] Is the document's LAST_UPDATED field updated?

### Documentation Standards

1. **Format:** All documentation uses GitHub-flavored Markdown
2. **Line Length:** Maximum 120 characters per line (use soft wrapping)
3. **Headings:** Use ATX-style headings (`#`, `##`, `###`)
4. **Code Blocks:** Use fenced code blocks with language identifiers
5. **Tables:** Use GFM table syntax
6. **Cross-References:** Use relative links within the docs directory
7. **Templates:** Use templates from PART 15 where applicable

---

## PART 8: Testing Workflow

The AI MUST follow this exact testing order. Each step depends on the previous step passing.

### Step 1: Compile Check

- Run TypeScript compilation: `npm run build` or `tsc --noEmit`
- ALL errors must be fixed before proceeding
- Compile errors are the highest priority fix
- If compilation fails, fix the error and re-run. Do not proceed to Step 2 until compilation passes.

### Step 2: Lint Check

- Run ESLint: `npm run lint`
- ALL errors must be fixed
- Warnings should be fixed if possible
- If a lint rule is intentionally broken, document WHY with a special comment (e.g., `// eslint-disable-next-line <rule> -- <reason>`)
- Lint must pass before proceeding

### Step 3: Type Check

- Run TypeScript strict type checking with `tsc --noEmit --strict`
- No `any` types without justification
- No type assertions without justification
- All interfaces/types must be correct
- All generic type parameters must be satisfied

### Step 4: Unit Tests

- Run specific unit tests for changed files: `npm test -- --grep "pattern"`
- If unit tests do not exist for the changed code, WRITE THEM FIRST
- New business logic MUST have unit tests
- Test coverage requirements:
  - All branches of new code must be covered
  - All error paths must be tested
  - All input validation paths must be tested
  - All business rule conditions must be tested

### Step 5: Integration Tests

- Run integration tests for the affected module
- Test service + model interactions together
- Test multi-step flows (e.g., create → read → update → delete)
- Test database interactions
- Test external service interactions (with mocks or test doubles)

### Step 6: Business Rule Tests

- For each BR-xxx rule affected, write or verify a test that specifically tests that rule
- Test names MUST reference the rule ID: e.g., `"BR-MEM-001: One active membership per member"`
- Verify: rule enforced, rule happy path, rule edge cases
- These tests serve as regression prevention for business rules

### Step 7: Permission Tests

- For each endpoint modified, test that the correct roles have access
- Test that incorrect roles receive 403 Forbidden
- Test edge cases: no token, expired token, invalid token, malformed token
- Verify the permission check happens BEFORE the business logic executes

### Step 8: Security Tests

- Test input validation: send invalid/malicious data, verify rejection
- Test injection attempts if applicable (SQL injection, NoSQL injection, XSS)
- Test rate limiting if endpoint is auth-related
- Test sensitive data exposure: verify passwords, tokens, PII are never returned in responses

### Step 9: Regression Tests

- Run the full test suite
- ALL existing tests must pass
- If an existing test fails:
  - Determine if it is a pre-existing failure (document it with a known-issue reference)
  - If it is a regression (newly broken), FIX THE CODE, do not modify the test
  - If the test is wrong because of an intentional behavior change, update the test and document why

### Step 10: Frontend Tests (if applicable)

- **Responsive:** Check layout at 375px, 768px, 1280px, 1920px viewport widths
- **Accessibility:** Check semantic HTML, keyboard navigation, ARIA labels, focus management
- **Visual:** No visual regressions compared to the previous version
- **Component Tests:** If component tests exist, run them

### Step 11: Manual QA (simulated)

The AI must simulate the user flow to verify correctness:

- **Happy Path:** Complete the flow end-to-end with valid data
- **Error Path:** Trigger each error condition and verify the correct error response
- **Edge Path:** Test boundary conditions (empty data, maximum data, concurrent requests)

Manual QA is documented with the exact steps taken and the results observed. If any step produces unexpected results, the AI must fix the issue before proceeding.

---

## PART 9: Review Workflow

### AI Self-Review (Mandatory for ALL tasks)

Before any human or peer sees the code, the AI MUST run through the complete self-review checklist from AI_CODING_CONSTITUTION.md PART 14.

The AI must output answers to each question and fix any issues found before proceeding. Self-review is NOT optional and cannot be skipped.

Self-review process:
1. Read through all modified files
2. For each item on the checklist, verify compliance
3. Document any issues found
4. Fix all issues
5. Re-run tests to confirm fixes are correct
6. Document that self-review is complete

### Peer Review (Required for specific task types)

Required for: Features, Refactors, Database, API, Security, Migration

If a peer AI is available:
1. Send the full diff + implementation plan to the peer AI
2. Peer checks:
   - Business logic correctness
   - Architecture compliance
   - Code standards compliance
   - Edge case handling
   - Test coverage
   - Documentation accuracy
3. All peer feedback MUST be addressed:
   - Accept the feedback and fix the code, OR
   - Explain why the feedback does not apply (with justification)
4. Document the peer review result

If no peer AI is available, document "Peer review: not available" and proceed to human review.

### Human Review (Required for all Approval Gates from PART 5)

When required:
1. Present the completed work to the human
2. Include in the presentation:
   - Summary of all changes
   - Implementation plan (original + any deviations)
   - Test results (all passing)
   - Documentation changes
   - Self-review results
   - Peer review results (if applicable)
3. The human may request changes
4. ALL requested changes must be addressed
5. After addressing changes, re-present for final approval

### Release Review (Required for deployments)

Before deployment:
1. Verify all tests pass in CI
2. Verify documentation is complete
3. Verify no security vulnerabilities have been introduced
4. Verify performance targets are met
5. Verify migration plan (if applicable) is tested and ready
6. Verify rollback plan exists and is tested (if applicable)

### Production Checklist

Before marking READY FOR MERGE, verify EVERY item:

- [ ] All tests pass (unit, integration, business rule, permission, regression)
- [ ] All code is documented (JSDoc for public APIs, README for modules)
- [ ] No secrets committed (API keys, passwords, tokens, certificates)
- [ ] No debug code (breakpoints, debugger statements, trace logging)
- [ ] No `console.log` in production code (use proper logging service)
- [ ] No TODO/FIXME comments in production code
- [ ] No dead code (unused functions, variables, imports, exports)
- [ ] All error paths handled (try/catch on async operations, error middleware)
- [ ] All input validated (type, format, range, sanitization)
- [ ] All permissions checked (authentication + authorization on every endpoint)
- [ ] Business rules followed (each BR-xxx is verified)
- [ ] Architecture maintained (dependency direction, module isolation)
- [ ] Module isolation maintained (no direct imports across module boundaries)
- [ ] Performance targets met (response time, query count, memory usage)
- [ ] Security requirements met (input validation, auth, rate limiting, encryption)

---

## PART 10: Error Recovery Workflow

Each failure mode has a defined recovery workflow. The AI MUST follow the exact workflow for the failure mode encountered.

### Compile Fails

```
ERROR: Compilation fails
    ↓
1. Read the error message carefully
2. Identify the exact file, line number, and error code
3. Determine the fix (type mismatch, missing import, syntax error, incompatible types)
4. Apply the fix
5. Re-run compilation
6. If compilation fails again:
    ├─ After 3 consecutive attempts: STOP
    ├─ Reconsider the approach (is this the right way to implement the change?)
    ├─ Update implementation plan if needed
    └─ Consult documentation for correct types/signatures
```

### Lint Fails

```
ERROR: Lint check fails
    ↓
1. Read the lint error message and rule name
2. Fix the issue:
    ├─ Formatting: auto-fix if available (`npm run lint -- --fix`)
    ├─ Naming: apply correct naming convention
    ├─ Unused variable: remove or use
    └─ Other: fix according to the specific rule
3. Re-run lint
4. If the same lint error persists:
    ├─ Check if eslint config has special rules for this case
    ├─ If an intentional violation, add eslint-disable comment with reason
    └─ If no valid workaround, document and escalate
```

### Unit Tests Fail

```
ERROR: Unit test fails
    ↓
1. Read the test failure message carefully
2. Identify the assertion that failed:
    ├─ Expected vs actual output
    ├─ Expected vs actual exception
    └─ Timeout / async failure
3. Determine which is wrong:
    ├─ Is the test wrong? (behavior changed intentionally)
    │   └─ Update the test to match new expected behavior
    ├─ Is the code wrong? (behavior is incorrect)
    │   └─ Fix the code to match expected behavior
    └─ Is the test environment wrong? (test data, mocks, setup)
        └─ Fix the test environment
4. Re-run tests
5. If tests fail repeatedly after fixes:
    ├─ Step back and reconsider the implementation approach
    ├─ Verify understanding of the business rule
    └─ May need to update implementation plan
```

### Integration Tests Fail

```
ERROR: Integration test fails
    ↓
1. Check if environment/setup issue:
    ├─ Test database available?
    ├─ Mocks configured correctly?
    ├─ External services available?
    └─ Test data seeded correctly?
2. Check if behavior change is intentional:
    ├─ YES → Update the test to reflect new behavior
    └─ NO → Fix the code to match expected behavior
3. Re-run tests
4. If failure persists:
    ├─ Is there a pre-existing condition?
    ├─ Is the integration point documented incorrectly?
    └─ Escalate if needed
```

### Migration Fails

```
ERROR: Migration fails
    ↓
1. STOP immediately. Do not retry.
2. Document the exact error:
    ├─ Migration script name
    ├─ Error message and stack trace
    ├─ Data state at time of failure
    └─ Affected records (if known)
3. Check if rollback script exists:
    ├─ YES → Execute rollback immediately
    └─ NO → Manually revert changes (document all steps)
4. After rollback verified:
    ├─ Analyze root cause
    ├─ Fix migration script
    ├─ Test migration on staging environment
    └─ Only then run on production
```

### Deployment Fails

```
ERROR: Deployment fails
    ↓
1. STOP. Do not force deployment.
2. Read deployment logs:
    ├─ Build stage failure → fix build
    ├─ Test stage failure → fix test or code
    ├─ Migration stage failure → see Migration Fails workflow
    └─ Deploy stage failure → check infrastructure
3. Rollback to previous version:
    ├─ Use automated rollback if available
    └─ Manual rollback if needed
4. Fix the issue:
    ├─ Based on failure stage
    └─ Test in staging
5. Re-deploy
```

### Documentation Missing

```
ERROR: Required documentation is missing
    ↓
1. STOP implementation
2. Determine what documentation is needed:
    ├─ Missing entirely → create from scratch
    ├─ Outdated → update from current code
    └─ Incomplete → add missing sections
3. Create/update the documentation
4. Resume implementation
5. If documentation is too large (estimated > 1 hour):
    ├─ Create a placeholder with TODO
    ├─ Create a separate documentation task
    └─ Add the documentation task to the current sprint
```

### Business Rule Conflict

```
ERROR: Business rule conflict
    ↓
1. STOP immediately
2. Document the conflict:
    ├─ Existing rule: rule ID + exact text
    ├─ Required behavior: what the task demands
    └─ Conflict: exactly how they conflict
3. Present to human for resolution:
    ├─ Option A: Modify existing rule (requires Gate 1)
    ├─ Option B: Change task approach to fit existing rule
    └─ Option C: Create exception rule (if supported by business)
4. Do NOT implement either behavior until resolution is received
```

### Architecture Conflict

```
ERROR: Architecture conflict
    ↓
1. STOP immediately
2. Document the conflict:
    ├─ Existing architecture constraint
    ├─ Required change
    └─ How they conflict
3. Present options:
    ├─ Option A: Change the approach to fit within existing architecture
    ├─ Option B: Modify the architecture (requires Gate 5 — Architecture Change)
    └─ Option C: Create a new module/adapter layer
4. Wait for human resolution
```

### Decision Tree (ASCII)

```
ERROR OCCURS
    ↓
Is it compile/lint? → Fix → Retry → Pass → Continue
    ↓                    ↓FAIL x3
    ↓                    STOP → Reconsider approach
    ↓ No
Is it test failure? → Is test or code wrong?
    ├─ Test wrong → Update test → Retry → Pass → Continue
    │                                       ↓FAIL
    │                                       STOP → Reconsider
    └─ Code wrong → Fix code → Retry → Pass → Continue
                                        ↓FAIL
                                        STOP → Reconsider
    ↓ No
Is it migration failure? → STOP → Rollback → Analyze → Fix → Retry on staging
    ↓ No
Is it deployment failure? → STOP → Rollback → Analyze → Fix → Redeploy
    ↓ No
Is it business conflict? → STOP → Document → Present → Wait
    ↓ No
Is it architecture conflict? → STOP → Options → Wait
    ↓ No
Unhandled error → STOP → Document → Report → Wait
```

---

## PART 11: Context Optimization

AI models operate within limited context windows. This section defines how to optimize context usage while ensuring all critical information is retained.

### Context Tiers

| Tier | Size | Always Loaded? | Contents |
|------|------|----------------|----------|
| **Core** | ~2000 tokens | YES | Task description, CURRENT_PHASE.md, README_FOR_AI.md (summary), AI_CODING_CONSTITUTION.md (Parts 1, 3, 5, 6, 15, 16 as summary), project name + tech stack |
| **Module** | ~4000 tokens | PER AFFECTED MODULE | docs/modules/{module}.md (full), BUSINESS_RULES.md (relevant section), STATE_MACHINES.md (relevant section), PERMISSION_MATRIX.md (relevant section), EDGE_CASES.md (relevant section), DATABASE.md (relevant models), API_STANDARDS.md (relevant endpoints) |
| **Temporary** | ~1000 tokens | DURING IMPLEMENTATION | Current implementation plan, current file being edited, current test output |
| **Session** | ~2000 tokens | LAST 5 EXCHANGES | Conversation history (last 5 exchanges), previous decisions, previously identified constraints |
| **Historical** | ~3000 tokens | ON DEMAND ONLY | Project history, previous ADRs, previous migration records, past bug patterns |
| **Archived** | Variable | NEVER — loaded only if explicitly needed | Old versions of docs, completed task reports, old test results |

### Maximum Recommended Loading Strategy

For a typical task, load in this exact order:

1. **Core Context** (always)
2. **Task Classification** details
3. **Module Context** for each affected module (in order of impact significance)
4. **Session Context** (last 5 exchanges)
5. **If changing business rules:** Load FULL `BUSINESS_RULES.md`
6. **If changing architecture:** Load FULL `SYSTEM_ARCHITECTURE.md`
7. **If AI change:** Load `AI_ARCHITECTURE.md` + `AI_WORKFLOW.md` (full or summary)
8. **Historical Context** only if investigating a pattern from the past

### Context Budget Management

- **Target:** Keep active context under ~70% of the model's context window
- **If context is getting full (approaching limit):**

  1. **Summarize loaded documents:**
     - Remove examples, keep only rules
     - Remove verbose explanations, keep definitions
     - Remove low-priority details

  2. **Drop archived/historical context:**
     - Historical context is the first to go when space is needed
     - Archived context should never be in active context unless specifically needed

  3. **Summarize conversation history:**
     - Reduce to 3 key points: what was decided, what was approved, what is next
     - Drop resolved discussions

  4. **Drop completed implementation details:**
     - Remove details of already-implemented steps
     - Keep only the remaining steps

  5. **Summarize files:**
     - Instead of loading a full file, load only the relevant sections
     - Use grep to find specific lines/types/interfaces

### Context Loading API

The AI uses the following strategies to load only what is needed:

- **Glob:** Find files by pattern (e.g., all files in `docs/modules/`)
- **Grep:** Find specific patterns within files (e.g., `BR-AUTH` to find auth business rules)
- **Read with offset/limit:** Read specific sections of large files
- **Head/Tail:** Read the beginning or end of files for summaries and metadata

### Context Retention Rules

1. **Core context** is retained throughout the entire task
2. **Module context** is retained while working on that module
3. **Temporary context** is refreshed each cycle
4. **Session context** is updated after each exchange
5. **Historical context** is loaded, used, and dropped within the same exchange

---

## PART 12: Parallel Development Rules

When multiple AI agents work on the same project, these rules govern their interaction.

### Agent Roles

| Role | Quantity | Responsibility | Writes Code? |
|------|----------|----------------|--------------|
| **Planner** | 1 per task | Receives task, classifies, loads context, creates plan, presents for approval, assigns work, tracks progress, performs final review | NO |
| **Architect** | 1 per project (shared) | Reviews architecture impact, maintains SYSTEM_ARCHITECTURE.md and ADRs, approves/rejects architecture changes | NO |
| **Backend Engineer** | 1+ per backend task | Implements backend changes, writes backend tests, updates backend documentation | YES |
| **Frontend Engineer** | 1+ per frontend task | Implements frontend changes, writes frontend tests, updates frontend documentation | YES |
| **Database Engineer** | 1 per database task | Implements schema changes, writes migrations, optimizes queries, creates indexes, updates DATABASE.md | YES |
| **AI Engineer** | 1 per AI task | Implements AI changes, tests AI conversation flows, updates AI_ARCHITECTURE.md and AI_WORKFLOW.md | YES |
| **QA Agent** | 1 per task (after implementation) | Runs all tests, validates business rules, checks permissions, checks edge cases, reports findings | NO |
| **Reviewer** | 1 per task (after QA) | Performs code review, checks standards compliance, checks documentation, approves/rejects for merge | NO |
| **Documentation Agent** | 1 per project (shared) | Maintains documentation quality, updates cross-references, creates new docs, validates consistency | YES (docs only) |
| **Merge Manager** | 1 per project (shared) | Validates Ready for Merge checklist, merges approved changes, updates CURRENT_PHASE.md, creates release notes | NO |

### Communication Protocol

All inter-agent communication uses structured messages with explicit status fields.

**Planner → Engineer:**
```
TO: Backend Engineer
FROM: Planner
TASK: TASK-123
ATTACHMENT: Implementation Plan
FILE LIST: path/to/file1.ts, path/to/file2.ts
BUSINESS RULES: BR-MEM-001, BR-MEM-003
GATES TRIGGERED: None
DEADLINE: 2026-07-22
STATUS: READY FOR IMPLEMENTATION
```

**Engineer → QA:**
```
TO: QA Agent
FROM: Backend Engineer
TASK: TASK-123
CHANGES: path/to/file1.ts (modified), path/to/file2.ts (new)
TEST RESULTS: Unit: 5 new, 3 modified, all pass
DOCS UPDATED: BUSINESS_RULES.md, docs/modules/membership.md
STATUS: READY FOR QA
```

**QA → Reviewer:**
```
TO: Reviewer
FROM: QA Agent
TASK: TASK-123
QA REPORT ATTACHED
BUSINESS RULES VERIFIED: BR-MEM-001, BR-MEM-003
PERMISSIONS VERIFIED: MEMBERSHIP_READ, MEMBERSHIP_WRITE
EDGE CASES VERIFIED: EC-MEM-001, EC-MEM-002
TEST RESULTS: All pass
STATUS: QA PASSED / QA FAILED
```

**Reviewer → Planner:**
```
TO: Planner
FROM: Reviewer
TASK: TASK-123
REVIEW RESULT: APPROVED / CHANGES REQUIRED / REJECTED
ISSUES: None / [list of issues]
STATUS: READY FOR MERGE / AWAITING FIXES
```

**Planner → Merge Manager:**
```
TO: Merge Manager
FROM: Planner
TASK: TASK-123
CHANGE SUMMARY: Added membership freeze functionality
DOCS UPDATED: BUSINESS_RULES.md, docs/modules/membership.md, DATABASE.md
APPROVAL: Self-review done, Peer review done, Human review done
READY FOR MERGE CHECKLIST: All items verified
STATUS: READY FOR MERGE
```

### Conflict Resolution

| Conflict | Resolution Authority |
|----------|---------------------|
| Backend and Frontend disagree on API contract | **Architect** arbitrates |
| QA finds a bug | **Engineer** fixes, **QA** re-verifies |
| Reviewer rejects | **Engineer** addresses feedback, **Reviewer** re-reviews |
| Planner and Architect disagree on architecture | **Architect** has final say on architecture |
| Planner and Architect disagree on timeline | **Planner** has final say on timeline |
| Two Backend Engineers disagree on implementation approach | **Planner** decides based on plan and architecture |
| Engineer cannot reproduce QA-reported bug | **QA** provides reproduction steps; if still unreproducible, **Planner** decides |

### Agent Coordination Rules

1. **One Writer Per File:** No two agents may modify the same file simultaneously. The Planner assigns file ownership.
2. **Dependency Order:** If Backend Engineer depends on Database Engineer (schema must exist first), the Planner sequences the work.
3. **Shared Resources:** Agents share a single Git repository. Each agent works on a feature branch derived from the plan.
4. **Status Reporting:** Every agent reports status after each work cycle. The Planner tracks overall progress.
5. **Escalation:** If an agent is blocked for more than 15 minutes, it escalates to the Planner.

---

## PART 13: Merge Workflow

### Ready for Merge Checklist

ALL items MUST be verified before marking a task as ready for merge. If any item fails, the task is returned to the Planner with the specific failure items documented.

- [ ] **Code Complete:** All planned implementation steps are done
- [ ] **Compiles:** TypeScript compilation succeeds with zero errors
- [ ] **Lint Clean:** ESLint passes with zero errors (zero warnings preferred)
- [ ] **Types Correct:** Strict type checking passes
- [ ] **Tests Pass:** All unit, integration, business, permission tests pass
- [ ] **No Regressions:** Full test suite passes
- [ ] **Business Verified:** All affected BR-xxx rules are correctly implemented
- [ ] **Edge Cases Handled:** All relevant EC-xxx cases from EDGE_CASES.md are handled
- [ ] **Permissions Correct:** All permission checks match PERMISSION_MATRIX.md
- [ ] **Security Checked:** No secrets, no injection vulnerabilities, auth in place
- [ ] **Performance Acceptable:** No N+1 queries, pagination used, appropriate indexes exist
- [ ] **Documentation Updated:** All affected docs updated per PART 7 matrix
- [ ] **No Dead Code:** No TODO, FIXME, console.log, commented code, unused imports
- [ ] **No Duplicate Logic:** All business logic exists in exactly one place
- [ ] **Architecture Maintained:** Dependency direction, module isolation, patterns followed
- [ ] **Approval Obtained:** All required gates from PART 5 have been approved
- [ ] **Review Completed:** Self-review, peer review (if required), human review (if required) all done

### Merge Process

```
MERGE REQUESTED
    ↓
Merge Manager validates checklist
    ↓
┌─── All items pass? ───→ YES ───→ MARK READY FOR MERGE
│                               ↓
│                          Merge into target branch
│                               ↓
│                          Update CURRENT_PHASE.md
│                               ↓
│                          Close task
│                               ↓
│                          If merge causes issues:
│                               ├─ Execute rollback plan
│                               ├─ Investigate
│                               └─ Fix and re-merge
│
└─── NO ───→ Return to Planner with specific failure items
                 ↓
            Planner addresses failures
                 ↓
            Re-submits for merge validation
```

### Branch Strategy

| Branch | Purpose | Base Branch |
|--------|---------|-------------|
| `main` | Production-ready code | — |
| `develop` | Integration branch for features | `main` |
| `feature/{task-id}` | Individual feature work | `develop` |
| `hotfix/{task-id}` | Urgent production fixes | `main` |
| `emergency/{task-id}` | Critical incident fixes | `main` |
| `release/{version}` | Release candidates | `develop` |

### Merge Requirements by Type

| Task Type | Target Branch | Min. Approvals |
|-----------|---------------|----------------|
| Bug Fix | `develop` | 1 (self-review) |
| Feature | `develop` | 2 (self + peer) |
| Refactor | `develop` | 2 (self + peer) |
| Performance | `develop` | 2 (self + peer) |
| Security | `develop` | 3 (self + peer + human) |
| Database | `develop` | 3 (self + peer + human) |
| API | `develop` | 3 (self + peer + human) |
| Migration | `develop` | 3 (self + peer + human) |
| Hotfix | `main` | 2 (self + human expedited) |
| Emergency | `main` | 1 (human ASAP) |
| Documentation | `develop` | 1 (self-review) |
| Infrastructure | `develop` | 2 (self + peer) |

---

## PART 14: Continuous Improvement

After EVERY completed task, the AI MUST evaluate and document what was learned.

### Evaluation Framework

**1. What Improved**

- What specific capability was added or improved?
- What metrics changed? (performance, coverage, quality)
- What was the measurable impact of this change?

**2. What Failed**

- What went wrong during implementation?
- What was harder than expected?
- What had to be reworked or reverted?
- What caused the most delays?

**3. Documentation Improvements**

- Did this task reveal any gaps in documentation?
- Did any documentation need to be created from scratch?
- Were there any discrepancies between docs and code?
- Were any cross-references broken?

**4. New ADR Needed**

- Was an architecture decision made during this task that should be recorded?
- Was an existing ADR violated or updated?
- Is there a new pattern or practice that should be documented?

**5. Business Document Changes**

- Did the task require new business rules?
- Were existing business rules modified?
- Should BUSINESS_RULES.md be updated with new scenarios?

**6. Workflow Evolution**

- Did any part of this workflow cause friction?
- Were there any unnecessary steps?
- Should any step be added, removed, or modified?
- Propose specific changes to AI_DEVELOPMENT_WORKFLOW.md

### Output

The AI produces a brief Continuous Improvement report at the end of each task and saves it to `docs/completed/{date}-{task-name}-review.md`.

### Report Format

```markdown
# Continuous Improvement Report

## Task
TASK-123: Add membership freeze functionality

## Date
2026-07-20

## What Improved
- Added membership freeze/unfreeze capability
- No performance impact (verified)
- Documentation coverage for membership module increased

## What Failed
- Initial implementation missed the freezedays rollover rule (BR-MEM-004)
- Required rework after QA discovered the gap

## Documentation Improvements
- BR-MEM-004 was documented but in a different section than the freeze logic
- Recommendation: group all freeze-related rules in a single section

## New ADR Needed
- None

## Business Document Changes
- None (rules existed but were scattered)

## Workflow Evolution
- Consider adding a "cross-reference check" step to self-review
- The QA agent found the gap; consider earlier verification
```

---

## PART 15: Templates

### Implementation Plan Template

```markdown
# Implementation Plan

## Problem
[1-2 sentences describing what needs to be done]

## Root Cause (if bug)
[Explanation of the root cause]

## Affected Modules
- Module A
- Module B

## Files to Modify
- `path/to/file.ts` — [description of change]
- `path/to/other.ts` — [description of change]

## Dependencies
[None or list of external dependencies + version]

## Business Rules
- BR-MEM-001
- BR-MEM-003

## Architecture Impact
[None or description of architecture changes]

## Risks
- [Risk 1 description] — LOW
- [Risk 2 description] — MEDIUM

## Implementation Steps
1. Step 1 description
2. Step 2 description
3. Step 3 description

## Rollback Plan
[How to undo the change if something goes wrong]

## Testing Plan
- Unit test for new validation logic
- Integration test for the full flow
- Permission test for new endpoint
- Business rule test for BR-MEM-001

## Documentation Plan
- Update BUSINESS_RULES.md (BR-NEW-001)
- Update docs/modules/membership.md

## Approval Required
YES — Database Change (Gate 2)
```

### Task Report Template

```markdown
# Task Report

## Summary
[Brief description of what was accomplished]

## Task Type
[Classification]

## Module
[Primary affected module]

## Changes
- `path/to/file1.ts`: [specific change]
- `path/to/file2.ts`: [specific change]

## Tests
- Unit: 5 new, 0 modified, all pass
- Integration: 2 new, 0 modified, all pass
- Business rule: 3 new, all pass
- Permission: 4 new, all pass
- Regression: full suite passes

## Documentation
- BUSINESS_RULES.md: updated BR-MEM-001
- docs/modules/membership.md: updated freeze section

## Time Spent
[Estimate in hours]

## Issues Encountered
[None or list of issues + how they were resolved]

## Continuous Improvement
[Brief notes from PART 14 evaluation]
```

### Bug Report Template

```markdown
# Bug Report

## Description
[What is the bug — clear, specific, reproducible]

## Environment
[Production / Staging / Development]

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Root Cause
[What caused the bug — technical explanation]

## Fix
[What was changed to fix it]

## Tests Added
[What tests were added to prevent regression]

## Related Business Rules
[BR-xxx references]
```

### Feature Report Template

```markdown
# Feature Report

## Description
[What was implemented]

## Business Rules
[BR-xxx references]

## Implementation Summary
[High-level approach and architecture decisions]

## Files Changed
[List of files with brief change descriptions]

## API Changes (if any)
[Method, path, request body, response body, auth requirements]

## Database Changes (if any)
[New models, fields, indexes, or migrations]

## Documentation Updated
[List of documentation files updated]
```

### Review Report Template

```markdown
# Review Report

## Reviewer
[AI name or role]

## Changes Reviewed
[List of files reviewed]

## Issues Found
- [Issue 1] — Severity: HIGH / MEDIUM / LOW
  - File: path/to/file.ts:42
  - Description: [issue description]
- [Issue 2] — Severity: HIGH / MEDIUM / LOW
  - File: path/to/file.ts:105
  - Description: [issue description]

## Issues Fixed
[List of issues that were fixed during review]

## Remaining Issues
[List of issues that could not be fixed and need follow-up]

## Verdict
APPROVED / CHANGES REQUIRED / REJECTED

## Notes
[Additional observations, patterns noticed, recommendations]
```

### Risk Report Template

```markdown
# Risk Report

## Task
[Task name / ID]

## Risks Identified
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss | LOW | HIGH | Transaction rollback + backup |
| Performance degradation | MEDIUM | MEDIUM | Query optimization + indexing |
| Breaking API change | HIGH | HIGH | Deprecation period + migration guide |
| Security vulnerability | LOW | CRITICAL | Security review + penetration test |

## Overall Risk Level
LOW / MEDIUM / HIGH

## Recommendation
PROCEED / MITIGATE / STOP
```

### Testing Report Template

```markdown
# Testing Report

## Summary
- Unit tests: X new, X modified, X passed, X failed
- Integration tests: X new, X passed, X failed
- Business rule tests: X new, X passed, X failed
- Permission tests: X new, X passed, X failed
- Regression tests: full suite — X passed, X failed

## Failures
| Test | Reason | Fix |
|------|--------|-----|
| test_name_1 | Expected value mismatch | Updated test expectation |
| test_name_2 | Missing mock | Added mock for external service |

## Coverage
- Lines: XX%
- Branches: XX%
- Functions: XX%

## Verdict
PASS / FAIL / INCOMPLETE
```

### Merge Report Template

```markdown
# Merge Report

## Task
[Task name / ID]

## Ready for Merge Checklist
- [ ] All items verified (see PART 13)

## Summary of Changes
[Brief description of all changes in this merge]

## Test Results
[Summary of all test results]

## Documentation Updated
[List of documentation files updated]

## Approval
- Self-review: [date] — [status]
- Peer review: [date] — [status] (if applicable)
- Human review: [date] — [status] (if applicable)

## Merge Status
MERGED / PENDING / REJECTED

## Post-Merge Notes
[Any issues encountered after merge]
```

---

## PART 16: Production Workflow

This section defines the workflows for production incidents, hotfixes, and emergency situations.

### Hotfix

A hotfix is a production fix that cannot wait for the normal release cycle.

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Production bug affecting paying customers |
| **Classification** | HOTFIX |
| **Branch** | From `main`, named `hotfix/{task-id}` |
| **Gates** | ALL bypassed EXCEPT Gate 7 (Security) |
| **Testing** | Minimal: compile + lint + unit tests for affected module |
| **Review** | Human review: REQUIRED (expedited, 1 reviewer minimum) |
| **Deployment** | Immediately after approval |
| **Follow-up** | Create follow-up task for: full regression testing, documentation update, root cause analysis |

**Process:**
```
PRODUCTION BUG REPORTED
    ↓
Classify as HOTFIX
    ↓
Bypass all gates except Security
    ↓
Branch from main: hotfix/{task-id}
    ↓
Implement minimal fix
    ↓
Test: compile + lint + unit (affected module)
    ↓
Human review (expedited)
    ↓
Deploy to production
    ↓
Monitor for 30 minutes
    ↓
Create follow-up task for full testing and documentation
```

### Critical Bug

A critical bug is a non-production issue that blocks development or testing.

| Attribute | Detail |
|-----------|--------|
| **Trigger** | Development/Staging environment is blocked |
| **Classification** | BUG FIX (critical priority) |
| **Branch** | From `develop`, named `fix/{task-id}` |
| **Gates** | Normal gates apply but expedited |
| **Testing** | Full: compile + lint + unit + integration for affected module |
| **Review** | Human review: REQUIRED |
| **Deployment** | Next release cycle |

### Emergency Patch

An emergency patch addresses an active security vulnerability or data loss risk.

| Attribute | Detail |
|-----------|--------|
| **Trigger** | CVE disclosure, data breach, active data corruption |
| **Classification** | EMERGENCY |
| **Branch** | From `main`, named `emergency/{task-id}` |
| **Gates** | ALL bypassed EXCEPT Gate 7 (Security) |
| **Testing** | Minimum: compile + lint + security tests |
| **Review** | Human review: REQUIRED (ASAP) |
| **Deployment** | Immediately after approval |
| **Postmortem** | Full postmortem required within 24 hours |
| **Follow-up** | Regression tests, documentation updates, permanent fix |

### Production Incident

A production incident is unrecoverable without intervention.

| Attribute | Detail |
|-----------|--------|
| **Trigger** | System down, data loss, payment failure |
| **Classification** | INCIDENT |
| **Branch** | From `main`, named `incident/{task-id}` |
| **Gates** | NONE — immediate investigation |
| **Process** | STOP all other work → Investigate → Fix → Deploy → Verify |
| **Postmortem** | Full postmortem required within 48 hours |

**Process:**
```
INCIDENT DETECTED
    ↓
STOP ALL OTHER WORK
    ↓
Immediate investigation (no gates)
    ↓
Identify root cause
    ↓
Implement fix (minimal, targeted)
    ↓
Deploy fix
    ↓
Verify fix in production
    ↓
Full postmortem within 48 hours
```

### Rollback

Trigger: Deployed change causes production issues.

**Process:**
```
PRODUCTION ISSUE AFTER DEPLOYMENT
    ↓
Execute rollback plan (from implementation plan)
    ↓
Verify rollback was successful
    ↓
Restore previous version
    ↓
Investigate root cause
    ↓
Fix and re-deploy through normal process
```

Rollback rules:
- Rollback takes priority over all other work
- The rollback plan must be in the implementation plan BEFORE deployment (PART 4, section 10)
- After rolling back, the change cannot be re-deployed until root cause is identified and fixed
- If no rollback plan exists, STOP and escalate

### Root Cause Analysis (RCA)

Trigger: Any production incident, emergency patch, or rollback.

**Process:**
1. Document timeline of events (from detection to resolution)
2. Identify root cause using the "5 Whys" technique
3. Identify contributing factors (what allowed the root cause to exist?)
4. Implement preventive measures (automated tests, validation, monitoring)
5. Update documentation with lessons learned
6. Add new edge cases to EDGE_CASES.md if discovered
7. Assign action items with owners and deadlines

### Postmortem

Trigger: After any production incident.

**Format:**
```markdown
# Postmortem: [Title]

## Date
[Date of postmortem meeting]

## Severity
CRITICAL / HIGH / MEDIUM / LOW

## Summary
[1-2 paragraph description of the incident]

## Timeline
- [Time] Event occurred
- [Time] Detected (by monitoring / user report)
- [Time] Response started
- [Time] Root cause identified
- [Time] Fix deployed
- [Time] Service restored

## Root Cause
[Explanation of what caused the incident]

## 5 Whys
1. Why did [event] happen? → [answer]
2. Why did [answer 1] happen? → [answer]
3. Why did [answer 2] happen? → [answer]
4. Why did [answer 3] happen? → [answer]
5. Why did [answer 4] happen? → [root cause]

## Impact
- Users affected: [number or percentage]
- Revenue impact: [amount if measurable]
- Data loss: [yes/no and details]
- Duration: [total downtime]

## Preventive Measures
1. [Measure 1] — Assigned to: [owner]
2. [Measure 2] — Assigned to: [owner]
3. [Measure 3] — Assigned to: [owner]

## Action Items
- [ ] [Action item 1] — Owner: [name] — Due: [date]
- [ ] [Action item 2] — Owner: [name] — Due: [date]

## Lessons Learned
[What the team learned from this incident]
```

---

## PART 17: Definition of Ready

A task is READY to be worked on ONLY if ALL of the following conditions are met.

### Business Understood

- [ ] The task references specific business rules (BR-xxx) or features that are documented in `BUSINESS_RULES.md` or `BUSINESS_BLUEPRINT.md`
- [ ] No ambiguity in what the business expects (the task description can be mapped to specific, verifiable behavior)
- [ ] If a new business rule is needed: the rule is drafted, documented, and approved (per Gate 1)

### Architecture Understood

- [ ] The task fits within the `SYSTEM_ARCHITECTURE.md` and does not violate existing architectural constraints
- [ ] If architecture changes are needed: the change is designed, documented in an ADR or proposal, and approved (per Gate 5)
- [ ] Dependency direction between modules is clear and documented
- [ ] Module boundaries are clear (which module does each affected file belong to?)

### Context Loaded

- [ ] Core context loaded: `README_FOR_AI.md`, `AI_CODING_CONSTITUTION.md`, `CURRENT_PHASE.md`
- [ ] Module context loaded for each affected module: `docs/modules/{module}.md`, business rules, permissions, edge cases
- [ ] Technical context loaded: `DATABASE.md`, `API_STANDARDS.md`, ADRs for each affected module
- [ ] Business context loaded: all relevant business rules, state machines, and edge cases

### Dependencies Identified

- [ ] All affected modules are identified (primary + secondary + indirect)
- [ ] All external dependencies are identified (libraries, services, APIs)
- [ ] No hidden dependencies (e.g., a model change that affects 5 other features)
- [ ] Cross-module impacts are identified and documented

### Risk Assessed

- [ ] All risks are identified and rated (see PART 4, section 8)
- [ ] HIGH risks have specific mitigation plans
- [ ] Rollback plan exists for database changes, migrations, and any change with data impact

### Approval Received

- [ ] If any Approval Gate from PART 5 is triggered: approval has been received in writing
- [ ] If no gate is triggered: the implementation plan has been acknowledged by the requestor

### Not Ready

If any condition is NOT met, the task is NOT ready. The AI MUST:

1. Identify exactly which conditions are not met
2. Communicate what is missing to the requester
3. Wait for the missing information before proceeding

---

## PART 18: Definition of Done

A task is DONE ONLY if ALL of the following conditions are met. This expands on AI_CODING_CONSTITUTION.md PART 16.

### Business Correctness

- [ ] All documented business rules are correctly implemented and verified by tests
- [ ] No business rules were invented or assumed — every rule is traceable to a documented source
- [ ] All state machine transitions are handled (happy path + error path + edge path)
- [ ] All edge cases from `EDGE_CASES.md` are handled
- [ ] Business logic exists ONLY in services (not in controllers, routes, or models)

### Architecture Compliance

- [ ] Dependency direction is correct: routes → controllers → services → models (never the reverse)
- [ ] Module isolation is maintained: no direct imports across module boundaries
- [ ] No circular dependencies exist (verified with dependency checker)
- [ ] Existing patterns are followed (project conventions, module structure, naming conventions)
- [ ] No architecture violations exist

### Code Quality

- [ ] Code compiles without errors (`npm run build` or `tsc --noEmit` passes)
- [ ] Lint passes with zero errors (zero warnings preferred, exception only with documented justification)
- [ ] TypeScript strict mode passes — no `any` types, no type assertions without justification
- [ ] No `console.log` in production code (use the project's logging service)
- [ ] No TODO, FIXME, XXX, or similar placeholders in production code
- [ ] No commented-out code
- [ ] No dead code: unused imports, variables, functions, exports, parameters
- [ ] No duplicate logic: each piece of business logic exists in exactly one place
- [ ] Maximum 300 lines per file (files approaching this limit should be refactored)
- [ ] Error handling on ALL async operations (try/catch, proper error propagation, logging)
- [ ] Input validation on ALL user-facing endpoints

### Testing Completeness

- [ ] Compile check passes
- [ ] Lint check passes
- [ ] Type check passes
- [ ] Unit tests pass (all new + all existing)
- [ ] Integration tests pass (all new + all existing)
- [ ] Business rule tests cover ALL affected BR-xxx rules
- [ ] Permission tests cover ALL affected endpoints (correct roles get access, incorrect roles get 403)
- [ ] Security tests pass (if applicable)
- [ ] Full regression suite passes

### Performance

- [ ] No N+1 database queries (verified by checking query patterns)
- [ ] Pagination on all list endpoints (no unbounded result sets)
- [ ] Appropriate indexes exist (verified against query patterns)
- [ ] API response time within targets (if measurable and documented)

### Security

- [ ] Authentication on all protected endpoints (verified by test)
- [ ] Authorization on all protected endpoints (verified by permission test)
- [ ] Input validation prevents injection (SQL, NoSQL, XSS, command injection)
- [ ] No secrets in code (API keys, passwords, tokens, certificates, connection strings)
- [ ] Rate limiting considered (at least for auth endpoints)
- [ ] Audit logging for sensitive operations (if applicable)

### Documentation

- [ ] `BUSINESS_RULES.md` updated (if rules changed)
- [ ] `STATE_MACHINES.md` updated (if states or transitions changed)
- [ ] `PERMISSION_MATRIX.md` updated (if permissions changed)
- [ ] `API_STANDARDS.md` updated (if endpoints changed)
- [ ] `DATABASE.md` updated (if schema changed)
- [ ] `DATABASE_CONVENTIONS.md` updated (if conventions changed)
- [ ] `ERROR_HANDLING.md` updated (if error codes changed)
- [ ] `EDGE_CASES.md` updated (if new edge cases discovered)
- [ ] `docs/modules/{affected}.md` updated (for each affected module)
- [ ] New ADR created (if architecture decision was made)
- [ ] `PROJECT_OVERVIEW.md` updated (if module list or tech stack changed)
- [ ] `CURRENT_PHASE.md` updated (if phase milestone reached)

### Frontend (if applicable)

- [ ] Responsive on mobile (375px), tablet (768px), desktop (1280px), large desktop (1920px)
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard navigation, focus management
- [ ] Loading states shown during data fetch
- [ ] Error states shown on failure (user-friendly error messages)
- [ ] Empty states for when no data is available
- [ ] Visual consistency with existing UI components and design system

### Review Completeness

- [ ] Self-review completed (AI_CODING_CONSTITUTION.md PART 14 — all items checked)
- [ ] Peer review completed (if required per PART 9)
- [ ] Human review completed (if required per PART 9)
- [ ] All review feedback addressed (accepted and fixed, or explained with justification)

### Final

- [ ] No TODOs, FIXMEs, placeholders, or unfinished work
- [ ] No console.log, debug code, or development-only code
- [ ] No breaking changes without migration plan and approval (Gate 9)
- [ ] All approval gates from PART 5 have been passed
- [ ] Ready for Merge checklist (PART 13) is complete

### Done Means Done

If ANY condition in this Definition of Done is not met, the task is NOT done. The AI must:

1. Identify exactly which conditions are not met
2. Fix the issues or communicate what remains to be done
3. Not mark the task as done until all conditions are satisfied

There is no such thing as "mostly done" or "done except for documentation." Done means every single item on this list is verified and complete.

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-20 | Principal Engineering Manager | Initial version — complete engineering process |
