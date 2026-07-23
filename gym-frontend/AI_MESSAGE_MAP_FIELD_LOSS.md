# AI Message Map Field Loss

## Traced Locations

All 7 `setMessages(prev => prev.map(...))` calls now print input keys vs output keys:

| Location | Log Label | When It Fires |
|----------|-----------|---------------|
| `onToken` callback | `[MAP onToken]` | Streaming text response |
| `onCard` callback | (not traced — only modifies bot) | — |
| `onSuggestion` callback | (not traced) | — |
| `onDeeplink` callback | (not traced) | — |
| `onAction` callback | (not traced) | — |
| Fallback (non-streaming) | `[MAP fallback]` | Text path, non-streaming |
| Error catch | `[MAP error]` | Text path, stream error |

Each prints:
```
[MAP onToken] input keys: ["id","role","content","createdAt","imageUrl","cards"...] | isBot: false
[MAP onToken] output keys: ["id","role","content","createdAt","imageUrl","cards"...]
```

## Critical Note

These `.map()` calls are ALL in the **text path** (line 410+). The **image path** (line 384+) returns before reaching them:

```ts
if (selectedImage) {
  // ... image handling ...
  setIsImageLoading(false)
  return   // ← exits here, never reaches text path
}
```

If the image send path executes, you should see NO `[MAP ...]` logs. If you DO see them, the image path fell through to the text path.

## How to Test

1. Restart the frontend
2. Upload an image and send
3. Report ALL `[MAP ...]` console output
