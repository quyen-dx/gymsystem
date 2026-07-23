# AI Mobile Chat UX Refactor Report

## Summary

Refactored `AiChatWidget.tsx` to behave like a modern messaging app (ChatGPT/Messenger/Intercom) on mobile, while keeping the desktop floating popup.

## Changes

### 1. Mobile Breakpoint: 640px → 768px

`useIsMobile()` now detects `(max-width: 768px)`.

### 2. Mobile Layout — Full Screen Overlay

**Before**: Floating popup, `height: 70vh`, `maxHeight: 85vh`, positioned at bottom.

**After**: Full viewport overlay starting below the app header:
```
top: calc(60px + env(safe-area-inset-top, 0px))
left: 0
right: 0
bottom: 0
paddingBottom: env(safe-area-inset-bottom, 0px)
```

### 3. Floating Button

**Before**: Always visible. Toggled between 💬 and ✕ icons.

**After**: Rendered only when `!isOpen`. Completely hidden when chat is open. Only one close button visible (the ✕ in the header).

### 4. Mobile Backdrop

Dark dimmed overlay behind the chat panel:
- `background: rgba(0,0,0,0.45)`
- `z-index: 1049` (below chat panel's 1050)
- Fade-in animation (`backdropIn 0.2s`)
- Tap backdrop → `setIsOpen(false)`

### 5. Desktop Click-Outside

Invisible overlay (`position: fixed, inset: 0, z-index: 1049`) behind the chat. Click → close. Panel `onClick={e.stopPropagation()}` prevents the click from bubbling.

### 6. Safe Area (iPhone Notch)

```css
top: calc(60px + env(safe-area-inset-top, 0px))
paddingBottom: env(safe-area-inset-bottom, 0px)
```

No controls touch the notch or home indicator on iPhone.

### 7. Animations

| Platform | Open | Close |
|----------|------|-------|
| Mobile | `slideUp 0.25s` (from bottom) | `slideDown 0.2s` (to bottom) |
| Desktop | `widgetPopup 0.22s` (scale + fade) | None (instant remove) |

### 8. Keyboard (iOS Safari)

Mobile panel uses `position: fixed; bottom: 0`. iOS Safari automatically resizes the viewport when the keyboard opens. The input stays above the keyboard since it's flex-positioned at the bottom of the fixed panel. `flex-shrink: 0` on input prevents it from collapsing.

### 9. Z-Index Stack

| Layer | z-index |
|-------|---------|
| App Header | (app-defined) |
| Drawer/Sidebar | (app-defined, higher) |
| Chat Floating Button | 1060 |
| Chat Panel | 1050 |
| Chat Backdrop / Click-Outside | 1049 |
| Page Content | (default) |

### 10. Route Changes

Chat stays open during route navigation. `useState` preserves `isOpen`, `messages`, `inputValue`. Only clears on logout or manual "Clear conversation".

### 11. Duplicate Close Buttons Removed

- Floating button hidden when chat is open
- Only `✕` in the chat header acts as close
- Backdrop tap / click-outside also closes

## Files Modified

| File | Change |
|------|--------|
| `src/components/chat/AiChatWidget.tsx` | Breakpoint 640→768, fullscreen mobile panel with safe area, backdrop overlay, click-outside, floating button hidden when open, new slide animations, removed duplicate close button |

## What Was NOT Changed

- AI backend
- SSE streaming
- Messages rendering
- Action buttons
- Suggestions
- Persistence logic
- Context memory
