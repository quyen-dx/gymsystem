# AI Image Send Path Trace

## Debug Logs Remaining

Only 5 `console.log` calls — all in `handleSend()`:

| Line | Label | What |
|------|-------|------|
| 382 | `[SEND PATH]` | `hasImage`, `imagePreview`, `hasText` — which branch will execute |
| 387 | `[SETMESSAGES] image path` | `userMsg` full object (image branch) |
| 388 | `[SETMESSAGES] Object.keys` | Keys of the userMsg (image branch) |
| 412 | `[SETMESSAGES] text path` | `userMsg` full object (text branch) |
| 413 | `[SETMESSAGES] Object.keys` | Keys of the userMsg (text branch) |

All other debug logs removed.

## Two Possible Outcomes

### Outcome A — Image path executes
```
[SEND PATH] { hasImage: true, imagePreview: "blob:http://...", hasText: true }
[SETMESSAGES] image path userMsg: { id:..., role:"user", content:"...", createdAt:"...", imageUrl:"blob:http://..." }
[SETMESSAGES] Object.keys(userMsg): ["id","role","content","createdAt","imageUrl"]
```
→ `imageUrl` IS present in `userMsg` → bug is after `setMessages` (transformation or cleanup)

### Outcome B — Text path executes
```
[SEND PATH] { hasImage: false, imagePreview: null, hasText: true }
[SETMESSAGES] text path userMsg: { id:..., role:"user", content:"...", createdAt:"..." }
[SETMESSAGES] Object.keys(userMsg): ["id","role","content","createdAt"]
```
→ `selectedImage` is false/null → bug is image selection flow, `selectedImage` not set

## How to Test

1. Restart the frontend dev server
2. Open the AI chat
3. Upload an image via 🖼
4. Click "Gửi"
5. Report the console output
