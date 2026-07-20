# AI Architecture — GymPro Gym Management System

> **Version:** 1.0.0  
> **Last Updated:** 2026-07-20  
> **Status:** Living Document

---

## 1. AI System Purpose

The AI assistant is the **brain** of the GymPro Gym Management System. It serves as the primary conversational interface for members, enabling them to inquire about and interact with their memberships, bookings, check-ins, workouts, payments, product purchases, and gym policies.

### Core Principles

| Principle | Rule |
|---|---|
| **Truthfulness** | The assistant NEVER hallucinates. Every claim is grounded in retrieved data. |
| **Privacy** | The assistant NEVER guesses, assumes, or fabricates user data. |
| **Honesty** | The assistant NEVER invents information. If data is unavailable, it says so explicitly. |
| **Safety** | The assistant refuses unsafe, harmful, or misleading advice — especially in fitness, nutrition, and medical contexts. |

---

## 2. Source Priority Policy

All user requests are fulfilled by consulting data sources in strict priority order. A source is only consulted if all higher-priority sources return empty or cannot satisfy the request.

### Priority Table

| Priority | Source | Description | Empty Result Behaviour |
|---|---|---|---|
| **1** | **Internal Database (MongoDB)** | Source of truth. All user data, memberships, bookings, check-ins, payments, products, workouts, profiles. | Return `"No data found."` |
| **2** | **Business Tools** | BMI/BMR/TDEE calculators, schedule lookups, booking availability checks, streak calculations, macro calculators. | Fall through to Priority 3 |
| **3** | **RAG (Vector Knowledge Base)** | FAQ, gym policies, exercise library, nutrition guides, how-to guides, membership plans overview. | Fall through to Priority 4 |
| **4** | **Vision (Image Analysis)** | InBody scan interpretation, food photo nutrition estimation, exercise form analysis, barcode/QR scanning, nutrition label OCR. | Fall through to Priority 5 |
| **5** | **Trusted Search (Tavily)** | Nutrition data, supplement facts, evidence-based medical guidelines, exercise technique references. **NEVER** used for user data, pricing, memberships, or internal business logic. | Fall through to Priority 6 |
| **6** | **LLM Internal Knowledge** | **NEVER used by default.** Only permitted for general fitness chitchat, motivational messages, or casual conversation. Every such response MUST include a disclaimer: `"This is general information and not personalised advice."` | N/A |

### Priority Enforcement

```mermaid
graph TD
    A[User Request] --> B{Priority 1: DB?}
    B -->|Has Data| C[Return DB Result]
    B -->|No Data| D{Priority 2: Business Tools?}
    D -->|Has Result| E[Return Tool Result]
    D -->|No Result| F{Priority 3: RAG?}
    F -->|Has Context| G[Return RAG Result]
    F -->|No Context| H{Priority 4: Vision?}
    H -->|Analysed| I[Return Vision Result]
    H -->|No Image| J{Priority 5: Tavily?}
    J -->|Found Info| K[Return Search Result]
    J -->|No Info| L{Priority 6: LLM Knowledge?}
    L -->|Chitchat| M[Return LLM Answer + Disclaimer]
    L -->|Not Chitchat| N[Return "I cannot find that information"]
```

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Web/Mobile)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI GATEWAY                                     │
│           (Auth verification, rate limiting, request validation)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI ORCHESTRATOR                                   │
│              (Central coordinator — manages conversation lifecycle)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTENT CLASSIFIER                                 │
│               (Classifies message → one of 14 intent types)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLANNER                                        │
│                (Builds ordered execution plan from intent)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PERMISSION ENGINE                                  │
│              (Verifies user role has access to requested data/tool)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTEXT BUILDER                                   │
│     (Assembles final LLM prompt: system + profile + history + data)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TOOL ROUTER                                      │
│              (Dispatches execution to correct subsystem)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│      DB ROUTER        │ │    RAG ROUTER     │ │    SEARCH ROUTER     │
│  (MongoDB queries)    │ │ (Vector KB search) │ │   (Tavily web search) │
└───────────────────────┘ └───────────────────┘ └───────────────────────┘
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│    VISION ROUTER      │ │   CALCULATOR      │ │   EXTERNAL TOOLS     │
│ (Image analysis)      │ │ (BMI/BMR/TDEE...) │ │       (None)          │
└───────────────────────┘ └───────────────────┘ └───────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM (Language Model)                                │
│       Primary: Gemini 2.5 Flash → Fallback chain (see Section 10)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSE BUILDER                                   │
│         (Formats LLM output, applies response policies, adds citations)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT FILTER                                     │
│     (PII redaction, profanity filter, safety check, content policy)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STREAMING LAYER                                    │
│             (SSE-based streaming with UX states — see Section 12)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Web/Mobile)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. AI Orchestrator

