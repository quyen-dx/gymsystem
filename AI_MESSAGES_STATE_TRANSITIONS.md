# AI_MESSAGES_STATE_TRANSITIONS.md

## Goal
Trace every `setMessages()` call and the resulting `messages` state to identify which transition drops `imageUrl` from the message object keys.

## Implementation (already in AiChatWidget.tsx)

### 1. Trace Effect (lines 312–322)
Logs `[MESSAGES STATE UPDATED]` on every `messages` state change with per-message keys.

### 2. All 13 `[SETMESSAGES #N]` Labels

| Label | Location | Line | Description |
|-------|----------|------|-------------|
| `#1 clear-user` | `useEffect` on `userId` | 232 | Clear messages on user switch |
| `#2 clear` | `handleClear` | 372 | User clears conversation |
| `#3 img-user` | `handleSend` (image branch) | 397 | Append `userMsg` with `imageUrl` |
| `#4 img-bot` | `handleSend` (image branch) | 405 | Append bot response |
| `#5 img-error` | `handleSend` (image catch) | 408 | Append error bot message |
| `#6 text-all` | `handleSend` (text branch) | 420 | Append `[userMsg, botMsg]` |
| `#7 stream-token` | `onToken` callback | 429 | Streaming: update bot content |
| `#8 stream-card` | `onCard` callback | 430 | Streaming: add card |
| `#9 stream-suggest` | `onSuggestion` callback | 431 | Streaming: add suggestion |
| `#10 stream-deeplink` | `onDeeplink` callback | 432 | Streaming: add link |
| `#11 stream-action` | `onAction` callback | 433 | Streaming: add action |
| `#12 fallback` | fallback `sendChatMessage` | 441 | Non-streaming bot reply |
| `#13 fallback-err` | fallback catch | 444 | Non-streaming error |

## How to Use

1. **Start the frontend** (`npm run dev`)
2. **Open browser DevTools** → Console
3. **Clear console** (`Ctrl+L`)
4. **Upload an image** and send
5. **Copy all console output** starting from `[SETMESSAGES #3 img-user]` through the last `[MESSAGES STATE UPDATED]` block
6. **Paste it here** so we can trace the exact transition that drops `imageUrl`

## Expected Pattern (if working correctly)
```
[SETMESSAGES #3 img-user]        ← userMsg added (has imageUrl)
[MESSAGES STATE UPDATED]          ← messages state updated
  msg keys: ["id","role","content","createdAt","imageUrl"]

[SETMESSAGES #4 img-bot]          ← bot response appended
[MESSAGES STATE UPDATED]          ← messages state updated
  msg keys: ["id","role","content","createdAt","imageUrl"]  ← imageUrl should survive
```

If `imageUrl` disappears, the transition between two `[MESSAGES STATE UPDATED]` blocks will show the key missing.
