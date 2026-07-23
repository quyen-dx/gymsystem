# AI Overlay Priority Report

## Problem

When a mobile drawer (hamburger nav, account, filters, etc.) opens, the AI chat remains visible — creating multiple overlapping full-screen overlays.

## Solution

A `MutationObserver` in the AI chat widget watches `document.body.style.overflow`. Antd `<Drawer>` components set `body.style.overflow = 'hidden'` when they open. The chat widget detects this and automatically closes.

## Implementation

**File**: `src/components/chat/AiChatWidget.tsx`

Added 1 `useEffect` block (12 lines):

```ts
// Overlay priority: close chat when any antd Drawer opens
useEffect(() => {
  if (!isOpen) return
  const observer = new MutationObserver(() => {
    if (document.body.style.overflow === 'hidden') {
      setIsOpen(false)
    }
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
  return () => observer.disconnect()
}, [isOpen])
```

## How It Works

1. User taps hamburger icon → `MemberLayout` sets `menuOpen = true`
2. Antd `<Drawer open={true}>` renders → sets `document.body.style.overflow = 'hidden'`
3. `MutationObserver` fires → `setIsOpen(false)` → chat panel, backdrop, overlay all close
4. Chat floating launcher button becomes visible again (via `{!isOpen && <button/>}`)
5. User closes drawer → `body.style.overflow` removed → no effect on chat

## Coverage

| Drawer/Overlay Type | Component | Uses antd Drawer? | Detected? |
|---|---|---|---|
| Mobile nav (hamburger) | `MemberLayout.tsx` | Yes | Yes |
| Dashboard sidebar (mobile) | `DashboardLayout.tsx` | Yes | Yes |
| Account profile mobile drawer | `AccountProfilePage.tsx` | Yes | Yes |
| Account profile modal menu | `AccountProfileModal.tsx` | Custom (CSS sheet) | Via body overflow |
| Notification filter panel | `NotificationCenter.tsx` | Inline expandable | No (inline, not overlay) |
| Any antd `<Modal>` | Various | Yes | Yes |
| Any future antd `<Drawer>` | Any | Yes | Yes |

## Priority Stack

```
App Header (highest z-index)
  ↓
antd Drawer (body overflow hidden, z-index: 1000+)
  ↓
AI Chat (z-index: 1050) → auto-closes when above opens
  ↓
Page Content (default)
```

When any drawer opens: **AI chat closes**. Only one overlay at a time.

## Behavior

| Action | Result |
|--------|--------|
| Drawer opens while chat is open | Chat closes, launcher reappears |
| Drawer closes | Launcher stays visible (chat does NOT auto-reopen) |
| Chat opens while drawer is open | Chat opens normally (drawer already has priority) |
| Desktop permanent sidebar | No antd Drawer used — chat works normally, no interference |
| Tablet with hamburger drawer | Same as mobile behavior |

## Files Modified

| File | Change |
|------|--------|
| `src/components/chat/AiChatWidget.tsx` | Added `MutationObserver` effect (12 lines) watching `body.style.overflow` |

**No other files modified** — the observer catches all antd Drawers without touching `MemberLayout`, `DashboardLayout`, `AccountProfilePage`, or any other component.