The **AI Orchestrator** is the central coordinator of every conversation. It owns the entire lifecycle of a user request from ingestion to response delivery.

### Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI ORCHESTRATOR LIFECYCLE                     │
├──────────────────────────────────────────────────────────────────┤
│  1. Receive             ──  Receive validated user message      │
│  2. Classify Intent     ──  Call Intent Classifier              │
│  3. Build Plan          ──  Call Planner → execution plan       │
│  4. Verify Permissions  ──  Call Permission Engine              │
│  5. Assemble Context    ──  Call Context Builder                │
│  6. Route & Execute     ──  Call Tool Router → execute tools    │
│  7. Invoke LLM          ──  Call LLM with assembled context     │
│  8. Build Response      ──  Call Response Builder               │
│  9. Filter & Stream     ──  Pass through Output Filter → Stream │
└──────────────────────────────────────────────────────────────────┘
```

### Responsibilities

| Responsibility | Description |
|---|---|
| **State Management** | Maintains conversation state across the lifecycle (intent, plan, context, permissions, retrieved data). |
| **Error Handling** | Catches errors from any subsystem. On failure: returns a graceful error message, logs the incident, and does NOT expose internal details to the user. |
| **Timeouts** | Enforces per-phase timeouts (classification: 3s, planning: 2s, DB queries: 10s, LLM: 15s). If a phase times out, it returns a partial or fallback response. |
| **Fallback Chain** | If the primary LLM fails (timeout/error), cascades through the fallback LLM chain (see Section 10). |
| **Logging & Audit** | Logs every step — intent, plan, permissions checked, data retrieved, LLM used, tokens consumed, response sent. All logs are auditable. |

---

## 5. Intent Classifier

The Intent Classifier takes the raw user message and maps it to one of 14 intent types. It operates with strict confidence thresholds and provides both primary and secondary intent predictions.

### Intent Types

| Intent | Description | Example Query |
|---|---|---|
| `membership_q` | Membership plan details, status, renewal, upgrades | "What plan am I on?" |
| `booking_q` | Class booking, cancellation, availability | "Book me into Yoga tomorrow" |
| `checkin_q` | Check-in history, count, streaks | "How many check-ins this month?" |
| `workout_q` | Workout logs, routines, progress | "Log my chest workout" |
| `payment_q` | Payment history, dues, wallet, invoices | "When is my next payment due?" |
| `nutrition_q` | Meal plans, nutrition advice, diet questions | "What should I eat post-workout?" |
| `exercise_q` | Exercise technique, form, muscles worked | "How do I deadlift properly?" |
| `schedule_q` | Gym hours, class schedules, trainer availability | "What time does the gym open?" |
| `product_q` | Product inquiries, purchases, supplements | "Do you sell protein bars?" |
| `profile_q` | Profile updates, preferences, settings | "Update my phone number" |
| `general_q` | Gym policies, FAQ, general information | "What is your cancellation policy?" |
| `chitchat` | Casual conversation, motivation, greetings | "Good morning!" |
| `unclear` | Ambiguous, incomplete, or nonsensical input | "asdf" or "stuff" |
| `vision_request` | Image analysis, photo upload, scan request | "Analyse this InBody scan" |

### Confidence Thresholds

| Tier | Confidence Range | Behaviour |
|---|---|---|
| **High Confidence** | ≥ 0.90 | Accept top intent immediately. |
| **Medium Confidence** | 0.85 – 0.89 | Accept top intent if > 0.10 ahead of runner-up. Otherwise, ask for clarification. |
| **Low Confidence** | < 0.85 | Do NOT accept. Return clarification prompt. |

### Clarification Prompt Template

```
I want to make sure I understand correctly. Did you mean:
  A) [Predicted Intent A]
  B) [Predicted Intent B]
  C) Something else?
