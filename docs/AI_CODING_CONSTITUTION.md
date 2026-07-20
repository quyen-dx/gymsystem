# AI CODING CONSTITUTION

> **Authority**: Chief Software Architect, GymPro Project  
> **Status**: Ratified  
> **Version**: 1.0.0  
> **Scope**: All code written for GymPro by any developer (human or AI)  
> **Enforcement**: This document is the single highest-authority engineering document. Every line of code written for GymPro must conform to every applicable rule herein. Any violation is a defect.

---

## PART 1: Project Philosophy

### Mission

GymPro's mission is to provide a unified, production-grade gym management platform enabling gyms to manage memberships, training, scheduling, payments, e-commerce, and member wellness through a single system. This is a real commercial product targeting gyms in Vietnam with international expansion planned. Every line of code serves this mission.

### Engineering Philosophy

- **Correctness over Speed**: A slow correct system beats a fast broken one. Business logic correctness is non-negotiable.
- **Simplicity over Complexity**: Choose the simplest solution that meets requirements. Avoid over-engineering.
- **Consistency over Cleverness**: Code should look like it was written by one person. Follow existing patterns.
- **Security by Design**: Security is not an afterthought — it's built into every layer.
- **Documentation as Code**: Documentation is part of the deliverable, not optional commentary.

### Quality Standards

- Zero tolerance for business logic errors (revenue leakage, double bookings, unauthorized access)
- 100% of business rules must be verifiable in code
- All API endpoints must have typed request/response definitions
- All database queries must handle failure gracefully
- All user-facing text must support bilingual (Vietnamese/English) where applicable

### Maintainability Goals

- Any developer (human or AI) must understand any module within 15 minutes of reading its documentation
- Maximum 300 lines per file
- Maximum 3 levels of nested callbacks/conditionals
- Zero commented-out code in production
- Zero TODO/FIXME in production
- All business logic in services (not controllers, not models)

### Scalability Goals

- API response times: p95 < 500ms, p99 < 2s
- Support 1000 concurrent users per gym instance
- Database queries: max 20ms per query (p95)
- Horizontal scaling: stateless API layer, state stored in DB/Redis
- Real-time: Socket.io with < 100ms message delivery

### AI Development Principles

- AI writes code, but humans are responsible. Every AI-generated change must be reviewable.
- AI must never hallucinate business rules, API endpoints, database schemas, or permissions.
- AI must always read documentation before writing code in an unfamiliar module.
- AI must prioritize safety over helpfulness when uncertain.
- AI must cite sources when making decisions (which doc, which rule, which ADR).

---

## PART 2: Core Principles

### Single Source of Truth

Every piece of business logic exists in exactly ONE place. If you find duplicate logic, eliminate it. Business rules live in `BUSINESS_RULES.md`. State machines live in `STATE_MACHINES.md`. Permissions live in `PERMISSION_MATRIX.md`.

### Never Duplicate Business Logic

- Business validation belongs in services, not controllers or models.
- If two modules need the same validation, extract it to a shared utility or a shared service.
- Never copy-paste validation logic.

### Documentation First

Before writing code for any feature, read the relevant documentation. If documentation doesn't exist or is outdated, write/update it before writing code.

### Business Before Code

Understand the business rule before implementing it. If you don't understand, ask. Never guess business requirements.

### Architecture Before Features

Every feature must fit within the existing architecture. If a feature requires architectural changes, those changes must be designed and approved before feature implementation begins.

### Security First

Every endpoint must have authentication + authorization + validation + rate limiting. These are not optional. They are designed in before the first line of business logic is written.

### Performance Matters

Write efficient code from the start. Avoid N+1 queries. Use pagination for lists. Cache where appropriate. Lazy-load components. Optimize images.

### Readable > Clever

- `array.reduce` with a complex reducer: NO
- `array.map` + `array.filter` in clear steps: YES
- Clever one-liners: NO (unless provably faster in a hot path with a comment explaining why)

### Explicit > Implicit

- Explicit parameter types over inferred `any`
- Explicit error handling over try-catch swallowing
- Explicit state transitions over magic string comparisons
- Explicit permission checks over "it's probably fine"

### Small Changes

- One task = one logical change. Don't fix unrelated bugs in the same PR.
- If you see a problem in an unrelated module, file an issue, don't fix it inline.

### Module Isolation

- Modules communicate through services, not through direct database access.
- Module A must never import a model from Module B directly — use Module B's service.
- Circular dependencies between modules are forbidden.

---

## PART 3: AI Behaviour Rules

### The AI MUST

1. **Read documentation before writing code**: Always consult README_FOR_AI.md first, then the relevant module docs, business rules, state machines, and permission matrix.
2. **Follow existing patterns**: Look at how similar features are implemented and match the style, structure, and conventions.
3. **Use existing utilities**: Before writing a new helper, check if one already exists. grep the codebase.
4. **Handle all states**: Every state machine transition must be handled. No missing states.
5. **Handle all errors**: Every async operation must have try-catch. Every API call must handle failure.
6. **Validate all inputs**: Every user-facing endpoint must validate input before processing.
7. **Check permissions on every endpoint**: Every route handler must verify the caller has the right role.
8. **Write tests for business logic**: Any new business rule must have a corresponding test.
9. **Update documentation when code changes**: If code changes affect documented behavior, update the docs.
10. **Use type-safe code**: TypeScript strict mode. No `any`. No type assertions without justification.
11. **Use idempotency keys for payments**: Every payment mutation must be idempotent.
12. **Use transactions for multi-document operations**: Wallet + order, membership + payment.
13. **Add audit logging for sensitive operations**: Role changes, refunds, cancellations, permission changes.
14. **Ask for clarification when uncertain**: If a business rule is unclear, STOP and ask.

