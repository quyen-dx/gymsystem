# IMPLEMENTATION ROADMAP

---

## PART A: Documentation Consistency Audit

List of all issues found during a full documentation review, classified by severity.

### CRITICAL Issues

**C-01: Cancellation Window Contradiction (3 different values)**

- BUSINESS_BLUEPRINT.md section 2.2: "24h free"
- BUSINESS_RULES.md BR-BKG-004: "free up to 2 hours before"
- STATE_MACHINES.md Booking section: "free-cancellation window (e.g. ≥ 6 h before)" from PENDING state
- Impact: Three documents define three different cancellation windows. Any developer or AI will implement the wrong one.
- Fix: Decide ONE authoritative cancellation window. Update all three documents to match. Then implement once.

**C-02: Business Blueprint Section 7 Rule ID Mismatches**

- BUSINESS_BLUEPRINT.md Section 7 incorrectly maps BR-BKG-002 to "Cancellation Refund: 24h free cancel" but the actual BR-BKG-002 is "Member must have active membership to book."
- BUSINESS_BLUEPRINT.md Section 7 incorrectly maps BR-PAY-002 to "Refund Window: 7 days full refund" but the actual BR-PAY-002 is "Payment idempotency key required."
- Impact: The summary table in the project's top-level business document is flat wrong. Any developer reading only the blueprint will get wrong rule IDs.
- Fix: Regenerate the summary table in BUSINESS_BLUEPRINT.md Section 7 to correctly map rule IDs. Verify all 18+ rule ID cross-references.

**C-03: AI Module Scope Mismatch**

- BUSINESS_BLUEPRINT.md Section 1 describes AI as: "Recommendation engine, churn prediction, health insights, automated scheduling"
- AI_ARCHITECTURE.md describes AI as: "The primary conversational interface for members, enabling them to inquire about and interact with their memberships, bookings, check-ins, workouts, payments, product purchases, and gym policies."
- Impact: These are two completely different AI scopes. The current codebase (gymProAgent + gymTools) implements the conversational AI approach. The blueprint describes a predictive analytics approach. The blueprint is wrong.
- Fix: Update BUSINESS_BLUEPRINT.md AI module description to match the conversational AI scope in AI_ARCHITECTURE.md.

### HIGH Issues

**H-01: Membership State Naming Inconsistency**

- BUSINESS_RULES.md uses lowercase status values: 'active', 'pending', 'frozen'
- STATE_MACHINES.md uses UPPER_SNAKE_CASE: 'ACTIVE', 'PENDING_ACTIVATION', 'FROZEN'
- BUSINESS_RULES BR-MEM-001 refers to 'pending' status; STATE_MACHINES calls it 'PENDING_ACTIVATION'
- Impact: Confusion between 'pending' (business rule) and 'PENDING_ACTIVATION' (state machine). May cause inconsistent database queries.
- Fix: Normalize all state names. Choose CONSISTENT naming across all docs. Suggest using UPPER_SNAKE_CASE everywhere.

**H-02: Booking State Machine vs Business Rules Cancellation**

- STATE_MACHINES.md Booking: free cancellation from PENDING state if "≥ 6 h before"
- BUSINESS_RULES.md BR-BKG-004: free cancellation up to 2 hours before
- Impact: Same booking cancellation has two different time windows in two different docs.
- Fix: Related to C-01. After deciding the authoritative window, fix both documents.

**H-03: Membership "Active" Constraint Incomplete in Blueprint**

- BUSINESS_BLUEPRINT.md Section 6 Business Constraints says "1 active membership" at any time
- BUSINESS_RULES.md BR-MEM-001 checks for status IN ('active', 'pending', 'frozen') — meaning ONE membership in any of these 3 states
- Impact: The blueprint constraint is incomplete. A developer reading only the blueprint would write incorrect logic only checking 'active'.
- Fix: Update Business Blueprint constraint to mention all three limiting statuses.

**H-04: Missing Required Documents**

