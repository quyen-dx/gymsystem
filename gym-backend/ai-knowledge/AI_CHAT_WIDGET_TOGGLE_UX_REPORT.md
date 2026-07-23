# AI Chat Widget Toggle UX Report

## Change

**File:** `gym-frontend/src/components/chat/AiChatWidget.tsx`  
**Lines:** 283–290

The floating button now always renders and toggles its icon based on `isOpen`.

## Before

```tsx
{!isOpen && (
  <button onClick={() => setIsOpen(true)} ...>💬</button>
)}
```

- Button only rendered when widget was closed
- Always showed chat bubble (💬) icon
- Click always opened the widget

## After

```tsx
<button onClick={() => setIsOpen(o => !o)} ...>
  <span style={{ transition: ..., transform: ... }}>
    {isOpen ? '✕' : '💬'}
  </span>
</button>
```

| State | Icon | Click action |
|-------|------|-------------|
| `isOpen = false` | 💬 | Opens widget |
| `isOpen = true` | ✕ | Closes widget |

## Behavior

- **Single button** always visible at `bottom:24, right:24` (zIndex 1060, above panel)
- **Closed:** Shows chat bubble (💬), click opens widget
- **Open:** Shows X symbol (✕), click closes widget
- **Icon transition:** Wrapped in a `<span>` with `transform: rotate(90deg)` animation (0.22s ease)
- **Hover effects:** Scale 1.08 + deeper shadow, same as before
- **Header X button** at line ~300 (`setIsOpen(false)`) is unchanged — both buttons close the widget independently

## Unchanged

- Widget position, size, layout
- Chat logic, streaming, AI behavior
- Header X button
- Loading state, message handling, input
