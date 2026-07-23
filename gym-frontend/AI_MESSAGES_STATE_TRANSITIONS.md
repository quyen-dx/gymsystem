# AI Messages State Transitions

## Added

**One `useEffect`** on `[messages]` — fires after every state update:

```
[MESSAGES STATE UPDATED]
[{ id, role, imageUrl, keys }, ...]
```

**13 labeled `setMessages()` calls:**

| # | Label | When |
|---|-------|------|
| 1 | `clear-user` | User changes (logout → different user) |
| 2 | `clear` | Manual clear conversation |
| 3 | `img-user` | Image send — user message with `imageUrl` |
| 4 | `img-bot` | Image send — bot analysis response |
| 5 | `img-error` | Image send — error response |
| 6 | `text-all` | Text send — user + bot messages |
| 7 | `stream-token` | Streaming token update |
| 8 | `stream-card` | Streaming card |
| 9 | `stream-suggest` | Streaming suggestion |
| 10 | `stream-deeplink` | Streaming deeplink |
| 11 | `stream-action` | Streaming action |
| 12 | `fallback` | Non-streaming response |
| 13 | `fallback-err` | Stream error fallback |

## Expected Output for Image Send

```
[SETMESSAGES #3 img-user]
[MESSAGES STATE UPDATED]
  [{ id:..., role:"user", imageUrl:"blob:...", keys:["id","role","content","createdAt","imageUrl"] }]

[SETMESSAGES #4 img-bot]
[MESSAGES STATE UPDATED]
  [{ id:..., role:"user", imageUrl:"blob:...", keys:[...] }, { id:..., role:"assistant", imageUrl:undefined, keys:["id","role","content","createdAt"] }]
```

If `imageUrl` disappears, the `[MESSAGES STATE UPDATED]` array will show exactly which `[SETMESSAGES #N]` trigger was responsible — because the `useEffect` fires immediately after each state change, and the `messages` array shows what's in state at that moment.
