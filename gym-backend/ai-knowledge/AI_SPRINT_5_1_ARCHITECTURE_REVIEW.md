# Sprint 5.1 — Vision Architecture Enhancement

## Files modified

| File | Change |
|---|---|
| `src/ai/providers/visionProvider.js` | **Created** — provider-agnostic facade |
| `src/ai/providers/googleVisionProvider.js` | Unchanged (implementation) |
| `src/ai/tools/visionTool.js` | Refactored — removed intent enum, reduced limit to 5MB, standardized response |
| `src/ai/prompts/visionPrompt.md` | Rewritten — generic step-by-step, AI decides, JSON output |
| `src/controllers/visionController.js` | Refactored — uses provider facade, returns standardized format + backward compat fields |
| `src/routes/visionRoutes.js` | Updated — fileSize limit 20MB → 5MB |

## Architecture improvements

### 1. Provider abstraction (decoupled from Google)

**Before**: `visionController.js` imported `analyzeImage` directly from `googleVisionProvider.js`.

**After**: A new `visionProvider.js` facade sits between the controller and the implementation:

```
visionController.js → visionProvider.js (facade) → googleVisionProvider.js
```

The facade lazy-loads the provider based on `VISION_PROVIDER` env var (default: `'google'`):

```js
const name = process.env.VISION_PROVIDER || 'google'
if (name === 'google') {
  provider = await import('./googleVisionProvider.js')
}
```

To add a new provider (DeepSeek, OpenAI, etc.):
1. Create `src/ai/providers/deepseekVisionProvider.js` exporting `analyzeImage()` and `isVisionAvailable()`
2. Add a case in `visionProvider.js`
3. No changes to VisionTool, controller, or routes

### 2. VisionTool — zero business logic

**Before** (`visionTool.js`):
- `VISION_DECLARATION` had `intent` parameter with hardcoded `enum: ['body_assessment', 'meal_analysis', 'food_label', 'posture_check']`
- Backend decided image categories via the function declaration

**After**:
- `VISION_DECLARATION` is generic (no `intent`, no `enum`, no `required`)
- Tool only validates: mime type, extension, file size
- Tool only normalizes: request (buffer → base64), response (AI text → `{source, imageCategory, summary, confidence, response, suggestions}`)
- `normalizeResponse` parses JSON from AI response; falls back to `'general'` category if parsing fails
- **No `if/else`, no `switch`, no filename/mime-based classification**

```js
function normalizeResponse(aiResponse) {
  const raw = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  let parsed = null
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { parsed = null }
  return {
    source: 'vision',
    imageCategory: parsed?.imageCategory || 'general',
    summary: parsed?.summary || '',
    confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    response: parsed?.response || raw,
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
    raw,
  }
}
```

### 3. Vision prompt — AI decides, backend never decides

**Before**: 4 hardcoded categories with predefined analysis instructions. Backend selected intent.

**After**: Generic 3-step process:

```
BƯỚC 1 — XÁC ĐỊNH: Quan sát và xác định danh mục (body, food, exercise, 
                     supplement, equipment, document, receipt, membership, 
                     medical, nutrition, qr, general, unknown)
BƯỚC 2 — PHÂN TÍCH: Dựa vào danh mục, đưa ra phân tích phù hợp
BƯỚC 3 — TRẢ LỜI: Trả về JSON với cấu trúc cố định
```

All 14 categories are listed as options — the AI freely chooses based on visual content. New categories can be added to the prompt without any backend changes.

### 4. Standardized response format

**Before**: `{ analysis, fileName, fileSize }`

**After**:
```json
{
  "source": "vision",
  "imageCategory": "food",
  "summary": "Một bữa ăn gồm cơm, rau và thịt gà.",
  "confidence": 0.92,
  "response": "Đây là bữa ăn cân bằng dinh dưỡng...",
  "suggestions": ["Bổ sung thêm chất xơ", "Giảm lượng tinh bột"],
  "analysis": "Đây là bữa ăn cân bằng dinh dưỡng...",
  "fileName": "photo.jpg",
  "fileSize": 12345
}
```

**New fields** (standardized):
- `source`: always `"vision"`
- `imageCategory`: AI-determined category from 14 options
- `summary`: one-sentence summary
- `confidence`: 0.0–1.0 how sure the AI is about its classification
- `response`: detailed analysis in Vietnamese
- `suggestions`: array of actionable tips

**Backward-compatible fields** (preserved for Sprint 5 frontend):
- `analysis`: maps to `response`
- `fileName`: preserved
- `fileSize`: preserved

### 5. Upload limit reduced

```
MAX_FILE_SIZE: 20MB  →  5MB
```

Sufficient for photos from modern smartphones (typically 2–4MB). Reduces memory pressure and latency.

---

## Why generic Vision is better

| Aspect | Before (Sprint 5) | After (Sprint 5.1) |
|---|---|---|
| Image types supported | 4 (hardcoded) | 14+ (AI decides, prompt-extensible) |
| New image type | Requires backend code change + prompt update | Prompt-only update |
| Classification logic | Backend (`intent` enum) | AI (Vision model) |
| Provider coupling | Direct import of Google | Facade pattern (`VISION_PROVIDER` env) |
| Response format | Ad-hoc `{ analysis }` | Standardized `{ source, imageCategory, summary, confidence, response, suggestions }` |
| Upload limit | 20MB | 5MB |
| Tool responsibility | Validation + classification | Validation only |

---

## Future extension strategy

### Adding a new image category (e.g., "pet", "skin")
1. Add to the prompt's category list and analysis instructions
2. No backend changes needed

### Adding a new Vision provider (e.g., DeepSeek, OpenAI)
1. Create `src/ai/providers/deepseekVisionProvider.js`
2. Export `analyzeImage({ imageData, mimeType, prompt })` and `isVisionAvailable()`
3. Add case in `src/ai/providers/visionProvider.js`
4. Set `VISION_PROVIDER=deepseek` in `.env`
5. No changes to VisionTool, controller, routes, or prompt

### Adding specialized analyzers (OCR, pose estimation, barcode)
- These are independent modules, not part of VisionTool
- Create `src/ai/analyzers/ocrAnalyzer.js`, etc.
- Wire them separately — VisionTool remains a pure validation+normalization layer

---

## Compatibility analysis

| Component | Status | Detail |
|---|---|---|
| `POST /api/ai/vision` | ✅ Unchanged | Same path, same auth, same multipart field `image` |
| Upload validation | ✅ Unchanged | Same validation flow (mime → extension → size) |
| Supported formats | ✅ Unchanged | jpg, jpeg, png, webp |
| Frontend `sendVisionImage()` | ✅ Compatible | Expects `data.analysis` — still present |
| Frontend image picker | ✅ Unchanged | Same UI, same file input |
| Frontend preview/loading | ✅ Unchanged | Same behavior |
| Error handling | ✅ Unchanged | Same try/catch, same 400/500 responses |
| Existing routes | ✅ Unchanged | aiRoutes.js, server.js untouched |
| Existing AI orchestration | ✅ Unchanged | assistant/aiAssistantService.js untouched |
| Database Tool | ✅ Unchanged | untouched |
| Web Tool | ✅ Unchanged | untouched |

## Verification

```
MAX_FILE_SIZE: 5MB (target: 5MB)                          ✓
VISION_DECLARATION has intent enum: NO (GOOD)              ✓
Backward compat: analysis field in response: YES           ✓
Prompt has step-by-step: YES                               ✓
JSON parse OK: true                                        ✓
Non-JSON fallback OK: true                                 ✓
All modules load OK                                        ✓
```
