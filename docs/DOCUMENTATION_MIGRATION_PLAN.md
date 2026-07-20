# Documentation Migration Plan — GymPro

> **Author:** Documentation Architect
> **Status:** Awaiting Approval
> **Version:** 1.0.0
> **Rule:** This document must be approved BEFORE any markdown file is modified.

---

## Context

A full consistency audit of all 48 documentation files was performed by reading every document in the mandated order (README_FOR_AI.md → PROJECT_OVERVIEW.md → ... → module docs). The audit identified **20 issues**: 3 Critical, 6 High, 6 Medium, 5 Low.

This migration plan provides:

1. **Detailed root cause analysis** for every issue
2. **Source-of-truth assignment** (which document wins when they conflict)
3. **Exact modification instructions** per file
4. **Impact assessment** across business logic, database, API, and AI workflow
5. **Risk assessment** if each issue is left unresolved
6. **Phased execution plan** with dependency ordering

**Nothing is modified yet. This plan requires approval.**

---

## Part A: Issue Analysis

---

### CRITICAL-01: Cancellation Window Contradiction (3 Values)

**Affected Documents:**
- `BUSINESS_BLUEPRINT.md` — Section 2.2 (line 57): "Cancellation policies with tiered deadlines (24h free, <24h penalty)"
- `BUSINESS_RULES.md` — BR-BKG-004 (lines 255-277): "free up to 2 hours before"
- `STATE_MACHINES.md` — Booking transitions (line 130): "Within free-cancellation window (e.g. ≥ 6 h before)"

**1. Root Cause:** Three documents were authored independently. The booking cancellation policy was designed at three different times by three different authors (or agents), each with their own assumption about the correct window. No cross-reference validation was performed during document generation.

**2. Why It Happened:** The Business Blueprint was written as a high-level vision document. The Business Rules were generated from the codebase audit (the code audit likely found the 2-hour rule in actual code). The State Machines were generated from the blueprint and rules combined, but the agent chose a different illustrative value (6h) for the "e.g." field. Three independent generation passes = three different values.

**3. Source of Truth:** `BUSINESS_RULES.md` — BR-BKG-004 (2 hours). Rationale: Business rules are the formal, enumerated implementation contract. The blueprint is descriptive. The state machine uses placeholder text ("e.g."). The business rule is closest to implementable code and was sourced from the existing codebase audit.

**4. Documents That Must Be Updated:**
- `BUSINESS_BLUEPRINT.md` — Section 2.2: Replace "24h free" with "2h free"
- `BUSINESS_BLUEPRINT.md` — Section 7: BR-BKG-002 row (which is itself wrong, see C-02)
- `STATE_MACHINES.md` — Line 130: Remove "e.g." and make the guard explicit: "Within 2 hours before session start"
- `EDGE_CASES.md` — Verify all booking edge cases reference the correct window

**5. Exact Modifications Required:**

**File: `BUSINESS_BLUEPRINT.md`**
```
Line 57: Change "tiered deadlines (24h free, <24h penalty)" 
         to "tiered deadlines (2h free, penalty after 2h)"
```

**File: `STATE_MACHINES.md`**
```
Line 130: Change "Within free-cancellation window (e.g. ≥ 6 h before)" 
         to "At least 2 hours before session start time"
```

**File: `docs/modules/booking.md`**
```
Add explicit cancellation window: "Free cancellation up to 2 hours before session.
Cancellation within 2 hours incurs 50% penalty."
```

**6. Impact on Business Logic:**
- The actual code likely implements one of these values. The fix will align documentation with code.
- If code implements 24h, changing to 2h makes cancellations more lenient (higher revenue but lower member satisfaction).
- If code implements 2h, no code change needed — only documentation fix.
- If code implements 6h, changing to 2h makes cancellations stricter (lower revenue but happier members).
- **Must verify which value the actual code implements before finalizing this decision.**

**7. Impact on Database:** None — cancellation window is a business rule enforced in application logic, not a database constraint.

**8. Impact on API:** None — the cancellation API endpoint behavior may change if the code doesn't match the final window. If code already matches 2h, no API change. If not, the cancellation endpoint must be updated.

**9. Impact on AI Workflow:**
- AI's booking cancellation tool must use the resolved window when advising members.
- Intent classifier for booking_q must understand "cancel my booking" intent with the correct timing constraints.
- The LLM system prompt must include the exact policy to prevent hallucinated cancellation windows.

**10. Risk If Left Unresolved:**
- **HIGH:** Any developer (human or AI) implementing booking will pick one of the three values arbitrarily, likely breaking production booking flows. Members see one policy in UI, code enforces another, support team has a third answer. Trust erosion.

---

### CRITICAL-02: Business Blueprint Section 7 Rule ID Mismatches

**Affected Documents:**
- `BUSINESS_BLUEPRINT.md` — Section 7 (lines 220-244): Summary table maps wrong IDs to wrong rules
- `BUSINESS_RULES.md` — Actual rule definitions (correct)

**1. Root Cause:** The Blueprint summary table was generated by summarizing the business rules, but the agent that generated it matched summary text to rule IDs incorrectly. Specifically:

| Blueprint Row | Blueprint Says | Actually Belongs To |
|---------------|---------------|---------------------|
| BR-BKG-002 | "Cancellation Refund: 24h free cancel; <24h = 50% refund" | BR-BKG-004 (Cancellation by member) |
| BR-PAY-002 | "Refund Window: 7 days full refund (unactivated); prorated (activated)" | BR-MEM-006 (Refund calculation) |
| BR-PAY-003 | "Atomic Wallet Ops" | BR-PAY-001 (Atomic financial transactions) |
| BR-WAL-001 | "Minimum Balance: Cannot go below 0" | Correct ✓ |

**2. Why It Happened:** The summary table was auto-generated by matching rule descriptions to nearest rule IDs. The agent used semantic similarity but got the ID mapping wrong because:
- BR-BKG-002 (active membership required) and BR-BKG-004 (cancellation policy) both relate to booking — the agent picked the wrong one.
- BR-MEM-006 (refund calculation) was misattributed to payment rules because refunds involve payment flow.

**3. Source of Truth:** `BUSINESS_RULES.md` — the full rule definitions are correct. IDs map to actual rules. The Blueprint summary table must be regenerated from the actual rule definitions.

**4. Documents That Must Be Updated:**
- `BUSINESS_BLUEPRINT.md` — Section 7: Regenerate entire summary table from BUSINESS_RULES.md
- `docs/modules/payment.md` — Verify rule references
- `docs/modules/booking.md` — Verify rule references
- `docs/modules/membership.md` — Verify rule references

**5. Exact Modifications Required:**