- README_FOR_AI.md references CURRENT_PHASE.md, ROADMAP.md, DEPLOYMENT_GUIDE.md as "should exist" (Section 5)
- CURRENT_PHASE.md is also referenced by AI_CODING_CONSTITUTION.md and AI_DEVELOPMENT_WORKFLOW.md as mandatory reading
- These files do NOT exist in the docs directory
- Impact: The AI development workflow (AI_DEVELOPMENT_WORKFLOW.md) references CURRENT_PHASE.md as required context. An AI following the workflow will fail.
- Fix: Create CURRENT_PHASE.md, ROADMAP.md, and DEPLOYMENT_GUIDE.md.

**H-05: README_FOR_AI File Purpose Table Outdated**

- All files in Section 5 are marked "📄 Should exist" but these files were generated and DO exist
- The table says "📁 Empty dir" for adr/ but ADRs have been generated
- Impact: Misleading to future developers/AIs. They will assume docs don't exist.
- Fix: Update Section 5 of README_FOR_AI.md to mark all existing files as "✅ Existing" and update directory statuses.

**H-06: AI Intent/Permission Scope conflict between docs**

- AI_WORKFLOW.md Appendix B says READ_OWN_MEMBERSHIP requires "member, admin"
- PERMISSION_MATRIX.md says Member can "View own" membership (R), PT can also "View own" (R)
- AI_WORKFLOW only lists member and admin for this permission scope, missing PT
- Impact: AI permission checks will incorrectly block PTs from viewing their own membership data.
- Fix: Update AI_WORKFLOW.md Appendix B to include PT for READ_OWN_MEMBERSHIP scope.

### MEDIUM Issues

**M-01: ADRs Reference Express 5 but Documentation Recommends Express 4 LTS**

- ADR-002: "Continue with Express 5"
- SYSTEM_ARCHITECTURE.md: "Should pin to Express 4 LTS"
- DATABASE.md: "planned downgrade to Mongoose 8 LTS"
- Impact: Conflicting guidance on framework versions.
- Fix: Decide whether to stay on Express 5, pin to Express 4, or accept Express 5 with risk mitigation. Update ADR accordingly.

**M-02: MEMBERSHIP_SYSTEM_ARCHITECTURE.md Overlap**

- This file exists but is not formally referenced in the main documentation navigation
- It likely duplicates content from DATABASE.md, STATE_MACHINES.md, and docs/modules/membership.md
- Impact: Risk of out-of-sync information between this file and the standard docs.
- Fix: Review for duplication. Either remove duplicate content in favor of standard docs, or add it as a cross-reference in DATABASE.md and docs/modules/membership.md.

**M-03: Missing AI Sub-Documents**

- AI_ARCHITECTURE.md Appendix B references: AI_INTENTS.md, VISION_PIPELINE.md, RAG_PIPELINE.md, STREAMING_API.md
- These files do NOT exist in the docs directory
- Impact: AI developers lack implementation details for these sub-systems.
- Fix: Either create these files, or remove their references from AI_ARCHITECTURE.md with a note that they are planned for a future phase.

**M-04: Business Blueprint Auth Description References Session Management**

- BUSINESS_BLUEPRINT.md Section 1 Core Modules table: Auth handles "session management, OAuth, MFA"
- ADR-003: Decision is JWT Bearer Tokens over Session-Based Auth
- Impact: Contradiction — blueprint says session management exists; ADR says JWT was chosen over sessions.
- Fix: Update BUSINESS_BLUEPRINT.md Auth description to say "token management" instead of "session management."

**M-05: Passport Version Inconsistency**

- PROJECT_OVERVIEW.md says "Passport.js | 0.7"
- README_FOR_AI.md mentions Passport for Google/Facebook but not version
- Minor inconsistency in tech stack version reporting
- Impact: Low. But version tracking should be consistent.
- Fix: Confirm actual Passport.js version in package.json, update both documents to match.

**M-06: Edge Cases vs Business Rules Cross-Reference Gaps**

