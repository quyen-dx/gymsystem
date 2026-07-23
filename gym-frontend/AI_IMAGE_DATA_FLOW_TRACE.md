# AI Image Data Flow Trace

## Trace Points

4 debug points added to `AiChatWidget.tsx`:

| Step | Offset | Line | What |
|------|--------|------|------|
| 1 | File selected | `validateAndSetImage` | `file`, `previewUrl` |
| 2 | Before `setMessages()` | `handleSend` ~L391 | `userMsg` full object |
| 3 | Inside `setMessages()` updater | `handleSend` ~L404 | `messages` array with the new msg |
| 4 | Inside `messages.map()` | render loop ~L571 | each `msg` as it renders |

Each step prints `Object.keys(msg)` and all relevant property values.

## Suspected Root Cause

Looking at the code flow:

```
Line 391: userMsg = { ... imageUrl: imagePreview || undefined }
Line 404: setMessages(prev => [...prev, userMsg])   ← stores blob URL
Line 419: handleRemoveImage()                        ← REVOKES blob URL!
```

`handleRemoveImage()` at line 419:

```ts
const handleRemoveImage = () => {
  setSelectedImage(null)
  if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null) }
}
```

This is called IMMEDIATELY after `setMessages()`, **before** React re-renders. The blob URL stored in the message (`blob:http://...`) is revoked. When the browser tries to render `<img src="blob:http://..." />`, the URL is dead → image fails to load → browser shows `alt="Uploaded"`.

## Verification

If STEP 4 shows `msg.imageUrl: "blob:http://..."` but the image renders as "Uploaded" — the blob URL was revoked between STEP 3 and STEP 4 rendering.

## Fix Location

Swap the order: call `handleRemoveImage()` BEFORE `setMessages()`, or remove the `URL.revokeObjectURL()` call (the blob will be garbage-collected when the component unmounts or when no DOM element references it).
