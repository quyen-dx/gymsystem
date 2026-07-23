# AI Sprint 7 — Conversation Memory

## 1. Architecture

```
User Message
  ↓
Load Memory (by user._id)
  ↓ (if valid, not expired)
Build Memory Context (entities, topic, summary, recent questions)
  ↓
Build Full Context (memory + system prompt + user message)
  ↓
Assistant → Chat Provider → Tools → Response
  ↓
Update Memory (topic, entities, questions, answer summary)
  ↓ (TTL-controled expiry)
Store in Memory Store
```

Memory is **contextual understanding**, not chat history. It tracks what the conversation is about, not every message verbatim.

## 2. Files Created

| File | Purpose |
|------|---------|
| `src/ai/memory/memoryStore.js` | Memory store interface + `InMemoryMemoryStore` (Map-based, auto-cleanup every 60s). Reads `MEMORY_PROVIDER` env. |
| `src/ai/memory/conversationMemory.js` | Business logic: `loadMemory`, `updateMemory`, `buildMemoryPrompt`, `deleteMemory`. Rule-based topic detection, entity extraction, summarization. Zero AI dependency. |
| `src/ai/prompts/memoryPrompt.md` | Instructions for AI on how to use memory: respect context, ignore stale topics, never replace real data. |

## 3. Files Modified

| File | Change |
|------|--------|
| `src/ai/assistant/aiAssistantService.js` | Added memory import, `loadMemory` before context build, `updateMemory` after response, memory context injection into `buildContents`. Memory failures are non-critical (wrapped in try/catch). Public API `process(message, user)` unchanged. |
| `src/ai/factory/providerFactory.js` | Added `getMemoryStore()` that returns the store instance. |
| `.env` | Added `MEMORY_PROVIDER=memory` and `MEMORY_TTL=30` (minutes). |

## 4. Memory Schema

```js
{
  sessionId: string,              // user._id.toString() — per-user, auto-expiring
  currentTopic: string | null,    // "membership" | "exercise" | "nutrition" | "policy" | "checkin" | "pt" | "shop" | "wallet" | null
  currentIntent: string | null,   // reserved for future use
  entities: {},                   // { height: "175cm", weight: "70kg", age: "25 tuổi", package: "tháng" }
  recentQuestions: string[],      // last 3 user questions (summarized to 200 chars)
  lastAnswerSummary: string | null, // first sentence of last AI response (max 150 chars)
  conversationSummary: string | null, // compressed context after 5+ messages
  messageCount: number,           // total messages in session
  updatedAt: number,              // timestamp
  expiresAt: number,              // timestamp
  createdAt: number,              // timestamp
}
```

## 5. TTL Strategy

- `MEMORY_TTL` env var (default: 30 minutes).
- InMemoryStore checks expiry on every `get()` — if expired, returns null and deletes entry.
- Background cleanup via `setInterval(60s)` sweeps expired entries.
- Each `updateMemory()` extends TTL (fresh `expiresAt` = now + TTL).
- Same user returns after TTL → fresh memory (no stale context).

## 6. Summarization Strategy

| Condition | Behavior |
|-----------|----------|
| `messageCount < 5` | Keep up to 3 recent questions, direct context. |
| `messageCount >= 5` | Compress into `conversationSummary`: "đang thảo luận về {topic}. câu hỏi gần đây: ..." Reset `recentQuestions` to just the latest. |
| `messageCount >= 10` | Summary keeps accumulating. Entity set preserved across summarizations. |

All summarization is **rule-based** — no AI model call. Strings are truncated at natural boundaries within character limits.

## 7. Topic & Entity Detection (Rule-Based)

### Topic Detection (Vietnamese keyword patterns)
| Topic | Triggers |
|-------|----------|
| `membership` | gói tập, hết hạn, gia hạn, đăng ký gói, bảo lưu |
| `exercise` | bài tập, squat, push-up, cardio, tập tạ, khởi động |
| `nutrition` | ăn, protein, dinh dưỡng, calo, thực phẩm, bữa ăn |
| `policy` | chính sách, quy định, nội quy, hoàn tiền, điều khoản |
| `checkin` | check-in, vào cửa, quét mã, điểm danh |
| `pt` | pt, huấn luyện viên, personal trainer |
| `shop` | cửa hàng, mua hàng, sản phẩm |
| `wallet` | ví, số dư, nạp tiền, thanh toán |