### The AI MUST NOT

1. **Invent business rules**: If a business rule isn't in BUSINESS_RULES.md, ask. Do not guess.
2. **Invent API endpoints**: Every endpoint must match API_STANDARDS.md or be explicitly designed and approved.
3. **Invent database schemas**: Every model must match DATABASE.md or be explicitly designed and approved.
4. **Invent permissions**: Every permission must match PERMISSION_MATRIX.md or be explicitly designed and approved.
5. **Invent state machines**: Every state must match STATE_MACHINES.md or be explicitly designed and approved.
6. **Invent enums/constants**: All enums must be defined in types. Do not use magic strings.
7. **Remove existing security**: Never remove authentication, authorization, validation, rate limiting.
8. **Remove audit logging**: Never remove or bypass audit trails.
9. **Remove transactions**: Never remove database transactions from multi-document operations.
10. **Hardcode secrets**: Never put API keys, passwords, tokens, or connection strings in code.
11. **Hardcode URLs**: All external URLs must come from config/environment.
12. **Use fake/mock data in production code**: Never use placeholder data, mock data, or sample data in production code paths.
13. **Leave TODO/FIXME in production**: All TODOs must be resolved before code is considered complete.
14. **Leave dead code**: Never leave commented-out code, unused imports, unused variables, or unreachable code.
15. **Skip error handling**: Every catch block must do something meaningful (log + return error).
16. **Use console.log in production**: Use the logger service. console.log is for debugging only.
17. **Modify files outside the task scope**: If another module needs changes, STOP and ask for approval.
18. **Commit directly to main**: All changes must go through branches and PRs.

### The AI SHOULD

1. Prefer pure functions over functions with side effects.
2. Prefer async/await over raw promises or callbacks.
3. Prefer early returns over nested if-else.
4. Prefer descriptive variable names over short ones.
5. Prefer composition over inheritance.
6. Prefer dependency injection over hardcoded dependencies.
7. Prefer small, focused files over large monolithic ones.
8. Prefer functional patterns over class-based patterns (unless class is warranted).
9. Prefer using Antd components over building custom UI from scratch.
10. Use React.memo for expensive renders, useMemo for expensive computations.

### The AI SHOULD NOT

1. Add comments explaining obvious code (`i++ // increment i`). Comments are for WHY, not WHAT.
2. Import entire libraries when only a function is needed (tree-shake).
3. Optimize before profiling. Don't guess bottlenecks.
4. Override existing styles without understanding the design system.
5. Add new dependencies without checking if existing ones suffice.
6. Nest callbacks more than 2 levels deep.

### The AI MAY

1. Refactor code if it improves readability without changing behavior.
2. Extract reusable utilities when the same pattern appears 3+ times.
3. Add logging for debugging purposes during development (remove before PR).
4. Suggest improvements to documentation beyond the immediate task.
5. Ask clarifying questions about business requirements.

---

## PART 4: Mandatory Workflow

Before writing ANY code, the AI MUST follow this exact workflow:

### Step 1: Read Core Documentation
- `README_FOR_AI.md` — Understand how to use the documentation
- `PROJECT_OVERVIEW.md` — Understand the project, mission, goals
- `SYSTEM_ARCHITECTURE.md` — Understand the system layout

### Step 2: Read Current Phase
- `CURRENT_PHASE.md` — Understand what is currently being worked on, what is known, what is planned

### Step 3: Read Business Context
- `BUSINESS_BLUEPRINT.md` — Understand business domain and objectives
- `BUSINESS_RULES.md` — Find exact rules for the module
- `STATE_MACHINES.md` — If the feature involves state transitions
- `PERMISSION_MATRIX.md` — Determine who can do what
- `EDGE_CASES.md` — Know what can go wrong

### Step 4: Read Architecture Context
- `AI_ARCHITECTURE.md` — If the task involves AI features
- `AI_WORKFLOW.md` — If the task involves AI conversation flows

### Step 5: Read Module Documentation
- `docs/modules/{module}.md` — Read the specific module doc
- Understand all models, services, controllers, and flows for that module

### Step 6: Read Standards
- `CODING_STANDARDS.md` — General coding rules
- `TYPESCRIPT_STANDARDS.md` — TypeScript conventions
- `NAMING_CONVENTION.md` — Naming rules
- `COMPONENT_GUIDELINES.md` — React component patterns
- `API_STANDARDS.md` — API endpoint conventions
- `ERROR_HANDLING.md` — Error patterns
- `DATABASE.md` — Schema reference
- `DATABASE_CONVENTIONS.md` — Mongoose patterns

### Step 7: Read Relevant ADRs
- `docs/adr/ADR-*.md` — Read ADRs that affect the module

### Step 8: Analyze
- Understand the existing code structure
- Identify where changes must be made
- Verify the codebase matches documentation
- If discrepancies exist, document them

### Step 9: Generate Implementation Plan
- List all files that need modification
- List what changes each file needs
- List any new files needed
- List documentation updates needed
- Identify risks and edge cases

### Step 10: Wait for Approval
- Present the implementation plan
- Do NOT write any code until the plan is approved
- If the plan is rejected, revise and re-present

### Step 11: Write Code
- Only after approval
- Follow all coding rules in this constitution
- Write tests alongside code
- Update documentation alongside code