- EC-MEM-001 (double refund) references BR-MEM-005 and BR-MEM-006 but not BR-PAY-001 (atomic transactions)
- EC-BKG-001 (double booking) correctly references BR-BKG-003
- Some edge cases don't reference their related business rules
- Impact: When implementing fixes, developers won't know which rules are affected.
- Fix: Add BR-xxx references to all edge cases in EDGE_CASES.md.

### LOW Issues

**L-01: API Standards snake_case vs MongoDB camelCase**

- API_STANDARDS.md says snake_case for JSON keys matching MongoDB field names
- DATABASE_CONVENTIONS.md uses camelCase for schema fields
- MongoDB/Mongoose conventionally uses camelCase
- Impact: Minor — just a style guide clarification needed.
- Fix: Clarify in API_STANDARDS.md that the actual convention is camelCase (as used in the existing codebase).

**L-02: Currency Representation Not Standardized**

- DATABASE_CONVENTIONS.md: No floating point for money, store integers
- BUSINESS_RULES.md BR-PAY-005: references VND amounts as integers
- DATABASE.md: "price: Number — VND, no decimals"
- Multiple docs agree on integer VND but no single authoritative statement on the currency strategy
- Impact: Low — implicit agreement exists but should be explicit.
- Fix: Add explicit currency section to DATABASE_CONVENTIONS.md.

**L-03: Notification Module Doc vs Business Rules Naming**

- BUSINESS_RULES.md uses "BR-NTF" prefix
- docs/modules/notification.md uses different internal naming
- Impact: Low — cosmetic inconsistency.
- Fix: Ensure module docs reference BR-NTF-xxx rules explicitly.

**L-04: Missing "SELLER" from AI_WORKFLOW Permission Scopes**

- AI_WORKFLOW.md Appendix B only lists a subset of roles for permission scopes
- PERMISSION_MATRIX.md has a comprehensive matrix including SELLER
- Impact: Minor — AI workflow doc doesn't have full coverage.
- Fix: Update AI_WORKFLOW permission scopes appendix to match PERMISSION_MATRIX.

**L-05: BUSINESS_RULES Appendix Truncated**

- The BUSINESS_RULES.md appendix (Rule Index table) appears cut off mid-way
- Impact: Medium — incomplete reference. But full rules are in the body.
- Fix: Complete the Rule Index table in BUSINESS_RULES.md.

---

## PART B: Implementation Roadmap

Based on the documentation review and dependency analysis, this is the recommended implementation sequence.

### Overall Strategy

The project is POST-MVP, pre-production. The priority is:

1. Fix critical documentation conflicts (these block implementation)
2. Implement security hardening (must happen before production)
3. Complete core business logic gaps
4. Build out reporting/analytics
5. Enable AI features
6. Polish frontend and deploy

### Phase 0: Foundation & Fixes (2 weeks) — BEFORE ANY NEW FEATURES

**Sprint 0.1: Documentation Resolution**

- Resolve C-01: Decide on cancellation window and update all docs
- Resolve C-02: Fix BUSINESS_BLUEPRINT.md Section 7 rule ID mappings
- Resolve C-03: Fix AI module scope mismatch
- Resolve H-01: Normalize state naming across all docs
- Resolve H-02: Align booking cancellation between State Machine and Business Rules
- Resolve H-04: Create CURRENT_PHASE.md, ROADMAP.md, DEPLOYMENT_GUIDE.md
- Resolve H-05: Update README_FOR_AI.md file purpose table
- Resolve H-06: Fix AI_WORKFLOW.md permission scopes

**Sprint 0.2: Security Hardening**

- Add Helmet middleware to Express app
- Add rate limiting to all auth endpoints (express-rate-limit)
- Add rate limiting to payment endpoints
- Add input validation (Zod) to all unprotected endpoints
- Add webhook signature verification for VNPAY and Stripe
- Review and fix all permission middleware gaps
- Add audit logging for all admin actions
- Encrypt PII fields in MongoDB (email, phone, address)
- Implement proper CORS configuration
- Add CSRF protection for cookie-based refresh token
- Resolve H-03: Update membership constraint in blueprint