### Entity Extraction (regex + unit normalization)
| Entity | Pattern | Example → Normalized |
|--------|---------|---------------------|
| `height` | `(\d{2,3})\s*(cm\|mét\|m)` | "175cm" → `"175cm"` |
| `weight` | `(\d{2,3})\s*(kg\|ký\|kilo)` | "70kg" → `"70kg"` |
| `age` | `(\d{1,3})\s*(tuổi)` | "25 tuổi" → `"25 tuổi"` |
| `package` | `gói\s+(tháng\|quý\|năm\|premium)` | "gói Tháng" → `"tháng"` |

## 8. Future Migration Strategy

### RedisMemoryStore
```js
class RedisMemoryStore {
  constructor() { this.redis = new Redis(...) }
  get(key)    { return JSON.parse(this.redis.get(key)) }
  set(key, m) { this.redis.setex(key, TTL_SEC, JSON.stringify(m)) }
  delete(key) { this.redis.del(key) }
  cleanup()   { /* Redis handles TTL natively */ }
}
```
Set `MEMORY_PROVIDER=redis` in `.env`.

### MongoMemoryStore
```js
class MongoMemoryStore {
  constructor() { this.collection = db.collection('ai_memory') }
  async get(key) { return this.collection.findOne({ _id: key }) }
  async set(key, m) { this.collection.updateOne({ _id: key }, { $set: m, $setOnInsert: { createdAt: now } }, { upsert: true }) }
}
```
Set `MEMORY_PROVIDER=mongo` in `.env`.

Switch by adding case to `memoryStore.js`:
```js
case 'redis': StoreClass = RedisMemoryStore; break
case 'mongo': StoreClass = MongoMemoryStore; break
```

## 9. Compatibility Analysis

| Component | Status | Evidence |
|-----------|--------|----------|
| Assistant API unchanged | **✔** | `process(message, user)` signature identical |
| Database Tool unchanged | **✔** | Zero lines changed |
| Web Tool unchanged | **✔** | Zero lines changed |
| Vision Tool unchanged | **✔** | Zero lines changed |
| Vector Tool unchanged | **✔** | Zero lines changed |
| Provider Factory extended | **✔** | `getMemoryStore()` added, existing methods untouched |
| Provider independent | **✔** | Zero AI SDK imports in memory modules |
| No business data cached | **✔** | Memory stores ONLY contextual info, never wallet/status/booking data |
| Entity extraction works | **✔** | "Tôi cao 175cm nặng 70kg" → `{height:"175cm", weight:"70kg"}` |
| Topic detection works | **✔** | "nên ăn bao nhiêu protein" → topic: `nutrition` |
| Topic switching works | **✔** | From nutrition to "cách check-in" → topic: `checkin` |
| Entities persist | **✔** | Height/weight retained across topic switches |
| Summarization triggers | **✔** | After 6 messages, summary generated, recentQuestions reset to 1 |
| Memory expiry | **✔** | Expired memory returns null, auto-deleted |
| Store cleanup | **✔** | `setInterval(60s)` sweeps, verified |
| Fallback on failure | **✔** | Memory errors caught, assistant continues without context |
| Existing APIs unchanged | **✔** | No route changes, no controller changes |
| Frontend unchanged | **✔** | No frontend changes |

## 10. Key Design Decisions

1. **Session key = user._id** — One memory per user, TTL handles natural session boundaries. No need for explicit session management.

2. **Memory is NOT chat history** — Only contextual metadata (topic, entities, summaries). Never stores verbatim message transcripts.

3. **Zero AI dependency** — Topic detection and entity extraction are pure regex. Summarization is rule-based string concatenation. Works identically regardless of chat provider (Gemini, DeepSeek, OpenAI, Claude).

4. **Non-blocking** — Memory load/update failures never crash the assistant. `try/catch` at every memory call.

5. **Business data REQUIRES tool calls** — The prompt explicitly says "Dữ liệu cá nhân (ví, hạn gói tập) phải lấy từ databaseQuery mỗi lần." Memory never substitutes for real data.
