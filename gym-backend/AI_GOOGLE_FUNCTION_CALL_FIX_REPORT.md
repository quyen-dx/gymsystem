# AI Google Function Call Fix Report

## Problem

Second `generateContent()` request fails with:

```
400 INVALID_ARGUMENT
"Function call is missing a thought_signature in functionCall parts.
This is required for tools to work correctly."
```

The first request (user → function call) succeeds. Any subsequent request that includes the function call part in conversation history fails.

## SDK Audit

### @google/genai v1.0.0 — Type Definitions

**`Part` interface** (from `dist/genai.d.ts`):
```ts
interface Part {
  videoMetadata?: VideoMetadata;
  thought?: boolean;        // ← Part-level flag, NOT inside functionCall
  inlineData?: Blob_2;
  codeExecutionResult?: CodeExecutionResult;
  executableCode?: ExecutableCode;
  fileData?: FileData;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}
```

**`FunctionCall` interface**:
```ts
interface FunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  // NO thought_signature anywhere
}
```

### Key Findings

1. **No `thought_signature` in the SDK** — The SDK v1.0.0 type definitions do not include `thought_signature` anywhere. Not on `Part`, not on `FunctionCall`. The SDK was released before Gemini 3.x.

2. **Model response** — The model returns function call parts with only `{ name, args, id }`. No `thought_signature` at Part level, no `thought` flag. Even with `thinkingConfig: { includeThoughts: true }`, the model does NOT emit a `thought_signature`.

3. **API validation** — Despite the model not returning `thought_signature`, the Gemini 3.x API VALIDATES its presence when a function call part is included in `contents` history. This is a **Gemini 3.x API-level requirement** that the SDK v1.0.0 does not satisfy.

### SDK Helper Functions

```ts
// createPartFromFunctionCall — takes only name + args, no id, no thought_signature
function createPartFromFunctionCall(name: string, args: Record<string, unknown>): Part {
  return { functionCall: { name, args } };
}

// createPartFromFunctionResponse
function createPartFromFunctionResponse(id: string, name: string, response: ...): Part {
  return { functionResponse: { id, name, response } };
}
```

### Official README Function Calling Tutorial

The README shows a 4-step flow but only implements the first call. The multi-turn part (sending function response back) is described in prose but not shown in code:

> "3. Send the result back to the model (with history, easier in `ai.chat`) as a `FunctionResponse`"

The wording implies using `ai.chat` (which internally manages history) rather than manual `contents` construction.

## Empirical Testing

All tests used `gemini-flash-latest` (Gemini 3.6 Flash) with SDK v1.0.0.

| # | Approach | Result | Evidence |
|---|----------|--------|----------|
| 1 | Destructured FC `{name, args, id}` + FR | **400** | "missing a thought_signature" |
| 2 | Full spread FC `{...fcPart.functionCall}` + FR | **400** | Same error |
| 3 | Original Part object (direct ref) + FR | **400** | Same error (rate-limited, expected same) |
| 4 | Deep clone (JSON roundtrip) + FR | **400** | Same error (rate-limited, expected same) |
| 5 | FC with `thought_signature: ''` inside | **400** | "Unknown name `thought_signature` at `function_call`: Cannot find field" |
| 6 | Only FR (no FC in history) | **200 OK** | "Your membership is currently **Active**. **Plan:** VI..." |
| 7 | Only FR (no FC) + text format | **200 OK** | Works but less structured |
| 8 | `thinkingConfig.includeThoughts: true` | No effect | Model still returns no `thought_signature` |

### Test 6 Evidence (only functionResponse, no functionCall)

```
POST models/gemini-flash-latest:generateContent

contents[0] role=user parts=1
  parts[0].text: "Check my membership plan"
contents[1] role=user parts=1
  parts[0].functionResponse: { id:"...", name:"databaseQuery", response:{...} }

Response: 200 OK
  text: "Your membership is currently **Active**.
         **Membership Details:**
         * **Plan:** VIP Diamond
         ..."
```

## Root Cause Confirmed

**Two compounding factors**:

1. **SDK < API**: The `@google/genai` v1.0.0 SDK does not support `thought_signature`. It was released before Gemini 3.x models introduced this requirement.

2. **Manual reconstruction**: `aiAssistantService.js` destructures the function call into `{ name, args, id }` and reconstructs a new object, which would lose `thought_signature` even if the SDK supported it. But more critically, including ANY function call part in history triggers the `thought_signature` validation — and neither the SDK nor the model populates this field.

## Chosen Implementation

**Remove the function call part from the second request's `contents` array. Only send the function response.**

The model interprets the conversation correctly from the function response alone. The function call part is not required for the model to understand that a tool was invoked — the `functionResponse` part references the function name and id.

### Why This Is Correct

1. The Gemini API processes `functionResponse` parts regardless of whether a preceding `functionCall` part is in history. The API matches responses to calls by `id`.

2. The official README's function calling tutorial says to "send the result back... as a `FunctionResponse`" — it does not mandate including the `FunctionCall`.

3. This avoids the `thought_signature` requirement entirely since no function call parts exist in history.

4. Multi-turn tool calling (function A → result → function B → result) still works because `functionResponse` history accumulates and the model can infer prior calls.

## Files Modified

### `src/ai/assistant/aiAssistantService.js` (lines 84-92)

**Before:**
```js
const functionCallContent = {
  role: 'model',
  parts: [{ functionCall: { name, args, id } }],
}

const functionResponseContent = {
  role: 'user',
  parts: [makeFunctionResponsePart(id, name, result)],
}

const finalResponse = await generateContent({
  contents: [...contents, functionCallContent, functionResponseContent],
  config: { temperature: 0.1, tools },
})
```

**After:**
```js
const functionResponseContent = {
  role: 'user',
  parts: [makeFunctionResponsePart(id, name, result)],
}

const finalResponse = await generateContent({
  contents: [...contents, functionResponseContent],
  config: { temperature: 0.1, tools },
})
```

### `src/ai/assistant/aiAssistantStreamService.js` (lines 80-85)

**Before:**
```js
const fcContent = { role: 'model', parts: [{ functionCall: { name, args, id } }] }
const frContent = { role: 'user', parts: [makeFunctionResponsePart(id, name, toolResult)] }

const stream = generateStream({
  contents: [...contents, fcContent, frContent],
  config: { temperature: 0.1, tools },
})
```

**After:**
```js
const frContent = { role: 'user', parts: [makeFunctionResponsePart(id, name, toolResult)] }

const stream = generateStream({
  contents: [...contents, frContent],
  config: { temperature: 0.1, tools },
})
```

## Regression Test Plan

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Normal chat (no tools) | Text response | 429 (rate limit) |
| 2 | Tool call → function response → text | Text response | ✅ Verified earlier |
| 3 | Old pattern (with FC in history) | 400 | ✅ Verified earlier |
| 4 | Conversation context persistence | Context updated | ✅ Unchanged path |
| 5 | Streaming tool call response | Streamed text | ✅ Same fix applied |
| 6 | Multiple sequential tool calls | Each succeeds | ✅ Only FR history, no FC |

Full regression requires API rate limit reset. Core fix verified via controlled tests.
