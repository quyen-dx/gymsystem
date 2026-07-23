# Sprint 4 Review — Improvements

## Change 1 — WebSearchProvider abstraction

### Problem

`aiAssistantService.js` imported directly from `webSearchService.js`, which WAS the Tavily implementation. Swapping the search provider would require changing AI logic.

### Solution

Introduced a provider abstraction layer:

```
src/services/webSearchService.js          ← Facade (unchanged import path)
src/services/webSearch/tavilyProvider.js  ← Tavily implementation
```

**`webSearchService.js`** (facade, 5 lines):
```js
import { search as tavilySearch } from './webSearch/tavilyProvider.js'

export async function search(query) {
  return tavilySearch(query)
}
```

**`webSearch/tavilyProvider.js`** (implementation, 59 lines):
- Contains all Tavily API logic (URL, API key, axios call, result mapping)
- Contains domain filtering (`prioritize()` function)
- Exports `search(query)` per the provider contract

### How to add a new provider

1. Create `src/services/webSearch/newProvider.js` exporting `async function search(query)`
2. Update `src/services/webSearchService.js` to delegate to the new provider

The AI service (`aiAssistantService.js`) is never touched — it imports `{ search }` from the facade.

### Verification

```
Facade exports: [ 'search' ]       ✓
Provider exports: [ 'search' ]     ✓
Results: 5                         ✓
```

---

## Change 2 — System prompt: smarter webQuery usage

### Problem

Previous prompt forced `webQuery` for ALL general knowledge questions ("Kiến thức tổng quát → webQuery"). The model should answer directly from its own knowledge when confident.

### Solution

Updated routing rules:

```
- Kiến thức ổn định bạn đã biết rõ → Trả lời trực tiếp từ kiến thức
- Thông tin cần cập nhật (tin tức, khuyến nghị mới, nghiên cứu, dẫn nguồn) → webQuery
```

webQuery description changed from:
```
Tìm kiếm trên web các nguồn đáng tin cậy.
→ Dùng cho: kiến thức tổng quát, dinh dưỡng, sức khỏe, thể thao, gym, fitness
```

To:
```
Tìm kiếm trên web các nguồn y khoa và khoa học đáng tin cậy.
→ Dùng cho: thông tin cần cập nhật, tin tức, khuyến nghị mới, nghiên cứu khoa học
```

### Expected routing

| Question | Behavior |
|---|---|
| "Protein là gì?" | Model answers directly (stable knowledge) |
| "Cách tăng cơ?" | Model answers directly (stable knowledge) |
| "Khuyến nghị protein mới nhất 2026?" | `webQuery` (need recent update) |
| "Nghiên cứu mới về creatine?" | `webQuery` (scientific update) |
| "Tôi còn bao nhiêu tiền?" | `databaseQuery` (personal data) |

---

## Change 3 — Trusted domains moved from prompt to provider

### Problem

Hardcoded domain names (`who.int`, `nih.gov`, etc.) were in the system prompt, making them visible to the AI and hard to maintain.

### Solution

**Removed from prompt** (lines 45-53 deleted):
```
~~NGUỒN WEB ƯU TIÊN (trusted domains):
- who.int
- nih.gov
- mayoclinic.org
- healthline.com
- examine.com
- verywellfit.com

Ưu tiên các nguồn trên. KHÔNG ưu tiên blog cá nhân hoặc trang thương mại điện tử.~~
```

**Moved to `webSearch/tavilyProvider.js`** (internal constant):
```js
const TRUSTED_DOMAINS = [
  'who.int',
  'nih.gov',
  'mayoclinic.org',
  'healthline.com',
  'examine.com',
  'verywellfit.com',
]
```

**Filtering logic** in `prioritize()`:
- Results from trusted domains are placed FIRST in the array
- Other results follow after
- Gemini naturally picks the top results first

The AI only knows the prompt instruction: _"các nguồn y khoa và khoa học đáng tin cậy"_ — no specific domain names leak into the LLM context.

---

## Files changed

| File | Action | Summary |
|---|---|---|
| `src/services/webSearch/tavilyProvider.js` | **Created** | Tavily implementation + domain prioritizing, 59 lines |
| `src/services/webSearchService.js` | **Rewritten** | Now a 5-line facade delegating to the provider |
| `ai-knowledge/prompts/system-prompt-vi.md` | **Modified** | Routing rules favor direct answers; trusted domains removed |
| `src/services/aiAssistantService.js` | **Unchanged** | Import path `'./webSearchService.js'` still works |

---

## Verification

```
Facade exports: [ 'search' ]              ✓
Provider exports: [ 'search' ]            ✓
Results via facade: 5                     ✓
First result: "Creatine là gì?"           ✓
Source: hellobacsi.com                    ✓
Module loads without import errors        ✓
```