**File: `BUSINESS_BLUEPRINT.md` Section 7**
```
Replace entire table with correct mapping. Verify each row against BUSINESS_RULES.md.
The corrected table should read:

| Rule ID | Name | Summary |
|---------|------|---------|
| BR-MEM-001 | One Active Membership | At most 1 membership in active/pending/frozen state |
| BR-MEM-002 | Auto-Activation | Pending membership activates on first check-in or payment |
| BR-MEM-003 | Renewal Queue Limit | Max 3 pending renewals |
| BR-MEM-004 | Freeze Limits | Max 2 freezes/cycle, max 30 days/freeze, min 7 days between |
| BR-MEM-005 | Cancellation Approval | Admin approval required if activated |
| BR-MEM-006 | Refund Calculation | Full <7 days unactivated; prorated activated; 0 after 50% consumed |
| BR-MEM-007 | Expiry Notifications | Notified 7, 3, 1 day before expiry |
| BR-MEM-008 | Trial Rules | No bookings, max 3 check-ins, one trial per lifetime |
| BR-BKG-001 | Booking Window | Max 30 days ahead |
| BR-BKG-002 | Active Membership Required | Must have active/pending membership to book |
| BR-BKG-003 | One Booking Per Slot | Max 1 booking/slot/PT/time |
| BR-BKG-004 | Cancellation Refund | Free up to 2h before; 50% penalty within 2h |
| BR-BKG-005 | No-Show Penalty | 1 violation point; 3 → booking suspension 30 days |
| BR-BKG-006 | PT Confirmation | PT has 1h to confirm/reject, then auto-confirm |
| BR-BKG-007 | Recurring Booking | Max 4 weeks, same day/time, membership must cover all dates |
| BR-PT-001 | Max Member Assignments | Max 10 active members per PT |
| BR-PT-002 | Daily Session Cap | Max 8 sessions/day per PT |
| BR-PT-003 | Self-Booking Prohibited | PT cannot book themselves |
| BR-PT-004 | Schedule Modification | PT can modify with min 24h notice |
| BR-CHK-001 | QR Required | QR token, 30s expiry, single-use |
| BR-CHK-002 | Auto-Activation | First check-in activates pending membership |
| BR-CHK-003 | Streak Tracking | Consecutive days only |
| BR-CHK-004 | Daily Limit | Once per membership per day |
| BR-CHK-005 | Operating Hours | Check-in during gym hours only |
| BR-PAY-001 | Atomic Transactions | Wallet + order in single DB transaction |
| BR-PAY-002 | Idempotency Keys | UUID required, deduplicate within 24h |
| BR-PAY-003 | Refund to Original Method | Refund goes back to payment method or wallet |
| BR-PAY-004 | Gateway Timeouts | VNPAY 15min, Stripe 30min |
| BR-PAY-005 | Minimum Payment | 1,000 VND minimum |
| BR-WAL-001 | Non-Negative Balance | Cannot go below 0 |
| BR-WAL-002 | Withdrawal Verification | Identity verification required |
| BR-WAL-003 | Immutable Transactions | Append-only, corrections via offsetting entries |
| BR-WAL-004 | Dual-Entry Booking | Every transaction records debit + credit |
| BR-SHP-001 | Inventory Reservation | Stock reserved on order, released on cancel |
| BR-SHP-002 | Platform Fee | 2% of product price |
| BR-SHP-003 | Seller Escrow | Funds held until delivery confirmed |
| BR-SHP-004 | Return Window | 7 days from delivery |
```

