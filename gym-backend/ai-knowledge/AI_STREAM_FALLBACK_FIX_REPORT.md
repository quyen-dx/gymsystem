# AI Stream Fallback Fix Report

## Issue

When SSE streaming fails (e.g., HTTP 401) and non-streaming fallback succeeds, the UI briefly renders the raw error message (`HTTP 401`) before showing the actual assistant reply.

## Root Cause

**`AiChatWidget.tsx` lines 221-239 (`handleSend`)**

The streaming-to-nonstreaming fallback flow had two sequential state updates:

```
1. streamChatMessage fails → onError("HTTP 401") → setMessages(..., content: "HTTP 401")  ← visible
2. fallback sendChatMessage succeeds → setMessages(..., content: "Hello!")                  ← overwrites
```

Between steps 1 and 2, React renders "HTTP 401" because both operations are async and there is at least one commit cycle between them.

The `onError` callback was designed for unrecoverable errors, but in our architecture, streaming failure always triggers non-streaming fallback. Setting the message content in `onError` was always a race condition with the fallback success path.

## Fix

**File:** `gym-frontend/src/components/chat/AiChatWidget.tsx`  
**Lines:** 221 & 229 & 238

| Before | After |
|--------|-------|
| `onError` immediately called `setMessages` with the error text | `onError` stores the error in `streamError` variable, does NOT update state |
| Fallback catch showed generic fallback error | Fallback catch shows `streamError` (streaming error) or generic message |

Three changes:
1. **Line 221:** Declared `let streamError: string | null = null` before the streaming call
2. **Line 229:** Changed `onError` callback from `setMessages(...)` to `streamError = msg` — suppresses the flashing error
3. **Line 238:** In the double-failure catch, falls back to `streamError || 'Đã xảy ra lỗi...'` — preserves the streaming error when fallback also fails

## Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Streaming succeeds | Reply shown | No change |
| Streaming fails, fallback succeeds | **"HTTP 401" flashed briefly** → reply shown | Reply shown directly (no flash) |
| Streaming fails, fallback fails | Generic error | `streamError` (stream error) or generic error |
| Streaming fails (AbortError) | No error, `abortRef` null | No change |

## Reasoning

- The `onError` callback in SSE streaming should never set visible state because:
  - It fires BEFORE the caller knows whether fallback will succeed
  - Streaming failure is always followed by a non-streaming fallback attempt
  - The final message content is determined by the fallback result, not the stream error
- Storing the error in a local variable defers the decision to the fallback outcome
- If fallback succeeds, the stream error is silently discarded
- If fallback also fails, the stream error is surfaced for diagnostics
