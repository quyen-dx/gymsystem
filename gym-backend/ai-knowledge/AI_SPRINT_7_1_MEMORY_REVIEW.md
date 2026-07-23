# AI Sprint 7.1 — Conversation Memory Review

## 1. Removed: Rule-Based Topic Detection

**Before:** `TOPIC_PATTERNS` (8 regex patterns) + `detectTopic()` function. Memory guessed the topic from keyword matching.

**After:** `TOPIC_PATTERNS` and `detectTopic()` removed entirely. `currentTopic` field removed from memory schema. The LLM naturally infers conversation context from entities, summaries, and recent questions in the `[BỐI CẢNH NGẮN GỌN]` block.

```diff
- const TOPIC_PATTERNS = [ { key: 'membership', pattern: /gói\s*tập|.../i }, ... ]
- function detectTopic(text) { ... }
- currentTopic: detectTopic(message),
- currentTopic,
```

## 2. Changed: Entities from Object to Array

**Before:**
```js
entities: { height: "175cm", weight: "70kg", age: "25 tuổi" }
```
Fixed key names. No confidence scoring. Harder to extend with new entity types.

**After:**
```js
entities: [
  { type: "height", value: "175cm", confidence: 1.0 },
  { type: "weight", value: "70kg", confidence: 1.0 },
  { type: "age", value: "25 tuổi", confidence: 1.0 },
]
```
Type-safe, extensible, supports confidence scoring for future ML-based extraction. Deduplication via `Map<type, entity>` merge logic.

## 3. Memory Schema (Current)

```js
{
  sessionId: string,              // user._id.toString()
  entities: [],                   // { type, value, confidence }[]
  recentQuestions: string[],      // last 3 (summarized, max 200 chars)
  lastAnswerSummary: string|null, // first sentence, max 100 chars
  conversationSummary: string|null, // compressed when messageCount >= 5
  messageCount: number,
  updatedAt: number,
  expiresAt: number,
  createdAt: number,
}
```

Removed: `currentTopic`, `currentIntent`.

## 4. Compressed Memory Prompt

**Before:** Verbose with `[BỐI CẢNH TRÒ CHUYỆN]` block, `Chủ đề:`, `Thông tin đã biết:`, `Câu hỏi trước:`, `Câu trả lời trước:` labels.

**After:** Minimal `[BỐI CẢNH NGẮN GỌN]` block. Two modes:

| Mode | Output |
|------|--------|
| Has `conversationSummary` | Single line with the summary |
| No summary, has entities | `type:value, type:value` line + `Trả lời trước:` line |
| No entities, no summary | Empty string (zero token waste) |

Example output: `height:175cm, weight:65kg, package:quý, age:25 tuổi`

Prompt guard: returns `''` if no `conversationSummary` AND no `entities` → greeting contexts produce zero overhead.

## 5. Memory Store — Redis/Mongo Ready

API contract for any store implementation:

```js
interface MemoryStore {
  get(sessionId: string) → memory | null     // auto-expire check
  set(sessionId: string, memory: object) → void
  delete(sessionId: string) → void
  cleanup() → void
}
```

Redis migration:
```js
class RedisMemoryStore {
  async get(key) { return JSON.parse(await redis.get(key)) }
  set(key, m) { redis.setex(key, MEMORY_TTL, JSON.stringify(m)) }
  delete(key) { redis.del(key) }
  cleanup() {} // Redis handles expiry natively
}
```

Mongo migration:
```js
class MongoMemoryStore {
  async get(key) { return db.collection('ai_memory').findOne({ _id: key }) }
  async set(key, m) { db.collection('ai_memory').updateOne({ _id: key }, { $set: m }, { upsert: true }) }
}
```

Switch via `MEMORY_PROVIDER=redis|mongo` — no changes to `conversationMemory.js`.

## 6. memoryPrompt.md — Compressed

**Before:** 20 lines, 6 numbered rules with examples.  
**After:** 11 lines, 4 concise rules. Removed example narratives, kept only directive language.

## 7. Behavior Verification

| Check | Result |
|-------|--------|
| Entity extraction (array format) | ✅ `[{type:"height",value:"175cm",confidence:1}]` |
| Entity merge + dedup | ✅ Same type overrides, no duplicates |
| Package entity Unicode | ✅ "gói quý" → `{type:"package",value:"quý"}` |
| No `currentTopic` field | ✅ Field absent from all memory objects |
| Greeting → empty prompt | ✅ Zero tokens for "Xin chào" context |
| Summary after 6 msgs | ✅ Single-line compressed summary |
| Prompt output ≤ 150 chars | ✅ Single line with entity list |
| Module loads | ✅ All exports valid |
| Public API unchanged | ✅ `process(message, user)` untouched |
| Provider independent | ✅ Zero AI SDK imports |