**6. Impact on Business Logic:**
- Without fixing: any developer or AI reading the blueprint will implement wrong rules (e.g., they'll look at BR-BKG-002 expecting cancellation logic but find "active membership required" instead).
- After fixing: blueprint becomes a reliable index into BUSINESS_RULES.md.

**7. Impact on Database:** None — data models are correct in DATABASE.md.

**8. Impact on API:** None — endpoint definitions in API_STANDARDS.md are correct and independent of this mapping.

**9. Impact on AI Workflow:** MODERATE — If an AI reads only the blueprint for rule context (skipping BUSINESS_RULES.md), it will implement wrong business logic. The AI_CODING_CONSTITUTION's mandatory reading order partially mitigates this but doesn't eliminate the risk.

**10. Risk If Left Unresolved:**
- **CRITICAL:** Misinformation in the project's top-level business document will cascade into every feature built from it. Wrong cancellation window, wrong refund rules, wrong payment flows. This is a single-point-of-failure for business logic correctness.

---

### CRITICAL-03: AI Module Scope Mismatch

**Affected Documents:**
- `BUSINESS_BLUEPRINT.md` — Section 1 (lines 46-47): AI listed as "Recommendation engine, churn prediction, health insights, automated scheduling"
- `AI_ARCHITECTURE.md` — Section 1 (lines 11-12): AI is "the primary conversational interface for members, enabling them to inquire about and interact with their memberships, bookings, check-ins, workouts, payments, product purchases, and gym policies."
- `docs/modules/ai-assistant.md` — Should describe AI module scope

**1. Root Cause:** Two different conceptual visions of AI were never reconciled:
- Vision A (Blueprint): AI as predictive analytics — recommendation engine, churn prediction, ML-driven insights
- Vision B (Architecture): AI as conversational assistant — chat-based interface to all gym services

The codebase implements Vision B (gymProAgent + gymTools + service layer). The blueprint describes Vision A (future ML capabilities).

**2. Why It Happened:** The BUSINESS_BLUEPRINT was designed with aspirational AI capabilities (machine learning, churn prediction) while the AI_ARCHITECTURE was designed for the currently implementable AI (RAG + tools + LLM). The blueprint was not updated when the AI design was finalized.

**3. Source of Truth:** `AI_ARCHITECTURE.md` — This describes the implemented architecture (in code). The blueprint should reflect what IS, not what COULD BE.

**4. Documents That Must Be Updated:**
- `BUSINESS_BLUEPRINT.md` — Section 1 Core Modules table: Replace AI description
- `BUSINESS_BLUEPRINT.md` — Any other references to AI in predictive context

**5. Exact Modifications Required:**

**File: `BUSINESS_BLUEPRINT.md` Section 1 (line 46-47)**
```
Change:    | **AI** | Recommendation engine, churn prediction, health insights, automated scheduling |
To:        | **AI** | Conversational AI assistant (Gemini 2.5 Flash) — membership queries, booking help, nutrition advice, 
            exercise guidance, policy questions, chitchat. Uses RAG + tool calling + trusted search. |
```

**6. Impact on Business Logic:**
- None directly. The AI module currently implements conversational AI, not predictive analytics.
- The blueprint mismatch may cause someone to scope AI features incorrectly (e.g., requesting churn prediction when the infrastructure doesn't support it).

**7. Impact on Database:** None — AI models (ai_conversations, ai_messages, ai_embeddings, ai_feedback, ai_model_config) match the conversational architecture.

**8. Impact on API:** None — AI API endpoints (/api/ai/chat, /ai/history, /ai/feedback) match the conversational architecture.

**9. Impact on AI Workflow:**
- AI engineers following the blueprint would try to build recommendation engines and churn prediction.
- AI_CODING_CONSTITUTION redirects them to AI_ARCHITECTURE.md, but the Blueprint is listed earlier in the reading order and may be trusted first.
- The system prompt for the AI assistant itself needs to reflect conversational scope, not predictive analytics.

**10. Risk If Left Unresolved:**
- **HIGH:** Feature requests based on the blueprint will target predictive AI capabilities (churn prediction, recommendations) that the system is not designed for. This wastes development time and creates scope creep. When AI features are implemented, they won't match stakeholder expectations from the blueprint.

---

### HIGH-01: Membership State Naming Inconsistency

**Affected Documents:**
- `BUSINESS_RULES.md` — BR-MEM-001 (line 35): `status IN ('active', 'pending', 'frozen')`
- `STATE_MACHINES.md` — Section 1 (line 18): `PENDING_ACTIVATION`
- `DATABASE.md` — Line 176: `status: String — enum: active, frozen, expired, cancelled`

**1. Root Cause:** The state machine design uses UPPER_SNAKE_CASE for state names (a convention for enum/constant values). The business rules were written by an agent that used lowercase string literals (matching MongoDB field values). The database schema lists the enum values but is MISSING the 'pending' status from its enum definition.

**2. Why It Happened:** Three different sources of naming:
- Database: MongoDB field values → lowercase (`'active'`, `'frozen'`)
- State Machine: Architectural design → UPPER_SNAKE (`PENDING_ACTIVATION`)
- Business Rules: Pseudocode → lowercase SQL-style (`'pending'`)

No naming convention document specified which format to use for status values. The NAMING_CONVENTION.md says "Enums: PascalCase enum, UPPER_SNAKE_CASE members" but this applies to TypeScript code, not documentation.

**3. Source of Truth:** `STATE_MACHINES.md` — as the authoritative state definition document. However, for MongoDB field values, the DATABASE.md enum values take precedence. Resolution: Use PENDING_ACTIVATION in state machine docs, and ensure DATABASE.md includes 'pending' as a valid enum value.

**4. Documents That Must Be Updated:**
- `BUSINESS_RULES.md` — BR-MEM-001: Use consistent state names matching STATE_MACHINES or at minimum note the mapping
- `DATABASE.md` — membership_cycles table: Add 'pending' to the status enum (it's currently missing!)
- `NAMING_CONVENTION.md` — Add section on state names in documentation vs code

**5. Exact Modifications Required:**

**File: `BUSINESS_RULES.md` — BR-MEM-001 (line 35)**
```
Change:  AND status IN ('active', 'pending', 'frozen')
To:      AND status IN ('active', 'pending_activation', 'frozen')
         [→ matches MongoDB field values and STATE_MACHINES naming]
```
OR add a note: "Note: status 'pending_activation' is referred to as 'pending' in business rule pseudocode."

**File: `DATABASE.md` — membership_cycles table (line 176)**
```
Change:  status | String | enum: active, frozen, expired, cancelled
To:      status | String | enum: pending_activation, active, frozen, expired, cancelled, refunded
         [→ adds missing states to match STATE_MACHINES]
```

**6. Impact on Business Logic:**
- Database queries using 'pending' vs 'pending_activation' will silently return no results.
- The "one active membership" constraint will miss 'pending_activation' records if deployed with lowercase 'pending'.

**7. Impact on Database:**
- The membership_cycles.status field may contain either 'pending' or 'pending_activation' depending on when records were created.
- **Requires data audit:** Check actual values in the database. Migrate all records to the canonical form.
- The missing enum values in DATABASE.md (pending_activation, refunded) mean documentation doesn't match actual data.

**8. Impact on API:** Membership status endpoints must return consistent status values. Frontend must handle both lowercase and UPPER_SNAKE depending on what the API returns.

**9. Impact on AI Workflow:**
- AI querying membership data must use the correct status filter.
- Intent classifier for membership_q must understand status questions regardless of naming.

**10. Risk If Left Unresolved:**
- **HIGH:** Database migration risks (incorrect queries, stale data). New code written against docs will use wrong status values. Silent data bugs where membership status checks fail.

---

### HIGH-02: Booking State Machine Cancellation Guard vs Business Rule

**Affected Documents:**
- `STATE_MACHINES.md` — Line 130: "Within free-cancellation window (e.g. ≥ 6 h before)"
- `BUSINESS_RULES.md` — BR-BKG-004: "free up to 2 hours before"

**1. Root Cause:** Same as C-01 with an additional layer: the state machine uses "e.g." (exempli gratia = for example), suggesting the 6h value was illustrative, not authoritative. But because it appears in the guard column of a transition table, a developer would implement it as the actual guard.

**2. Why It Happened:** The state machine agent used "e.g." to suggest an example guard without checking the actual business rule. The "e.g." qualifier was lost in the structured format.

**3. Source of Truth:** `BUSINESS_RULES.md` BR-BKG-004 (2 hours). The state machine is a model of the rules, not the authority.

**4. Documents That Must Be Updated:** Same as C-01.

**5. Exact Modifications Required:** Same as C-01 with this additional note:

**File: `STATE_MACHINES.md` — All transition tables**
```
Policy: Remove ALL "e.g." qualifiers from guard columns.
Every guard must be definitive, not illustrative.
If a value is the actual enforced guard, state it precisely.
If a value is genuinely configurable, state "configurable" and reference the config source.
```

**6-10. Same as C-01.**

---

### HIGH-03: Membership "Active" Constraint Incomplete in Blueprint

**Affected Documents:**
- `BUSINESS_BLUEPRINT.md` — Section 6 (line 203): "1 active membership at any given time"
- `BUSINESS_RULES.md` — BR-MEM-001: checks `IN ('active', 'pending', 'frozen')`

**1. Root Cause:** The blueprint simplified the constraint for readability. "Active" in common language means "currently in effect." But the system considers pending and frozen memberships as "occupying the single membership slot." The simplification lost critical nuance.

**2. Why It Happened:** Blueprint written for business stakeholders, rules written for engineers. The gap between "business English" and "implementation specification" is natural but dangerous.

**3. Source of Truth:** `BUSINESS_RULES.md` BR-MEM-001 (three-status check is correct).

**4. Documents That Must Be Updated:**
- `BUSINESS_BLUEPRINT.md` — Section 6 constraint table

**5. Exact Modifications Required:**

**File: `BUSINESS_BLUEPRINT.md` Section 6 (line 203)**
```
Change:  | Active Membership Limit | A member may have at most 1 active membership 
         at any given time | Membership purchase, activation |
To:      | Active Membership Limit | A member may have at most 1 membership in active, 
         pending_activation, or frozen status at any given time. Expired, cancelled, 
         or refunded memberships are excluded. | Membership purchase, activation |
```

**6. Impact on Business Logic:**
- If implemented from blueprint only: member with a pending membership could buy a second membership (because only 'active' is checked). This violates BR-MEM-001 and creates orphaned purchases.

**7. Impact on Database:** None — the constraint is application-level.

**8. Impact on API:** Membership purchase endpoint must enforce the complete constraint.

**9. Impact on AI Workflow:** AI membership tool must query for all three statuses when checking eligibility.

**10. Risk If Left Unresolved:**
- **HIGH:** Double membership purchases create accounting problems, revenue leakage (refunds for duplicate), and member confusion.

---

### HIGH-04: Missing Required Documents

**Affected Documents:**
- `README_FOR_AI.md` — Section 5 (line 218): CURRENT_PHASE.md listed as "📄 Should exist"
- `AI_CODING_CONSTITUTION.md` — Part 4 mandates reading CURRENT_PHASE.md
- `AI_DEVELOPMENT_WORKFLOW.md` — Part 2 requires CURRENT_PHASE.md in core context

**1. Root Cause:** These documents were referenced in the documentation framework as mandatory but were never generated. The generation process focused on technical, business, and architecture docs but missed project management documents.

**2. Why It Happened:** Documentation generation was prioritized as architecture-heavy. Project status and roadmap were deferred. But other documents were built with hard references to these files, making their absence a process blocker.

**3. Source of Truth:** The content does not exist. These files must be CREATED, with content based on the current project status described in PROJECT_OVERVIEW.md and the implementation phases in this migration plan.

**4. Documents That Must Be Updated:**
- CREATE `docs/CURRENT_PHASE.md`
- CREATE `docs/ROADMAP.md`
- CREATE `docs/DEPLOYMENT_GUIDE.md`

**5. Exact Modifications Required:**

**File: `docs/CURRENT_PHASE.md` — NEW FILE**
```
Content: Current project status, active development priorities, known issues in production.
Based on: PROJECT_OVERVIEW.md Section 8 ("Post-MVP, pre-production") and the implementation 
priorities from IMPLEMENTATION_ROADMAP.md.
```

**File: `docs/ROADMAP.md` — NEW FILE**
```
Content: Feature roadmap, milestones, release schedule.
Based on: IMPLEMENTATION_ROADMAP.md Phase 0-5 breakdown, BUSINESS_BLUEPRINT goals.
```

**File: `docs/DEPLOYMENT_GUIDE.md` — NEW FILE**
```
Content: Production deployment steps, Docker configuration, environment variables,
CI/CD pipeline, monitoring setup, backup procedures.
Based on: SYSTEM_ARCHITECTURE.md deployment section, docker-compose.yml, existing scripts.
```

**6-8. N/A** — These are project management documents, not technical specifications.

**9. Impact on AI Workflow:**
- **BLOCKER:** AI_DEVELOPMENT_WORKFLOW.md Step 2 says "Read CURRENT_PHASE.md." If the file doesn't exist, the workflow is broken at step 2. Every AI agent following the workflow will fail.

**10. Risk If Left Unresolved:**
- **HIGH:** AI agents following the mandated development workflow will halt at context loading. Current development status is unknown to new contributors. No single source of truth for "what are we doing right now."

---

### HIGH-05: README_FOR_AI File Purpose Table Outdated

**Affected Documents:**
- `README_FOR_AI.md` — Section 5 (lines 196-225): File Purpose Table

**1. Root Cause:** This table was generated BEFORE the full documentation generation pass. It lists all docs as "📄 Should exist" even though they were subsequently created. The table was never updated after generation completed.

**2. Why It Happened:** The documentation generation was a one-pass process. README_FOR_AI was generated first (so AI models would have a navigation guide), then the other 47 docs were generated. The earlier file was not revised after the later files were created.

**3. Source of Truth:** The actual filesystem. Files either exist or they don't.

**4. Documents That Must Be Updated:**
- `README_FOR_AI.md` — Section 5: Update status column for every file that now exists

**5. Exact Modifications Required:**

**File: `README_FOR_AI.md` Section 5**
```
Change all "📄 Should exist" entries to "✅ Existing" for these files:
- PROJECT_OVERVIEW.md
- SYSTEM_ARCHITECTURE.md
- BUSINESS_BLUEPRINT.md
- BUSINESS_RULES.md
- DATABASE.md
- DATABASE_CONVENTIONS.md
- STATE_MACHINES.md
- PERMISSION_MATRIX.md
- EDGE_CASES.md
- ERROR_HANDLING.md
- API_STANDARDS.md
- CODING_STANDARDS.md
- TYPESCRIPT_STANDARDS.md
- NAMING_CONVENTION.md
- COMPONENT_GUIDELINES.md
- ROADMAP.md (if created in H-04)
- CURRENT_PHASE.md (if created in H-04)
- DEPLOYMENT_GUIDE.md (if created in H-04)

Change "📁 Empty dir" for docs/adr/ to "✅ Existing (10 ADRs)"
Change "📄 Should exist" for docs/modules/*.md to "✅ Existing (19 modules)"

Also add these entries (not in original table but exist):
- AI_ARCHITECTURE.md → ✅ Existing
- AI_WORKFLOW.md → ✅ Existing
- AI_CODING_CONSTITUTION.md → ✅ Existing
- AI_DEVELOPMENT_WORKFLOW.md → ✅ Existing
- IMPLEMENTATION_ROADMAP.md → ✅ Existing
- DOCUMENTATION_MIGRATION_PLAN.md → ✅ Existing (this file, after creation)
```

**6-9. N/A** — Pure documentation status update.

**10. Risk If Left Unresolved:**
- **MEDIUM:** AI models reading this table will assume critical documentation doesn't exist and may attempt to create it from scratch, inventing content that contradicts actual docs. Wastes time and introduces duplicate documentation.

---

### HIGH-06: AI_WORKFLOW Permission Scopes Missing PT Role

**Affected Documents:**
- `AI_WORKFLOW.md` — Appendix B (lines 220-227): Permission scopes table
- `PERMISSION_MATRIX.md` — Membership section: PT can "View own" (R)

**1. Root Cause:** AI_WORKFLOW.md Appendix B was written as a simplified reference. It only listed `member` and `admin` for READ_OWN_MEMBERSHIP. The full PERMISSION_MATRIX also grants READ to PT.

**2. Why It Happened:** The appendix was hand-crafted for common scenarios. Staff, seller, and PT edge cases were omitted during a simplification pass. The phrase "member, admin" captured the primary use case but missed the PT edge case.

**3. Source of Truth:** `PERMISSION_MATRIX.md` — This is the authoritative RBAC document.

**4. Documents That Must Be Updated:**
- `AI_WORKFLOW.md` — Appendix B

**5. Exact Modifications Required:**

**File: `AI_WORKFLOW.md` — Appendix B**
```
Change:  | READ_OWN_MEMBERSHIP | member, admin |
To:      | READ_OWN_MEMBERSHIP | member, pt, admin |

Also verify all other scopes against PERMISSION_MATRIX:
- CREATE_BOOKING: PERMISSION_MATRIX says member, staff, admin, super_admin (not just member)
- READ_ALL_CHECKINS: PERMISSION_MATRIX says staff, admin (not trainer)
  (Note: "trainer" in AI_WORKFLOW maps to "PT" in PERMISSION_MATRIX)
- READ_ALL_MEMBERSHIPS: PERMISSION_MATRIX says staff, admin (not just admin)
- MANAGE_USERS: Only super_admin has "Assign roles" and "Delete user" (admin cannot)
```

**6. Impact on Business Logic:** If the AI Permission Engine uses this appendix, PTs will be incorrectly denied access to their own membership data.

**7. Impact on Database:** None.

**8. Impact on API:** None — API endpoints use the actual middleware, not this appendix.

**9. Impact on AI Workflow:**
- **MODERATE:** The AI assistant's Permission Engine will deny PTs viewing their own membership data. This is currently not a critical flow (PTs don't primarily use the chat for membership queries) but it's wrong.

**10. Risk If Left Unresolved:**
- **MEDIUM:** When PTs use the AI assistant, membership queries will be incorrectly blocked. Workaround exists (manual web/app access). Low immediate impact but represents a trust problem in the AI system.

---

### MEDIUM-01: ADRs Reference Express 5 but Docs Recommend Express 4 LTS

**Affected Documents:**
- `docs/adr/ADR-002.md` — Title and decision: "Express 5 over NestJS/Fastify"
- `SYSTEM_ARCHITECTURE.md` — Section 9: "Express 5 beta (should pin to Express 4 LTS)"
- `DATABASE.md` — Line 8: "Mongoose 9 (→ 8 LTS planned)"
- `PROJECT_OVERVIEW.md` — Line 48: "Express | 5"

**1. Root Cause:** The ADR was written when Express 5 was the chosen path. Later analysis (code audit, SYSTEM_ARCHITECTURE) identified Express 5 beta stability risks and recommended downgrading to Express 4 LTS. The ADR was never updated to reflect this revised decision. Similarly for Mongoose.

**2. Why It Happened:** ADRs are point-in-time decisions. The downgrade recommendation was made in a later document (SYSTEM_ARCHITECTURE) without either updating the ADR or creating a new ADR to supersede it.

**3. Source of Truth:** The ADR represents the accepted decision. The SYSTEM_ARCHITECTURE represents a risk assessment. Until a new ADR is written or ADR-002 is amended, ADR-002 remains authoritative. **This needs a decision: stick with Express 5 or officially adopt Express 4 LTS.**

**4. Documents That Must Be Updated:**
- Either: `ADR-002.md` — Amend to note Express 4 LTS recommendation
- Or: Create `ADR-011: Express 4 LTS over Express 5 Beta` (superseding ADR-002)
- `PROJECT_OVERVIEW.md` — Update version if downgrade is decided
- `DATABASE.md` — Remove "planned downgrade" if staying on Mongoose 9, or finalize if downgrading

**5. Exact Modifications Required:**

**Option A — If downgrade to Express 4 LTS + Mongoose 8 LTS is confirmed:**
```
ADR-002.md: Add "Amended" section noting the risk mitigation decision
PROJECT_OVERVIEW.md: Change Express 5 → Express 4, Mongoose 9 → Mongoose 8
DATABASE.md: Change "(→ 8 LTS planned)" to "(downgraded to 8 LTS)"
```

**Option B — If staying on Express 5 + Mongoose 9:**
```
SYSTEM_ARCHITECTURE.md: Remove "should pin to Express 4 LTS" recommendation
DATABASE.md: Remove "(→ 8 LTS planned)" annotation
```

**6. Impact on Business Logic:** None — Express version doesn't affect business rules.

**7. Impact on Database:** Mongoose 9 has breaking changes in schema validation, query middleware execution, and TypeScript inference. Either way, database code must be compatible.

**8. Impact on API:** Express 5 has different error handling. Express 5 async route handlers automatically catch rejected promises (Express 4 doesn't). Version choice affects all error handling patterns.

**9. Impact on AI Workflow:** None.

**10. Risk If Left Unresolved:**
- **MEDIUM:** Developers may base new work on the wrong version assumptions. If Express 5 is actually deployed and has beta issues in production, the risk is higher. If Express 4 is deployed and docs say Express 5, developers will use APIs that don't exist in 4.

---

### MEDIUM-02: MEMBERSHIP_SYSTEM_ARCHITECTURE.md Overlap

**Affected Documents:**
- `docs/MEMBERSHIP_SYSTEM_ARCHITECTURE.md` — 32 KB of membership-specific architecture
- `docs/DATABASE.md` — Section 2.2: Membership collections
- `docs/STATE_MACHINES.md` — Section 1: Membership cycle state machine
- `docs/modules/membership.md` — Membership module documentation

**1. Root Cause:** MEMBERSHIP_SYSTEM_ARCHITECTURE.md was generated as a deep-dive document for the membership module before the standard module documentation structure was established. It overlaps with three other docs.

**2. Why It Happened:** This document predates the standardized docs/modules/ structure. It was likely the first deep-dive document before the full documentation framework was designed.

**3. Source of Truth:** The standard documentation files take precedence:
- Database schemas → `DATABASE.md`
- State machines → `STATE_MACHINES.md`
- Module docs → `docs/modules/membership.md`

**4. Documents That Must Be Updated:**
- Review MEMBERSHIP_SYSTEM_ARCHITECTURE.md for unique content not covered in standard docs
- If unique: keep as cross-reference, add links from standard docs
- If duplicate: reduce to a navigation/overview page pointing to standard docs

**5. Exact Modifications Required:**

**File: `MEMBERSHIP_SYSTEM_ARCHITECTURE.md`**
```
Add header: "This document provides a consolidated deep-dive into membership architecture.
For authoritative specifications, see: DATABASE.md (schemas), STATE_MACHINES.md (states),
BUSINESS_RULES.md (BR-MEM-*), docs/modules/membership.md (module overview)."

Review for contradictions:
- Compare membership_cycles schema fields against DATABASE.md
- Compare state transitions against STATE_MACHINES.md
- Remove or flag any conflicting content
```

**6-9. N/A** — Documentation cleanup only.

**10. Risk If Left Unresolved:**
- **MEDIUM:** If MEMBERSHIP_SYSTEM_ARCHITECTURE.md contains outdated or conflicting information, developers may reference it instead of the authoritative standard docs. This creates implementation drift.

---

### MEDIUM-03: Missing AI Sub-Documents

**Affected Documents:**
- `AI_ARCHITECTURE.md` — Appendix B (lines 609-613): References AI_INTENTS.md, VISION_PIPELINE.md, RAG_PIPELINE.md, STREAMING_API.md

**1. Root Cause:** AI_ARCHITECTURE.md was designed with references to detailed sub-system documents that were never generated. The appendix lists them as "Related Documents" implying they exist.

**2. Why It Happened:** The AI architecture document is comprehensive and assumes decomposition into sub-documents. The sub-documents were deferred during generation but the references were left in place.

**3. Source of Truth:** The content for these sub-systems is partially covered in AI_ARCHITECTURE.md and AI_WORKFLOW.md already. Decision: either create the sub-documents or remove the references.

**4. Documents That Must Be Updated:**
- `AI_ARCHITECTURE.md` — Appendix B

**5. Exact Modifications Required:**

**File: `AI_ARCHITECTURE.md` — Appendix B**
```
Change:  | AI INTENTS | ./AI_INTENTS.md | Detailed intent taxonomy and training data |
To:      | AI INTENTS | ./AI_ARCHITECTURE.md §5 | Intent classification (covered in Section 5) |

Change:  | VISION PIPELINE | ./VISION_PIPELINE.md | Image processing pipeline architecture |
To:      | VISION PIPELINE | ./AI_ARCHITECTURE.md §9 | Vision tools (covered in Section 9 Vision Tools) |

Change:  | RAG PIPELINE | ./RAG_PIPELINE.md | Vector search and knowledge base architecture |
To:      | RAG PIPELINE | ./AI_ARCHITECTURE.md §9 | RAG tools (covered in Section 9 RAG Tools) |

Change:  | STREAMING API | ./STREAMING_API.md | SSE API contract for streaming responses |
To:      | STREAMING API | ./AI_ARCHITECTURE.md §12 | Streaming UX States (covered in Section 12) |

Add note: "These sub-system documents are planned for a future phase. Until then, 
AI_ARCHITECTURE.md and AI_WORKFLOW.md serve as the authoritative references."
```

**6-9. N/A** — Documentation cleanup.

**10. Risk If Left Unresolved:**
- **LOW:** AI developers clicking these links will find dead references. The information exists in AI_ARCHITECTURE.md itself. Frustration but not blocking.

---

### MEDIUM-04: Business Blueprint Auth Description References Session Management

**Affected Documents:**
- `BUSINESS_BLUEPRINT.md` — Section 1 (line 45): "Auth: Authentication, authorization (RBAC), session management, OAuth, MFA"
- `ADR-003.md` — "JWT Bearer Tokens over Session-Based Auth"
- `SYSTEM_ARCHITECTURE.md` — Section 7: "JWT access tokens (15min) + refresh tokens (7d httpOnly cookie)"

**1. Root Cause:** The Auth module description in the blueprint lists "session management" as a responsibility. ADR-003 explicitly chose JWT OVER session-based auth. The phrase "session management" in the blueprint likely refers to "managing user sessions" (the concept) rather than "server-side session store" (the implementation). But it's ambiguous.

**2. Why It Happened:** "Session management" is a generic term. To a business analyst, JWT token management IS session management (tracking who is logged in). To an engineer, "session management" means express-session or similar server-side session store.

**3. Source of Truth:** `ADR-003` — JWT is the chosen auth mechanism, not server-side sessions.

**4. Documents That Must Be Updated:**
- `BUSINESS_BLUEPRINT.md` — Section 1 Auth row

**5. Exact Modifications Required:**

**File: `BUSINESS_BLUEPRINT.md` Section 1 (line 45)**
```
Change:  | **Auth** | Authentication, authorization (RBAC), session management, OAuth, MFA |
To:      | **Auth** | Authentication, authorization (RBAC), JWT token management, 
          OAuth (Google, Facebook), OTP verification, MFA |
```

**6-9. N/A** — Terminology clarification.

**10. Risk If Left Unresolved:**
- **LOW:** An engineer might implement express-session alongside JWT, duplicating auth mechanisms. The architecture docs and ADRs would override this, so risk is contained.

---

### MEDIUM-05: Passport Version Inconsistency

**Affected Documents:**
- `PROJECT_OVERVIEW.md` — Line 50: "Passport.js | 0.7"
- `README_FOR_AI.md` — Line 18: "Passport (Google, Facebook)" (no version)

**1. Root Cause:** Version was listed in one place but not another. Passport.js 0.7.x is the current major version line, but the actual version in package.json may differ.

**2. Why It Happened:** Inconsistent level of detail between the overview and the AI readme.

**3. Source of Truth:** `gym-backend/package.json` — the actual installed version.

**4. Documents That Must Be Updated:**
- Verify actual Passport version in package.json
- Update PROJECT_OVERVIEW.md if different
- Add version to README_FOR_AI.md tech stack table or remove version from PROJECT_OVERVIEW.md for consistency

**5. Exact Modifications Required:**

```
Option: Remove specific version numbers from PROJECT_OVERVIEW.md
and note "see package.json for exact versions" to prevent future drift.
This applies to all versioned dependencies in the table.
```

**6-9. N/A.**

**10. Risk If Left Unresolved:**
- **LOW:** Actual package.json is the source of truth. Documentation version drift is cosmetic.

---

### MEDIUM-06: Edge Cases vs Business Rules Cross-Reference Gaps

**Affected Documents:**
- `EDGE_CASES.md` — Edge cases EC-MEM-001 through EC-SYS-007

**1. Root Cause:** Some edge cases reference their related business rules, others don't. EC-MEM-001 (double refund) correctly references BR-MEM-005 and BR-MEM-006 but misses BR-PAY-001 (atomic transactions) and BR-PAY-002 (idempotency). The references were added inconsistently.

**2. Why It Happened:** Edge cases were generated module-by-module. The agent knew the module's rules but didn't always check cross-module rules.

**3. Source of Truth:** BUSINESS_RULES.md contains all rules. Each edge case should reference all relevant BR-xxx rules.

**4. Documents That Must Be Updated:**
- `EDGE_CASES.md` — Add BR-xxx references to edge cases that currently lack them

**5. Exact Modifications Required:**

**File: `EDGE_CASES.md` — specific entries**
```
EC-MEM-001: Add "Related rules: BR-MEM-005, BR-MEM-006, BR-PAY-001, BR-PAY-002"
EC-PAY-001: Add "Related rules: BR-PAY-002, BR-WAL-001" (currently none listed)
EC-WAL-004: Add "Related rules: BR-WAL-003, BR-PAY-001" (currently none listed)

Systematic fix: Ensure every edge case in EC-MEM-* through EC-SYS-* has a 
"Related rules" field listing applicable BR-xxx rules.
```

**6-9. N/A** — Documentation cross-reference improvement.

**10. Risk If Left Unresolved:**
- **LOW:** Developers implementing fixes for edge cases won't have a complete list of affected business rules. They might fix the edge case but miss a related rule. But the core business rules are enforced independently.

---

### LOW-01: API Standards JSON Key Convention

**Affected Documents:**
- `API_STANDARDS.md` — Section 10: "snake_case for JSON keys (matching MongoDB field names)"
- `DATABASE_CONVENTIONS.md` — Uses camelCase in schema examples
- `NAMING_CONVENTION.md` — Section on Database: "in Mongoose, use camelCase and map to snake_case"

**1. Root Cause:** Multiple conventions are described. NAMING_CONVENTION.md has the most nuanced view (camelCase in code, snake_case in DB). API_STANDARDS assumes snake_case matching MongoDB. The actual MongoDB convention in this project uses camelCase field names (which is standard Mongoose practice).

**2. Why It Happened:** The API standards were written assuming MongoDB fields are snake_case (common in SQL conventions). But Mongoose models in this codebase use camelCase.

**3. Source of Truth:** The actual codebase convention. Check existing API responses.

**4. Documents That Must Be Updated:**
- `API_STANDARDS.md` — Section 10

**5. Exact Modifications Required:**

**File: `API_STANDARDS.md` Section 10**
```
Change:  snake_case for JSON keys (matching MongoDB field names)
To:      camelCase for JSON keys (matching Mongoose schema field names).
         Note: MongoDB collections use snake_case by convention but Mongoose 
         automatically maps between camelCase model fields and collection fields.
```

**6-9. N/A** — Convention clarification.

**10. Risk If Left Unresolved:**
- **LOW:** Existing API responses already use one convention. New endpoints may use the other. Inconsistency within the API is confusing but not breaking.

---

### LOW-02: Currency Representation Not Authoritatively Documented

**Affected Documents:**
- `DATABASE_CONVENTIONS.md` — "No floating point for money — store integers"
- `BUSINESS_RULES.md` BR-PAY-005 — Uses integer VND amounts
- `DATABASE.md` — Various "price: Number — VND, no decimals"

**1. Root Cause:** Three documents mention integer VND but no single document has a "Currency Strategy" section defining it as the standard.

**2. Why It Happened:** Each document was generated with awareness of the integer-money rule but none was designated as the authority.

**3. Source of Truth:** All docs agree on integer VND. Just need to centralize.

**4. Documents That Must Be Updated:**
- `DATABASE_CONVENTIONS.md` — Add explicit "Currency Strategy" section

**5. Exact Modifications Required:**

**File: `DATABASE_CONVENTIONS.md`**
```
Add new section after Field Type Mapping:
"## Currency Strategy
- All monetary values are stored as integers in VND (no floating point).
- Example: 100,000 VND is stored as 100000.
- Frontend displays divide by 1 and format with locale.
- API transfers use integer values, not decimal strings.
- This applies to ALL price, amount, fee, balance, and cost fields."
```

**6-9. N/A** — Standardization.

**10. Risk If Left Unresolved:**
- **LOW:** Existing consensus exists. Centralizing it prevents future drift.

---

### LOW-03: Notification Module Doc vs Business Rules Naming

**Affected Documents:**
- `BUSINESS_RULES.md` — Section 8: Uses BR-NTF prefix
- `docs/modules/notification.md` — May use different internal naming

**1-10:** Minor cosmetic issue. Fix: Ensure docs/modules/notification.md references BR-NTF-001 through BR-NTF-003 explicitly.

---

### LOW-04: AI_WORKFLOW Permission Scopes Incomplete

**Affected Documents:**
- `AI_WORKFLOW.md` — Appendix B

**1. Root Cause:** The appendix is an illustrative subset, not a complete mapping. STAFF and SELLER roles are omitted even though they have some permissions.

**2-10:** Related to HIGH-06. Fix together: expand Appendix B or replace with reference to PERMISSION_MATRIX.md.

---

### LOW-05: BUSINESS_RULES Appendix Truncated

**Affected Documents:**
- `BUSINESS_RULES.md` — Appendix: Rule Index table (section after line 1031)

**1. Root Cause:** The rule index table was being generated when the file was written and may have been truncated. The full rules exist in the body; the index is a convenience table.

**2. Why It Happened:** The rule index was appended as a summary. It may or may not be complete.

**3. Source of Truth:** The full rule definitions in the document body.

**4-10:** Verify the index is complete. If truncated, regenerate it from the rule headers.

---

## Part B: Documentation Migration Plan

### Execution Rules

1. **One file at a time.** Each file modification is a separate step.
2. **Verify after each change.** Read the file to confirm the change was applied correctly.
3. **No cascading changes.** If fixing one file reveals new issues in another, load that file and add a new step.
4. **All changes are documentation-only.** No application code is modified.
5. **Every modification must be explicit.** No "update as needed" — state exactly what to change.

---

### Phase 1: Critical Fixes (Execution Order: Top-Down)

All Critical issues MUST be resolved before any other modifications.

#### Step 1.1: Fix C-02 — BUSINESS_BLUEPRINT.md Section 7 Rule ID Table

| Field | Value |
|-------|-------|
| **File** | `docs/BUSINESS_BLUEPRINT.md` |
| **Reason** | Rule ID mappings are wrong. BR-BKG-002 and BR-PAY-002 misattributed. |
| **Dependencies** | None (just read BUSINESS_RULES.md) |
| **Modification** | Replace the entire Section 7 summary table (lines 220-244) with corrected mappings as detailed in C-02 analysis above. Verify all 35+ rule IDs against BUSINESS_RULES.md body text. |

#### Step 1.2: Fix C-03 — BUSINESS_BLUEPRINT.md Section 1 AI Module Description

| Field | Value |
|-------|-------|
| **File** | `docs/BUSINESS_BLUEPRINT.md` |
| **Reason** | AI module scope is wrong — describes predictive analytics instead of conversational assistant. |
| **Dependencies** | None (depends on AI_ARCHITECTURE.md which is correct) |
| **Modification** | Line 46-47: Change AI row from "Recommendation engine, churn prediction, health insights, automated scheduling" to "Conversational AI assistant (Gemini 2.5 Flash) — membership queries, booking help, nutrition advice, exercise guidance, policy questions, chitchat. Uses RAG + tool calling + trusted search." |

#### Step 1.3: Fix C-01 — Cancellation Window (3 files in sequence)

| Field | Value |
|-------|-------|
| **Files** | `docs/BUSINESS_BLUEPRINT.md`, `docs/STATE_MACHINES.md`, `docs/modules/booking.md` |
| **Reason** | Three different cancellation windows documented. Must align to one: 2 hours (BR-BKG-004). |
| **Dependencies** | C-02 must be completed first (it fixes the rule ID that points to cancellation policy) |
| **Modifications** | |
| | 1. `BUSINESS_BLUEPRINT.md` Section 2.2: Change "tiered deadlines (24h free, <24h penalty)" to "tiered deadlines (2h free, penalty within 2h)" |
| | 2. `BUSINESS_BLUEPRINT.md` Section 7: BR-BKG-004 row in new table should say "Free up to 2h before; 50% penalty within 2h" |
| | 3. `STATE_MACHINES.md` Line 130: Change "Within free-cancellation window (e.g. ≥ 6 h before)" to "At least 2 hours before session start" |
| | 4. `docs/modules/booking.md`: Add explicit cancellation window to Key Flows section: "Free cancellation up to 2 hours before session start. Cancellation within 2 hours incurs 50% penalty fee." |

---

### Phase 2: High Priority Fixes

#### Step 2.1: Fix H-01 — Membership State Naming (3 files)

| Field | Value |
|-------|-------|
| **Files** | `docs/BUSINESS_RULES.md`, `docs/DATABASE.md`, `docs/NAMING_CONVENTION.md` |
| **Reason** | State names use inconsistent casing. DATABASE.md is missing enum values. |
| **Dependencies** | None |
| **Modifications** | |
| | 1. `BUSINESS_RULES.md` BR-MEM-001: Add note: "Note: In pseudocode, status values are lowercase. In MongoDB, the field stores: 'pending_activation', 'active', 'frozen', 'expired', 'cancelled', 'refunded'." |
| | 2. `DATABASE.md` membership_cycles table: Change enum to include ALL states: `enum: pending_activation, active, frozen, expired, cancelled, refunded` |
| | 3. `NAMING_CONVENTION.md`: Add "State Values: In documentation, state values use lowercase matching MongoDB field values. In architecture diagrams, UPPER_SNAKE_CASE is used. Both refer to the same values." |

#### Step 2.2: Fix H-04 — Create Missing Documents (3 new files)

| Field | Value |
|-------|-------|
| **Files** | CREATE `docs/CURRENT_PHASE.md`, CREATE `docs/ROADMAP.md`, CREATE `docs/DEPLOYMENT_GUIDE.md` |
| **Reason** | Referenced as mandatory in README_FOR_AI, AI_CODING_CONSTITUTION, AI_DEVELOPMENT_WORKFLOW |
| **Dependencies** | None |
| **Modifications** | |
| | 1. Create `docs/CURRENT_PHASE.md` with skeleton content (status, known issues, active priorities) |
| | 2. Create `docs/ROADMAP.md` with skeleton content (milestones mapped to IMPLEMENTATION_ROADMAP.md phases) |
| | 3. Create `docs/DEPLOYMENT_GUIDE.md` with skeleton content (env vars, Docker, build, deploy, backup steps) |
| | Note: Full content for these files is a future task. Minimum viable: acknowledge existence with placeholder structure. |

#### Step 2.3: Fix H-05 — Update README_FOR_AI File Purpose Table

| Field | Value |
|-------|-------|
| **File** | `docs/README_FOR_AI.md` |
| **Reason** | Table shows all files as "Should exist" but they exist now |
| **Dependencies** | H-04 (need to know if new files were created) |
| **Modifications** | Update Section 5 status column for all files. Add entries for AI_ARCHITECTURE.md, AI_WORKFLOW.md, AI_CODING_CONSTITUTION.md, AI_DEVELOPMENT_WORKFLOW.md, IMPLEMENTATION_ROADMAP.md, DOCUMENTATION_MIGRATION_PLAN.md |

#### Step 2.4: Fix H-06 — Update AI_WORKFLOW Permission Scopes

| Field | Value |
|-------|-------|
| **File** | `docs/AI_WORKFLOW.md` |
| **Reason** | Permission scopes missing PT and other roles |
| **Dependencies** | None |
| **Modifications** | Update Appendix B: READ_OWN_MEMBERSHIP adds 'pt'; READ_ALL_CHECKINS changes 'trainer' to 'staff'; CREATE_BOOKING adds 'staff'; READ_ALL_MEMBERSHIPS adds 'staff'; MANAGE_USERS corrected to 'super_admin' only |

#### Step 2.5: Fix H-03 — Update BUSINESS_BLUEPRINT Membership Constraint

| Field | Value |
|-------|-------|
| **File** | `docs/BUSINESS_BLUEPRINT.md` |
| **Reason** | "1 active" constraint is incomplete — should include pending and frozen |
| **Dependencies** | Phase 1 changes to same file should be completed first |
| **Modifications** | Section 6 line 203: Expand constraint description to "At most 1 membership in active, pending_activation, or frozen status" |

#### Step 2.6: Fix H-02 — Same as C-01 (already addressed in Phase 1)

Already covered. No additional action needed.

---

### Phase 3: Medium Priority Fixes

#### Step 3.1: Fix M-01 — Resolve Express/Mongoose Version Decision

| Field | Value |
|-------|-------|
| **Files** | `docs/adr/ADR-002.md`, `docs/DATABASE.md`, `docs/PROJECT_OVERVIEW.md` |
| **Reason** | ADR says Express 5, SYSTEM_ARCHITECTURE recommends Express 4 LTS. Decision needed. |
| **Dependencies** | Requires human decision on framework versions |
| **Modifications** | After decision: either amend ADR-002 or create ADR-011. Update PROJECT_OVERVIEW.md and DATABASE.md to match. |

#### Step 3.2: Fix M-02 — Resolve MEMBERSHIP_SYSTEM_ARCHITECTURE.md Overlap

| Field | Value |
|-------|-------|
| **File** | `docs/MEMBERSHIP_SYSTEM_ARCHITECTURE.md` |
| **Reason** | May contain duplicate or conflicting content with standard docs |
| **Dependencies** | Phase 1 changes to membership docs |
| **Modifications** | Review for conflicts. Add cross-reference header. Flag duplicates. |

#### Step 3.3: Fix M-03 — Fix AI_ARCHITECTURE Appendix B Broken Links

| Field | Value |
|-------|-------|
| **File** | `docs/AI_ARCHITECTURE.md` |
| **Reason** | References non-existent files (AI_INTENTS.md, VISION_PIPELINE.md, etc.) |
| **Dependencies** | None |
| **Modifications** | Update Appendix B links to point to AI_ARCHITECTURE sections or add "planned" note |

#### Step 3.4: Fix M-04 — Fix Auth Description in Blueprint

| Field | Value |
|-------|-------|
| **File** | `docs/BUSINESS_BLUEPRINT.md` |
| **Reason** | "Session management" misleading — should say "JWT token management" |
| **Dependencies** | Phase 1 changes to same file should be completed first |
| **Modifications** | Section 1 Auth row: Replace "session management" with "JWT token management" |

#### Step 3.5: Fix M-05 — Verify Passport.js Version

| Field | Value |
|-------|-------|
| **Files** | `docs/PROJECT_OVERVIEW.md`, `docs/README_FOR_AI.md` |
| **Reason** | Passport version may be incorrect in docs |
| **Dependencies** | Need to check actual package.json |
| **Modifications** | Verify version and update or remove version specificity |

#### Step 3.6: Fix M-06 — Add BR-xxx References to EDGE_CASES

| Field | Value |
|-------|-------|
| **File** | `docs/EDGE_CASES.md` |
| **Reason** | Cross-references to business rules are incomplete |
| **Dependencies** | Phase 1 (ensures rule IDs are correct) |
| **Modifications** | Add "Related rules" field to edge cases that lack it. Verify existing references. |

---

### Phase 4: Low Priority Fixes

#### Step 4.1: Fix L-01 — API Standards JSON Key Convention

| Field | Value |
|-------|-------|
| **File** | `docs/API_STANDARDS.md` |
| **Reason** | snake_case vs camelCase convention needs clarification |
| **Dependencies** | None |
| **Modifications** | Section 10: Clarify camelCase for JSON matching Mongoose conventions |

#### Step 4.2: Fix L-02 — Add Currency Strategy to DATABASE_CONVENTIONS

| Field | Value |
|-------|-------|
| **File** | `docs/DATABASE_CONVENTIONS.md` |
| **Reason** | Currency strategy implicit but not centralized |
| **Dependencies** | None |
| **Modifications** | Add "Currency Strategy" subsection |

#### Step 4.3: Fix L-03 — Update Notification Module Doc with BR-NTF References

| Field | Value |
|-------|-------|
| **File** | `docs/modules/notification.md` |
| **Reason** | Business Rules section doesn't reference BR-NTF rules |
| **Dependencies** | None |
| **Modifications** | Add explicit BR-NTF-001 through BR-NTF-003 references |

#### Step 4.4: Fix L-04 — Expand AI_WORKFLOW Permission Scopes

| Field | Value |
|-------|-------|
| **File** | `docs/AI_WORKFLOW.md` |
| **Reason** | Appendix B incomplete |
| **Dependencies** | Step 2.4 (same file, don't duplicate work) |
| **Modifications** | Covered in Step 2.4 |

#### Step 4.5: Fix L-05 — Verify BUSINESS_RULES Appendix Completeness

| Field | Value |
|-------|-------|
| **File** | `docs/BUSINESS_RULES.md` |
| **Reason** | Rule index may be truncated |
| **Dependencies** | None |
| **Modifications** | Read the full appendix. If incomplete, regenerate from rule headers. |

---

## Summary

| Phase | Issues Fixed | Files Modified | Files Created |
|-------|-------------|---------------|--------------|
| **Phase 1** | C-01, C-02, C-03 | 4 | 0 |
| **Phase 2** | H-01, H-02, H-03, H-04, H-05, H-06 | 5 | 3 |
| **Phase 3** | M-01, M-02, M-03, M-04, M-05, M-06 | 6 | 0 |
| **Phase 4** | L-01, L-02, L-03, L-04, L-05 | 4 | 0 |
| **Total** | 20 issues | ~12 files | 3 files |

---

**Awaiting approval to begin Phase 1 execution.**
