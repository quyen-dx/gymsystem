# AI Mobile Launcher Visibility Report

## Problem

On mobile/tablet, when the hamburger drawer opens, the floating AI launcher button remained visible, overlapping the drawer.

## Solution

Pass the existing `menuOpen` state from `MemberLayout` to `AiChatWidget` as a prop. Hide the launcher when both conditions are true: `isMobile && drawerOpen`.

## Changes

### 1. `MemberLayout.tsx:564` — Pass `menuOpen` as prop

```diff
- <AiChatWidget />
+ <AiChatWidget drawerOpen={menuOpen} />
```

### 2. `AiChatWidget.tsx:192` — Accept prop

```diff
- export default function AiChatWidget() {
+ export default function AiChatWidget({ drawerOpen = false }: { drawerOpen?: boolean }) {
```

### 3. `AiChatWidget.tsx:493` — Conditional launcher visibility

```diff
- {!isOpen && (
+ {!isOpen && !(isMobile && drawerOpen) && (
```

## Behavior

| State | Launcher | Panel |
|-------|----------|-------|
| Chat closed, drawer closed | ✅ Visible | ❌ Hidden |
| Chat open, drawer closed | ❌ Hidden | ✅ Visible |
| Chat closed, drawer open (mobile) | ❌ **Hidden** | ❌ Hidden |
| Chat open, drawer open (mobile) | ❌ Hidden | ❌ Hidden (closed by overlay event) |
| Desktop, drawer open | ✅ Visible (drawer is permanent sidebar, not overlay) | As normal |

## What was NOT changed

- `isOpen` state — unchanged
- Chat messages — unchanged
- Persistence — unchanged
- `gympro:overlay-open` event — unchanged (still closes the chat panel when drawer opens)
- No new state added
- No MutationObserver
- No custom events added

## Files Modified

| File | Change |
|------|--------|
| `src/components/layout/header/MemberLayout.tsx` | Pass `menuOpen` as `drawerOpen` prop (1 char change) |
| `src/components/chat/AiChatWidget.tsx` | Accept optional `drawerOpen` prop, add `!(isMobile && drawerOpen)` to launcher render condition |
