# AI Sprint 1 — Chat Infrastructure Implementation Report

**Date:** 2026-07-22  
**Scope:** POST /api/ai/chat (mock) + Floating AI Chat Widget + Conversation history storage

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Files touched | 6 |
| Lines added | ~325 |
| Frontend files | 3 (api.ts, AiChatWidget.tsx, MemberLayout.tsx) |
| Backend files | 3 (aiController.js, aiRoutes.js, server.js) |
| New dependencies | 0 |
| Tests | N/A (no test suite configured) |

---

## 2. Files Changed

### 2.1 Backend

#### `gym-backend/src/controllers/aiController.js` (NEW — 20 lines)
- Single async handler `postChat`
- Validates `message` (required, string, ≤4096 chars)
- Returns `{ reply: "Xin chào, tôi là Trợ lý GymPro." }`
- Catches errors and returns 500

#### `gym-backend/src/routes/aiRoutes.js` (NEW — 9 lines)
- Express router
- `POST /chat` with `protect` middleware → `postChat` controller

#### `gym-backend/server.js` (MODIFIED — +2 lines)
- Import `aiRoutes`
- Register `app.use('/api/ai', aiRoutes)` at line 143

### 2.2 Frontend

#### `gym-frontend/src/services/api.ts` (MODIFIED — +5 lines)
- New exported function `sendChatMessage(message, sessionId?)`
- POSTs to `/api/ai/chat` with `{ message, sessionId }`
- Returns typed `{ reply: string }`

#### `gym-frontend/src/components/chat/AiChatWidget.tsx` (REWRITTEN — 291 lines)
- Floating circular button (bottom-right, 56px, `💬` / `✕`)
- Click opens a 380px overlay panel above the button
- **Panel contents:**
  - Header: "Trợ lý GymPro" + close button
  - Scrollable message list with user (right-aligned) and assistant (left-aligned) bubbles
  - Empty state: greeting with 👋 icon
  - Thinking indicator: three animated dots during API call
  - Text input with Enter-key support + Send button (disabled when empty/loading)
- **State management:** local `useState` (isOpen, messages[], inputValue, isLoading)
- **Error handling:** shows "Đã xảy ra lỗi, vui lòng thử lại sau." on fetch failure
- **Styling:** inline styles using existing CSS variables (`var(--theme-*)`) — no new CSS dependencies
- **Animation:** `@keyframes aiThinking` added to `index.css`

#### `gym-frontend/src/components/layout/header/MemberLayout.tsx` (MODIFIED — +2 lines)
- Import `AiChatWidget`
- Mount `<AiChatWidget />` before closing `</Layout>` — available across all member pages

---

## 3. Data Flow

```
User clicks 💬 button
  → Panel opens (isOpen = true)
  → User types message, clicks "Gửi" or presses Enter
  → User message added to local state
  → Thinking indicator shown
  → sendChatMessage(message) → POST /api/ai/chat
  → Backend returns { reply: "Xin chào, tôi là Trợ lý GymPro." }
  → Assistant reply added to local state
  → Thinking indicator hidden
  → List auto-scrolls to bottom
```

---

## 4. Verification

- Backend syntax: `node --check` passes for all 3 files
- Frontend TypeScript: `tsc --noEmit` — zero errors
- Frontend lint: no new errors (731 pre-existing errors unchanged)
- Backend endpoint: `curl -X POST http://localhost:5000/api/ai/chat -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"message":"xin chào"}'` → `{ "reply": "Xin chào, tôi là Trợ lý GymPro." }`

---

## 5. Notes

- No AI logic, no Gemini SDK, no streaming, no SSE, no database queries
- No new routes, no new pages, no App.tsx changes
- Widget auto-mounts in MemberLayout — appears on all member pages
- Input validated at 4096-char max (matching architecture spec)
- Conversation history storage deferred to Sprint 2
- All styling uses existing theme CSS variables — respects dark/light mode
