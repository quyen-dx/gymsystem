# AI Sprint 11 — Conversation Context Engine Report

## Objective

Improve conversational intelligence by adding a lightweight, short-lived context layer that allows the AI to understand implicit references between consecutive messages (nó, cái đó, giá bao nhiêu, etc.).

This is NOT long-term memory. It is a temporary conversation state that expires quickly.

## Architecture

```
User Message
    │
    ├── 1. Load Conversation Context (conversationContext.js)
    ├── 2. Load Memory (conversationMemory.js)
    ├── 3. Build Contents with injected context + memory prompts
    ├── 4. LLM processes request (uses context to resolve implicit references)
    ├── 5. Execute Tool (if function call)
    ├── 6. Build Rich Response
    ├── 7. Update Memory
    └── 8. Update Context (save new state for next message)

                    ┌─────────────────────────┐
                    │   Conversation Context   │
                    │   (In-Memory Map)       │
                    │                         │
                    │  lastIntent             │
                    │  lastTool               │
                    │  lastSubject            │
                    │  lastItems              │
                    │  lastResponseSummary    │
                    │  lastCardType           │
                    │  lastRoute              │
                    │  timestamp              │
                    │                         │
                    │  TTL: 10 min (default)  │
                    └─────────────────────────┘
```

## Files

### Created

| File | Purpose |
|------|---------|
| `src/ai/context/conversationContext.js` | Context store + prompt builder + inferrer (115 lines) |
| `ai-knowledge/prompts/context-prompt-vi.md` | Context prompt template |

### Modified

| File | Change |
|------|--------|
| `src/config/aiConfig.js` | Added `context.ttl` config (line 80-82) |
| `src/ai/assistant/aiAssistantService.js` | Load context → inject prompt → update context after response |
| `src/ai/assistant/aiAssistantStreamService.js` | Same integration for streaming path |

## Context State

| Field | Type | Description |
|-------|------|-------------|
| `lastIntent` | string | Tool args (wallet_balance, membership_status, vector query string) |
| `lastTool` | string | Tool used (databaseQuery, vectorQuery, webQuery) |
| `lastSubject` | string | Semantic topic (Ví của người dùng, Gói tập của người dùng, Kiến thức GymPro) |
| `lastItems` | string[] | Items shown to user (plan names, PT names, document titles) |
| `lastResponseSummary` | string | First 120 chars of AI response |
| `lastCardType` | string | Type of card shown (membership_card, wallet_card, etc.) |
| `lastRoute` | string | Suggested navigation route |
| `timestamp` | number | Last activity (Date.now()) |

## Context Lifecycle

```
Create → Update (on each response) → Expire (after TTL or topic change)
```

- **TTL:** 10 minutes (configurable via `CONTEXT_TTL` env var)
- **Expiry check:** On every `loadContext()`, expired entries are deleted
- **No persistent storage:** Uses in-memory Map (same pattern as memoryStore)
- **Separate from Memory:** Context is for conversation flow tracking; Memory is for long-term user context

## Prompt Injection

When context exists, it's injected before the system prompt as:

```
[BỐI CẢNH HỘI THOẠI]
Chủ đề: Gói tập của người dùng
Công cụ đã dùng: databaseQuery
Ý định trước: membership_status
Trả lời trước: Bạn đang dùng gói Premium. Còn 45 ngày.
Đã liệt kê: Premium
Loại thẻ đã hiển thị: membership_card

Nếu tin nhắn tiếp theo chứa tham chiếu ngầm định (nó, cái đó, cái này, đầu tiên, thứ hai, giá bao nhiêu, mua luôn, đặt luôn, đổi sang, còn...),
hãy dùng bối cảnh trên để giải thích tham chiếu đó.
Chỉ hỏi lại nếu có nhiều cách hiểu hợp lý như nhau.
[/BỐI CẢNH HỘI THOẠI]
```

The LLM uses this injected context to resolve references — no regex, no keyword tables, no hardcoded entity lists.

## Context Inference

`inferContextFromResponse()` extracts context from every AI response:

- **Subject mapping:** Maps tool name + intent to semantic categories (ví, gói tập, lịch PT, kiến thức, etc.)
- **Item extraction:** From rich response cards (card.title, card.data.planName, card.data.ptName) or result data (bookings, documents)
- **Summary:** First sentence of response (max 120 chars)
- **Card type & route:** From rich response metadata

## Conversation Examples

### Before (no context)
```
User: Có những gói nào?
AI:   Gold (1.000.000đ), Silver (700.000đ), VIP (2.000.000đ)
User: Giá bao nhiêu?
AI:   [Confused — doesn't know what "giá" refers to]

User: Đặt lịch PT.
AI:   ...
User: Đổi sang ngày mai.
AI:   [Confused — no memory of the booking]
```

### After (with context)
```
User: Có những gói nào?
AI:   Gold (1.000.000đ), Silver (700.000đ), VIP (2.000.000đ)
      [Context: lastTool=vectorQuery, lastSubject=Kiến thức GymPro,
       lastResponseSummary="Gold (1.000.000đ), Silver...",
       lastItems=["Gold", "Silver", "VIP"]]
User: Giá bao nhiêu?
AI:   [Sees context: "Gold, Silver, VIP" was just listed]
      → Giá các gói: Gold 1.000.000đ, Silver 700.000đ, VIP 2.000.000đ

User: Đặt lịch PT.
AI:   Bạn muốn đặt vào ngày nào? Có các PT: Hùng, Minh, Lan.
      [Context: lastSubject=Lịch PT, lastItems=["Hùng", "Minh", "Lan"]]
User: Đổi sang ngày mai.
AI:   [Sees context: booking was just discussed]
      → Đã đổi lịch PT sang ngày mai. Bạn muốn chọn PT nào?
```

## Design Principles

- **No regex:** Context is extracted from structured tool results and rich response cards, not from text pattern matching
- **No hardcoded entity lists:** The LLM resolves references using the free-text context prompt
- **Lightweight:** ~115 lines, in-memory Map store, no external dependencies
- **Explainable:** The injected context prompt is human-readable
- **Non-invasive:** Memory, tools, streaming, routing, and public API are unchanged

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CONTEXT_TTL` | `10` | Minutes before context expires |

## Unchanged

- Database Tool
- Vector Tool
- Vision Tool
- Web Tool
- Provider Architecture
- AI Routing
- AI Streaming
- Rich Response
- Memory System
- Public API
