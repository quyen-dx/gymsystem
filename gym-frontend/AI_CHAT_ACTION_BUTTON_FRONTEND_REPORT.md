# AI Chat Action Button — Frontend Report

## Summary

Renders structured `actions` from the AI response as clickable navigation buttons below the assistant message bubble.

## Files Modified

| File | Change |
|------|--------|
| `src/types/aichat/aichat.ts` | Added `AiAction` type |
| `src/services/api.ts` | Added `onAction` callback to `StreamCallbacks`, `event: action` SSE handler, `actions` in `sendChatMessage` return type |
| `src/components/chat/AiChatWidget.tsx` | Added `ActionButton` to `ChatMessage`, `useNavigate` integration, `onAction` callback, button rendering, `ICON_MAP` |

## Changes in Detail

### 1. `src/types/aichat/aichat.ts` — New Type

```ts
export type AiAction = {
  label: string
  route: string
  icon: string
  variant: 'primary' | 'secondary'
}
```

### 2. `src/services/api.ts` — SSE Handler

New callback in `StreamCallbacks`:
```ts
onAction: (action: { label: string; route: string; icon: string; variant: string }) => void
```

New SSE event parsing:
```ts
else if (eventType === 'action') callbacks.onAction(data)
```

### 3. `src/components/chat/AiChatWidget.tsx` — Button Rendering

**Interface** — added `actions?: ActionButton[]` to `ChatMessage`.

**Streaming** — `onAction` appends to the active assistant message during streaming (same bubble, no new message):
```ts
onAction: (action) => setMessages(prev => prev.map(
  m => m.id === botId ? { ...m, actions: [...(m.actions || []), action] } : m
))
```

**Non-streaming** — `actions` propagated from `data.actions` in fallback:
```ts
actions: data.actions
```

**Render** — after the "Sao chép" button, when message is complete:
- Purple filled button for `variant: 'primary'`
- Outlined purple button for `variant: 'secondary'`
- Icon rendered from `ICON_MAP` lookup
- `navigate(action.route)` using `react-router-dom` (`useNavigate`)
- Hidden during typing animation (only shown when message complete)

**Icon map**:
```ts
{ wallet: '💰', document: '📋', 'id-card': '🎫', calendar: '📅', clock: '⏱', shop: '🛒', user: '👤' }
```

## Visual

```
┌────────────────────────────────┐
│ Bạn có thể kiểm tra số dư ví    │
│ của mình bất cứ lúc nào.        │
│                                │
│ [💰 Xem ví]  [🎫 Hội viên]     │
└────────────────────────────────┘
         Sao chép
```

## Backward Compatibility

- `actions` missing or `[]` → no buttons rendered, text only
- Streams without `event: action` → no buttons
- Works with both streaming and non-streaming API calls

## No Backend Changes Required

Backend already returns `actions` in JSON response and emits `event: action` in SSE stream.
