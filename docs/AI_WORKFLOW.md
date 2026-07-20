# GymPro AI Assistant — Conversation Workflow

> **Document purpose:** Define the end-to-end flow from user message to final streamed response, covering routing, permissions, planning, execution, error handling, and retry policies.

---

## 1. Complete Conversation Flow

```
USER MESSAGE
    │
    ▼
SAFETY FILTER ── Blocked ──► "I cannot process this request."
    │ Passed
    ▼
GUEST CHECK ── No token ──► "Please login to use this feature."
    │ Authenticated
    ▼
INTENT CLASSIFIER ── < 0.85 confidence ──► Clarification prompt
    │ ≥ 0.85
    ▼
PERMISSION ENGINE ── Denied ──► "You don't have permission to access this information."
    │ Allowed
    ▼
PLAN BUILDER (ordered steps)
    │
    ▼
EXECUTION LOOP (for each step)
  ├── EMIT STATE TO CLIENT (SSE)
  ├── DB step     → query MongoDB → cache → on failure → fallback
  ├── RAG step    → embed query → vector search → rerank → compress
  ├── SEARCH step → Tavily → filter domains → format
  ├── VISION step → detect image type → OCR/analyze → extract data
  ├── TOOL step   → execute → format output
  └── MEMORY step → retrieve long-term → summarize
    │ All steps complete
    ▼
CONTEXT ASSEMBLY
    │
    ▼
LLM CALL (system prompt + context + user message + tool definitions)
    │
    ▼
OUTPUT FILTER (no PII, no fabrication, role-appropriate)
    │
    ▼
RESPONSE BUILDER (text + cards + links + suggestions + citations)
    │
    ▼
STREAM TO CLIENT
```

---

## 2. Detailed Step-by-Step per Request Type

### A. Membership Query — *"What's my plan?"*

| Stage | Detail |
|---|---|
| **Intent** | `membership_q` |
| **Permission** | `READ_OWN_MEMBERSHIP` (member, admin) |
| **Plan** | `[DB_QUERY(cycle), DB_QUERY(plan)]` |
| **DB 1** | `MembershipCycle.findOne({ memberId, status: 'active' })` |
| **DB 2** | `Plan.findById(cycle.currentPlanId)` |
| **Context** | user profile + active cycle + plan details (name, price, benefits, expiry) |
| **LLM** | Format membership info + suggest upgrades or renewals |
| **Response** | Text card with plan name, status, expiry date, and available upgrades |

### B. Booking a PT Session — *"Book PT Nguyen Van A for tomorrow 8am"*

| Stage | Detail |
|---|---|
| **Intent** | `booking_q` (entity extraction: PT name, date, time) |
| **Permission** | `CREATE_BOOKING` (member) |
| **Plan** | `[DB_QUERY(pt), DB_QUERY(membership), DB_QUERY(schedule), TOOL(booking)]` |
| **Validate** | Membership active, PT exists, PT is scheduled that day, time slot is free |
| **Execute** | Call booking service (writes to `Booking` collection) |
| **Response** | Booking confirmation card (PT name, time, location) or clear error reason |

### C. Nutrition Question — *"What should I eat before gym?"*

| Stage | Detail |
|---|---|
| **Intent** | `nutrition_q` |
| **Permission** | `general` (all roles) |
| **Plan** | `[RAG(nutrition), SEARCH_TRUSTED(supplements)]` |
| **RAG** | Vector search on internal nutrition guides and meal plans |
| **Search** | Tavily with domain whitelist (health.gov, WHO, NHS, Mayo Clinic) |
| **Context** | Top-3 RAG chunks + top-2 search results + medical disclaimer |
| **LLM** | Compile advice with inline citations |
| **Response** | Narrative answer with bullet-point suggestions and citation links |

### D. Check-in Stats — *"How many times this month?"*

| Stage | Detail |
|---|---|
| **Intent** | `checkin_q` |
| **Permission** | `READ_OWN_CHECKIN` (member) |
| **Plan** | `[DB_QUERY(checkins), TOOL(count)]` |
| **DB** | `CheckIn.find({ memberId, date: { $gte: startOfMonth } })` |
| **Tool** | Count result set length |
| **Response** | *"You've checked in X times this month. Your goal is Y — Z more to go!"* |

### E. General Chitchat — *"How are you?"*

| Stage | Detail |
|---|---|
| **Intent** | `chitchat` |
| **Permission** | none required |
| **Plan** | `[]` — no tool calls |
| **LLM** | Respond from model internal knowledge only |
| **Data** | No DB, no RAG, no search invoked |
| **Response** | Friendly conversational reply, no business logic |

---

## 3. Tool Calling Flow (LLM-requested tools)

When the LLM generates a `function_call` request mid-generation:

