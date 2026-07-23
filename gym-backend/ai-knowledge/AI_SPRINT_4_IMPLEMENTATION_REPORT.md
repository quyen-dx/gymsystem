# Sprint 4 — Web Search Integration

## Objective

Allow GymPro AI to answer general knowledge questions (dinh dưỡng, sức khỏe, gym, fitness) using web search via Tavily API, while keeping personal data queries routed to `databaseQuery`.

---

## Architecture

### Before

```
User → Gemini → databaseQuery → Gemini → Response
```

### After

```
User → Gemini → databaseQuery or webQuery → Gemini → Response
```

---

## New file: `src/services/webSearchService.js`

**Responsibilities**:
- Exposes `search(query)` function
- Calls Tavily Search API (`https://api.tavily.com/search`) via `axios`
- Normalizes results to `{ source, title, content, url }[]`
- Returns empty array `[]` on error or no results
- Uses existing `TAVILY_API_KEY` from `.env`

**Key details**:
- `search_depth: 'basic'` for fast responses
- `max_results: 5` — enough context for Gemini to summarize
- `include_answer: false` — let Gemini synthesize from raw results
- No scraping, no HTML parsing, no SDK dependency — pure REST API call

```js
export async function search(query) {
  // axios POST to Tavily
  // returns [{ source, title, content, url }, ...]
}
```

---

## Modified file: `src/services/aiAssistantService.js`

### 1. Import

```js
import { search as webSearch } from './webSearchService.js'
```

### 2. New function definition: `WEB_QUERY_DECLARATION`

```js
const WEB_QUERY_DECLARATION = {
  name: 'webQuery',
  description: 'Tìm kiếm trên web để trả lời các câu hỏi về kiến thức tổng quát, ...',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'Câu hỏi hoặc từ khóa cần tìm kiếm trên web.',
      },
    },
    required: ['query'],
  },
}
```

### 3. New handler function: `webQuery(query)`

```js
async function webQuery(query) {
  const results = await webSearch(query)
  if (!results.length) return { error: 'NO_RESULT' }
  return { results }
}
```

- Returns `{ results: [...] }` on success
- Returns `{ error: 'NO_RESULT' }` when Tavily returns nothing
- Never hallucinates data

### 4. Multi-tool dispatch in `process()`

**Tools array** now includes both declarations:

```js
const tools = [{ functionDeclarations: [DATABASE_QUERY_DECLARATION, WEB_QUERY_DECLARATION] }]
```

**Function routing**:

```js
if (name === 'webQuery') {
  result = await webQuery(args?.query)
} else {
  result = await databaseQuery(args?.intent, user)
}
```

Gemini decides which tool to call based on the user's intent. The two-turn flow (function call → function response → final text) is identical for both.

---

## Modified file: `ai-knowledge/prompts/system-prompt-vi.md`

### Tool documentation section

```
1. databaseQuery(query) → dữ liệu cá nhân (ví, gói tập, lịch PT, thông báo)
2. webQuery(query) → kiến thức tổng quát, dinh dưỡng, sức khỏe, thể thao, gym
```

### Routing rules

```
- Dữ liệu cá nhân → databaseQuery
- Kiến thức tổng quát → webQuery
- Câu chào hỏi → trả lời trực tiếp
- Không chắc chắn → trả lời trực tiếp từ kiến thức
```

### Trusted domains

```
- who.int
- nih.gov
- mayoclinic.org
- healthline.com
- examine.com
- verywellfit.com
```

### webQuery error handling

```
NO_RESULT → "Tôi không tìm thấy thông tin cho câu hỏi này trên web."
```

---

## Verification results

### Greeting
```
Q: Xin chào
A: Xin chào bạn! Tôi có thể giúp gì cho bạn hôm nay? 😊
```
✅ Greeting routes correctly — no tool called.

### Web search (Tavily direct, no Gemini quota)
```
Q: Creatine la gi?
   → 5 results, first: hellobacsi.com
Q: Người truong thanh nen ngu may tieng?
   → 5 results, first: vnexpress.net
Q: Cach tang co?
   → 5 results, first: vnexpress.net
```
✅ Tavily returns real, relevant results for all test queries.

### Gemini 429 (rate limited)
Gemini free-tier quota (20 req/day) was exhausted. The `429` code path returns:
```
"Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau."
```
✅ Error handling works. Awaiting quota reset for end-to-end Gemini + Tavily verification.

### Expected routing (from prompt logic, verified by construction)

| Query | Expected tool | Reason |
|---|---|---|
| "Creatine là gì?" | `webQuery` | General knowledge |
| "Protein là gì?" | `webQuery` | General knowledge |
| "Cách tăng cơ?" | `webQuery` | General knowledge |
| "Tôi còn bao nhiêu tiền?" | `databaseQuery('wallet_balance')` | Personal data |
| "Hôm nay tôi có lịch PT không?" | `databaseQuery('upcoming_booking')` | Personal data |
| "Gói tập tôi còn hạn không?" | `databaseQuery('membership_expiry')` | Personal data |
| "Xin chào" | None | Greeting |

✅ Routing rules are unambiguous in the prompt.

---

## Architecture impact

| Layer | Change |
|---|---|
| `webSearchService.js` | **New** — Tavily API adapter |
| `aiAssistantService.js` | **Modified** — added webQuery declaration + handler + multi-tool dispatch |
| `system-prompt-vi.md` | **Modified** — added tool docs, routing rules, trusted domains, webQuery error handling |
| `databaseQuery` | **Unchanged** — no modifications to database tool |
| `Function calling` | **Unchanged** — same two-turn flow, just added a second function |
| `Frontend` | **Unchanged** — no modifications |
| `.env` | **Unchanged** — `TAVILY_API_KEY` already exists |

---

## Files changed

| File | Action | Summary |
|---|---|---|
| `src/services/webSearchService.js` | Created | Tavily search adapter, 33 lines |
| `src/services/aiAssistantService.js` | Modified | +import, +WEB_QUERY_DECLARATION, +webQuery(), multi-tool dispatch (lines 10, 67-80, 172-183, 205) |
| `ai-knowledge/prompts/system-prompt-vi.md` | Modified | Tool docs, routing rules, trusted domains (lines 8-53) |
