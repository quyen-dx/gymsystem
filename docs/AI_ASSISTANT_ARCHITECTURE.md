# GymPro AI Assistant — Architecture Design

> **Status:** v4.0 (Final — FROZEN)  
> **Audience:** AI Engineers, Backend Team  
> **Principle:** MyViettel Assistant for GymPro. Receptionist, not ChatGPT.

---

## Table of Contents

0. [Chief AI Architect Review (v3.0)](#0-chief-ai-architect-review-v30)
1. [Core Philosophy](#1-core-philosophy)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Responsibilities](#3-component-responsibilities)
4. [Question Routing Flow](#4-question-routing-flow)
5. [Conversation Flow](#5-conversation-flow)
6. [Image Analysis Flow](#6-image-analysis-flow)
7. [Database Interaction Flow](#7-database-interaction-flow)
8. [Vector Search Flow](#8-vector-search-flow)
9. [Web Search Flow](#9-web-search-flow)
10. [Future Expansion Suggestions](#10-future-expansion-suggestions)
11. [FINAL ARCHITECTURE VALIDATION (v4.0)](#final-architecture-validation-v40--gate-check)

---

## 0. Chief AI Architect Review (v3.0)

> **Reviewer:** Chief AI Architect  
> **Date:** 2026-07-22  
> **Goal:** Optimize, don't redesign. Make it feel like MyViettel Assistant.

---

### 0.1 Architecture Score: 7.5/10

The foundation is solid. The optimizations below push it to 9/10.

---

### 0.2 What Should Be Kept

| # | Component | Verdict | Why |
|---|-----------|---------|-----|
| 1 | **Single endpoint** `POST /api/ai/chat` | ✅ KEEP | One door. Simple. All routing happens inside. |
| 2 | **Services over Models** | ✅ KEEP | Non-negotiable. walletService, membershipService, bookingService, etc. Must never call Mongoose directly. |
| 3 | **4 data sources only** | ✅ KEEP | Database, Vector, Web, Vision. Adding a 5th source means the architecture is wrong — one of the 4 should cover it. |
| 4 | **Read-only, no actions** | ✅ KEEP | Assistant answers. Existing pages execute. Prevents the #1 AI failure mode: replacing working features with unreliable AI. |
| 5 | **Conversation memory only** | ✅ KEEP | Session-scoped. Never caches personal data values. Always re-read from services. |
| 6 | **SSE streaming** | ✅ KEEP | Tokens appear as generated. Table stakes for chat UX. |
| 7 | **Domain whitelist/blacklist for Web** | ✅ KEEP | Critical for trust. Health info from Mayo Clinic, not Reddit. |
| 8 | **System prompt as primary control** | ✅ KEEP | Versioned. Role-specific. Git-tracked. This IS the product. |
| 9 | **Page deeplinks on every response** | ✅ KEEP | MyViettel secret sauce. Assistant shortcuts to real pages. |
| 10 | **Greeting + suggestion chips** | ✅ KEEP | First impression defines the relationship. "Receptionist," not "ChatGPT." |

---

### 0.3 What Should Be Removed

| # | Component | Verdict | Replacement |
|---|-----------|---------|-------------|
| 1 | **Keyword-based routing** | ❌ REMOVE | Let Gemini decide routing via function calling. It's better at Vietnamese slang, typos, and mixed questions than any keyword list. |
| 2 | **Separate "Understand" LLM call** | ❌ REMOVE | Combine classification + routing + response into one Gemini call with function calling. Cuts latency by 50%. |
| 3 | **Redis for conversation** | ❌ REMOVE | AiChatHistory (MongoDB) already stores messages. Load last 10 into LLM context. Gemini Flash has 1M token window — plenty. |
| 4 | **ChromaDB as separate infra** | ❌ REMOVE | Store embeddings in existing MongoDB VectorDocument collection. Compute cosine similarity in Node.js. For <2000 docs this is <10ms. Zero new infra. |
| 5 | **46 ChatResponseType cards** | ❌ REDUCE | Keep 6: text, info_card, list, analysis_card, action_link, suggestion_chips. 46 types means 46 rendering paths to maintain for types that will never surface. |
| 6 | **Tool Registry system** | ❌ REMOVE | The existing `src/modules/**/tool.js` pattern was designed for a multi-agent system. For a single assistant with function calling, it's overhead. Replace with 4 flat function files. |
| 7 | **Hybrid routing fallback** | ❌ REMOVE | Keyword rules + LLM fallback = two code paths, two sets of bugs. Use LLM function calling for everything. Consistent, testable, debuggable. |

---

### 0.4 What Should Be Simplified

| # | Current Design | Problem | Simplified Design |
|---|---------------|---------|-------------------|
| 1 | **4 pipeline stages** (Understand → Route → Fetch → Respond) | Each stage is a named subsystem implying complexity | **2 steps:** Build Context → Gemini Function Call. Gemini handles understand+route+respond. Backend only fetches. |
| 2 | **Separate Cloudinary upload for chat images** | Adds ~1-2s latency for transient analysis | **Base64 inline.** Resize client-side to 1024px. Send base64 directly to Gemini Vision. Only save to Cloudinary if user explicitly saves. |
| 3 | **ChromaDB ANN search** | Separate database for <1000 docs | **MongoDB cosine similarity.** Load embeddings into memory on startup (~6MB for 2000 docs). Compute dot product in Node.js. Re-index when VectorDocument changes. |
| 4 | **Per-request embedding generation** | Every vector query calls text-embedding-004 | **Acceptable.** Embedding generation is fast (~100ms) and necessary per unique query. Can add LRU cache for identical queries (rare). |
| 5 | **Named components everywhere** | Query Understander, Data Source Router, Data Fetcher, Response Generator — sounds like a microservice mesh | **One function: `AiAssistant.process()`** (~150 lines). Internally: context → LLM → functions → LLM → done. |
| 6 | **Two LLM calls per message** | Understand call + Response call | **One LLM call** with Gemini function calling. LLM outputs function calls, backend executes them, results go back to same conversation turn. |

---

### 0.5 Potential Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **LLM hallucinates data when service returns empty** | High | High | System prompt must include: "If function returns null/empty/error → say 'Tôi không tìm thấy.' NEVER invent data." |
| 2 | **Gemini API downtime** | Low | High | Prep OpenRouter fallback (Claude). Already have the API key. 15-minute failover config. |
| 3 | **Tavily rate limit exceeded** | Medium | Medium | Track usage. Implement exponential backoff. Fallback: "Tôi không thể tìm kiếm web lúc này." |
| 4 | **Vietnamese slang / dialect confusion** | Medium | Medium | Test with real member phrases. "Còn bao nhiêu buổi?" vs "Còn mấy buổi?" vs "Hết bao nhiêu buổi rồi?" — Gemini handles this better than keywords. |
| 5 | **System prompt drift** | High | High | Version prompts in Git. Never edit live. Test with a fixed set of 50 real questions before deployment. |
| 6 | **Cost overrun** | Medium | Medium | Gemini Flash is ~$0.075/1M tokens. Estimate: 1000 members × 5 questions/day × 2000 tokens avg = 10M tokens/day = $0.75/day. Acceptable. Set billing alert at $50/month. |
| 7 | **Image abuse (inappropriate uploads)** | Low | Medium | Gemini Vision has built-in safety filters. Add input classifier for NSFW detection before Vision call. |
| 8 | **Member asks admin-level question** | Low | Low | Role is in the system prompt. If member asks "Show me all members," database function limits to their own userId. Admin can access all. |

---

### 0.6 Performance Improvements

| # | Improvement | Current Latency | Target Latency | How |
|---|-------------|----------------|---------------|-----|
| 1 | **Single LLM call** instead of two | ~2000ms | ~1000ms | Gemini function calling handles classify+route+respond in one turn |
| 2 | **Remove Cloudinary roundtrip for images** | +1500ms | +0ms | Base64 inline to Gemini Vision. Cloudinary only for persistent storage |
| 3 | **MongoDB cosine similarity** instead of ChromaDB | ~50ms (ChromaDB) | ~10ms (in-memory) | Single Node.js process. No network call. No separate DB |
| 4 | **Remove Redis** for conversation | +20ms per request | +0ms | Load messages from MongoDB (already fetched anyway) |
| 5 | **Parallel function execution** | Sequential | Parallel | Database + Vector + Web can run simultaneously when independent |
| 6 | **LRU cache for embeddings** | ~100ms per query | ~5ms (cache hit) | Cache identical embedding requests (rare but free win) |
| 7 | **Memorize service schemas** | +50ms introspection | +0ms | hard-code service result shapes. No runtime discovery needed |

**Target: 80% of text-only queries complete in <2 seconds.**

---

### 0.7 Security Improvements

| # | Issue | Fix |
|---|-------|-----|
| 1 | **No prompt injection guard in current design** | Add input validator: detect "ignore previous instructions," "system prompt," "you are now DAN." Strip or reject. Add `[USER_MESSAGE]` / `[/USER_MESSAGE]` boundary tags in the prompt. |
| 2 | **userId injection is implicit** | **Make it explicit.** Every database function receives `userId` from the server, never from the LLM. LLM can ask for wallet, but the function signature is `getWallet(userId: string)` where userId is injected server-side. |
| 3 | **No image content filtering before Vision** | Add client-side and server-side check: image dimensions > 10px, file signature matches extension. Gemini has safety filters but defense in depth. |
| 4 | **No rate limiting per tool** | Add: 5 vision queries/hour per user (GPU cost). 20 web searches/minute per user (API cost). Database reads use global user rate limit. |
| 5 | **System prompt exposed in error messages** | Never include system prompt in logs or error responses. Log only: intent, sources used, latency, error type. |
| 6 | **No PII scrubbing on responses** | Add post-processing: scan response for patterns matching other users' data (email, phone, ID numbers). Strip before sending. Should never happen (services scope by userId), but defense in depth. |
| 7 | **Membership/health data in logs** | Sanitize: wallet balance → `[REDACTED]`, membership expiry → `[REDACTED]`. Log structure, not values. |

---

### 0.8 Conversation Improvements

| # | Issue | Fix |
|---|-------|-----|
| 1 | **30-min Redis TTL for session** | Remove Redis entirely. Store `lastTopic` and `lastEntities` as fields on AiChatHistory document. Read on next request. Simpler. Persistent across browser restarts. |
| 2 | **Memory tracks "8 sessions" as entity value** | Do NOT store data values in context. Store only: `lastTopic = "pt_booking"`. On follow-up "When do they expire?", re-query bookingService. Entity reference is structural, not a data cache. |
| 3 | **No explicit reference resolution** | Add to system prompt: "If the user uses pronouns (they, it, that, those), resolve from the previous message topic." Example: "they" → lastTopic. Gemini handles this natively. |
| 4 | **No topic-switching awareness** | Add to system prompt: "If the user changes topic abruptly, drop the previous context and start fresh." Avoids the "still talking about wallet when user asked about membership" problem. |
| 5 | **No conversation summary for long threads** | After 15 messages, include a 1-sentence summary of the last 5 messages in the context instead of raw messages. Saves tokens, keeps focus. |
| 6 | **Follow-up suggestions are static chips** | Let LLM generate 2-3 dynamic suggestions per response based on context. "You asked about wallet → suggest: 'Lịch sử giao dịch?' 'Cách nạp tiền?'" Feels more intelligent than static chips. |

---

### 0.9 UX Improvements

| # | Issue | Fix |
|---|-------|-----|
| 1 | **Widget shows nothing on first open** | Show: "Xin chào 👋 Tôi có thể giúp gì cho bạn?" + 6 suggestion chips + subtle typing animation to indicate "I'm ready." |
| 2 | **No "thinking" state** | Show "Đang tra cứu..." with a 3-dot animation during function execution. Users abandon chats without visual feedback in <1 second. |
| 3 | **No deeplinks defined in architecture** | Every response that references existing data should include a clickable `[Xem chi tiết →]` that navigates to the React route. Wallet → /wallet. Membership → /membership. Booking → /pt-booking. |
| 4 | **No distinction between "found" and "not found"** | Visually differentiate: green check + data for found. Gray text + "Không tìm thấy..." for not found. Don't make users guess whether the assistant is still loading or has given up. |
| 5 | **Image analysis has no progress** | Show "Đang tải ảnh..." → "Đang phân tích..." → result. Three states, three visual indicators. |
| 6 | **No error recovery** | "Có lỗi xảy ra. Bạn muốn thử lại?" with a [Thử lại] button. Don't leave users stranded. |
| 7 | **Chat widget competes with page content** | Floating button bottom-right. Opens as a 380px panel overlay. Doesn't push page content. Mobile: full-width bottom sheet. |
| 8 | **No "new session" button** | Add subtle "Xóa hội thoại" at the top of the chat panel. Clears context, starts fresh. Users expect this. |
| 9 | **Suggestion chips are one-time use** | After user clicks a chip or types, replace static greeting chips with dynamic LLM-generated suggestions. Static chips are for onboarding only. |
| 10 | **No offline/inactive indicator** | If all data sources timeout, show "Trợ lý đang bận, vui lòng thử lại sau." Don't show a spinning loader forever. |

---

### 0.10 Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GYMPRO WEBSITE (React)                           │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  All existing pages work exactly as before:                       │   │
│  │  Membership | Wallet | PT Booking | Orders | Workout | Health...  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     AiChatWidget                                   │   │
│  │                     (bottom-right floating)                       │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────┐                    │   │
│  │  │  Xin chào 👋                              │                    │   │
│  │  │  Tôi có thể giúp gì cho bạn?              │                    │   │
│  │  │                                            │                    │   │
│  │  │  [🏋 Gói tập] [📅 Lịch PT] [💰 Ví]       │                    │   │
│  │  │  [🛒 Đơn hàng] [🥗 Dinh dưỡng] [❤️ SK]   │                    │   │
│  │  │                                            │                    │   │
│  │  │  ───────────────────────────────────       │                    │   │
│  │  │                                            │                    │   │
│  │  │  Bạn: "Còn bao nhiêu buổi PT?"             │                    │   │
│  │  │                                            │                    │   │
│  │  │  🏋️ AI: Bạn còn 5 buổi PT.                 │                    │   │
│  │  │        Buổi tiếp theo:                      │                    │   │
│  │  │        Thứ 4, 24/07, 9:00 với HLV Nam       │                    │   │
│  │  │        [Xem lịch →]                          │                    │   │
│  │  │                                            │                    │   │
│  │  │        [Lịch sử buổi tập] [Đặt thêm]        │                    │   │
│  │  │                                            │                    │   │
│  │  │  ───────────────────────────────────       │                    │   │
│  │  │  ⌨ [Nhập tin nhắn...]            📎 🎤     │                    │   │
│  │  └──────────────────────────────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                            JWT Bearer Token
                            POST /api/ai/chat
                            { message, images?, sessionId? }
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Express 5)                            │
│                                                                           │
│  POST /api/ai/chat                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ Middleware:                                                         │   │
│  │ 1. authenticate (JWT → req.user)         ← existing, re-used       │   │
│  │ 2. rateLimit (per role, sliding window)  ← existing pattern        │   │
│  │ 3. validateInput (≤4096 chars, ≤3 imgs) ← existing pattern        │   │
│  │ 4. detectPromptInjection (reject/clean)  ← NEW                     │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Controller:                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ const response = await AiAssistant.process({                       │   │
│  │   userId:    req.user._id,                                         │   │
│  │   role:      req.user.role,                                        │   │
│  │   name:      req.user.name,                                        │   │
│  │   message:   req.body.message,                                     │   │
│  │   images:    req.body.images,        // base64[]                   │   │
│  │   sessionId: req.body.sessionId,                                   │   │
│  │   language:  detectLanguage(req.body.message)                      │   │
│  │ })                                                                 │   │
│  │                                                                    │   │
│  │ // Stream via SSE                                                   │   │
│  │ for await (const chunk of response) {                              │   │
│  │   res.write(`data: ${JSON.stringify(chunk)}\n\n`)                  │   │
│  │ }                                                                  │   │
│  │ res.end()                                                          │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       AI ASSISTANT CORE                                   │
│                                                                           │
│  AiAssistant.process() — The only new function. ~150 lines.              │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 1: BUILD CONTEXT                                             │  │
│  │                                                                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │  │
│  │  │ Load last 10    │  │ Load system     │  │ Define function  │   │  │
│  │  │ messages from   │  │ prompt from     │  │ declarations    │   │  │
│  │  │ AiChatHistory   │  │ Git-versioned   │  │ (4 data sources)│   │  │
│  │  │ (MongoDB)       │  │ prompt file     │  │                 │   │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘   │  │
│  │           └────────────────────┼─────────────────────┘              │  │
│  │                                ▼                                    │  │
│  │                     Gemini messages array                           │  │
│  │                     (system + history + user)                       │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 2: GEMINI FUNCTION CALLING                                   │  │
│  │                                                                     │  │
│  │  Single API call to Gemini 2.5 Flash. LLM decides:                 │  │
│  │  - What the user wants                                             │  │
│  │  - Which functions to call                                         │  │
│  │  - What parameters to pass                                         │  │
│  │                                                                     │  │
│  │  Returns: [{ functionCall: "databaseQuery", args: { domain:        │  │
│  │             "wallet" } }, ...]                                      │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 3: EXECUTE FUNCTIONS (parallel when independent)             │  │
│  │                                                                     │  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │  │
│  │  │ databaseQuery()  │ │ vectorQuery()    │ │ webQuery()       │   │  │
│  │  │                  │ │                  │ │                  │   │  │
│  │  │ userId INJECTED  │ │ Embed → cosine   │ │ Rewrite query    │   │  │
│  │  │ by server        │ │ search MongoDB   │ │ → Tavily API     │   │  │
│  │  │ (LLM can't       │ │ VectorDocument   │ │ → filter domains │   │  │
│  │  │  override)       │ │ collection       │ │                  │   │  │
│  │  │                  │ │                  │ │                  │   │  │
│  │  │ Calls existing   │ │ Top K = 5        │ │ Max 5 results    │   │  │
│  │  │ services:        │ │ Threshold ≥ 0.75 │ │                  │   │  │
│  │  │ - walletService  │ │                  │ │                  │   │  │
│  │  │ - memberService  │ │                  │ │                  │   │  │
│  │  │ - bookingService │ │                  │ │                  │   │  │
│  │  │ - orderService   │ │                  │ │                  │   │  │
│  │  │ - healthService  │ │                  │ │                  │   │  │
│  │  │ - etc.           │ │                  │ │                  │   │  │
│  │  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘   │  │
│  │           │                    │                    │              │  │
│  │  ┌────────┴────────────────────┴────────────────────┴─────────┐   │  │
│  │  │  visionQuery()  — ONLY if images present                    │   │  │
│  │  │  Base64 → Gemini Vision → structured analysis               │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  │                                                                     │  │
│  │  EMPTY RESULT HANDLING (per source):                                │  │
│  │  DB empty  → "Tôi không tìm thấy dữ liệu này."                    │  │
│  │  Vec empty → fallback to webQuery                                  │  │
│  │  Web empty → "Tôi không tìm thấy thông tin đáng tin cậy."         │  │
│  │  NEVER fabricate. NEVER guess. NEVER fill gaps.                    │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 4: LLM FORMATS RESPONSE                                      │  │
│  │                                                                     │  │
│  │  Function results go back to Gemini in the same conversation turn.  │  │
│  │  LLM produces:                                                      │  │
│  │  - Natural Vietnamese (or English) response                        │  │
│  │  - Page deeplink: "[Xem chi tiết →]" to relevant existing page     │  │
│  │  - 2-3 dynamic follow-up suggestions                               │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 5: POST-PROCESS                                              │  │
│  │                                                                     │  │
│  │  - Strip any medical diagnosis language (regex + LLM check)        │  │
│  │  - Add disclaimer if health/nutrition content detected             │  │
│  │  - Scan for PII leakage (other users' data) → strip                │  │
│  │  - Update AiChatHistory.lastTopic + lastEntities                    │  │
│  │  - Save messages to AiChatHistory (async, fire-and-forget)         │  │
│  │  - Log: latency per step, sources used, token count (observability) │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 0.11 Final Optimized Architecture (The tl;dr)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   ONE FUNCTION:    AiAssistant.process(userId, message, images?)     │
│                                                                        │
│   ONE ENDPOINT:    POST /api/ai/chat                                  │
│                                                                        │
│   ONE LLM CALL:    Gemini 2.5 Flash (function calling)                │
│                    Handles: classify + route + respond                 │
│                                                                        │
│   FOUR FUNCTIONS:  databaseQuery()  → walletService, etc.             │
│                    vectorQuery()    → MongoDB cosine similarity       │
│                    webQuery()       → Tavily API + domain filter       │
│                    visionQuery()    → Gemini Vision (base64)          │
│                                                                        │
│   ONE DATABASE:    MongoDB (existing)                                  │
│                    - Business data via services                        │
│                    - Vector embeddings in VectorDocument collection    │
│                    - Chat history in AiChatHistory collection          │
│                                                                        │
│   ONE SYSTEM       System prompt (versioned in Git)                    │
│   PROMPT:          Controls everything. This IS the product.          │
│                                                                        │
│   ZERO NEW INFRA:  No Redis. No ChromaDB. No new databases.           │
│                                                                        │
│   ~150 LINES:      AiAssistant.process() is the only new backend code. │
│                    Everything else already exists.                    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 0.12 Receptionist Checklist (Does It Feel Like MyViettel?)

```
┌──────────────────────────────────────────────────────────────────────┐
│  RECEPTIONIST BEHAVIOR            │  CURRENT   │  TARGET             │
├───────────────────────────────────┼────────────┼─────────────────────┤
│  Greets user warmly               │  ✅ Yes     │  ✅ "Xin chào 👋"  │
│  Shows what they can help with    │  ✅ Chips   │  ✅ Dynamic chips   │
│  Answers short and direct         │  ⚠ Varies   │  ✅ <3 sentences    │
│  Never makes up information       │  ⚠ Risk     │  ✅ Strict guard    │
│  Points to where to go next       │  ❌ Missing  │  ✅ [Xem chi tiết→] │
│  Remembers what you just discussed│  ✅ Memory   │  ✅ lastTopic field │
│  Says "I don't know" honestly     │  ❌ Missing  │  ✅ Explicit design │
│  Responds quickly (<2 seconds)    │  ⚠ 2-4s     │  ✅ <2s target      │
│  Works in Vietnamese natively     │  ✅ Yes      │  ✅ Vietnamese-first│
│  Handles follow-up questions      │  ✅ Yes      │  ✅ Context-aware   │
│  Never forces you to use AI       │  ✅ Yes      │  ✅ Widget optional │
│  Suggests related next steps      │  ⚠ Static    │  ✅ LLM-generated  │
└──────────────────────────────────────────────────────────────────────┘
```

### 0.13 Expansion Strategy (Zero Core Changes)

New capabilities are added as **new functions** registered with Gemini:

```
┌──────────────────────────────────────────────────────────────────────┐
│  FUTURE CAPABILITY   │  HOW TO ADD IT          │  CORE CHANGES       │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  Speech input        │  New function:          │  NONE               │
│                      │  speechToText(audio)    │  AiAssistant.process│
│                      │  → Web Speech API       │  unchanged.         │
│                      │  → Gemini STT           │  Just another fn.   │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  OCR / Document      │  New function:          │  NONE               │
│                      │  ocrRead(image/pdf)     │  Uses existing      │
│                      │  → Gemini Vision OCR    │  Vision pipeline.   │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  Calendar            │  New function:          │  NONE               │
│                      │  getCalendarEvents()    │  Calls existing     │
│                      │  → Google Cal API       │  bookingService.    │
│                      │  → bookingService       │  Same data.         │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  Maps / Location     │  New function:          │  NONE               │
│                      │  getGymLocation()       │  Static data.       │
│                      │  → Google Maps embed    │  Just returns URL.  │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  Smart Notifications │  Separate cron job:     │  NONE               │
│                      │  Check DB → push to     │  Not part of chat.  │
│                      │  existing Notification  │  Separate system.   │
│                      │  service                │                     │
├──────────────────────┼─────────────────────────┼─────────────────────┤
│  Multi-language      │  Detect language →      │  NONE               │
│                      │  load vi or en prompt   │  Prompt variant.    │
│                      │  Gemini already handles │  Same function.     │
│                      │  both languages         │                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Core Philosophy

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│   GymPro AI Assistant is NOT:                                     │
│                                                                    │
│   ✗ A general AI platform                                         │
│   ✗ A replacement for the website                                 │
│   ✗ A chatbot that does everything                                │
│   ✗ A multi-agent system                                          │
│   ✗ A new set of features                                         │
│                                                                    │
│   GymPro AI Assistant IS:                                         │
│                                                                    │
│   ✓ A helper that answers questions naturally                     │
│   ✓ A layer on top of existing modules                           │
│   ✓ A shortcut so users don't need to navigate menus             │
│   ✓ A single chat widget                                          │
│   ✓ Lightweight and practical                                     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 The Assistant's Only Job

```
                 ┌──────────────────────────┐
                 │     GYMPRO WEBSITE       │
                 │                          │
                 │  ┌────────────────────┐  │
                 │  │ Membership Page    │  │
                 │  │ Wallet Page        │  │
                 │  │ PT Booking Page    │  │
                 │  │ Workout Page       │  │
                 │  │ Nutrition Page     │  │
                 │  │ Shop Page          │  │
                 │  │ Orders Page        │  │
                 │  │ Health Page        │  │
                 │  │ Reports Page       │  │
                 │  └────────────────────┘  │
                 │                          │
                 │         ▲                │
                 │         │ reads data     │
                 │         │ from           │
                 │  ┌──────┴───────────┐    │
                 │  │   AI ASSISTANT   │    │
                 │  │                  │    │
                 │  │  💬 Chat Widget  │    │
                 │  │  "Ask me         │    │
                 │  │   anything"      │    │
                 │  └──────────────────┘    │
                 │                          │
                 └──────────────────────────┘

The website works exactly as before.
The assistant only reads data and answers questions.
It does NOT replace any existing page.
```

### 1.2 What the Assistant Answers vs What It Doesn't

```
─────────────────────────────────────────────────────────────────
  USER ASKS                         ASSISTANT DOES
─────────────────────────────────────────────────────────────────
  "My wallet balance?"         →    Read wallet from MongoDB
                                    Reply with balance number

  "When does my membership     →    Read membership from MongoDB
   expire?"                         Reply with expiry date

  "How many PT sessions        →    Read bookings from MongoDB
   left this week?"                 Reply with count

  "Refund policy?"             →    Search vector DB for policy
                                    Reply with relevant section

  "How much protein per day?"  →    Search web for guidelines
                                    Reply with researched answer

  "Analyze this meal photo"    →    Send to Vision API
                                    Reply with food breakdown

  "Compare Gold vs Platinum"   →    Read plans from MongoDB
                                    Search vector for features
                                    Reply with comparison
─────────────────────────────────────────────────────────────────

  USER ASKS                         ASSISTANT DOES NOT
─────────────────────────────────────────────────────────────────
  "Book PT tomorrow 9am"       →    ✗ Actions belong to existing UI
                                    ✓ Suggests: "Go to PT Booking page"

  "Buy Gold membership"        →    ✗ Actions belong to existing UI
                                    ✓ Explains: "Visit Membership page"

  "Pay my order"               →    ✗ Actions belong to existing UI
                                    ✓ Shows: order status from DB

  "Create workout plan"        →    ✗ Actions belong to existing UI
                                    ✓ Suggests workouts from guides
─────────────────────────────────────────────────────────────────

RULE: Assistant ANSWERS questions using existing data.
      It does NOT EXECUTE business operations.
      Users click through to existing pages for actions.
```

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             CLIENT                                        │
│                                                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │                    GymPro Website (React)                     │      │
│   │                                                               │      │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │      │
│   │   │ Member   │ │ PT       │ │ Wallet   │ │ Shop     │  ...  │      │
│   │   │ Page     │ │ Booking  │ │ Page     │ │ Page     │       │      │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────┘       │      │
│   │                                                               │      │
│   │                         ┌──────────────────────┐              │      │
│   │                         │   AiChatWidget       │              │      │
│   │                         │   (floating button   │              │      │
│   │                         │    bottom-right)     │              │      │
│   │                         │                      │              │      │
│   │                         │   💬 Ask anything... │              │      │
│   │                         └──────────────────────┘              │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                           │
│   Also: /ai-chat — Full page dedicated chat view                         │
│                                                                           │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
                        JWT (existing auth)
                        POST /api/ai/chat
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                     │
│                                                                           │
│   POST /api/ai/chat                                                      │
│                                                                           │
│   Middleware (all existing):                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ auth middleware → rate limiter → input validator → controller    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│   Controller does:                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ 1. Extract user from JWT (req.user._id, req.user.role)          │   │
│   │ 2. Pass message + user + attachments to AiAssistant             │   │
│   │ 3. Stream response back via SSE                                  │   │
│   │ 4. Save to AiChatHistory (async)                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI ASSISTANT CORE                                 │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      AiAssistant                                 │   │
│   │                                                                  │   │
│   │   Input: message + user context + images (optional)              │   │
│   │                                                                  │   │
│   │   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │   │
│   │   │ 1. UNDERSTAND │ → │ 2. ROUTE     │ → │ 3. FETCH         │   │   │
│   │   │               │   │              │   │                  │   │   │
│   │   │ - Intent      │   │ - Database?  │   │ - Call existing  │   │   │
│   │   │ - Entities    │   │ - Vector?    │   │   services       │   │   │
│   │   │ - References  │   │ - Web?       │   │ - Call vector DB │   │   │
│   │   │   to prior    │   │ - Vision?    │   │ - Call Tavily    │   │   │
│   │   │   conversation│   │ - Multiple?  │   │ - Call Gemini    │   │   │
│   │   └──────────────┘   └──────────────┘   └────────┬─────────┘   │   │
│   │                                                   │              │   │
│   │                                          ┌────────▼─────────┐   │   │
│   │                                          │ 4. RESPOND       │   │   │
│   │                                          │                  │   │   │
│   │                                          │ LLM formats raw  │   │   │
│   │                                          │ data into natural │   │   │
│   │                                          │ language reply   │   │   │
│   │                                          └──────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Conversation Memory                            │   │
│   │                                                                  │   │
│   │   Stores in Redis (per session):                                 │   │
│   │   - Last 10 messages                                             │   │
│   │   - Active topic (membership, wallet, booking...)                │   │
│   │   - Referenced entities (PT name, order ID, plan name...)       │   │
│   │                                                                  │   │
│   │   TTL: 30 minutes of inactivity                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES (4 only)                             │
│                                                                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│   │   DATABASE   │  │   VECTOR     │  │     WEB      │  │   VISION    │ │
│   │              │  │              │  │              │  │             │ │
│   │ Source:      │  │ Source:      │  │ Source:      │  │ Source:     │ │
│   │ MongoDB      │  │ ChromaDB     │  │ Tavily API   │  │ Gemini      │ │
│   │              │  │              │  │              │  │ Vision API  │ │
│   │ Via:         │  │ Via:         │  │ Via:         │  │ Via:        │ │
│   │ Existing     │  │ Embedding    │  │ HTTP call    │  │ HTTP call   │ │
│   │ Service      │  │ + ANN search │  │ + filter     │  │ + prompt    │ │
│   │ Layer        │  │              │  │              │  │             │ │
│   │              │  │              │  │              │  │             │ │
│   │ Reads:       │  │ Reads:       │  │ Reads:       │  │ Reads:      │ │
│   │ - Membership │  │ - FAQ        │  │ - Nutrition  │  │ - Images    │ │
│   │ - Wallet     │  │ - Policies   │  │ - Workout    │  │   uploaded  │ │
│   │ - Bookings   │  │ - Guides     │  │   science    │  │   by user   │ │
│   │ - Orders     │  │ - Gym Rules  │  │ - Sleep      │  │             │ │
│   │ - Workouts   │  │ - Exercises  │  │   research   │  │ Returns:    │ │
│   │ - Health     │  │ - Prompts    │  │ - Supplements│  │ - Body      │ │
│   │ - Nutrition  │  │              │  │ - Medical    │  │   analysis  │ │
│   │ - Products   │  │              │  │   references │  │ - Meal      │ │
│   │ - Payments   │  │              │  │              │  │   analysis  │ │
│   │ - Notif's    │  │              │  │              │  │ - Posture   │ │
│   └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

### 3.1 Client Layer

| Component | What It Does | What It Never Does |
|-----------|-------------|-------------------|
| **AiChatWidget** | Floating button bottom-right. Opens/closes chat panel. Shows message history, typing indicator, suggestion chips. Handles image upload. | Never processes AI logic. Never calls APIs directly (goes through api.ts). |
| **AiChatPage** | Full-page chat view at `/ai-chat`. Same widget, larger canvas. Optional for users who prefer it. | Never replaces existing pages. |
| **Suggestion Chips** | Pre-defined quick-access buttons: Membership, PT Booking, Wallet, Orders, Nutrition, Health, Check-in. Clicking sends a templated message. | Never generates suggestions. |
| **Message Renderer** | Renders text responses, cards (wallet balance, membership info), image analysis results inline. | Never modifies AI response structure. |

### 3.2 API Layer

| Component | What It Does | What It Never Does |
|-----------|-------------|-------------------|
| **POST /api/ai/chat** | Single endpoint. Receives message, attachments, optional locale. Authenticates via existing JWT middleware. Calls AiAssistant. Streams response. | Never accesses database directly. |
| **Auth Middleware** | Existing middleware (`protect`). Extracts `req.user` from JWT. Already built. | Never changed for AI assistant. |
| **Rate Limiter** | Per-user limit: 30 req/min for members, 60 for staff, 100 for admin. Uses existing rate limiter pattern. | Never blocks legitimate questions. |
| **Input Validator** | Validates message non-empty, ≤ 4096 chars. Validates image format (jpg/png/webp) and size (≤ 5MB). | Never interprets content. |

### 3.3 AiAssistant Core (The Only New Code)

| Component | What It Does | What It Never Does |
|-----------|-------------|-------------------|
| **Query Understander** | Takes user message + conversation history. Uses LLM (Gemini Flash) to classify: intent, entities, whether it references prior messages. Returns structured understanding. | Never accesses data. Never calls services. |
| **Data Source Router** | Based on intent + entities, decides which data source(s) to query. Simple rules-based routing with LLM fallback for ambiguous cases. | Never fetches data itself. |
| **Data Fetcher** | Calls the appropriate source(s): existing services for DB, ChromaDB for vectors, Tavily for web, Gemini Vision for images. Runs in parallel when multiple sources needed. Merges results. | Never interprets results. Never invents data. |
| **Response Generator** | Takes merged data + original question. Uses LLM to format into natural, friendly Vietnamese (or English) response. Cites source of every factual claim. | Never generates facts from thin air. Only rewrites data. |
| **Conversation Memory** | Short-lived Redis store. Keyed by session ID. Holds last 10 messages, current topic, referenced entities. TTL 30 min. | Never permanently caches personal data. |

### 3.4 Data Sources (Reuse Existing Infrastructure)

| Source | What It Uses | Responsibility |
|--------|-------------|----------------|
| **Database Source** | Calls existing **services** (membershipService, walletService, bookingService, orderService, workoutService, healthService, etc.). Never calls Mongoose models directly. | Read current user data. Always fresh. |
| **Vector Source** | ChromaDB with pre-embedded GymPro documents. Embedding model: Gemini text-embedding-004. | Search policies, guides, FAQs, gym rules. |
| **Web Source** | Tavily Search API. With domain whitelist (medical journals, health authorities) and blacklist (forums, social media, shops). | General fitness/nutrition/health knowledge. |
| **Vision Source** | Gemini 2.5 Flash Vision API. Images uploaded to Cloudinary first, URL passed to Vision. | Analyze body photos, meals, exercise form. |

---

## 4. Question Routing Flow

```
                         ┌─────────────────────────┐
                         │   USER SENDS MESSAGE    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   QUERY UNDERSTANDER    │
                         │                         │
                         │   LLM analyzes:         │
                         │   - What is the user    │
                         │     asking about?       │
                         │   - Entities mentioned  │
                         │   - References to       │
                         │     prior messages?     │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   DATA SOURCE ROUTER    │
                         │                         │
                         │   Rules-based routing:  │
                         └────────────┬────────────┘
                                      │
         ┌────────────────┬───────────┼───────────┬────────────────┐
         │                │           │           │                │
         ▼                ▼           ▼           ▼                ▼
   ┌──────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐   ┌──────────┐
   │ PERSONAL │    │  POLICY  │ │ GENERAL  │ │  IMAGE   │   │  MIXED   │
   │  DATA    │    │   FAQ    │ │ KNOWLEDGE│ │ ANALYSIS │   │          │
   └────┬─────┘    └────┬─────┘ └────┬─────┘ └────┬─────┘   └────┬─────┘
        │               │            │            │              │
        ▼               ▼            ▼            ▼              ▼
   ┌──────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐   ┌──────────┐
   │ DATABASE │    │  VECTOR  │ │   WEB    │ │  VISION  │   │ MULTIPLE │
   │  SOURCE  │    │  SOURCE  │ │  SOURCE  │ │  SOURCE  │   │ SOURCES  │
   └────┬─────┘    └────┬─────┘ └────┬─────┘ └────┬─────┘   └────┬─────┘
        │               │            │            │              │
        ▼               ▼            ▼            ▼              ▼
   Read from       Search        Search       Analyze      Fetch from
   existing        ChromaDB      Tavily       Gemini       2+ sources
   services        for similar   for info     Vision       in parallel
                   documents
```

### 4.1 Routing Decision Table

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER SAYS                        │  PRIMARY SOURCE  │  SECONDARY    │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Số dư ví tôi?"                  │  Database        │  —            │
│  (My wallet balance?)             │  (walletService) │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Gói tập khi nào hết hạn?"       │  Database        │  —            │
│  (When does membership expire?)   │  (membershipSvc) │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Còn bao nhiêu buổi PT?"         │  Database        │  —            │
│  (How many PT sessions left?)     │  (bookingService)│               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Đơn hàng gần đây?"              │  Database        │  —            │
│  (Recent orders?)                 │  (orderService)  │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Chính sách hoàn tiền?"          │  Vector          │  —            │
│  (Refund policy?)                 │  (policy docs)   │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Hướng dẫn tập Deadlift?"        │  Vector          │  Web          │
│  (Deadlift guide?)                │  (exercise lib)  │  (fallback)   │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Quy định phòng gym?"            │  Vector          │  —            │
│  (Gym rules?)                     │  (gym rules)     │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Nên ăn bao nhiêu protein?"      │  Web             │  —            │
│  (How much protein to eat?)       │  (nutrition)     │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Tác dụng phụ của creatine?"     │  Web             │  —            │
│  (Creatine side effects?)         │  (supplements)   │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Ngủ bao nhiêu là đủ?"           │  Web             │  —            │
│  (How much sleep is enough?)      │  (sleep science) │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  [Uploads body photo]              │  Vision          │  —            │
│  "Phân tích cơ thể tôi"           │  (body analysis) │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  [Uploads meal photo]              │  Vision          │  Web          │
│  "Bữa này bao nhiêu calo?"        │  (meal analysis) │  (nutrition)  │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "So sánh gói Gold và Platinum?"   │  Database        │  Vector       │
│                                    │  (planService)   │  (plan docs)  │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Chính sách hoàn tiền cho gói    │  Vector          │  Database     │
│   của tôi?"                        │  (refund policy) │  (my plan)    │
│  (Refund policy for my plan?)     │                  │               │
├────────────────────────────────────┼──────────────────┼───────────────┤
│  "Cân nặng 82kg. Nên ăn bao       │  Database        │  Web          │
│   nhiêu protein?"                  │  (healthService) │  (nutrition)  │
│  (I weigh 82kg. Protein intake?)  │                  │               │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 How Routing Works (Simple Decision Logic)

```
Step 1: Check for image attachment
        └─ Image present → Always include Vision source

Step 2: Check message content for keywords
        └─ "tôi", "của tôi", "my", "còn", "hiện tại"
           → User is asking about their own data → Database source

Step 3: Check for policy/rule/guide keywords
        └─ "chính sách", "quy định", "hướng dẫn", "cách", "làm sao"
           → User is asking about GymPro internal knowledge → Vector source

Step 4: Check for general knowledge keywords
        └─ "nên", "tốt nhất", "bao nhiêu", "tác dụng", "nghiên cứu"
           → User is asking general fitness questions → Web source

Step 5: If uncertain after Steps 1-4
        └─ Send to LLM for intent classification
        └─ LLM decides: database, vector, web, vision, or mixed
```

---

## 5. Conversation Flow

### 5.1 End-to-End Flow

```
─────────────────────────────────────────────────────────────────────────────
 USER ACTION                                 SYSTEM ACTION
─────────────────────────────────────────────────────────────────────────────

 1. Opens GymPro website
    (any page)
                                          │
                                          ▼
                              2. AiChatWidget renders as
                                 floating button bottom-right
                                 or full page at /ai-chat
                                          │
                                          ▼
                              3. Widget loads conversation
                                 history from AiChatHistory
                                 (last session, if any)
                                          │
                                          ▼
                              4. Widget shows greeting
                                 + suggestion chips:
                                 🏋 Membership  📅 PT Booking
                                 💳 Wallet      🛒 Orders
                                 🥗 Nutrition   ❤️ Health
                                          │
                                          ▼
 5. User types "Số dư ví
    của tôi bao nhiêu?"
    or clicks 💳 Wallet chip
                                          │
                                          ▼
                              6. POST /api/ai/chat
                                 Authorization: Bearer <JWT>
                                 Body: {
                                   message: "Số dư ví...",
                                   sessionId: "sess_abc"
                                 }
                                          │
                                          ▼
                              7. Auth middleware verifies JWT
                                 → req.user = { _id, role, name }
                                          │
                                          ▼
                              8. AiAssistant.understand()
                                 LLM: "intent=wallet_balance,
                                        entities=[wallet],
                                        personal=true"
                                          │
                                          ▼
                              9. AiAssistant.route()
                                 → Database source
                                 → walletService.getByUserId
                                          │
                                          ▼
                              10. DataFetcher.fetch()
                                  walletService.findByUserId(uid)
                                  → { balance: 500000, points: 120 }
                                          │
                                          ▼
                              11. ResponseGenerator.generate()
                                  LLM: "Số dư ví của bạn hiện
                                        là 500.000 VND. Bạn có
                                        120 điểm thưởng."
                                          │
                                          ▼
                              12. SSE stream chunks back
                                  chunk1: "Số dư ví "
                                  chunk2: "của bạn hiện là "
                                  chunk3: "500.000 VND. "
                                  chunk4: "Bạn có 120 điểm thưởng."
                                          │
                                          ▼
                              13. Widget displays response
                                  + source tag: [📊 Dữ liệu cá nhân]
                                          │
                                          ▼
                              14. Save to AiChatHistory (async)
                                  Update conversation memory (Redis)
                                          │
                                          ▼
 15. User reads response.
     User asks follow-up:
     "Còn điểm thưởng thì
      dùng làm gì?"
                                          │
                                          ▼
                              16. AiAssistant checks memory:
                                  Previous topic: wallet
                                  "điểm thưởng" refers to points
                                          │
                                          ▼
                              17. Router: Vector source
                                  Search: "điểm thưởng dùng để làm gì"
                                          │
                                          ▼
                              18. Response: "Điểm thưởng có thể
                                  dùng để đổi quà, giảm giá
                                  gói tập, hoặc mua sản phẩm..."
                                          │
                                          ▼
                              19. Updated memory:
                                  Last topic: wallet → points
─────────────────────────────────────────────────────────────────────────────
```

### 5.2 Conversation Memory (How "They" Refers to "PT Sessions")

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CONVERSATION MEMORY (Redis, TTL: 30 min)                               │
│                                                                          │
│  Key: session:<sessionId>                                               │
│                                                                          │
│  {                                                                       │
│    messages: [                      // Last 10 messages                  │
│      { role: "user",  content: "Tôi có 8 buổi PT.", time: "10:00" },   │
│      { role: "assistant", content: "Bạn có 8 buổi PT...", time:"10:00"},│
│      { role: "user",  content: "Khi nào hết hạn?", time: "10:01" }     │
│    ],                                                                    │
│                                                                          │
│    context: {                        // Derived context                  │
│      activeTopic: "pt_booking",                                         │
│      activeEntities: ["PT", "8 buổi", "PT sessions"],                   │
│      lastToolUsed: "database",                                          │
│      lastDataFetched: {                                                  │
│        type: "bookings",                                                │
│        summary: "8 sessions remaining"                                   │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  When user says "Khi nào hết hạn?":                                     │
│                                                                          │
│  1. Memory shows: activeTopic = "pt_booking"                            │
│  2. LLM understands: "hết hạn" refers to PT sessions                    │
│  3. Router: Database source (bookingService)                            │
│  4. Query: next expiry among user's PT sessions                         │
│  5. Response: "Buổi PT tiếp theo hết hạn vào 2026-08-15"               │
│                                                                          │
│  IMPORTANT: Memory tracks REFERENCE, not VALUE.                         │
│  Every follow-up question queries the database again.                   │
│  Memory says "topic is PT", not "user has 8 sessions".                  │
│  The number 8 is never cached — always re-read from DB.                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Conversation Memory Lifecycle

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  SESSION   │     │  ACTIVE    │     │  INACTIVE  │     │  EXPIRED   │
│  START     │ ──▶ │            │ ──▶ │            │ ──▶ │            │
│            │     │  Messages  │     │  No new    │     │  TTL       │
│  Create    │     │  added     │     │  messages  │     │  reached   │
│  Redis key │     │  to memory │     │  for 30min │     │  (30 min)  │
│            │     │            │     │            │     │            │
│  Load from │     │  Context   │     │  Keep in   │     │  Delete    │
│  AiChat    │     │  updated   │     │  Redis     │     │  from      │
│  History   │     │  each turn │     │  (wait)    │     │  Redis     │
└────────────┘     └────────────┘     └────────────┘     └────────────┘

WHAT PERSISTS LONG-TERM:            WHAT ONLY LIVES IN SESSION:
─────────────────────────           ───────────────────────────
AiChatHistory (MongoDB)             Active topic tracking
- Full message history              Entity references
- Per user, per date                Last tool used
- Retained 30 days                  Pending clarifications
                                    Current conversation flow
AiUserMemory (MongoDB)
- User preferences                  ⚠ Personal data values
- Top topics                          (wallet balance,
- Language preference                 membership expiry, etc.)
- Response style                      are NEVER stored in
                                      memory. Always re-read
                                      from database.
```

---

## 6. Image Analysis Flow

```
                         ┌─────────────────────────┐
                         │   USER UPLOADS IMAGE    │
                         │   + optional question   │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   PRE-FLIGHT CHECK      │
                         │                         │
                         │   - Format: jpg, png,   │
                         │     webp only           │
                         │   - Size: ≤ 5MB         │
                         │   - Strip EXIF (GPS)    │
                         │                         │
                         │   → Upload to Cloudinary│
                         │     bucket: gympro/     │
                         │     ai-chat/            │
                         │   → Get secure URL      │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   ROUTING:              │
                         │   Image present →       │
                         │   Always use Vision     │
                         │   source                │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │   UNDERSTAND CONTEXT    │
                         │                         │
                         │   What type of image?   │
                         │   - Body photo?         │
                         │   - Meal photo?         │
                         │   - Exercise form?      │
                         │   - Progress comparison?│
                         │                         │
                         │   Determined by:        │
                         │   - User's text message │
                         │   - Conversation context│
                         │   - Quick-action chip   │
                         └────────────┬────────────┘
                                      │
         ┌────────────────┬───────────┼───────────┬────────────────┐
         │                │           │           │                │
         ▼                ▼           ▼           ▼                ▼
   ┌──────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐   ┌──────────┐
   │  BODY    │    │   MEAL   │ │ EXERCISE │ │ PROGRESS │   │ UNKNOWN  │
   │ ANALYSIS │    │ ANALYSIS │ │  FORM    │ │ COMPARE  │   │          │
   └────┬─────┘    └────┬─────┘ └────┬─────┘ └────┬─────┘   └────┬─────┘
        │               │            │            │              │
        ▼               ▼            ▼            ▼              ▼
   ┌──────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐   ┌──────────┐
   │ Gemini   │    │ Gemini   │ │ Gemini   │ │ Gemini   │   │ Ask user │
   │ Vision   │    │ Vision   │ │ Vision   │ │ Vision   │   │ "Bạn     │
   │ + body   │    │ + meal   │ │ + posture│ │ + 2 imgs │   │ muốn phân│
   │ prompt   │    │ prompt   │ │ prompt   │ │ + compare│   │ tích gì?"│
   └────┬─────┘    └────┬─────┘ └────┬─────┘ └────┬─────┘   └──────────┘
        │               │            │            │
        ▼               ▼            ▼            ▼
   ┌──────────────────────────────────────────────────────┐
   │                GUARDRAIL CHECK                       │
   │                                                      │
   │   ✓ Strip any medical diagnosis language             │
   │   ✓ Add disclaimer:                                  │
   │     "Đây là ước tính AI, chỉ mang tính tham khảo.    │
   │      Không thay thế đánh giá chuyên môn."            │
   │   ✓ Never: diagnose disease, prescribe treatment,    │
   │     claim medical accuracy                            │
   └──────────────────────┬───────────────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────────────┐
   │                FORMAT RESPONSE                       │
   │                                                      │
   │   BODY:                                              │
   │   "Dựa trên ảnh, tôi ước tính:                       │
   │    - Dáng người: Mesomorph                            │
   │    - Tỷ lệ mỡ: Khoảng 15-18%                         │
   │    - Vai cân đối, lưng phát triển tốt                │
   │                                                      │
   │    ⚠ Đây là ước tính AI, tham khảo thêm InBody."    │
   │                                                      │
   │   MEAL:                                              │
   │   "Trong ảnh tôi thấy:                               │
   │    - Ức gà (~150g): ~240 cal, 45g protein            │
   │    - Cơm trắng (~200g): ~260 cal, 56g carb           │
   │    - Rau xanh: ~30 cal, chất xơ                       │
   │                                                      │
   │    Tổng ước tính: ~530 cal                            │
   │    ⚠ Ước tính AI, calo thực tế có thể khác."        │
   └──────────────────────────────────────────────────────┘
```

### 6.1 Vision Analysis Categories

```
┌────────────────────────────────────────────────────────────────┐
│  CATEGORY        │  WHAT IT ANALYZES          │  DISCLAIMER    │
├──────────────────┼────────────────────────────┼────────────────┤
│  Body Photo      │  Body type, symmetry,      │  "AI estimate  │
│                  │  estimated body fat %,     │   for reference│
│                  │  visible muscle dev,       │   only. Use    │
│                  │  posture from front/       │   InBody/DEXA  │
│                  │  side/back views           │   for accuracy"│
├──────────────────┼────────────────────────────┼────────────────┤
│  Meal Photo      │  Food identification,      │  "AI estimate  │
│                  │  portion estimation,       │   based on     │
│                  │  macro breakdown,          │   visual       │
│                  │  calorie estimate,         │   appearance.  │
│                  │  nutrition quality         │   Actual values│
│                  │                            │   may differ"  │
├──────────────────┼────────────────────────────┼────────────────┤
│  Exercise Form   │  Joint angles,             │  "AI posture   │
│                  │  spine alignment,          │   check for    │
│                  │  range of motion,          │   reference.   │
│                  │  injury risk flags,        │   Consult PT   │
│                  │  corrections needed        │   for proper   │
│                  │                            │   assessment"  │
├──────────────────┼────────────────────────────┼────────────────┤
│  Progress        │  Side-by-side visual       │  "Visual       │
│  Comparison      │  comparison,               │   comparison   │
│                  │  change detection,         │   only. Not a  │
│                  │  visible muscle gain,      │   substitute   │
│                  │  visible fat loss          │   for body     │
│                  │                            │   measurements"│
├──────────────────┼────────────────────────────┼────────────────┤
│  ABSOLUTELY      │  Disease, skin condition,  │  BLOCKED       │
│  NEVER           │  injury diagnosis,         │  "Tôi không    │
│                  │  clinical assessment,      │   thể chẩn đoán│
│                  │  treatment recommendation  │   bệnh. Vui    │
│                  │                            │   lòng gặp     │
│                  │                            │   bác sĩ."     │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│   CRITICAL RULE: The AI Assistant NEVER calls Mongoose models directly.  │
│                  It ALWAYS calls existing Services.                       │
│                                                                           │
│   Reason: Services contain business logic, validation, and authorization. │
│           Models are just data access. Skipping services = broken logic.  │
│                                                                           │
│   AI Assistant  ──calls──▶  membershipService  ──calls──▶  Membership    │
│   (new code)              (existing code)               (existing model)  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────┐
                         │   ROUTER DECIDES:       │
                         │   Database Source       │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   IDENTIFY DOMAIN       │
                         │                         │
                         │   Intent → Domain map:  │
                         │                         │
                         │   wallet_balance   → walletService     │
                         │   membership_info  → membershipService │
                         │   booking_list     → bookingService    │
                         │   order_status     → orderService      │
                         │   workout_history  → workoutService    │
                         │   health_metrics   → healthService     │
                         │   nutrition_log    → nutritionService  │
                         │   pt_info          → ptService         │
                         │   products         → productService    │
                         │   payments         → paymentService    │
                         │   notifications    → notificationSvc   │
                         │   checkin_stats    → checkInService    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   CALL SERVICE          │
                         │                         │
                         │   userId = req.user._id │
                         │   (injected, cannot     │
                         │    be overridden)       │
                         │                         │
                         │   Example:              │
                         │   const wallet =        │
                         │     await walletService │
                         │     .getByUserId(       │
                         │       req.user._id      │
                         │     );                  │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   SERVICE RETURNS       │
                         │   RAW DATA              │
                         │                         │
                         │   {                     │
                         │     balance: 500000,    │
                         │     points: 120,        │
                         │     currency: "VND"     │
                         │   }                     │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   TAG WITH SOURCE       │
                         │                         │
                         │   source: "database"    │
                         │   service: "wallet"     │
                         │   timestamp: now        │
                         └────────────┬────────────┘
                                      │
                                      ▼
                              Pass to Response
                                Generator
```

### 7.1 Domain → Service Mapping (All Reuse Existing Code)

```
┌──────────────────────────────────────────────────────────────────────┐
│  WHAT USER ASKS ABOUT     │  SERVICE CALLED      │  RETURNS          │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Wallet balance/points    │  walletService       │  { balance,       │
│                           │  .getByUserId(id)    │    points }       │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Membership status/expiry │  membershipService   │  { plan, status,  │
│                           │  .getCurrent(userId) │    startDate,     │
│                           │                      │    expiresAt }    │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  PT bookings (upcoming)   │  bookingService      │  [ { trainer,     │
│                           │  .getByUserId(id,    │    date, time,    │
│                           │   { upcoming:true }) │    status } ]     │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Orders (recent/status)   │  orderService        │  [ { id, items,   │
│                           │  .getByUserId(id)    │    total, status  │
│                           │                      │    createdAt } ]  │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Workout history          │  workoutService      │  [ { date,        │
│                           │  .getByUserId(id)    │    exercises,     │
│                           │                      │    duration } ]   │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Health metrics           │  healthService       │  [ { weight,      │
│                           │  .getByUserId(id)    │    bodyFat,       │
│                           │                      │    date } ]       │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Nutrition logs           │  nutritionService    │  [ { date,        │
│                           │  .getByUserId(id)    │    meals,         │
│                           │                      │    calories } ]   │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Membership plans (list)  │  planService         │  [ { name, price, │
│                           │  .getAll()           │    features } ]   │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Products in shop         │  productService      │  [ { name, price, │
│                           │  .getAll()           │    stock } ]      │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Payment history          │  paymentService      │  [ { amount,      │
│                           │  .getByUserId(id)    │    method, date,  │
│                           │                      │    status } ]     │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Notifications            │  notificationService │  [ { title,       │
│                           │  .getByUserId(id)    │    message,       │
│                           │                      │    read } ]       │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  Check-in history/stats   │  checkInService      │  [ { date, time,  │
│                           │  .getByUserId(id)    │    streak } ]     │
├───────────────────────────┼──────────────────────┼───────────────────┤
│  PT listings/info         │  ptService           │  [ { name,        │
│                           │  .getAll()           │    specialty,     │
│                           │                      │    rating } ]     │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Admin/Staff Context

```
When role is admin or staff, the assistant can look up other members:

User (admin): "Show me Nguyễn Văn A's membership"
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │ Check permission:    │
                                    │ admin/staff can view │
                                    │ other members' data  │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │ Find user by name:   │
                                    │ userService          │
                                    │ .findByName("Nguyễn")│
                                    │ → targetUserId       │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │ Get membership:      │
                                    │ membershipService    │
                                    │ .getCurrent(         │
                                    │   targetUserId       │
                                    │ )                    │
                                    └─────────────────────┘
```

---

## 8. Vector Search Flow

```
                         ┌─────────────────────────┐
                         │   ROUTER DECIDES:       │
                         │   Vector Source         │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   GENERATE EMBEDDING    │
                         │                         │
                         │   User question →       │
                         │   Embedding vector      │
                         │                         │
                         │   Model:                │
                         │   text-embedding-004    │
                         │   (Gemini)              │
                         │                         │
                         │   Output: 768-dim       │
                         │   float array           │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   SEARCH CHROMADB       │
                         │                         │
                         │   ANN search with:      │
                         │   - Top K = 5           │
                         │   - Min similarity: 0.75│
                         │   - Filter by source    │
                         │     if applicable       │
                         │     (faq/policy/etc.)   │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   RESULTS               │
                         │                         │
                         │   [                     │
                         │     {                   │
                         │       content: "...",   │
                         │       source: "policy", │
                         │       title: "Hoàn tiền",│
                         │       score: 0.92       │
                         │     },                  │
                         │     {                   │
                         │       content: "...",   │
                         │       source: "faq",    │
                         │       title: "Hủy gói", │
                         │       score: 0.85       │
                         │     }                   │
                         │   ]                     │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   TAG WITH SOURCE       │
                         │                         │
                         │   source: "vector"      │
                         │   sourceType: "policy"  │
                         │   title: "Hoàn tiền"    │
                         │   score: 0.92           │
                         └────────────┬────────────┘
                                      │
                                      ▼
                              Pass to Response
                                Generator
```

### 8.1 Vector Knowledge Sources (Pre-Embedded)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SOURCE          │  CONTENT                         │  UPDATED       │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  faq             │  All FAQ entries from MongoDB    │  On FAQ change │
│                  │  "How to register?"              │                │
│                  │  "Payment methods?"              │                │
│                  │  "Cancel booking?"               │                │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  policy          │  All Policy documents from       │  On policy     │
│                  │  MongoDB                         │  change        │
│                  │  "Refund Policy"                 │                │
│                  │  "Privacy Policy"                │                │
│                  │  "Terms of Service"              │                │
│                  │  "Cancellation Policy"           │                │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  exercise        │  Curated exercise library        │  Manual sync   │
│                  │  "Bench Press Guide"             │                │
│                  │  "Squat Form"                    │                │
│                  │  "Deadlift Safety"               │                │
│                  │  "Pull-up Progression"           │                │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  nutrition       │  Curated nutrition guides        │  Manual sync   │
│                  │  "Protein Requirements"          │                │
│                  │  "Pre-workout Nutrition"         │                │
│                  │  "Post-workout Recovery"         │                │
│                  │  "Meal Timing Guide"             │                │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  gym_rules       │  Gym constitution & rules        │  Manual sync   │
│                  │  "Gym Etiquette"                 │                │
│                  │  "Equipment Usage Rules"         │                │
│                  │  "Locker Room Policy"            │                │
│                  │  "Guest Policy"                  │                │
├──────────────────┼──────────────────────────────────┼────────────────┤
│  prompts         │  Assistant prompt library        │  Manual sync   │
│                  │  System prompts for each role    │                │
│                  │  Response templates              │                │
│                  │  Disclaimer templates            │                │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Embedding Pipeline (Runs Separately, Not on User Request)

```
┌──────────────────────────────────────────────────────────────────────┐
│  EMBEDDING PIPELINE (Background Process)                             │
│                                                                       │
│  Trigger: On content change in MongoDB (faq, policy)                  │
│           Or manual sync for curated content (exercise, nutrition)    │
│                                                                       │
│  1. Detect changed/added document                                    │
│  2. Chunk text (1024 tokens, 128 overlap)                            │
│  3. Generate embedding via text-embedding-004                        │
│  4. Store in VectorDocument (MongoDB) + ChromaDB                     │
│  5. Content hash for deduplication                                   │
│                                                                       │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ MongoDB  │ →  │ Embedding    │ →  │ ChromaDB     │               │
│  │ (Faq,    │    │ Generator    │    │ (Search      │               │
│  │ Policy,  │    │              │    │  Index)      │               │
│  │ ...)     │    │ Chunk →      │    │              │               │
│  │          │    │ Embed →      │    │ VectorDocument│              │
│  │          │    │ Store        │    │ (MongoDB)    │               │
│  └──────────┘    └──────────────┘    │ (Source of   │               │
│                                       │  truth)      │               │
│                                       └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Web Search Flow

```
                         ┌─────────────────────────┐
                         │   ROUTER DECIDES:       │
                         │   Web Source            │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   REWRITE QUERY         │
                         │                         │
                         │   Remove personal info  │
                         │   Add context for       │
                         │   better results        │
                         │                         │
                         │   "Nên ăn bao nhiêu     │
                         │    protein?"            │
                         │   → "recommended daily  │
                         │      protein intake     │
                         │      for adults 2026    │
                         │      fitness"           │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   CALL TAVILY API       │
                         │                         │
                         │   - search_depth:       │
                         │     advanced            │
                         │   - max_results: 5      │
                         │   - include_domains     │
                         │     (whitelist)         │
                         │   - exclude_domains     │
                         │     (blacklist)         │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   FILTER RESULTS        │
                         │                         │
                         │   ✓ Keep:               │
                         │   - Medical journals    │
                         │     (pubmed, who.int)   │
                         │   - Health authorities  │
                         │     (mayoclinic, nhs)   │
                         │   - Fitness research    │
                         │     (examine.com)       │
                         │                         │
                         │   ✗ Discard:            │
                         │   - Social media        │
                         │   - Forums (reddit)     │
                         │   - Blogs (personal)    │
                         │   - Supplement stores   │
                         │   - E-commerce sites    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   TAG WITH SOURCE       │
                         │                         │
                         │   source: "web"         │
                         │   urls: [...]           │
                         │   publishedDates: [...] │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   GUARDRAIL             │
                         │                         │
                         │   - Add disclaimer:     │
                         │     "Theo nguồn..."     │
                         │   - Cite every source   │
                         │   - Never present as    │
                         │     medical advice      │
                         └────────────┬────────────┘
                                      │
                                      ▼
                              Pass to Response
                                Generator
```

### 9.1 Web Search Domain Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│  DOMAIN CATEGORY      │  ALLOWED DOMAINS            │  BLOCKED       │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  Scientific Research  │  pubmed.ncbi.nlm.nih.gov    │                │
│                       │  scholar.google.com         │                │
│                       │  ncbi.nlm.nih.gov           │                │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  Medical Reference    │  mayoclinic.org              │                │
│                       │  nhs.uk                      │                │
│                       │  who.int                     │                │
│                       │  cdc.gov                     │                │
│                       │  healthline.com              │                │
│                       │  webmd.com                   │                │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  Fitness Science      │  acefitness.org              │                │
│                       │  nsca.com                    │                │
│                       │  strongerbyscience.com       │                │
│                       │  examine.com                 │                │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  Sleep Science        │  sleepfoundation.org         │                │
│                       │  pubmed.ncbi.nlm.nih.gov    │                │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  Nutrition            │  nutrition.org               │                │
│                       │  healthline.com/nutrition    │                │
│                       │  examine.com                 │                │
├───────────────────────┼─────────────────────────────┼────────────────┤
│  BLOCKED (always)     │                              │  reddit.com    │
│                       │                              │  quora.com     │
│                       │                              │  facebook.com  │
│                       │                              │  twitter.com   │
│                       │                              │  instagram.com │
│                       │                              │  tiktok.com    │
│                       │                              │  youtube.com   │
│                       │                              │  amazon.com    │
│                       │                              │  shopee.vn     │
│                       │                              │  *.blogspot.*  │
│                       │                              │  *.wordpress.* │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Future Expansion Suggestions

### 10.1 What Could Be Added (Without Changing Architecture)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FUTURE DATA SOURCE     │  WHY                    │  COMPLEXITY     │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Voice Input            │  Users speak instead    │  Low            │
│  (Speech-to-Text)       │  of type. Browser       │  Web Speech API │
│                         │  Web Speech API.        │  already exists │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  OCR / Document Read    │  Users upload meal plan │  Low            │
│                         │  PDFs, nutrition labels.│  Same Vision    │
│                         │  Reuses Vision source.  │  pipeline       │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Calendar Integration   │  Show PT bookings in    │  Medium         │
│                         │  calendar format.       │  Google Cal API │
│                         │  "What's my schedule?"  │                 │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Location / Maps        │  "Where is the gym?"    │  Low            │
│                         │  "Nearby gyms?"         │  Google Maps    │
│                         │  Static info mostly.    │  Static embed   │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Wearable Data Sync     │  Pull data from Apple   │  High           │
│                         │  Health / Google Fit    │  Requires OAuth │
│                         │  "How many steps today?"│  + API setup    │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Smart Notifications    │  Assistant proactively  │  Medium         │
│                         │  sends reminders:       │  Uses existing  │
│                         │  "PT session tomorrow"  │  Notification   │
│                         │  "Membership expiring"  │  service        │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Multi-language         │  English support in     │  Low            │
│                         │  addition to Vietnamese │  LLM already    │
│                         │  Auto-detect language   │  multilingual   │
├─────────────────────────┼─────────────────────────┼─────────────────┤
│  Exercise Video         │  Analyze short video    │  Medium         │
│  Analysis               │  clips of exercise form │  Gemini can     │
│                         │  (not just photos)      │  process video  │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 What Should NOT Be Added (Avoid Over-Engineering)

```
┌──────────────────────────────────────────────────────────────────────┐
│  DO NOT BUILD                         │  WHY                        │
├───────────────────────────────────────┼──────────────────────────────┤
│  Multi-agent system                   │  Single assistant is enough. │
│                                       │  This is a helper, not a    │
│                                       │  platform.                   │
├───────────────────────────────────────┼──────────────────────────────┤
│  AI-generated workout plans           │  Requires PT expertise.      │
│  (replacing PT)                       │  Legal risk.                 │
│                                       │  PTs create plans in UI.     │
├───────────────────────────────────────┼──────────────────────────────┤
│  AI booking/ordering agent            │  Existing booking/order UI   │
│  (executing actions)                  │  works fine. AI should not   │
│                                       │  replace working features.   │
├───────────────────────────────────────┼──────────────────────────────┤
│  AI dashboard / analytics page        │  Reports dashboard already   │
│                                       │  exists. AI only answers     │
│                                       │  questions about reports.    │
├───────────────────────────────────────┼──────────────────────────────┤
│  Separate AI admin panel              │  Admin uses the same         │
│                                       │  assistant, just with more   │
│                                       │  data access permissions.    │
├───────────────────────────────────────┼──────────────────────────────┤
│  AI-generated meal plans              │  Nutritionists create plans. │
│                                       │  AI only suggests guides.    │
├───────────────────────────────────────┼──────────────────────────────┤
│  RAG pipeline for user data           │  Personal data queried live  │
│                                       │  from DB. No embedding       │
│                                       │  needed for user data.       │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.3 Extension Pattern: Adding a New Data Source

```
If a new capability is needed (e.g., Speech, Calendar, OCR):

Step 1: Create the function handler
        └─ src/ai/functions/<name>Query.js
        └─ Must implement: execute(args, userId) → { data, sourceTag }

Step 2: Register in function declarations
        └─ Add function schema to the Gemini function calling config
        └─ No changes to AiAssistant.process()

Step 3: Done.
        └─ Gemini automatically discovers and uses the new function.
        └─ AiAssistant.process() unchanged.
        └─ API endpoint unchanged.
        └─ Chat widget unchanged.
        └─ Existing website unchanged.
```

---

## Appendix A: Key Design Decisions

```
┌──────────────────────────────────────────────────────────────────────┐
│  DECISION                              │  RATIONALE                  │
├────────────────────────────────────────┼─────────────────────────────┤
│  Assistant only ANSWERS, never ACTS   │  Business actions have       │
│                                        │  dedicated UIs. Assistant   │
│                                        │  is informational only.     │
├────────────────────────────────────────┼─────────────────────────────┤
│  AI calls Services, not Models        │  Services contain business   │
│                                        │  logic. Skipping them =     │
│                                        │  broken validation.         │
├────────────────────────────────────────┼─────────────────────────────┤
│  4 data sources max                   │  Database, Vector, Web,      │
│                                        │  Vision. Covers everything  │
│                                        │  users ask about.           │
├────────────────────────────────────────┼─────────────────────────────┤
│  Single /api/ai/chat endpoint         │  One endpoint for everything.│
│                                        │  Router decides source      │
│                                        │  internally.                │
├────────────────────────────────────────┼─────────────────────────────┤
│  Conversation memory only (no cache)  │  Personal data must be fresh.│
│                                        │  30-min TTL is enough for   │
│                                        │  conversation continuity.   │
├────────────────────────────────────────┼─────────────────────────────┤
│  LLM only formats, never invents      │  Every factual claim must    │
│                                        │  come from a data source.   │
│                                        │  LLM = formatter only.      │
├────────────────────────────────────────┼─────────────────────────────┤
│  Gemini 2.5 Flash as primary LLM      │  Multimodal (text + vision), │
│                                        │  fast, cost-effective,       │
│                                        │  API keys already exist.    │
├────────────────────────────────────────┼─────────────────────────────┤
│  MongoDB VectorDocument for vector   │  Store embeddings in existing│
│  search                               │  MongoDB. Cosine similarity  │
│                                        │  in Node.js. Zero new infra. │
│                                        │  <2000 docs = <10ms.        │
├────────────────────────────────────────┼─────────────────────────────┤
│  Tavily for web search                │  Purpose-built for AI agents.│
│                                        │  Returns clean results with │
│                                        │  source attribution.         │
├────────────────────────────────────────┼─────────────────────────────┤
│  SSE streaming for responses          │  Tokens appear as generated. │
│                                        │  Better UX than waiting.    │
│                                        │  Existing frontend support. │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: What Already Exists (Reuse)

```
┌──────────────────────────────────────────────────────────────────────┐
│  EXISTING ASSETS                    │  HOW ASSISTANT REUSES IT       │
├────────────────────────────────────┼─────────────────────────────────┤
│  Auth middleware + JWT              │  Same auth for /api/ai/chat.   │
│                                    │  req.user already available.    │
├────────────────────────────────────┼─────────────────────────────────┤
│  30+ Business Services             │  Database source calls them     │
│  (walletService, bookingService,   │  directly. No new DB access.    │
│   membershipService, etc.)         │                                 │
├────────────────────────────────────┼─────────────────────────────────┤
│  AiChatHistory model (MongoDB)     │  Stores messages per user per   │
│                                    │  session. Already defined.      │
├────────────────────────────────────┼─────────────────────────────────┤
│  AiUserMemory model (MongoDB)      │  Stores preferences, top        │
│                                    │  topics. Already defined.       │
├────────────────────────────────────┼─────────────────────────────────┤
│  VectorDocument model (MongoDB)    │  Source of truth for vector     │
│                                    │  data. Already defined.         │
├────────────────────────────────────┼─────────────────────────────────┤
│  Tool Registry system              │  Existing plugin pattern.       │
│  (src/modules/**/tool.js)          │  Can be simplified or kept      │
│                                    │  as-is for source connectors.   │
├────────────────────────────────────┼─────────────────────────────────┤
│  Cloudinary config                 │  ai-chat/ folder already        │
│  (aiChatImageUpload)               │  configured for image uploads.  │
├────────────────────────────────────┼─────────────────────────────────┤
│  AiChatWidget + components         │  14 chat UI components exist.   │
│  (src/components/chat/)            │  Need to un-stub the widget.    │
├────────────────────────────────────┼─────────────────────────────────┤
│  AiChatPage                        │  Full-page chat view at         │
│  (/ai-chat route)                  │  /dashboard/member/ai-chat.     │
│                                    │  Currently stubbed.             │
├────────────────────────────────────┼─────────────────────────────────┤
│  Chat types (aichat.ts)            │  46 response types defined.     │
│                                    │  Cards, plans, PT, analysis.    │
├────────────────────────────────────┼─────────────────────────────────┤
│  LLM API keys (.env)               │  Gemini, OpenRouter, Groq,      │
│                                    │  Tavily all configured.         │
├────────────────────────────────────┼─────────────────────────────────┤
│  Socket.IO (existing)              │  Can be used for streaming      │
│                                    │  fallback if needed.            │
├────────────────────────────────────┼─────────────────────────────────┤
│  Redis (if available)              │  For session memory + rate      │
│                                    │  limiting.                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

---

## FINAL ARCHITECTURE VALIDATION (v4.0 — Gate Check)

> **Reviewer:** Chief AI Architect  
> **Date:** 2026-07-22  
> **Purpose:** Production readiness gate check before implementation.

---

### 1. Production Readiness Score: 8/10

**Verdict:** The architecture is fundamentally correct. Clean up 5 contradictions in the document and 2 missing specs before starting, then proceed.

---

### 2. KEEP

| # | Item |
|---|------|
| 1 | **Single endpoint** `POST /api/ai/chat` — one door. |
| 2 | **Services over Models** — `walletService`, `membershipService`, etc. Never Mongoose directly. |
| 3 | **4 data sources** — Database, Vector, Web, Vision. Right number. |
| 4 | **Read-only, no actions** — Assistant answers, pages execute. |
| 5 | **Conversation memory only** — Session-scoped. `lastTopic` on AiChatHistory. No data caching. |
| 6 | **SSE streaming** — Tokens appear progressively. |
| 7 | **Domain whitelist/blacklist** — Health info from Mayo Clinic, not Reddit. |
| 8 | **Versioned system prompt** — In Git. Not edited live. |
| 9 | **Page deeplinks** — `[Xem chi tiết →]` on every response. |
| 10 | **Greeting + suggestion chips** — "Xin chào 👋" + 6 chips. Receptionist first impression. |
| 11 | **One Gemini call with function calling** — Classify + route + respond in one turn. |
| 12 | **MongoDB-only** — Vector embeddings in `VectorDocument` collection. No ChromaDB. |
| 13 | **No Redis** — Conversation stored in `AiChatHistory.lastTopic`. Context in LLM messages array. |
| 14 | **Base64 images** — Inline to Gemini Vision. Cloudinary for persistent saves only. |
| 15 | **Fallback chain** — Vector empty → Web. Web empty → "not found." DB empty → "Tôi không tìm thấy." |
| 16 | **Prompt injection detection** — Middleware before AiAssistant. |
| 17 | **Rate limiting per role** — Member 30/min, PT 60/min, Admin 100/min. |
| 18 | **OpenRouter fallback** — Claude if Gemini down. Already have API key. |
| 19 | **System prompt versioning** — Git-tracked, never edited live. |
| 20 | **Dynamic follow-up suggestions** — LLM generates, not static chips. |

---

### 3. REMOVE

| # | Item | Reason |
|---|------|--------|
| 1 | **Keyword-based routing** (Section 4.2) | Gemini function calling handles this better. Keywords bit-rot. |
| 2 | **Separate "Understand" LLM call** (Section 3.3) | Merged into the single Gemini function call. |
| 3 | **ChromaDB** (Section 8) | MongoDB VectorDocument + cosine similarity. No new database. |
| 4 | **Redis dependency** (Section 5.2) | AiChatHistory.lastTopic + LLM context messages. |
| 5 | **46 ChatResponseType cards** | Reduce to 6: text, info_card, list, analysis_card, action_link, suggestion_chips. |
| 6 | **Tool Registry system** | 4 flat function files instead. Not a multi-agent system. |
| 7 | **Named pipeline components** (Section 3.3) | "Query Understander," "Data Source Router," etc. One `AiAssistant.process()` function. |
| 8 | **Hybrid routing fallback** (Section 4.2, Step 5) | Two code paths = two sets of bugs. LLM function calling only. |
| 9 | **Cloudinary for transient images** (Section 6) | Base64 inline to Gemini Vision. Cloudinary only for explicit saves. |
| 10 | **ChromaDB reference in Appendix A** (line 1725) | Contradicts Section 0.3.4. Update to MongoDB vector search. |
| 11 | **"Data Source Router" reference in Section 10.3** | Contradicts removal. Update extension pattern. |

---

### 4. CRITICAL FIXES BEFORE IMPLEMENTATION (5 blocking issues)

| # | Issue | Why It Blocks Implementation | Fix |
|---|-------|------------------------------|-----|
| **CF-1** | **Appendix A line 1725 says "ChromaDB for vector search"** — contradicts Section 0.3.4 which says REMOVE ChromaDB | Implementer won't know which to follow. Two conflicting specs in the same document. | Change Appendix A to: "MongoDB VectorDocument + cosine similarity in Node.js. For <2000 docs this is <10ms." |
| **CF-2** | **Section 10.3 references "Data Source Router" and "Query Understander"** — both were removed in Section 0.3 and 0.4 | Extension pattern describes components that no longer exist. Implementer will add code to deleted abstractions. | Rewrite Section 10.3 to: "Add a new function declaration to the Gemini function calling config. No other changes needed." |
| **CF-3** | **No vector data seeding strategy** | The assistant cannot answer any policy/FAQ/guide questions until VectorDocument collection has embeddings. Starting from zero = 100% fallback to "I don't know." | Define seed data: minimum 50 FAQ entries, 10 policy documents, 20 exercise guides, 10 nutrition guides. Run embedding pipeline on deployment. |
| **CF-4** | **No testing specification** | Cannot validate assistant behavior before production. Risk of prompt-breaking changes going live undetected. | Define a test suite: 50 Vietnamese questions with expected source routing and acceptable answer ranges. Run before every prompt change. |
| **CF-5** | **No system prompt baseline** | The system prompt IS the product. Without a concrete baseline document, implementation starts in the dark. The architecture defines prompt structure but not content. | Write the actual system prompt in Vietnamese as a Git-tracked file before any code. This is the #1 implementation dependency. |

---

### 5. OPTIONAL IMPROVEMENTS (non-blocking — can be done after launch)

| # | Improvement | Value |
|---|-------------|-------|
| 1 | LRU cache for embedding generation (identical queries reuse cached embedding) | Saves ~$0.0001 per duplicate query. Low value, low effort. |
| 2 | Conversation summarization after 15+ messages (replace raw messages with 1-line summary) | Saves tokens in long chats. Useful but not critical at launch. |
| 3 | Smart greeting based on time of day ("Chào buổi sáng" / "Chào buổi tối") | Polishes the receptionist feel. One line of code. |
| 4 | "Xóa hội thoại" button in widget | Users expect this. But can ship without it. |
| 5 | Track user satisfaction (implicit: did they ask a follow-up? explicit: thumbs up/down) | Data for prompt improvement. Not needed for v1. |
| 6 | Multi-language (English fallback) | Gemini already multilingual. Just need an English prompt variant. |
| 7 | Offline mode detection (show "Không có kết nối" if API unreachable) | UX polish. Not blocking. |

---

### 6. FINAL ARCHITECTURE DIAGRAM (Authoritative — supersedes all previous)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         GYMPRO WEBSITE (React)                            │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  Existing pages: Membership | Wallet | PT Booking | Orders | ...  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  AiChatWidget (bottom-right floating, ~380px panel)                │   │
│  │                                                                    │   │
│  │  Xin chào 👋  Tôi có thể giúp gì cho bạn?                          │   │
│  │  [🏋 Gói tập] [📅 Lịch PT] [💰 Ví] [🛒 Đơn hàng] [🥗 DD] [❤️ SK] │   │
│  │  ────────────────────────────────────────────                      │   │
│  │  Bạn: "Còn bao nhiêu buổi PT?"                                     │   │
│  │  AI:  "Bạn còn 5 buổi. Buổi tiếp: Thứ 4, 9:00 với HLV Nam.       │   │
│  │        [Xem lịch →]"                                               │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │  JWT (existing auth)
                                   │  POST /api/ai/chat
                                   │  { message, images?: base64[] }
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  API Layer (Express 5 — existing)                                         │
│                                                                           │
│  Middleware: authenticate → rateLimit → validateInput → detectInjection  │
│  Controller: AiAssistant.process(userId, role, name, message, images)    │
│  Response: SSE stream                                                     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  AiAssistant.process() — ~150 lines. The only new backend code.          │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 1: BUILD CONTEXT                                               │ │
│  │                                                                      │ │
│  │ Load:                                                                │ │
│  │  • Last 10 messages from AiChatHistory (MongoDB)                    │ │
│  │  • lastTopic from AiChatHistory                                     │ │
│  │  • System prompt (versioned, per-role, from Git-tracked file)       │ │
│  │  • Function declarations for 4 data sources                         │ │
│  │                                                                      │ │
│  │ Assemble: [system, ...history, user_message + images]               │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
│                                     │                                     │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 2: GEMINI FUNCTION CALL (one API call)                         │ │
│  │                                                                      │ │
│  │ Gemini 2.5 Flash decides:                                           │ │
│  │  • What the user wants                                              │ │
│  │  • Which functions to call                                          │ │
│  │  • What parameters to pass                                          │ │
│  │                                                                      │ │
│  │ Returns function calls to execute.                                  │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
│                                     │                                     │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 3: EXECUTE FUNCTIONS (parallel when independent)               │ │
│  │                                                                      │ │
│  │  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ │ │
│  │  │ databaseQuery()   │ │ vectorQuery()     │ │ webQuery()        │ │ │
│  │  │                   │ │                   │ │                   │ │ │
│  │  │ userId INJECTED   │ │ Embed query       │ │ Rewrite query     │ │ │
│  │  │ by server         │ │ → MongoDB         │ │ → Tavily API      │ │ │
│  │  │ (LLM CANNOT       │ │   VectorDocument  │ │ → filter domains  │ │ │
│  │  │  override)        │ │ → cosine sim      │ │                   │ │ │
│  │  │                   │ │ → top K=5         │ │ Whitelist:        │ │ │
│  │  │ Calls existing    │ │ → threshold 0.75  │ │ pubmed, mayoclinic│ │ │
│  │  │ services:         │ │                   │ │ who.int, nhs.uk   │ │ │
│  │  │ walletService     │ │ Returns:          │ │ examine.com       │ │ │
│  │  │ membershipService │ │ content + source  │ │                   │ │ │
│  │  │ bookingService    │ │ + title + score   │ │ Blacklist:        │ │ │
│  │  │ orderService      │ │                   │ │ reddit, fb, blogs │ │ │
│  │  │ healthService     │ │                   │ │ shops, forums     │ │ │
│  │  │ nutritionService  │ │                   │ │                   │ │ │
│  │  │ productService    │ │                   │ │ Returns:          │ │ │
│  │  │ paymentService    │ │                   │ │ summary + urls    │ │ │
│  │  │ notificationSvc   │ │                   │ │ + dates           │ │ │
│  │  │ checkInService    │ │                   │ │                   │ │ │
│  │  │ planService       │ │                   │ │                   │ │ │
│  │  │ ptService         │ │                   │ │                   │ │ │
│  │  └───────────────────┘ └───────────────────┘ └───────────────────┘ │ │
│  │                                                                      │ │
│  │  ┌──────────────────────┐                                            │ │
│  │  │ visionQuery()        │  ONLY if images present                    │ │
│  │  │ Base64 → Gemini      │                                            │ │
│  │  │ Vision → structured  │                                            │ │
│  │  │ analysis + disclaimer│                                            │ │
│  │  └──────────────────────┘                                            │ │
│  │                                                                      │ │
│  │  EMPTY RESULT PROTOCOL:                                              │ │
│  │  DB null → "Tôi không tìm thấy thông tin này."                      │ │
│  │  Vec empty → FALLBACK to webQuery with same question                 │ │
│  │  Web empty → "Tôi không tìm thấy nguồn đáng tin cậy."              │ │
│  │  Vision error → "Không thể phân tích ảnh. Vui lòng thử ảnh khác."  │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
│                                     │                                     │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 4: GEMINI FORMATS RESPONSE (same conversation turn)            │ │
│  │                                                                      │ │
│  │ LLM produces:                                                        │ │
│  │  • Natural Vietnamese response (concise, <4 sentences)               │ │
│  │  • Page deeplink: "[Xem chi tiết →]"                                │ │
│  │  • 2-3 dynamic follow-up suggestions                                │ │
│  │  • Honest "I don't know" if all sources returned empty              │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
│                                     │                                     │
│                                     ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 5: POST-PROCESS                                                │ │
│  │                                                                      │ │
│  │  • Scan for medical diagnosis language → strip + add disclaimer     │ │
│  │  • Scan for PII leakage (other users' data) → strip                │ │
│  │  • Update AiChatHistory (async):                                    │ │
│  │    - Append user message + AI response                              │ │
│  │    - Update lastTopic field                                         │ │
│  │  • Update AiUserMemory (every 10 msgs): topTopics, historySummary  │ │
│  │  • Log: latency per step, sources used, token count                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  STORAGE (MongoDB only — no new databases)                                │
│                                                                           │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ AiChatHistory           │  │ VectorDocument                       │   │
│  │                         │  │                                      │   │
│  │ userId                  │  │ source: faq | policy | exercise |    │   │
│  │ messages[]              │  │         nutrition | gym_rules        │   │
│  │ lastTopic: "wallet"     │  │ title: "Chính sách hoàn tiền"        │   │
│  │ lastEntities: ["ví"]    │  │ content: "..."                       │   │
│  │                         │  │ embedding: [768 floats]              │   │
│  └─────────────────────────┘  │ contentHash: "sha256..."             │   │
│                               │ language: "vi"                       │   │
│  ┌─────────────────────────┐  └──────────────────────────────────────┘   │
│  │ AiUserMemory            │                                              │
│  │                         │  ┌──────────────────────────────────────┐   │
│  │ userId                  │  │ Existing MongoDB collections         │   │
│  │ preferences             │  │ (accessed ONLY via services)          │   │
│  │ topTopics: [wallet, pt] │  │                                      │   │
│  │ responseStyle           │  │ Users, Memberships, Wallets,         │   │
│  │ language                │  │ Bookings, Orders, Workouts,          │   │
│  │ historySummary          │  │ Health, Nutrition, Products,         │   │
│  └─────────────────────────┘  │ Payments, Notifications, Plans...    │   │
│                               └──────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 7. IMPLEMENTATION READINESS

## ✅ READY FOR IMPLEMENTATION

**Conditions:** Fix CF-1 through CF-5 before writing any code.

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAUNCH CHECKLIST                                                    │
│                                                                       │
│  Before Day 1 of coding:                                             │
│  □ CF-1: Fix Appendix A (ChromaDB → MongoDB vector)                  │
│  □ CF-2: Fix Section 10.3 (remove deleted component references)      │
│  □ CF-3: Prepare vector seed data (50 FAQ, 10 policy, 20 exercise)   │
│  □ CF-4: Write test set of 50 Vietnamese questions                   │
│  □ CF-5: Write system prompt (Vietnamese, Git-tracked, per-role)     │
│                                                                       │
│  Implementation order (recommended):                                  │
│  □ 1. System prompt (the product)                                    │
│  □ 2. AiAssistant.process() — core logic                             │
│  □ 3. databaseQuery() — calls existing services                      │
│  □ 4. vectorQuery() — MongoDB cosine similarity                      │
│  □ 5. webQuery() — Tavily + domain filter                            │
│  □ 6. visionQuery() — Gemini Vision base64                           │
│  □ 7. Express endpoint + middleware                                  │
│  □ 8. AiChatWidget — unstub, implement                               │
│  □ 9. Test against 50-question suite                                 │
│  □ 10. Deploy. Monitor. Iterate.                                     │
│                                                                       │
│  Target: ~600 lines of new code total.                                │
│  Target: 80% of text queries < 2 seconds.                             │
│  Target: Launch-ready in 2 weeks with 2 engineers.                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

> **Document Status:** FROZEN — No further architecture changes.  
> **Next Step:** Fix CF-1 to CF-5, then begin implementation.  
> **Document Version:** v4.0 (Final)  
> **Validated By:** Chief AI Architect, 2026-07-22
