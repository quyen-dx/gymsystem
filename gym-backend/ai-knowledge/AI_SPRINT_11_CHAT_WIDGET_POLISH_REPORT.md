# AI Sprint 11 — Chat Widget UX Polish

## 1. Files Modified

| File | Lines Before | Lines After | Changes |
|------|-------------|-------------|---------|
| `gym-frontend/src/components/chat/AiChatWidget.tsx` | 538 | 400 | Complete UX rewrite; -138 lines despite +12 features |

**No other files changed.** Backend, AI tools, APIs, streaming, rich response — all untouched.

## 2. Responsive Layout

### Desktop (`> 640px`)
- Width: 430px, Height: 640px (up from 380×560)
- Max-height: `calc(100vh - 120px)` — never overflows viewport
- Position: bottom-right, below floating button

### Mobile (`≤ 640px`)
- Bottom sheet style: `left:0, right:0, bottom:0`
- Width: 100vw, Height: 70vh, Max-height: 85vh
- Border-radius: `20px 20px 0 0` (top-rounded)
- Box-shadow: `0 -4px 24px` (shadow upward)
- No overlap with floating button (button hides when open)
- Implemented via `useIsMobile()` hook + `matchMedia`

### Tablet (640-900px implied)
- Same as desktop layout with narrower 380px width
- Height adapts to 70vh in mobile mode

## 3. Empty State & Suggested Questions

**Before:** Generic "👋 Xin chào! Tôi là Trợ lý GymPro."

**After:**
- Greeting: 👋 Xin chào! + "Tôi là Trợ lý GymPro — có thể giúp gì cho bạn?"
- 6 suggested question chips in responsive wrap layout:

| Icon | Text | Action |
|------|------|--------|
| 💰 | Ví của tôi còn bao nhiêu? | Auto-sends |
| 💳 | Gói tập còn hạn không? | Auto-sends |
| 📅 | Hôm nay tôi có lịch PT không? | Auto-sends |
| 🏋 | Creatine là gì? | Auto-sends |
| 🍱 | Phân tích bữa ăn | Auto-sends (vision) |
| 💪 | Phân tích body | Auto-sends (vision) |

Chips: `border-radius:18px`, hover scale transform, `white-space:nowrap`, flex-wrap for mobile overflow. Click → `handleSuggested(text)` → auto-sends message immediately.

## 4. Image Upload UX

### Click Upload (existing, improved)
- 📎/🖼 button in composer toolbar
- Hidden `<input type="file" accept=".jpg,.jpeg,.png,.webp">`

### Paste Image (Ctrl+V) — NEW
```ts
const handlePaste = (e: React.ClipboardEvent) => {
  for (const item of e.clipboardData?.items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) validateAndSetImage(file)
    }
  }
}
```
Bound to `onPaste` on the panel container. Works like ChatGPT — paste screenshot, image stays in buffer, preview appears.

### Drag & Drop — NEW
```ts
const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
const handleDrop = (e) => {
  e.preventDefault(); setIsDragOver(false)
  const file = e.dataTransfer.files?.[0]
  if (file?.type.startsWith('image/')) validateAndSetImage(file)
}
```
Visual overlay with dashed blue border + "Thả hình ảnh để tải lên" text during drag-over.

## 5. Image Preview

**Before:** 48×48px thumbnail with small remove button

**After:**
- 90×90px preview with rounded corners (10px)
- Remove button: 22×22px at top-right corner
- Below preview: filename + filesize (e.g., `IMG_001.jpg / 1.2 MB`)
- Format sizes via `formatFileSize()` helper (B → KB → MB)

## 6. Composer

| Feature | Implementation |
|---------|---------------|
| Auto-resize | `<textarea>` with `useEffect` — adjusts `scrollHeight` to `Math.min(120px)` |
| Min lines | 1 (`rows={1}`) |
| Max lines | 5 (`maxHeight:120px`) |
| Enter → Send | `if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }` |
| Shift+Enter → Newline | Passes through — textarea default behavior |
| Placeholder | "Nhập tin nhắn..." / "Thêm mô tả..." (when image attached) |
| Disabled state | During loading or image analysis |

## 7. Toolbar

Composer footer has:
- 🖼 Image upload button (left)
- Textarea (center, auto-resize)
- Send / Phân tích button (right)

Clean 3-element layout: `display:flex, gap:8, align-items:flex-end`.

## 8. Message Actions

Hover on assistant message → 4 action buttons:
- 📋 Copy — `navigator.clipboard.writeText()`
- 🔄 Retry — removes current bot message, re-sends previous user message
- 👍 Thumb Up (placeholder)
- 👎 Thumb Down (placeholder)

Hover on user message → 📋 Copy only.

Actions use `fadeIn` animation, appear on `mouseEnter`, disappear on `mouseLeave`. Tracked via `hoveredMsgId` state.

## 9. Animations

| Animation | Keyframes | Use |
|-----------|-----------|-----|
| `msgSlideIn` | translateY(12px)→0, opacity 0→1 | Every new message |
| `cardScaleIn` | scale(0.95)→1, opacity 0→1 | Rich response cards |
| `fadeIn` | opacity 0→1 | Message actions, empty state |
| `blink` | opacity 0↔1 | Typing cursor |
| `widgetOpen` | scale(0.95)+translateY(8px)→1 | Desktop panel open |
| `widgetOpenMobile` | translateY(100%)→0 | Mobile bottom sheet slide-up |

All animations are 0.15s–0.3s, using CSS `@keyframes` injected via `<style>` block.

## 10. Accessibility

| Feature | Implementation |
|---------|---------------|
| ESC closes widget | `useEffect` + `keydown` listener (only when `isOpen`) |
| Tab navigation | Native order: upload button → textarea → send button |
| ARIA labels | `aria-label="Mở chat"`, `aria-label="Đóng"`, `aria-label="Xoá ảnh"`, `aria-label="Đính kèm ảnh"` |
| Focus management | Textarea auto-focuses when widget opens (via ref, useEffect) |

## 11. Performance

- `useIsMobile` hook memoizes `matchMedia` listener
- `isSent` computed via `useMemo` to avoid re-render on every keystroke
- Message bubble styles computed inline (no CSS-in-JS library overhead)
- No emoji panel (placeholder only — could be lazy-loaded later)
- File size: 400 lines (down from 538)

## 12. Backward Compatibility

| Feature | Status |
|---------|--------|
| Chat messages render | ✅ Same `ChatMessage` interface |
| Streaming tokens | ✅ Same `streamChatMessage` callbacks |
| Cards rendering | ✅ `messages.cards` still passed to AssistantMessageBubble |
| Image vision analysis | ✅ Same `sendVisionImage` API |
| Non-streaming fallback | ✅ Same `sendChatMessage` + `startTyping` |
| Stop generation | ✅ AbortController still works |
| Floating button | ✅ Shows 💬 when closed, hidden when open |
