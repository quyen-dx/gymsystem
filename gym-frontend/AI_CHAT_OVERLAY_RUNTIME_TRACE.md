# AI Chat Overlay Runtime Trace

## Investigation

Added debug logs to identify which of 5 possible failures is occurring:

1. Event never dispatched
2. Event dispatched but never received
3. Event received but `setIsOpen(false)` not executed
4. `setIsOpen(false)` executes but another component immediately reopens
5. Launcher rendered from a different state than `isOpen`

## Static Analysis

### AiChatWidget — single instance
Only ONE `<AiChatWidget />` rendered in the entire app — at `MemberLayout.tsx:559`. No duplicate states.

### Event names — all consistent
All 4 dispatch sites and 1 listener use exactly `'gympro:overlay-open'`:
```
MemberLayout.tsx:71        → dispatch 'gympro:overlay-open'
DashboardLayout.tsx:67     → dispatch 'gympro:overlay-open'
AccountProfilePage.tsx:358 → dispatch 'gympro:overlay-open'
AccountProfileModal.tsx:433→ dispatch 'gympro:overlay-open'
AiChatWidget.tsx:303        → addEventListener('gympro:overlay-open', ...)
```

## Runtime Trace Logs Added

### dispatch side (MemberLayout/DashboardLayout/AccountProfilePage/AccountProfileModal)
```
[DRAWER] menuOpen changed to: true
[DRAWER] dispatching gympro:overlay-open...
[DRAWER] dispatchEvent() returned
```

### Listener side (AiChatWidget)
```
[CHAT] listener registered for gympro:overlay-open    ← on mount
[CHAT] overlay event RECEIVED, isOpen currently: true  ← when event fires
[CHAT] setIsOpen(false) executed                        ← after close
[CHAT] render isOpen=false launcherVisible=true ...     ← on re-render
```

## Files with Debug Logs

| File | Lines Added | Log Prefix |
|------|------------|------------|
| `src/components/chat/AiChatWidget.tsx` | 4 lines (listener + render) | `[CHAT]` |
| `src/components/layout/header/MemberLayout.tsx` | 3 lines | `[DRAWER]` |
| `src/components/layout/header/DashboardLayout.tsx` | 3 lines | `[DRAWER-DASH]` |
| `src/pages/auth/AccountProfilePage.tsx` | 3 lines | `[DRAWER-PROFILE]` |
| `src/pages/auth/AccountProfileModal.tsx` | 3 lines | `[DRAWER-MODAL]` |

## How to Test

1. Restart the frontend dev server
2. Open the app on mobile viewport (<=768px)
3. Open the DevTools console
4. Tap the hamburger menu button
5. Check the console output and report what you see

### Expected output if working:
```
[CHAT] render isOpen=false launcherVisible=true ...
[CHAT] listener registered for gympro:overlay-open
[CHAT] render isOpen=false launcherVisible=true ...
--- user taps hamburger ---
[DRAWER] menuOpen changed to: true
[DRAWER] dispatching gympro:overlay-open...
[DRAWER] dispatchEvent() returned
[CHAT] overlay event RECEIVED, isOpen currently: false
[CHAT] setIsOpen(false) executed
[CHAT] render isOpen=false launcherVisible=true ...
```

### If failing — the missing log tells you which step broke