```

---

## 6. Planner

The Planner converts the classified intent into a concrete, ordered **execution plan** — a list of steps the system must perform to fulfil the request.

### Plan Structure

Each plan is an ordered array of steps. Each step has:

```
{
  "step": 1,
  "type": "DB_QUERY" | "CALCULATE" | "RAG" | "SEARCH" | "VISION" | "BUSINESS_TOOL" | "LLM_ONLY",
  "target": "<specific data or tool>",
  "params": { ... },
  "optional": boolean,       // true = skip if prior step fails
  "depends_on": [step_ids]   // steps that must complete first
}
```

### Example Plans

| User Query | Classified Intent | Execution Plan |
|---|---|---|
| "How many check-ins this month?" | `checkin_q` | `[DB_QUERY(checkins, {month: current}), CALCULATE(count, {data: step1})]` |
| "What's a good pre-workout meal?" | `nutrition_q` | `[RAG(nutrition, {query: "pre-workout meal"}), SEARCH(supplements, {query: "pre-workout nutrition evidence"}, optional: true)]` |
| "Book me into yoga tomorrow" | `booking_q` | `[DB_QUERY(membership, {verify: active}), BUSINESS_TOOL(check_availability, {class: "yoga", date: tomorrow}), DB_QUERY(create_booking, ...)]` |
| "Analyse this InBody scan" | `vision_request` | `[VISION(inbody_scan, {image: attachment}), CALCULATE(bmi, {data: step1}), RAG(nutrition, {data: step1})]` |
| "What's your cancellation policy?" | `general_q` | `[RAG(policies, {query: "cancellation policy"})]` |
| "Hi, how are you?" | `chitchat` | `[LLM_ONLY({disclaimer: true})]` |

---

## 7. Permission Engine

The Permission Engine is invoked **before any data retrieval or tool execution**. It enforces the **Permission Matrix** (see [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md)) and ensures the requesting user's role is authorised.

### Behaviour

| Check Result | Action |
|---|---|
| **Granted** | Allow access. Return context with permission tag. |
| **Denied** | Return `"You don't have permission to access this."` Do NOT reveal what data exists or why access was denied. |
| **Partial** | Some data accessible, some denied. Return only permitted data with note: `"Some information is restricted."` |

### Permission Context

The Permission Engine returns a context object that is injected into the Context Builder:

```json
{
  "user_id": "abc123",
  "role": "member",
  "permissions": ["read_own_checkins", "read_own_payments", "book_classes"],
  "denied": ["read_other_profiles", "read_financial_reports"],
  "scope": "self_only"
}
```

### Denied Response Template

```
You don't have permission to access this.
```

No elaboration. No hints about what the data contains. No suggestions on how to gain access.

---

## 8. Context Builder

The Context Builder assembles the final prompt that is sent to the LLM. It merges data from multiple sources into a structured, deduplicated context object.

### Context Structure

```json
{
  "system_prompt": "...",
  "user_profile": { ... },
  "conversation_history": [ ... ],
  "retrieved_data": { ... },
  "permission_context": { ... },
  "current_intent": "checkin_q",
  "execution_plan": [ ... ]
}
```

### Components

| Component | Source | Details |
|---|---|---|
| **System Prompt** | Static definition | Role definition, anti-hallucination rules (Section 11), source priority policy (Section 2), output formatting rules. |
| **User Profile** | MongoDB (users collection) | Role, membership status, join date, preferences, timezone. Limited to permissions scope. |
| **Conversation History** | Session store | Last 10 messages (full). Older messages → summarised into a single "context summary" paragraph. |
| **Retrieved Data** | Tool Router results | DB query results, RAG chunks, search results, calculator outputs, vision analysis. Tagged with source priority level. |
| **Permission Context** | Permission Engine | What the user can and cannot see. Used to filter what data is included. |
| **Intent & Plan** | Intent Classifier + Planner | The current classification and execution plan. Used for LLM to understand the context. |

### Anti-Hallucination Prompt Segment

The following is appended to every system prompt:

```
You are an AI assistant for GymPro Gym Management System.

CRITICAL RULES — You MUST obey these without exception:

1. You NEVER make up information. You ONLY answer from retrieved data provided in this context.
2. If the "retrieved_data" section is empty or contains no relevant data, respond with:
   "I cannot find that information in your account or our knowledge base."