### Phase 1: Core Business Foundations (3 weeks)

**Sprint 1.1: Membership (Module Dependency Level: Foundation)**

Dependencies: Auth (completed), Payment

- Implement BR-MEM-001 through BR-MEM-008 in code
- Membership purchase flow with proper transactions
- Membership state machine implementation
- Freeze/unfreeze with date extension logic
- Refund calculation engine (full, prorated, 50%-consumed rule)
- Expiry notification cron job (7, 3, 1 day reminders)
- Trial period enforcement (check-in limits, no-booking flag)
- Edge cases: EC-MEM-001 through EC-MEM-010

**Sprint 1.2: Payment & Wallet (Module Dependency Level: Foundation)**

Dependencies: Auth, Membership

- Payment gateway integration finalization (VNPAY + Stripe)
- Idempotency key implementation with payload hashing
- Webhook handler with signature verification
- Atomic wallet transactions with balance guard
- Dual-entry ledger implementation
- Withdrawal flow with identity verification
- Timeout handling (VNPAY 15min, Stripe 30min)
- Edge cases: EC-PAY-001 through EC-PAY-006, EC-WAL-001 through EC-WAL-005

**Sprint 1.3: Booking & Schedule (Module Dependency Level: Core)**

Dependencies: Auth, Membership, Payment, PT

- Booking creation with slot availability check
- PT confirmation/rejection flow with auto-confirm timer
- Cancellation policy enforcement (resolved window from C-01)
- Recurring booking with truncation on membership expiry
- Waitlist with atomic promotion
- PT schedule management with 24h modification window
- Edge cases: EC-BKG-001 through EC-BKG-008

### Phase 2: Operations & Experience (3 weeks)

**Sprint 2.1: Check-in & Streaks**

Dependencies: Membership, Booking

- QR code generation with HMAC-signed payload
- Check-in with membership validation
- Auto-activation logic for pending memberships
- Streak tracking (consecutive days, reset on miss)
- Daily check-in deduplication
- Operating hours validation
- Edge cases: EC-CHK-001 through EC-CHK-006

**Sprint 2.2: Shop & Orders**

Dependencies: Auth, Payment, Wallet, GHN

- Product catalog with category management
- Inventory reservation on order creation
- Atomic checkout with stock guard
- GHN shipping integration (rate calculation, tracking, webhooks)
- Escrow-based payment flow
- Return/refund workflow (7-day window)
- Seller payout system
- Edge cases: EC-SHP-001 through EC-SHP-007

**Sprint 2.3: Notifications**

Dependencies: All modules

- Notification state machine (QUEUED → SENT → DELIVERED → READ → FAILED)
- Email delivery (Nodemailer) with templates
- SMS delivery (Twilio/SpeedSMS)
- In-app delivery (Socket.io)
- Notification preferences (opt-out for marketing, always-on for transactional)
- Batched email delivery (max 1/hour for non-urgent)
- BR-NTF-001 through BR-NTF-003

### Phase 3: Intelligence & Analytics (2 weeks)

**Sprint 3.1: AI Assistant**

Dependencies: All modules' services

- AI Gateway with auth + rate limiting
- Intent Classifier (14 intents, 0.85 confidence threshold)
- Permission Engine integration
- Context Builder with anti-hallucination prompts
- Tool Router (DB, RAG, Search, Vision, Calculator tiers)
- Response Builder with streaming (SSE)
- Output Filter (PII redaction, hallucination scan)
- LLM provider fallback chain (Gemini 2.5 Flash → 2.0 Flash → Claude → Llama)
- Resolve M-03: Create AI_INTENTS.md, VISION_PIPELINE.md, RAG_PIPELINE.md, STREAMING_API.md

**Sprint 3.2: Reports & Analytics**

Dependencies: All modules

