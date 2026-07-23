# Sprint 5 — Vision Architecture

## Objective

Prepare GymPro AI to support image understanding (body assessment, meal analysis, food label reading, posture check).

**No AI call logic implemented — architecture only.**

---

## Architecture

```
User (frontend image picker)
│
▼
POST /api/ai/vision  (multipart/form-data)
│
▼
visionRoutes.js  (multer validation)
│
▼
visionController.js  (validate → normalize → call provider → normalize)
│
▼
googleVisionProvider.js  (Gemini SDK — analyzeImage)
│
▼
Response: { analysis, fileName, fileSize }
```

---

## New files

### 1. `src/ai/providers/googleVisionProvider.js`

**Responsibility**: Wrap Gemini SDK for image analysis.

- `isVisionAvailable()` — checks if client is initialized
- `getVisionModel()` — returns model name
- `analyzeImage({ imageData, mimeType, prompt })` — sends image + prompt to Gemini

Uses `inlineData` for image transfer (base64), `temperature: 0.2` for consistent output.

**No business logic. No validation.**

### 2. `src/ai/tools/visionTool.js`

**Responsibility**: Validate and normalize vision requests/responses.

- `SUPPORTED_FORMATS`: `['image/jpeg', 'image/png', 'image/webp']`
- `SUPPORTED_EXTENSIONS`: `['jpg', 'jpeg', 'png', 'webp']`
- `MAX_FILE_SIZE`: 20MB
- `VISION_DECLARATION`: Gemini function definition for vision analysis
- `validateMimeType(mimeType)` — checks if mime is in allowed list
- `validateExtension(filename)` — checks file extension
- `validateFileSize(size)` — checks size <= MAX_FILE_SIZE
- `normalizeRequest(file)` — converts multer file to `{ imageData, mimeType, originalName, size }`
- `normalizeResponse(aiResponse)` — extracts text from Gemini response

**No Gemini SDK imports. No provider logic.**

### 3. `src/ai/prompts/visionPrompt.md`

Vietnamese system prompt for image analysis. Contains 4 analysis modes:

| Intent | Purpose |
|---|---|
| `body_assessment` | Evaluate body composition, suggest exercises/nutrition |
| `meal_analysis` | Identify foods, estimate portions, calculate nutrition |
| `food_label` | Read nutrition labels, interpret values |
| `posture_check` | Analyze exercise form, detect errors, safety notes |

Rules: Vietnamese only, 5-7 sentences max, no diagnosis, use "khoảng/ước lượng" for estimates.

### 4. `src/ai/utils/visionConfig.js`

**Responsibility**: Load and cache the vision prompt.

- `getVisionPrompt()` — returns cached prompt text
- Re-exports `SUPPORTED_FORMATS`, `SUPPORTED_EXTENSIONS`, `MAX_FILE_SIZE` from visionTool

### 5. `src/controllers/visionController.js`

**Responsibility**: Handle `POST /api/ai/vision` request lifecycle.

1. Validate file exists → 400 if missing
2. Validate mime type → 400 if unsupported
3. Validate extension → 400 if invalid
4. Validate file size → 400 if too large
5. Normalize request via visionTool
6. Call `analyzeImage()` via googleVisionProvider
7. Normalize response via visionTool
8. Return `{ analysis, fileName, fileSize }`

### 6. `src/routes/visionRoutes.js`

```
POST /api/ai/vision
  - protect (auth middleware)
  - upload.single('image') (multer with memoryStorage, 20MB limit, jpg/jpeg/png/webp filter)
  - postVision (controller)
```

---

## Backend changes

### `server.js`

Added:
```js
import visionRoutes from './src/routes/visionRoutes.js'
app.use('/api/ai', visionRoutes)
```

Route registered under `/api/ai` prefix → final path is `POST /api/ai/vision`.

---

## Frontend changes

### `src/services/api.ts`

Added `sendVisionImage(file, prompt?)`:
```ts
export const sendVisionImage = async (file: File, prompt?: string) => {
  const formData = new FormData()
  formData.append('image', file)
  if (prompt) formData.append('prompt', prompt)
  const { data } = await api.post('/ai/vision', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { analysis: string; fileName: string; fileSize: number }
}
```

### `src/components/chat/AiChatWidget.tsx`

Added:

| Feature | Detail |
|---|---|
| `selectedImage` state | Stores the picked File |
| `imagePreview` state | ObjectURL for preview rendering |
| `isImageLoading` state | Separate loading state for vision |
| `fileInputRef` | Hidden `<input type="file">` |
| Image picker button | 🖼 button next to text input |
| Image preview | 48x48 thumbnail with ✕ remove button |
| Image in message bubble | Renders `<img>` above text when `imageUrl` is set |
| Vision API call | `sendVisionImage()` via `FormData` |
| Validation | Client-side: jpg/png/webp only, 20MB max |

Button text changes to "Phân tích" when an image is selected.

---

## Verification

```
googleVisionProvider exports: [analyzeImage, getVisionModel, isVisionAvailable]    ✓
visionTool exports: [VISION_DECLARATION, validateMimeType, validateExtension, ...]  ✓
Vision prompt loaded: YES (1066 chars)                                              ✓
visionRoutes exports: [default]                                                     ✓
visionController exports: [postVision]                                              ✓
All vision modules load correctly                                                   ✓
```

---

## Future integration

To connect Vision into the AI orchestration:

1. Add `VISION_DECLARATION` to `toolRegistry.js`
2. Add vision dispatch case in `assistant/aiAssistantService.js`
3. The two-turn function calling flow handles vision naturally (user sends image → Gemini calls `visionAnalysis` → backend processes → Gemini summarizes)

No architecture changes needed — the provider, tool, prompt, and route are already in place.