---

## PART 5: Task Scope Rules

### Scope Definition

- The task scope is defined by the user's request. The AI may ONLY modify files directly related to the assigned task.
- "Related" means: the file contains logic that MUST change to implement the task.
- "Unrelated" means: the file could be modified but doesn't need to be for the task to work.

### Cross-Module Changes

If during implementation the AI discovers that a change in another module is required:

1. **STOP** immediately
2. Explain why the other module needs to change
3. List the specific changes needed (files + nature of changes)
4. Wait for explicit approval before modifying the other module

### Prohibited Scope Creep

- Do not fix unrelated bugs you encounter along the way (note them, don't fix them)
- Do not refactor unrelated code
- Do not "improve" code that works and isn't part of the task
- Do not add "nice-to-have" features beyond the task

### Exception: Security Vulnerabilities

- If you discover an active security vulnerability (secrets in code, missing auth, SQL injection), you MUST flag it immediately and may fix it without approval ONLY if it's in a file already within scope.

---

## PART 6: Forbidden Actions

The AI MUST NEVER:

### Business Logic

- **Invent business rules**: If you don't know the rule, you don't implement it. Find it in BUSINESS_RULES.md or ask.
- **Invent state machine states or transitions**: All states must match STATE_MACHINES.md. No new states without documented design.
- **Invent validation rules**: Validation rules are business rules. They belong in BUSINESS_RULES.md or module docs.
- **Invent payment logic**: Payment flows are complex. Never guess how refunds, retries, webhooks work.
- **Invent AI workflow**: AI conversation flows are defined in AI_WORKFLOW.md. Follow them exactly.

### API

- **Invent API endpoints**: Every endpoint must match API_STANDARDS.md. No new endpoints without documented design.
- **Invent request/response formats**: Must match the existing patterns. No inventing new response structures.
- **Remove existing endpoints**: Breaking changes require approval.

### Database

- **Invent database schemas**: Every collection and field must match DATABASE.md. No new fields without documented design.
- **Invent database collections**: No new collections without documented design and migration plan.
- **Remove existing fields/collections**: Breaking changes require approval.

### Security

- **Remove authentication**: Never make an authenticated endpoint public.
- **Remove authorization**: Never remove permission checks from any endpoint.
- **Remove validation**: Never remove input validation from any endpoint.
- **Remove rate limiting**: Never remove rate limiting from any endpoint.
- **Bypass permission checks**: Never add a way to skip authorization.
- **Bypass rate limiting**: Never add a way to skip rate limiting.
- **Hardcode secrets**: API keys, JWT secrets, database URIs must come from environment variables.
- **Hardcode URLs**: External URLs must be configurable via environment/settings.

### Quality

- **Use fake data in production**: No mock data, placeholder data, or sample data in production code paths.
- **Use TODO placeholders**: All TODOs must be resolved. If something is not done, don't commit.
- **Leave unfinished implementations**: Incomplete functionality should not be committed. Use feature flags if needed.
- **Leave dead code**: No commented-out code, no unused imports, no unused variables, no unused functions.
- **Skip error handling**: Every async operation must have error handling.
- **Skip logging**: Sensitive operations must be logged. Errors must be logged.

### Documentation

- **Skip documentation updates**: If code changes affect documented behavior, documentation must be updated.
- **Modify unrelated files**: Only change files within the approved scope.

---

## PART 7: Coding Rules

### Naming

- Follow NAMING_CONVENTION.md exactly
- Files: camelCase for utilities/services/hooks, PascalCase for components/pages
- Functions: camelCase, verb-noun pairing (`getUserById`, `createBooking`)
- Variables: camelCase, descriptive, no abbreviations except common ones (id, ref, idx)
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase
- Enums: PascalCase enum name, UPPER_SNAKE_CASE members
- Booleans: prefix with is/has/should/can/will
- Event handlers: handle prefix (handleSubmit, handleClick)

### Folder Structure

Backend:

```
src/
  config/       — Configuration files
  controllers/  — Thin request handlers
  middlewares/   — Auth, validation, rate limiting
  models/       — Mongoose schemas
  services/     — Business logic
  modules/      — AI tool definitions
  routes/       — Express route definitions
  jobs/         — Cron jobs
  utils/        — Helpers, errors, utilities
  scripts/      — Migration and maintenance
```

Frontend:

```
src/
  config/       — Environment config
  types/        — TypeScript definitions
  services/     — API client functions
  context/      — React context providers
  hooks/        — Custom hooks
  components/   — UI components
    common/     — Shared components
    layout/     — Layout components
    {module}/   — Domain-specific components
  pages/        — Route-level components
    auth/
    public/
    dashboard/
```

### File Organization

- One default export per file
- Named exports for utilities (multiple exports per file OK)
- Max 300 lines per file (split if exceeded)
- Related files in same directory
- Test file next to source: `file.ts` → `file.test.ts`

### Imports

Order (separated by blank line):

1. Node built-ins (`fs`, `path`)
2. External packages (`react`, `express`, `mongoose`)
3. Internal modules (`@/services/authService`)
4. Relative imports (`./authTypes`)
5. Types (`import type { ... }`)

Rules:

- No barrel files (no `index.ts` that re-exports)
- Use `@/` path alias for src/ directory
- Use `import type` for type-only imports
- Absolute imports preferred over deep relatives

### Dependency Direction

- Routes → Controllers → Services → Models
- NEVER: Models → Services, Controllers → Routes
- Services can call other services (same layer)
- Controllers never call other controllers
- Frontend: Pages → Components → Hooks → Services
- Circular dependencies are FORBIDDEN

### Error Handling

- All async handlers wrapped in catchAsync utility
- Throw typed AppError with code, message, statusCode
- Controllers: catch errors, send response (format defined in ERROR_HANDLING.md)
- Services: throw errors, perform business logic, log appropriately
- Never swallow errors: every catch must log and either rethrow or return error
- Never expose stack traces to client (development mode only)
- Error codes must match ERROR_HANDLING.md taxonomy

### Logging

- Use logger service (Winston) — never console.log in production
- Log levels: error (unhandled), warn (business errors), info (transactions), debug (development)
- Structured JSON logging with request ID for correlation
- Include userId in logs for audit trail
- NEVER log passwords, tokens (full), or payment details

### Validation

- Input validation on EVERY user-facing endpoint
- Use Mongoose schema validation for model-level
- Use middleware for cross-field validation
- Client-side validation for UX (Antd Form rules)
- Server-side validation for security (never trust client)
- Validation messages must support i18n (Vietnamese/English)

### TypeScript

- Strict mode enabled
- No `any` — use `unknown` and narrow
- Explicit return types on all functions
- Discriminated unions for state machines
- `import type` for type-only imports
- Use `satisfies` for type validation without widening
- Use `as const` for literal types

### Transactions

- Use MongoDB sessions for multi-document operations
- Wallet + Order: must be atomic
- Payment + Membership: must be atomic
- Any operation affecting two or more collections: use transaction
- Transaction timeout: 5 seconds
- Retry on TransientTransactionError

### Repository Pattern

- Data access logic lives in services, not models
- No raw Mongoose queries in controllers
- Services use Model.find(), Model.create(), etc.
- Complex queries in services, not in models (no query scopes on models)

### Services

- Stateless: all state passed as parameters or fetched within service
- Business logic ONLY in services (never in controllers, never in models)
- Services can call other services via dependency injection or direct import
- Services return typed results, never raw Mongoose documents (transform if needed)
- Services handle authorization logic (checking permissions beyond role — e.g., ownership)

### Controllers

- Thin: extract params from request, call service, send response
- Never contain business logic
- Always wrap in catchAsync
- Always validate input before passing to service
- Send standardized response format

### Components (React)

- Functional components with hooks (no class components)
- Props typed with `type Props = { ... }` (not interface)
- Destructure props with defaults
- Custom hooks for data fetching and state logic
- No direct API calls in components (use hooks/services)
- Use Antd components for UI, Tailwind for custom styling
- React.memo for expensive pure components

### Hooks

- Must start with `use` prefix
- Custom hooks encapsulate: data fetching, form state, URL params, auth state
- Hooks return typed objects, not raw data
- Hooks should be self-contained and testable

### Utilities

- Pure functions preferred
- Single responsibility
- Well-named, typed inputs and outputs
- Unit testable
- Extracted when pattern appears 3+ times

### State Management

- TanStack Query for server state (caching, refetching, mutations)
- React Context for global client state (auth, settings, theme)
- useState for local component state
- No Redux
- No prop drilling beyond 3 levels (use context or composition)

### Reusable Code

- If identical code appears twice: shared utility
- If similar code appears: parameterized utility
- If pattern appears 3+ times: extract to reusable hook/component/service
- Never copy-paste code with minor variations

---

## PART 8: Documentation Rules

### Documentation is Code

Documentation is not optional. It is a first-class deliverable with the same quality requirements as code.

### Documentation Before Code

When implementing a new feature, documentation should be written first or at the same time as the code. Documentation is NEVER written after code is complete.

### Documentation Updates

Whenever code changes, determine which documentation files are affected:

- Business rule changes → update BUSINESS_RULES.md
- State machine changes → update STATE_MACHINES.md
- Permission changes → update PERMISSION_MATRIX.md
- API changes → update API_STANDARDS.md
- Database changes → update DATABASE.md, DATABASE_CONVENTIONS.md
- Architecture changes → update SYSTEM_ARCHITECTURE.md
- Module changes → update docs/modules/{module}.md
- Error code changes → update ERROR_HANDLING.md
- Edge case discovered → update EDGE_CASES.md

### Documentation Outdated = Bug

If a developer or AI finds that documentation does not match the code, this is a bug. File an issue or fix it.

### What to Document

- Every new business rule (in BUSINESS_RULES.md)
- Every new API endpoint (in API_STANDARDS.md)
- Every new model/field (in DATABASE.md)
- Every new error code (in ERROR_HANDLING.md)
- Every new edge case (in EDGE_CASES.md)
- Every architecture decision (in docs/adr/ as a new ADR)
- Every module change (in docs/modules/{module}.md)

---

## PART 9: Review Checklist

Before completing any task, the AI MUST verify each item:

### Business Rules

- [ ] All business rules from BUSINESS_RULES.md are correctly implemented
- [ ] No new business rules were invented
- [ ] State machine transitions match STATE_MACHINES.md
- [ ] All states are handled (including error states)

### Architecture

- [ ] Changes follow SYSTEM_ARCHITECTURE.md
- [ ] Dependency direction is correct (routes → controllers → services → models)
- [ ] No circular dependencies introduced
- [ ] Module isolation maintained

### Permissions

- [ ] Every new endpoint has permission checks matching PERMISSION_MATRIX.md
- [ ] Existing permission checks are not bypassed or removed
- [ ] Role-based access is correctly enforced

### Validation

- [ ] All user inputs are validated on the server
- [ ] Mongoose schema validation is in place
- [ ] Cross-field validation is handled
- [ ] Validation error messages are user-friendly

### Edge Cases

- [ ] EDGE_CASES.md has been consulted for known edge cases
- [ ] New edge cases discovered are documented
- [ ] Empty states handled
- [ ] Error states handled
- [ ] Loading states handled
- [ ] Boundary conditions handled (pagination limits, date ranges, max values)

### Performance

- [ ] No N+1 queries introduced
- [ ] Pagination used for list endpoints
- [ ] Database queries have appropriate indexes
- [ ] No unnecessary re-renders in React components
- [ ] Lazy loading for route-level components

### Security

- [ ] Authentication present on all protected endpoints
- [ ] Authorization checks present on all protected endpoints
- [ ] Input validation prevents injection attacks
- [ ] No secrets in code
- [ ] Rate limiting considered for new endpoints
- [ ] File upload validation if applicable
- [ ] Audit logging for sensitive operations

### Documentation

- [ ] Documentation updated to reflect code changes
- [ ] New business rules documented in BUSINESS_RULES.md
- [ ] New API endpoints documented in API_STANDARDS.md
- [ ] New edge cases documented in EDGE_CASES.md
- [ ] Module documentation updated

### Frontend (if applicable)

- [ ] Responsive on mobile, tablet, desktop
- [ ] Accessibility: semantic HTML, aria labels, keyboard navigation
- [ ] Loading states shown during data fetch
- [ ] Error states shown on failure
- [ ] Empty states for no data
- [ ] Form validation before submission
- [ ] Toast notifications for actions

### Error Handling

- [ ] All async operations have try-catch
- [ ] Error responses follow ERROR_HANDLING.md format
- [ ] User-friendly error messages displayed
- [ ] Technical errors logged server-side

### Type Safety

- [ ] No `any` types introduced
- [ ] All function parameters and return types typed
- [ ] API responses typed
- [ ] State variables typed

---

## PART 10: Testing Rules

### Test Coverage Requirements

- Business logic: 100% coverage (every branch, every condition)
- API endpoints: every endpoint tested for success + failure
- Permissions: every role tested for access + denial
- Validation: every validation rule tested (valid + invalid input)
- Edge cases: every known edge case from EDGE_CASES.md tested

### Unit Tests

- Test pure business logic in isolation
- Mock external dependencies (DB, APIs, services)
- Test all branches (if-else, switch)
- Test error paths
- File: `{source}.test.ts` next to source file

### Integration Tests

- Test service + model together (with test database)
- Test multi-step flows (e.g., booking → payment → confirmation)
- Test state machine transitions
- Test transaction rollbacks

### Business Tests

- Test each business rule as a named test case
- BR-MEM-001 test: "one active membership per member"
- BR-BKG-001 test: "booking window max 30 days"
- Business tests must reference the rule ID

### Permission Tests

- For each role: test that permitted actions succeed
- For each role: test that forbidden actions return 403
- Test ownership-based permissions (user can edit own data, not others')

### API Tests

- Test HTTP status codes for each endpoint
- Test response format matches API_STANDARDS.md
- Test pagination, filtering, sorting
- Test error responses
- Test authentication (no token, expired token, invalid token)

### Validation Tests

- Test required fields: missing → 400
- Test invalid formats: wrong email → 400
- Test boundary values: min length, max length, min/max numbers
- Test enum values: invalid status → 400

### Security Tests

- Test SQL/NoSQL injection attempts
- Test XSS via input fields
- Test privilege escalation (member accessing admin endpoints)
- Test rate limiting on auth endpoints
- Test idempotency (duplicate payment requests)

### Regression Tests

- Existing features must not break
- Run full test suite before completing any task
- If existing tests fail, fix them or determine why

### Responsive Tests (Frontend)

- Test on mobile (375px width)
- Test on tablet (768px width)
- Test on desktop (1280px width)
- Test on large desktop (1920px width)

### Manual QA Checklist

- [ ] User can complete the happy path without errors
- [ ] User receives appropriate feedback for errors
- [ ] UI is consistent with the rest of the application
- [ ] No visual regressions
- [ ] Performance is acceptable (no lag, no jank)
- [ ] All text is bilingual where applicable

---

## PART 11: Security Rules

### Secrets Management

- NEVER hardcode secrets in source code
- ALL secrets in environment variables (.env file in development, environment in production)
- .env is in .gitignore (verify before committing)
- Secret types: JWT_SECRET, DB_URI, API_KEY, CLOUDINARY_SECRET, STRIPE_SECRET, VNPAY_SECRET
- Rotate secrets regularly (minimum: every 90 days)
- Use environment-specific config files (config/development.ts, config/production.ts)

### JWT

- Access token: 15 minutes expiry
- Refresh token: 7 days expiry, httpOnly cookie, secure in production
- Refresh token rotation: each refresh issues a new refresh token, invalidates old one
- Store refresh tokens in database for revocation capability
- Algorithm: HS256 minimum (RS256 preferred for multi-service)
- Never log tokens or include them in error messages

### OAuth (Google/Facebook)

- Validate all tokens server-side (don't trust client-provided tokens)
- Use state parameter to prevent CSRF
- Verify email domain if organization-restricted
- Store social account IDs securely

### Permissions

- Server-side enforcement on EVERY endpoint (never trust client-side checks alone)
- Use middleware for role-based access
- Service layer for resource-based access (ownership checks)
- PERMISSION_MATRIX.md is the source of truth
- Deny by default (whitelist approach)

### Input Validation

- Validate on server ALWAYS (client validation is for UX, not security)
- Use Mongoose schema validation
- Sanitize user input (strip scripts, control characters)
- Use parameterized queries (Mongoose handles this, but avoid $where)
- Validate file types and sizes on upload
- Reject unexpected fields (don't process unvalidated input)

### Output Encoding

- Escape user content before rendering
- Use React's built-in XSS protection (JSX escapes by default)
- For dangerouslySetInnerHTML: sanitize with DOMPurify
- Never render raw user-generated HTML without sanitization

### File Upload

- Validate file type on server (check magic bytes, not just extension)
- Limit file size (images: 5MB, videos: 50MB, documents: 10MB)
- Store files in Cloudinary/external storage, not on application server
- Scan uploads for malware
- Restrict executable file types
- Generate unique filenames (never trust user-provided filename)

### Rate Limiting

- Auth endpoints: 5 requests/minute per IP
- API endpoints: 100 requests/minute per user
- Payment endpoints: 10 requests/minute per user
- Webhook endpoints: whitelist IPs only
- Use express-rate-limit with MongoDB store for distributed rate limiting
- Return 429 with Retry-After header

### Transactions

- Use MongoDB sessions for multi-collection operations
- Rollback on any failure (no partial updates)
- Payment transactions: idempotency key required
- Transaction timeout: 5 seconds

### Audit Logs

- Log ALL sensitive operations:
  - User login/logout
  - Role changes
  - Permission changes
  - Payment operations (create, refund, failed)
  - Membership operations (create, cancel, freeze, refund)
  - Account changes (email, password, phone)
  - Admin actions (user disable, system config change)
- Audit log fields: userId, action, resource, resourceId, details, timestamp, ipAddress, userAgent
- Audit logs are append-only (immutable)

### Sensitive Data Protection

- Never log: passwords, tokens, full credit card numbers, full bank account numbers
- Mask sensitive data in logs: `email@***`, `****1234`
- Encrypt PII at rest in database (name, phone, address, email)
- HTTPS only in production
- HSTS header enabled
- Helmet middleware for security headers

### Prompt Injection (AI)

- Sanitize user input before passing to LLM prompt
- Use system prompt to define AI behavior boundaries
- Never allow user input to override system prompt
- Implement content filtering on AI output
- Rate limit AI conversations per user

### SQL/NoSQL Injection

- Use parameterized queries (Mongoose does this by default)
- Avoid $where operator (use aggregation pipeline instead)
- Validate ObjectId format before querying
- Sanitize string inputs for regex patterns

### XSS (Cross-Site Scripting)

- React JSX escapes by default (safe)
- For dangerouslySetInnerHTML: sanitize with DOMPurify
- Set Content-Security-Policy header
- Validate and sanitize all user-generated content before storage
- Escape output in email/SMS templates

### CSRF (Cross-Site Request Forgery)

- Use SameSite cookie attribute (Strict for auth cookies)
- CSRF token for non-API routes (if applicable)
- API uses JWT in Authorization header (not cookies) — inherently CSRF-safe

### SSRF (Server-Side Request Forgery)

- Validate and whitelist URLs that the server can fetch
- Never allow user input to determine full URL (only append to known base)
- Block internal IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Use a URL validation library

---

## PART 12: Performance Rules

### API Latency Targets

- p50: < 200ms
- p95: < 500ms
- p99: < 2000ms
- Any endpoint exceeding p95 target must be optimized

### Database Queries

- Maximum queries per request: 10 (fewer preferred)
- Maximum query time (p95): 20ms
- ALWAYS use indexes for query fields
- ALWAYS use .select() to limit returned fields
- ALWAYS use .lean() for read-only queries (no Mongoose document overhead)
- NEVER fetch entire documents when only a few fields are needed

### Avoid N+1 Queries

- Use .populate() with specific field selection
- Use aggregation with $lookup for complex joins
- Batch queries where possible (in query with array of IDs)
- If you see an N+1 in existing code, fix it (but ask if it's outside scope)

### Lazy Loading

- Frontend: React.lazy() + Suspense for all route-level components
- Images: loading="lazy" attribute
- Infinite scroll or pagination for lists > 50 items
- Chunk splitting: vendor chunk separate from app chunk

### Pagination

- ALL list endpoints must support pagination
- Default: page=1, limit=20
- Max limit: 100
- Cursor-based pagination for real-time data (check-ins, notifications, messages)
- Return pagination metadata: page, limit, total, totalPages

### Caching

- TanStack Query: staleTime for data that changes infrequently (config: 5 min, products: 10 min)
- Browser caching for static assets (images, fonts, CSS)
- API response caching for GET endpoints where appropriate
- No caching for auth, payment, or sensitive data
- Cache invalidation strategy defined per module

### Streaming

- AI responses: stream via SSE for real-time UX
- File uploads: stream to Cloudinary
- Large data exports: stream from DB to client

### Image Optimization

- Use Cloudinary for image transformations (resize, format, quality)
- Serve WebP format where supported
- Serve responsive image sizes (mobile, tablet, desktop)
- Lazy load images below the fold
- Specify image dimensions to prevent layout shift

### Bundle Size (Frontend)

- Target: < 300KB initial JS (gzipped)
- Tree-shake Antd imports (import Button from 'antd/es/button', not 'antd')
- Code-split by route
- Lazy load heavy libraries (chart libraries, markdown renderers)
- Monitor bundle size with vite-bundle-analyzer

### Code Splitting

- Each route page is a separate chunk
- Vendor chunk (react, antd, etc.) is cached separately
- Dynamic imports for feature sections not immediately visible

### Performance Monitoring

- API: response time logging per endpoint
- Frontend: Lighthouse scores target (Performance > 90, Accessibility > 90)
- Database: slow query log (> 100ms)
- Real user monitoring (RUM) planned

---

## PART 13: Documentation Update Matrix

This matrix defines which documentation MUST be updated for each type of change.

| Change Type | Files to Update |
|-------------|-----------------|
| **Database change** (new field, new collection, index change) | `DATABASE.md`, `DATABASE_CONVENTIONS.md` (if convention changes), `docs/modules/{affected}.md` |
| **API change** (new endpoint, changed endpoint, removed endpoint) | `API_STANDARDS.md`, `docs/modules/{affected}.md` |
| **Business rule change** (new rule, modified rule, removed rule) | `BUSINESS_RULES.md`, `STATE_MACHINES.md` (if state affected), `EDGE_CASES.md` (if new edge cases) |
| **Permission change** (new role, changed access, new resource) | `PERMISSION_MATRIX.md`, `API_STANDARDS.md` (if endpoint-level) |
| **State machine change** (new state, new transition) | `STATE_MACHINES.md`, `BUSINESS_RULES.md` (if new rules), `EDGE_CASES.md` |
| **Architecture change** (new layer, changed pattern) | `SYSTEM_ARCHITECTURE.md`, new ADR in `docs/adr/` |
| **New feature/module** | `docs/modules/{new}.md`, `PROJECT_OVERVIEW.md` (update module list), `ROADMAP.md` (mark as done) |
| **Error code change** (new code, changed code) | `ERROR_HANDLING.md`, `API_STANDARDS.md` (if endpoint affected) |
| **New edge case discovered** | `EDGE_CASES.md` |
| **Security change** (new middleware, changed auth flow) | `ERROR_HANDLING.md`, `API_STANDARDS.md`, relevant `docs/modules/{affected}.md` |
| **AI feature change** (new tool, changed workflow) | `AI_ARCHITECTURE.md`, `AI_WORKFLOW.md`, `docs/modules/ai-assistant.md` |
| **Testing change** (new test patterns) | `CODING_STANDARDS.md` (testing section) |
| **Dependency change** (new library, upgraded library) | `ADR` (new or updated), `PROJECT_OVERVIEW.md` (tech stack) |

### Enforcement

- If a change requires documentation update and none is provided, the task is NOT complete.
- Documentation updates and code changes happen in the SAME commit/task.
- Outdated documentation is treated as a bug.

---

## PART 14: AI Self-Review

Before finalizing any task, the AI MUST answer these questions truthfully:

### Business Logic

- Did I change any business rules? If YES, explain which ones and why, and verify they are documented.
- Did I introduce any new business rules? If YES, STOP — they must be in BUSINESS_RULES.md first.
- Did I handle all states from STATE_MACHINES.md? If NO, explain which are missing.
- Did I handle all known edge cases for this feature? If NO, explain which are not handled.

### Scope

- Did I modify files outside the task scope? If YES, STOP — explain why and get approval.
- Did I fix unrelated bugs or issues? If YES, explain which ones and why they were fixed.
- Did I add "nice-to-have" features? If YES, STOP — remove them.

### Documentation

- Did I update all affected documentation? If NO, STOP — update it now.
- Did I create any new documentation files? If YES, are they in the correct location and format?
- Did I check for outdated documentation and flag it? If NO, do it now.

### Code Quality

- Did I introduce duplicate logic? If YES, explain where and why no shared utility was used.
- Did I add any console.log calls? If YES, remove them.
- Did I add any TODO/FIXME comments? If YES, remove them — resolve or don't commit.
- Did I leave any commented-out code? If YES, remove it.
- Did I leave any dead code (unused imports, variables, functions)? If YES, remove it.

### Architecture

- Did I violate the dependency direction? If YES, STOP — fix it.
- Did I violate module isolation? If YES, STOP — fix it.
- Did I introduce circular dependencies? If YES, STOP — fix it.
- Did I violate the existing architecture pattern? If YES, explain and justify.

### Permissions

- Did I add any endpoint without permission checks? If YES, STOP — add them.
- Did I bypass any existing permission checks? If YES, STOP — revert it.
- Did I correctly implement the permissions from PERMISSION_MATRIX.md? If NO, fix it.

### Standards

- Did I follow NAMING_CONVENTION.md? If NO, fix it.
- Did I follow CODING_STANDARDS.md? If NO, fix it.
- Did I follow TYPESCRIPT_STANDARDS.md? If NO, fix it.
- Did I follow COMPONENT_GUIDELINES.md (if frontend)? If NO, fix it.
- Did I follow API_STANDARDS.md (if API change)? If NO, fix it.
- Did I follow DATABASE_CONVENTIONS.md (if database change)? If NO, fix it.

### If Any Answer is YES to a Violation Question

The AI must:

1. Explain WHY the violation occurred
2. Explain WHY it was necessary (or acknowledge it was a mistake)
3. If it was a mistake: fix it immediately
4. If it was necessary (architecture change, new business rule): STOP and get human approval

---

## PART 15: AI Stop Conditions

The AI MUST STOP and ask for approval if ANY of these conditions are met:

### Business Rule Unclear

- The task requires implementing a business rule that is not in BUSINESS_RULES.md
- The task contradicts a documented business rule
- The task requires a rule that conflicts with another rule
- STOP: Ask for clarification before proceeding

### Permission Unclear

- The task requires a permission that is not in PERMISSION_MATRIX.md
- The task requires granting access to a role that shouldn't have it
- The task removes a permission without being asked
- STOP: Ask for clarification before proceeding

### Database Change Required

- The task requires adding a new field that is not in DATABASE.md
- The task requires a new collection
- The task requires removing or renaming a field or collection
- The task requires a data migration
- STOP: Present the design for approval before implementing

### API Change Required

- The task requires a new endpoint not in API_STANDARDS.md
- The task requires changing an existing endpoint's behavior, method, or path
- The task requires removing an endpoint
- The task requires changing request/response format
- STOP: Present the design for approval before implementing

### Architecture Change Required

- The task requires a new module or service
- The task requires changing the dependency direction
- The task requires adding a new architectural layer
- The task requires changing the database technology
- The task requires changing the framework or major library
- STOP: Present the design for approval before implementing

### Security Impact

- The task requires handling sensitive data in a new way
- The task requires exposing a previously internal endpoint
- The task requires bypassing any security measure
- The task requires storing new types of PII
- STOP: Discuss security implications before implementing

### Breaking Change

- The task requires changing an existing API response format
- The task requires removing or renaming a database field
- The task requires changing how existing data is interpreted
- The task affects existing frontend-backend contracts
- STOP: Discuss migration strategy before implementing

### Migration Required

- The task requires transforming existing data
- The task requires backfilling new fields
- The task requires data cleanup
- STOP: Present migration plan for approval before implementing

### Cross-Module Modification Required

- The task requires changes in 2+ modules
- The task requires adding a dependency between modules that don't currently depend on each other
- The task requires changing the public interface of another module
- STOP: Present cross-module change plan for approval before implementing

### When Stopped, the AI Must

1. Clearly state WHICH stop condition was triggered
2. Explain the situation concisely
3. Present options (if applicable)
4. Wait for response before proceeding

---

## PART 16: Definition of Done

A task is COMPLETE only if ALL of these conditions are met:

### Business Logic

- [ ] All documented business rules for the feature are correctly implemented
- [ ] No new business rules were invented
- [ ] All state machine transitions are correctly handled
- [ ] All known edge cases are handled
- [ ] Business logic exists ONLY in services (not controllers, not models)

### Code Quality

- [ ] Code compiles without errors (TypeScript compilation passes)
- [ ] Lint passes (ESLint, no warnings or errors)
- [ ] TypeScript types are correct (strict mode, no `any`)
- [ ] No console.log calls in production code
- [ ] No TODO/FIXME comments
- [ ] No commented-out code
- [ ] No dead code (unused imports, variables, functions, exports)
- [ ] No duplicate logic
- [ ] Error handling present on all async operations
- [ ] Input validation present on all user-facing endpoints

### Testing

- [ ] Unit tests pass (or new tests written and pass)
- [ ] Integration tests pass (or new tests written and pass)
- [ ] Business rule tests cover new/modified rules
- [ ] Permission tests cover new/modified endpoints
- [ ] All existing tests still pass (no regressions)

### Security

- [ ] Authentication present on all protected endpoints
- [ ] Authorization/permission checks on all protected endpoints
- [ ] Input validation prevents injection attacks
- [ ] No secrets committed (JWT, API keys, DB URIs)
- [ ] Rate limiting in place (if applicable)
- [ ] Audit logging for sensitive operations
- [ ] File upload validation (if applicable)

### Performance

- [ ] No N+1 database queries
- [ ] Pagination implemented for list endpoints
- [ ] Appropriate indexes exist for new queries
- [ ] Lazy loading for new route-level components (frontend)

### Documentation

- [ ] README_FOR_AI.md reading order updated (if new files added)
- [ ] BUSINESS_RULES.md updated (if rules changed)
- [ ] STATE_MACHINES.md updated (if states changed)
- [ ] PERMISSION_MATRIX.md updated (if permissions changed)
- [ ] API_STANDARDS.md updated (if endpoints changed)
- [ ] DATABASE.md updated (if schema changed)
- [ ] DATABASE_CONVENTIONS.md updated (if conventions changed)
- [ ] ERROR_HANDLING.md updated (if error codes changed)
- [ ] EDGE_CASES.md updated (if new edge cases discovered)
- [ ] docs/modules/{affected}.md updated
- [ ] New ADR created (if architecture decision made)

### Frontend (if applicable)

- [ ] Responsive: works on mobile, tablet, desktop
- [ ] Accessibility: semantic HTML, aria labels, keyboard navigation
- [ ] Loading states shown during data fetch
- [ ] Error states shown on failure
- [ ] Empty states for no data
- [ ] Visual consistency with existing UI
- [ ] No visual regressions

### Verification

- [ ] All conditions in PART 9 (Review Checklist) are satisfied
- [ ] All conditions in PART 14 (AI Self-Review) are satisfied
- [ ] No stop conditions from PART 15 are triggered

### Final Confirmation

A task is DONE only when:

- The code is correct (by all measurable standards)
- The code is secure (by all applicable security rules)
- The code is documented (all affected docs updated)
- The code is tested (all relevant tests pass)
- The code is clean (no dead code, no TODOs, no commented code)
- The code follows the architecture (no violations of dependency direction or module isolation)

If any of these conditions is NOT met, the task is NOT done.
