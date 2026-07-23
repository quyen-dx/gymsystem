# AI Chat Persistence & UX Report

## Changes

### 1. Icons Removed from Action Buttons

Buttons now show label text only — no emoji icons.

**Before**: `📅 Đặt lịch tập` → **After**: `Đặt lịch tập`

Removed:
- Icon span from button render
- `gap:6` from inline style
- `ICON_MAP` constant (no longer needed)

### 2. Full Chat Persistence (localStorage)

**Storage key**: `gympro-chat-<userId>`

**What is persisted** (debounced 300ms):

| State | Stored |
|-------|--------|
| `messages` | Yes (last 50, all fields including cards, actions, links) |
| `inputValue` | Yes (draft text) |
| `isOpen` | Yes (widget open/closed) |
| `isLoading` | No (transient) |
| `selectedImage` | No (File object, not serializable) |
| `imagePreview` | No (blob URL, non-transferable) |
| `typingProgress` | No (recomputed on restore) |

### 3. Auto-Restore on Login

On mount, reads `localStorage.getItem('gympro-chat-<userId>')` and restores `messages`, `inputValue`, and `isOpen`. Messages appear immediately — typing animation replays for restored assistant messages.

### 4. Auto-Clear on User Change

When `userId` changes (logout → login as different user), all state resets:
```ts
useEffect(() => {
  if (prev && prev !== userId) {
    setMessages([])
    setInputValue('')
    setIsOpen(false)
    setTypingProgress({})
  }
}, [userId])
```

### 5. Manual Clear Button

🗑 button added to chat header. Clears messages, input, and removes the localStorage key.

### 6. Conversation Survives Navigation

Route changes do NOT affect the chat state. The widget is rendered inside `MemberLayout` which persists across member routes. `useState` preserves values across re-renders.

## File Modified

| File | Change |
|------|--------|
| `src/components/chat/AiChatWidget.tsx` | Removed icons, added `useAuth`, `getStorageKey`, `loadState`, `saveState`, `handleClear`, persist/restore effects, clear-on-user-change effect |

## Backward Compatibility

- API calls unchanged
- Streaming behavior unchanged
- No new package dependencies (uses existing `useAuth`)