3. You NEVER guess or assume user attributes (age, weight, height, membership plan, etc.).
4. If you are unsure what the user means, ask a clarifying question.
5. You NEVER fabricate schedules, prices, policies, or user data.
6. For any information that comes from RAG, search, or vision (not the database), you MUST cite the source.
7. "I don't know" is always better than a wrong answer.
8. For general chitchat, add: "This is general information and not personalised advice."
```

---

## 9. Tool Router

The Tool Router receives the execution plan and dispatches each step to the appropriate subsystem. It executes steps in order, respecting dependencies and optionality.

### Tool Categories

#### DB Tools
| Tool | Collection/Endpoint | Purpose |
|---|---|---|
| `query_memberships` | `memberships` | Get/verify membership plans, status, expiry |
| `query_bookings` | `bookings` | List, create, cancel, check availability of bookings |
| `query_checkins` | `checkins` | Check-in history, counts, streaks |
| `query_wallet` | `wallet` | Wallet balance, transactions, top-ups |
| `query_payments` | `payments` | Payment history, invoices, dues, receipts |
| `query_products` | `products` | Product catalogue, pricing, stock, purchases |
| `query_workouts` | `workouts` | Workout logs, routines, exercise history |
| `query_profiles` | `users` | User profile data (name, contact, preferences) |
| `query_schedules` | `schedules` | Class schedules, trainer availability, gym hours |

#### Calculator Tools
| Tool | Purpose |
|---|---|
| `calculate_bmi` | Body Mass Index from height/weight |
| `calculate_bmr` | Basal Metabolic Rate (Mifflin-St Jeor) |
| `calculate_tdee` | Total Daily Energy Expenditure |
| `calculate_macros` | Macro nutrient split based on goals |
| `calculate_calories` | Calorie tracking and estimation |
| `calculate_streak` | Consecutive check-in/attendance streak |

#### Business Tools
| Tool | Purpose |
|---|---|
| `check_schedule` | Look up class/gym schedule for a date |
| `check_booking_availability` | Check if a class/spot has availability |
| `calculate_attendance_streak` | Days since last absence or consecutive days |
| `calculate_goal_progress` | Progress towards user-set fitness goals |

#### RAG Tools
| Tool | Vector Collection | Purpose |
|---|---|---|
| `search_faq` | `faq` | Frequently asked questions |
| `search_policies` | `policies` | Gym rules, cancellation policies, terms |
| `search_exercises` | `exercises` | Exercise library, form guides, muscle groups |
| `search_nutrition` | `nutrition` | Nutrition guides, meal plans, diet information |
| `search_guides` | `guides` | How-to guides, feature documentation |

#### Search Tools
| Tool | Engine | Purpose | Restrictions |
|---|---|---|---|
| `tavily_search` | Tavily API | Nutrition, supplements, guidelines, techniques | NEVER user data, pricing, memberships |

#### Vision Tools
| Tool | Capabilities | Purpose |
|---|---|---|
| `analyse_inbody` | OCR + interpretation | InBody scan result parsing and explanation |
| `analyse_food_photo` | Object detection + estimation | Estimate calories/macros from food image |
| `analyse_exercise_form` | Pose estimation | Analyse exercise form from video/image |
| `scan_barcode` | Barcode/QR decoding | Product lookup from barcode |
| `ocr_nutrition_label` | OCR | Extract data from nutrition facts labels |

#### External Tools

**None.** All external API calls are handled by the backend service layer. The AI Orchestrator communicates only with internal subsystems and the LLM provider.

---

## 10. LLM Provider Strategy

The AI Assistant uses a fallback chain of LLM providers to ensure high availability and low latency.

### Provider Chain

| Priority | Provider | Model | Purpose | Notes |
|---|---|---|---|---|
| **Primary** | Google | **Gemini 2.5 Flash** | All standard conversations | Low latency (< 2s), superior function calling, native tool-use support. |
| **Fallback 1** | Google | **Gemini 2.0 Flash** | Latency-sensitive fallback | Faster but less capable than 2.5 Flash. Used if 2.5 Flash is unavailable. |
| **Fallback 2** | Anthropic (via OpenRouter) | **Claude 3.5 Haiku** | Fallback | Used if both Gemini models fail. Excellent for nuanced responses. |
| **Fallback 3** | Groq (via OpenRouter) | **Llama 3 (70B)** | Last resort fallback | Open-source fallback. Fast inference via Groq hardware. |

### System Prompt (Common to All Providers)

```
You are the AI assistant for GymPro Gym Management System.
You help members manage their gym membership, bookings, check-ins, workouts, payments, and more.

