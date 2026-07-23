# AI Sprint 2 — Gemini Integration: Implementation Report

**Date:** 2026-07-22  
**Scope:** Replace mocked POST /api/ai/chat response with Gemini 2.5 Flash

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Files created | 2 |
| Files modified | 2 |
| Total LOC | ~115 |
| Dependencies added | 1 (`@google/genai@^1.0.0`) |
| Frontend changes | 0 |

---

## 2. Files Changed

### 2.1 Created

#### `gym-backend/ai-knowledge/prompts/system-prompt-vi.md` (25 lines)
- Sprint 2 production system prompt (Vietnamese)
- States account data integration is NOT yet available
- Instructs polite refusal for personal-data questions: *"Tôi chưa thể truy cập dữ liệu tài khoản của bạn. Tính năng này sẽ sớm được cập nhật."*
- Absolute prohibition on fabricating numbers, dates, or personal data
- Template variables `{{userName}}` and `{{userRoleLabel}}` injected at runtime
- General knowledge (fitness, nutrition, GymPro info) still answerable

#### `gym-backend/src/services/aiAssistantService.js` (69 lines)
- **SDK:** `@google/genai` (new Google AI SDK)
- **Model:** Reads `process.env.GEMINI_MODEL`, fallback `gemini-2.5-flash`
- **Prompt loading:** `fs.readFileSync` at module init — loaded once during server startup
- **`buildContents(message, user)`:** Resolves template variables, wraps user message in `[USER_MESSAGE]` / `[/USER_MESSAGE]` boundary tags for prompt-injection defense
- **`process(message, user)`:** Sends to Gemini with `temperature: 0.1`, returns response text
- **Error handling:** No API key → *"Trợ lý hiện không khả dụng"*. API failure → *"Xin lỗi, tôi đang gặp sự cố kết nối"*. Empty response → fallback greeting

### 2.2 Modified

#### `gym-backend/src/controllers/aiController.js` (rewritten — 21 lines)
- Imports `process` from `aiAssistantService.js`
- Reuses existing input validation (empty, 4096-char max)
- Calls `aiProcess(message, req.user)` instead of returning hardcoded mock
- Returns `{ reply }` — preserves frontend contract

#### `gym-backend/package.json` (+1 line)
- Added `"@google/genai": "^1.0.0"`

---

## 3. Data Flow

```
User types message in AiChatWidget
  → POST /api/ai/chat { message }
  → protect middleware → req.user available
  → aiController.postChat
    → validate input (reuse Sprint 1 checks)
    → aiAssistantService.process(message, req.user)
      → buildContents() — resolve prompt variables, add boundary tags
      → Gemini 2.5 Flash generateContent()
      → return response text
    → res.json({ reply: responseText })
  → AiChatWidget displays reply
```

---

## 4. Verification

| Check | Result |
|-------|--------|
| `node --check src/controllers/aiController.js` | ✅ Pass |
| `node --check src/services/aiAssistantService.js` | ✅ Pass |
| `node --check server.js` | ✅ Pass |
| `@google/genai` dependency installed | ✅ `npm install` completed |
| Frontend unchanged | ✅ No files touched |
| Prompt loaded at module init | ✅ `fs.readFileSync` at top-level scope |
| Model from env var | ✅ `process.env.GEMINI_MODEL` with fallback |

---

## 5. Notes

- No function calling, no database query, no streaming, no SSE — deferred to future sprints
- System prompt is loaded ONCE at server start (module import), not per-request
- The `@google/genai` SDK is the new recommended Google AI SDK (not `@google/generative-ai`)
- No custom regex prompt-injection filtering — only `[USER_MESSAGE]` / `[/USER_MESSAGE]` boundary tags per the production system prompt pattern
- All Sprint 1 files remain unchanged (frontend, routes, server.js)
