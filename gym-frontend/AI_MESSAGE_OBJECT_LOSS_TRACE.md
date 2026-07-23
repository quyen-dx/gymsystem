# AI Message Object Loss Trace

## Finding from render logs

```
Object.keys(msg) = ['id', 'role', 'content', 'createdAt']
```

`imageUrl` key is completely absent from the message object at render time. This means the message was stored WITHOUT `imageUrl` — the loss happens BEFORE React state.

## All `setMessages()` call sites in AiChatWidget.tsx

| # | Line | Path | Creates User Msg With ImageUrl? | Trace |
|---|------|------|--------------------------------|-------|
| 1 | 232 | Clear user change | No | — |
| 2 | 366 | Clear conversation | No | — |
| 3 | 404 | Image send path | **YES** — `userMsg` has `imageUrl` | `[STEP 2/3]` |
| 4 | 428 | Image bot response | No (bot msg) | — |
| 5 | 431 | Image error response | No (error msg) | — |
| 6 | **443** | **Text send path** | **NO** — `userMsg` has no `imageUrl` | `[SETMSG-TEXT]` |
| 7-11 | 452-456 | Streaming updates | No (modifies existing bot msg) | `[SETMSG-STREAM]` |
| 12 | 464 | Non-streaming fallback | No (modifies existing msg) | `[SETMSG-FALLBACK]` |
| 13 | 467 | Stream error fallback | No (modifies existing msg) | `[SETMSG-FALLBACK-ERROR]` |

## Trace Logs Added At Each Site

| Site | Log Prefix | What It Prints |
|------|-----------|----------------|
| Image send (line 404) | `[STEP 2/3]` | `userMsg` keys, `imageUrl`, `imagePreview`, `selectedImage` before setMessages |
| Text send (line 443) | `[SETMSG-TEXT]` | `userMsg` keys, `imageUrl`, `selectedImage`, `imagePreview` |
| Streaming onToken (line 452) | `[SETMSG-STREAM]` | `prev.length` on each stream update |
| Non-streaming (line 464) | `[SETMSG-FALLBACK]` | Presence check |
| Error (line 467) | `[SETMSG-FALLBACK-ERROR]` | Presence check |

## Key Question

If the user sends an image, the **image send path** (line 404) should run. This path creates `userMsg` with `imageUrl: imagePreview || undefined`.

The `[STEP 2/3]` logs will show whether `imagePreview` is a valid blob URL at the moment `userMsg` is created.

If `imagePreview` is `null`/`undefined` at that point, something cleared it BEFORE `handleSend` was called.