CRITICAL RULES:
- You NEVER make up information. You ONLY answer from retrieved data.
- If no data is available, say "I cannot find that information."
- Do NOT guess user data (age, weight, height, membership details).
- Do NOT fabricate prices, schedules, policies, or user information.
- Cite sources for any non-database information.
- "I don't know" is better than a wrong answer.
- Use the provided context — do not rely on your training data for user-specific answers.
```

### Fallback Logic

```
1. Try Primary (Gemini 2.5 Flash)
   ├── Success → Return response
   └── Failure (timeout > 15s / error / empty response)
        └── 2. Try Fallback 1 (Gemini 2.0 Flash)
             ├── Success → Return response
             └── Failure
                  └── 3. Try Fallback 2 (Claude 3.5 Haiku via OpenRouter)
                       ├── Success → Return response
                       └── Failure
                            └── 4. Try Fallback 3 (Groq Llama 3 via OpenRouter)
                                 ├── Success → Return response
                                 └── Failure → Return error to user:

"Sorry, I'm having trouble connecting right now. Please try again in a moment."
```

### Streaming Support

All providers in the chain support SSE streaming. The streaming layer (Section 12) is provider-agnostic.

---

## 11. Anti-Hallucination Rules

These rules are **enforced at every layer** — from prompt construction through post-processing.

### Rule Definitions

| # | Rule | Enforcement Layer | Example Incorrect | Example Correct |
|---|---|---|---|---|
| 1 | **No data = "I cannot find..."** | Context Builder, Response Builder | "Your membership expires next month." | "I cannot find your membership information in our system." |
| 2 | **No guessing user attributes** | Permission Engine, Context Builder | "You weigh 75kg, right?" | "I don't have your weight on file. Would you like to update it?" |
| 3 | **No fabricating schedules/prices/policies** | Tool Router, LLM Prompt | "Yoga is at 6 PM every day." | Based on schedule data: "Yoga is at 6 PM on Mondays and Wednesdays." |
| 4 | **No interpreting ambiguous data** | Intent Classifier, Response Builder | "Your check-in count is probably around 10." | "I found 12 check-ins this month. Is that what you were looking for?" |
| 5 | **No using LLM knowledge when DB should answer** | Source Priority Policy, Context Builder | "The premium plan costs $50." (from training data) | "Your current plan is Premium, priced at $49.99/month." (from DB) |
| 6 | **Citations required for non-DB information** | Response Builder | "Deadlifts work your hamstrings." | "Deadlifts work your hamstrings. [Source: Exercise Library]" |
| 7 | **"I don't know" is better than wrong answer** | LLM Prompt, Output Filter | "I think the gym opens at 5 AM." | "I don't have that information. Please check our schedule page or contact the front desk." |
| 8 | **Confidence thresholds on ALL retrieval** | Intent Classifier, RAG Router, Search Router | Returning low-confidence RAG result as fact | Filter out results below confidence threshold (0.70). Say "I'm not entirely sure, but..." |

### Enforcement Points

```
┌─────────────────────────────────────────────────────────┐
│                   ENFORCEMENT MATRIX                     │
├───────────────┬─────────────────────────────────────────┤
│ Layer         │ Rules Enforced                          │
├───────────────┼─────────────────────────────────────────┤
│ Intent Classi.│ 4 (ambiguity threshold)                 │
│ Planner       │ 3 (no plan for unavailable data)        │
│ Permission    │ 2 (no guessing user attributes)         │
│ Context Bldr. │ 1, 2, 5 (prompt construction)           │
│ LLM Prompt    │ 1, 2, 3, 4, 5, 7, 8 (explicit rules)  │
│ Tool Router   │ 3, 8 (confidence thresholds)            │
│ Response Bldr.│ 1, 3, 6, 7 (formatting, citations)     │
│ Output Filter │ 2, 3, 4, 7 (post-processing scan)      │
└───────────────┴─────────────────────────────────────────┘
```

### Post-Processing Scan

The Output Filter runs a regex-based scan on the final response before sending to the client:

- `/\b(probably|maybe|perhaps|I think|I guess|might be|I assume)\b/i` → Flag for review. If found without supporting data context, rewrite or block.
- `/\b\d+(\.\d+)?\s*(kg|lbs|cm|inches|\$|£|€)\b/i` → Verify against retrieved data. If numeric values were not present in context, strip the response and regenerate with "I cannot find that information."

---

## 12. Streaming UX States

The AI Assistant streams real-time status updates to the client via **Server-Sent Events (SSE)**. Each state is emitted as a discrete event, providing the user with visibility into what the assistant is doing.

### State Machine

```
USER_MESSAGE → Understanding → Checking Permissions
    → Retrieving Database
      → Searching Knowledge
        → Searching Trusted Sources
          → Analysing Image
            → Running Calculations
              → Building Context
                → Thinking
                  → Writing Response
                    → COMPLETE
