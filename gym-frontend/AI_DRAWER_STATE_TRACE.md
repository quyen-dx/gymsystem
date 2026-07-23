# AI Drawer State Trace

## False Assumption Verified

**Assumption**: antd `<Drawer>` sets `document.body.style.overflow = 'hidden'` when opened.

**Result**: FALSE.

antd v6.3.3 Drawer wraps `@rc-component/drawer`. It does NOT implement scroll locking on `<body>`. The `overflow: hidden` patterns found in the antd source are CSS rules on internal component elements (`.ant-drawer-body`, modal content, etc.) — never `document.body.style`.

**Evidence**: Full text search of `node_modules/antd/es/drawer/*.js` and `node_modules/antd/es/**/*.js` for `body.style.overflow`, `lockScroll`, `scrollLock` — zero matches in Drawer or shared utilities.

## Real Drawer State

All drawer/overlay states are local `useState` in their respective components:

| Component | File | State Variable |
|---|---|---|
| Member mobile nav | `MemberLayout.tsx:67` | `menuOpen` |
| Dashboard mobile sidebar | `DashboardLayout.tsx:64` | `sidebarOpen` |
| Account profile page drawer | `AccountProfilePage.tsx:355` | `mobileMenuOpen` |
| Account profile modal menu | `AccountProfileModal.tsx:430` | `mobileMenuOpen` |

**No global state exists** for overlay management.

## Architecture: Custom DOM Event

Each drawer dispatches `gympro:overlay-open` on `window` when its state becomes `true`. The AI chat widget listens for this event and closes itself.

### Event Flow

```
MemberLayout Drawer opens (menuOpen = true)
  → useEffect fires
  → window.dispatchEvent(new CustomEvent('gympro:overlay-open'))
  → AiChatWidget listener: setIsOpen(false)
  → Chat panel, backdrop, overlay all close
  → Floating launcher button reappears
```

### Event Producer Pattern

Every component with a drawer adds:

```ts
const [drawerOpen, setDrawerOpen] = useState(false)

useEffect(() => {
  if (drawerOpen) window.dispatchEvent(new CustomEvent('gympro:overlay-open'))
}, [drawerOpen])
```

### Event Consumer (AiChatWidget)

```ts
useEffect(() => {
  const handler = () => setIsOpen(false)
  window.addEventListener('gympro:overlay-open', handler)
  return () => window.removeEventListener('gympro:overlay-open', handler)
}, [])
```

Note: No `isOpen` dependency — listener always active. When chat is already closed, the event is a no-op.

## Files Modified

| File | Change |
|------|--------|
| `AiChatWidget.tsx` | Removed broken MutationObserver. Added `gympro:overlay-open` listener (9 lines) |
| `MemberLayout.tsx` | Added effect: dispatch `gympro:overlay-open` when `menuOpen = true` (3 lines) |
| `DashboardLayout.tsx` | Added effect: dispatch when `sidebarOpen = true` (3 lines) |
| `AccountProfilePage.tsx` | Added effect: dispatch when `mobileMenuOpen = true` (3 lines) |
| `AccountProfileModal.tsx` | Added effect: dispatch when `mobileMenuOpen = true` (3 lines) |

## Extending

To add overlay priority for any new drawer or full-screen component:

```ts
const [myOpen, setMyOpen] = useState(false)

useEffect(() => {
  if (myOpen) window.dispatchEvent(new CustomEvent('gympro:overlay-open'))
}, [myOpen])
```