- Revenue dashboard (daily, weekly, monthly, yearly)
- Membership analytics (growth, churn, retention)
- Check-in statistics (attendance rate, peak hours)
- Trainer performance (sessions delivered, member satisfaction)
- Product sales (revenue, top sellers, inventory turnover)
- Export to CSV/Excel

### Phase 4: Infrastructure & Production (2 weeks)

**Sprint 4.1: System Operations**

- Database health monitoring
- Cron job reliability (missed-window detection)
- Connection pool management
- Circuit breaker for external services
- Logging infrastructure (Winston structured JSON)
- Error tracking and alerting
- Edge cases: EC-SYS-001 through EC-SYS-007

**Sprint 4.2: Production Readiness**

- Docker compose production configuration
- CI/CD pipeline (GitHub Actions or similar)
- Database backup automation
- SSL/TLS configuration
- CDN setup for static assets (Cloudinary)
- Load testing and performance optimization
- Monitoring dashboards (API latency, error rates, DB query times)
- Security audit and penetration testing

### Phase 5: Polish & Launch (1 week)

**Sprint 5.1: Frontend Polish**

- Responsive verification (375px, 768px, 1280px, 1920px)
- Accessibility audit (semantic HTML, aria labels, keyboard nav)
- Loading/error/empty state completeness
- Bilingual support verification (Vietnamese/English)
- Bundle size optimization (< 300KB gzipped)
- Lighthouse scores (Performance > 90, Accessibility > 90)

**Sprint 5.2: Documentation & Handover**

- Final documentation review and updates
- Deployment guide finalization
- Support/troubleshooting guide
- API documentation for external consumers
- Handover to operations team

### Dependency Graph (ASCII)

```
                     AUTH
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
     MEMBERSHIP    PAYMENT      WALLET
         │            │            │
         ├────────────┘            │
         ▼                         │
     CHECK-IN                     │
         │                        │
         ▼                        │
     BOOKING ──────PT─────────────┘
                      │
                      ▼
                  SCHEDULE
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
      WORKOUT       SHOP       PRODUCTS
                      │
                      ▼
                   ORDERS ────── GHN
                      │
                      ▼
                 NOTIFICATIONS
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
       REPORTS    AI_ASST      CONTENT
                      │
                      ▼
                 SETTINGS
```

### High-Risk Modules

| Module | Risk Level | Risks |
|--------|-----------|-------|
| **Payment** | CRITICAL | Revenue leakage, double charges, webhook failures, gateway timeout |
| **Membership** | CRITICAL | State corruption, double activation, incorrect refunds, plan deletion cascade |
| **Booking** | HIGH | Double bookings, slot conflicts, cancellation disputes, waitlist race conditions |
| **Wallet** | HIGH | Negative balance, withdrawal fraud, transaction log divergence, escrow mismanagement |
| **AI Assistant** | HIGH | Hallucination, unauthorized data access, prompt injection, provider downtime |
| **Shop** | HIGH | Inventory overselling, escrow loss, return after payout, GHN webhook failures |
| **System** | MEDIUM | DB disconnection mid-transaction, cron job misses, memory leaks, rate limit bypass |

### Recommended Implementation Strategy

1. **Phase 0 First**: No new features until documentation is consistent and security baseline is in place
2. **Sprint-by-Sprint**: Each sprint delivers a complete module with tests + documentation
3. **Transactional Guarantees**: Payment and Wallet must be built together (atomic operations span both)
4. **Test-Driven**: Write business rule tests FIRST, then implement — especially for payment/membership
5. **Incremental Delivery**: Deploy each sprint to staging, verify, then proceed
6. **No Tech Debt**: Zero tolerance for TODO/FIXME/commented code from sprint 0 onwards
7. **Documentation Kept Current**: Every sprint updates affected documentation

### Total Estimated Timeline

| Phase | Duration |
|-------|----------|
| Phase 0 | 2 weeks |
| Phase 1 | 3 weeks |
| Phase 2 | 3 weeks |
| Phase 3 | 2 weeks |
| Phase 4 | 2 weeks |
| Phase 5 | 1 week |
| **Total** | **13 weeks** |