```
LLM GENERATION
    │
    ├── Normal token output (streamed)
    │
    └── function_call detected
            │
            ▼
    PAUSE response stream
            │
            ▼
    TOOL ROUTER ──► execute requested tool
            │               │
            │          ┌─────┴──────┐
            │          │ Success    │ Failure
            │          ▼            ▼
            │     Format       Format
            │     result       error
            │          │            │
            └──────────┴────────────┘
                        │
                        ▼
            INSERT tool result into conversation context
                        │
                        ▼
            LLM CONTINUES generation with tool result
                        │
                        ▼
            RESUME streaming to client
```

- The stream is **not** terminated; a `"tool_call"` event is emitted so the client can show a loading indicator.
- Tool results are appended to the message array as a `tool` role message.
- The LLM receives the full conversation history including the new tool result.

---

## 4. Error Handling per Step

| Step | Error | User-Facing Message |
|---|---|---|
| **Safety filter** | Content violation | *"I cannot process this request."* |
| **Auth / guest check** | Missing / invalid token | *"Please login to use this feature."* |
| **Permission engine** | Role lacks required scope | *"You don't have permission to access this information."* |
| **Intent classifier** | Confidence < 0.85 | *"Could you rephrase that? I want to make sure I understand correctly."* |
| **DB query** | Timeout / connection error | *"The system is currently slow. Please try again."* |
| **DB query** | Record not found | *"I couldn't find that information in our system."* |
| **RAG** | No relevant chunks | *"I don't have information about that in my knowledge base."* |
| **Search (Tavily)** | Network error / no results | *"I couldn't find trusted information online about that."* |
| **Vision** | Image unreadable / corrupt | *"I couldn't read this image clearly. Please try a clearer photo."* |
| **Tool execution** | Runtime exception | *"I encountered an error processing your request. Please try again or contact support."* |
| **LLM output filter** | PII / hallucination detected | Intercept and replace with *"I can't provide that information."* |
| **Unknown intent** | No classifier match | *"I'm not sure how to help with that. You can ask about membership, booking, nutrition, or check-ins."* |

---

## 5. Retry Policy

| Step | Max Retries | Backoff | Notes |
|---|---|---|---|
| **DB query** | 2 | 500 ms fixed | Only for transient errors (timeout, connection pool exhaustion) |
| **Search (Tavily)** | 1 | 1 000 ms fixed | One retry; if both fail, fall back to RAG-only |
| **Vision (OCR / analysis)** | 1 | Immediate | May be transient (GPU contention, file lock) |
| **External API** (booking, payment) | 2 | Exponential: 1 s, 2 s | 3 total attempts; circuit-breaker if > 30 % failures in 60 s window |
| **RAG vector search** | 0 | — | No retry; return empty result set |
| **LLM call** | 0 | — | No retry; fail fast and surface error |
| **Safety filter** | 0 | — | Blocked once = always blocked for that message |

**Retry flow diagram:**

```
EXECUTE STEP
    │
    ├── Success ──► continue
    │
    └── Failure
            │
            ▼
    Retries remaining?
    ├── Yes ──► wait(backoff) ──► retry
    └── No  ──► emit error ──► fallback
```

---

## Appendix A — Intent Classifier Outputs

| Intent Label | Example | Confidence Threshold |
|---|---|---|
| `membership_q` | *"What plan am I on?"* | ≥ 0.85 |
| `booking_q` | *"Book a session with Lan"* | ≥ 0.85 |
| `nutrition_q` | *"Best post-workout meal?"* | ≥ 0.85 |
| `checkin_q` | *"How often have I come this week?"* | ≥ 0.85 |
| `chitchat` | *"Good morning!"* | ≥ 0.85 |
| `unknown` | *"Translate this to French"* | — (fallback) |

## Appendix B — Permission Scopes

> Note: This is a simplified reference for the AI Permission Engine. For the authoritative, complete matrix, see [PERMISSION_MATRIX.md](./PERMISSION_MATRIX.md).

| Scope | Required Roles | Source |
|---|---|---|
| `READ_OWN_MEMBERSHIP` | `member`, `pt`, `admin`, `super_admin` | PERMISSION_MATRIX — Membership: View own |
| `CREATE_BOOKING` | `member`, `staff`, `admin`, `super_admin` | PERMISSION_MATRIX — Booking: Create |
| `READ_OWN_CHECKIN` | `member` | PERMISSION_MATRIX — Check-in: View own |
| `READ_ALL_CHECKINS` | `staff`, `admin`, `super_admin` | PERMISSION_MATRIX — Check-in: View any |
| `READ_ALL_MEMBERSHIPS` | `staff`, `admin`, `super_admin` | PERMISSION_MATRIX — Membership: View any |
| `MANAGE_USERS` | `super_admin` | PERMISSION_MATRIX — User Management: Assign roles, Delete user |
| `general` | `guest`, `member`, `pt`, `staff`, `seller`, `admin`, `super_admin` | PERMISSION_MATRIX — Content: View public |