```

### State Definitions

| Emoji | State | Phase | Expected Duration | Description |
|---|---|---|---|---|
| 🧠 | **Understanding request** | Intent Classification | < 1s | Analysing the user's message to determine intent |
| 🔒 | **Checking permissions** | Permission Verification | < 500ms | Verifying the user has access to requested data |
| 📂 | **Retrieving database** | DB Queries | < 3s | Querying MongoDB for user data, memberships, bookings, etc. |
| 📚 | **Searching knowledge** | RAG / Vector Search | < 2s | Searching the vector knowledge base (FAQ, policies, guides) |
| 🌐 | **Searching trusted sources** | Web Search | < 5s | Searching trusted sources via Tavily |
| 🖼 | **Analysing image** | Vision Processing | < 10s | Processing uploaded image (InBody, food, barcode) |
| 🧮 | **Running calculations** | Calculator / Business Tools | < 1s | Running computations (BMI, BMR, TDEE, streaks, macros) |
| 🧩 | **Building context** | Context Assembly | < 500ms | Assembling all retrieved data into the LLM prompt |
| 🤖 | **Thinking** | LLM Call | < 15s | LLM processing the assembled context and generating response |
| ✍️ | **Writing response** | Response Building & Streaming | < 5s | Formatting, filtering, and streaming the final response |

### SSE Event Format

```
event: status
data: {"state": "understanding", "emoji": "🧠", "label": "Understanding request", "timestamp": "2026-07-20T10:30:00Z"}

event: status
data: {"state": "checking_permissions", "emoji": "🔒", "label": "Checking permissions", "timestamp": "2026-07-20T10:30:00.5Z"}

event: status
data: {"state": "retrieving_database", "emoji": "📂", "label": "Retrieving database", "timestamp": "2026-07-20T10:30:01Z"}

event: token
data: {"text": "Here", "timestamp": "2026-07-20T10:30:05Z"}

event: token
data: {"text": " is", "timestamp": "2026-07-20T10:30:05.1Z"}

event: token
data: {"text": " your", "timestamp": "2026-07-20T10:30:05.2Z"}

event: complete
data: {"state": "complete", "timestamp": "2026-07-20T10:30:06Z"}
```

### Streaming State Transitions

| Transition | Condition |
|---|---|
| `understanding → checking_permissions` | Intent classified with confidence ≥ 0.85 |
| `understanding → error` | Intent confidence < 0.85 after clarification loop |
| `checking_permissions → retrieving_database` | Permission granted, plan step is DB_QUERY |
| `checking_permissions → searching_knowledge` | Permission granted, plan step is RAG |
| `checking_permissions → analysing_image` | Permission granted, plan step is VISION |
| `checking_permissions → running_calculations` | Permission granted, plan step is CALCULATE |
| `checking_permissions → denied` | Permission denied |
| `any → error` | Timeout, system error, LLM failure after all fallbacks |
| `writing_response → complete` | Response fully streamed and acknowledged |

---

## Appendices

### A. Glossary

| Term | Definition |
|---|---|
| **LLM** | Large Language Model |
| **RAG** | Retrieval-Augmented Generation |
| **SSE** | Server-Sent Events |
| **Tavily** | Trusted web search API for AI agents |
| **InBody** | Body composition analysis scan |
| **BMR** | Basal Metabolic Rate |
| **TDEE** | Total Daily Energy Expenditure |
| **BMI** | Body Mass Index |
| **OpenRouter** | Unified API for multiple LLM providers |
| **MongoDB** | Primary database (source of truth) |

### B. Related Documents

| Document | Path | Description |
|---|---|---|
| PERMISSION MATRIX | `./PERMISSION_MATRIX.md` | Role-based access control matrix |
| AI INTENTS | `./AI_INTENTS.md` | Detailed intent taxonomy and training data |
| VISION PIPELINE | `./VISION_PIPELINE.md` | Image processing pipeline architecture |
| RAG PIPELINE | `./RAG_PIPELINE.md` | Vector search and knowledge base architecture |
| STREAMING API | `./STREAMING_API.md` | SSE API contract for streaming responses |
