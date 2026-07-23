# AI Chat State Owner Report

## Runtime trace finding

```
[CHAT] overlay event RECEIVED, isOpen currently: false
```

The event IS received. `isOpen` IS `false`. The panel IS hidden. **The launcher button is still visible because `!isOpen` → `true` → renders the button.**

## Root cause: Single state conflates two concerns

`AiChatWidget` uses ONE boolean `isOpen` to control THREE things:

| Renders | When `isOpen = true` | When `isOpen = false` |
|---------|---------------------|----------------------|
| Chat panel + header | ✅ Visible | ❌ Hidden |
| Backdrop overlay | ✅ Visible | ❌ Hidden |
| Floating launcher button | ❌ Hidden | ✅ **Visible** |

When the drawer opens, `setIsOpen(false)` hides the panel and backdrop — but the launcher **reappears**.

The user's requirement was: *"hide AI launcher"* when a drawer opens. This requires the launcher to be independently controllable — it cannot be simply `!isOpen`.

## Search Results

### Only one `AiChatWidget` instance
```
AiChatWidget.tsx:192   → export default function AiChatWidget()
MemberLayout.tsx:564    → <AiChatWidget />
```
One render, one component, no duplicates.

### Only one `isOpen` state
```
AiChatWidget.tsx:203   → const [isOpen, setIsOpen] = useState(restored?.isOpen ?? false)
```
Single source of truth for chat panel visibility.

### Only one floating launcher button
```
AiChatWidget.tsx:494   → {!isOpen && (<button onClick={() => setIsOpen(true)} ...>💬</button>)}
```
Renders when `!isOpen`.

## State Ownership Model

```
AiChatWidget
  ├── isOpen          → controls panel + backdrop visibility
  └── (derived)       → !isOpen controls launcher visibility
                        ↑
                        CANNOT independently hide launcher
                        while panel is closed
```

## Required: Two independent states

```
AiChatWidget
  ├── isOpen          → controls panel + backdrop visibility
  └── launcherHidden  → controls launcher visibility (NEW)
  
  Launcher renders when: !isOpen && !launcherHidden
  Panel renders when:    isOpen
  Backdrop renders when: isOpen
```

### Event handling

```
gympro:overlay-open received
  → setIsOpen(false)        ← close panel
  → setLauncherHidden(true) ← hide launcher
  → Start polling for drawer close (MutationObserver on .ant-drawer-root)
    → When drawer root disappears → setLauncherHidden(false) ← restore launcher
```

## Duplicate Instances

| What | Count | File |
|------|-------|------|
| `AiChatWidget` component | **1** | `MemberLayout.tsx:564` |
| `useState(false)` for chat | **1** | `AiChatWidget.tsx:203` |
| Floating launcher button | **1** | `AiChatWidget.tsx:494` |
| `gympro:overlay-open` listener | **1** | `AiChatWidget.tsx:303` |
| `gympro:overlay-open` dispatcher | **4** | MemberLayout, DashboardLayout, AccountProfilePage, AccountProfileModal |
| `MemberLayout` render (with AiChatWidget) | **1** per member route | Used as layout route wrapper |
| `AiChatPage` (dead code, uses MemberLayout) | Not routed | `AiChatPage.tsx:5` — unused in App.tsx |

## Files to Modify (not done)

| File | Change |
|------|--------|
| `AiChatWidget.tsx` | Add `launcherHidden` state. Change launcher render to `!isOpen && !launcherHidden`. Set `launcherHidden = true` on `gympro:overlay-open`. Add MutationObserver to detect drawer close → `launcherHidden = false` |
