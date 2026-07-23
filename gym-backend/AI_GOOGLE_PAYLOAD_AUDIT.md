# AI Google Payload Audit — 400 INVALID_ARGUMENT

## Problem

First request to `generateContent` succeeds. Second request (with function call history) fails:

```
400 INVALID_ARGUMENT
GenerateContentRequest.contents[2].parts[0].data required oneof field 'data'
```

or more specifically:

```
Function call is missing a thought_signature in functionCall parts. 
This is required for tools to work correctly.
```

## Environment

| Item | Value |
|------|-------|
| SDK | `@google/genai` v1.0.0 |
| Model | `gemini-flash-latest` (resolves to `gemini-3.6-flash`) |
| API Key | `GOOGLE_API_KEYS` from `.env` |
| Node.js | v20.19.4 |

## Trace of the Failing Request

### Request 1 (SUCCESS)

```
POST models/gemini-flash-latest:generateContent

contents[0] role=user parts=1
  parts[0] keys: ["text"]
  parts[0].text: "Check my membership plan"
```

Response returns a function call part:

```
Response parts[0] keys: ["functionCall"]
functionCall: { name: "databaseQuery", args: { intent: "..." }, id: "..." }
```

**Notably absent from the response**: `thought_signature` — not on the Part, not inside `functionCall`. The model (Gemini 3.6 Flash) does NOT return a `thought_signature` field at all.

### Request 2 (400 FAILURE)

```
POST models/gemini-flash-latest:generateContent

contents[0] role=user parts=1        ← original user message
  parts[0] keys: ["text"]
contents[1] role=model parts=1       ← RECONSTRUCTED function call (THE BUG)
  parts[0] keys: ["functionCall"]
  parts[0].functionCall: { name, args, id }  ← ONLY 3 fields, no thought_signature
contents[2] role=user parts=1        ← function response
  parts[0] keys: ["functionResponse"]
  parts[0].functionResponse: { id, name, response }
```

**Response**: `400 INVALID_ARGUMENT — "Function call is missing a thought_signature"`

## Root Cause

### Location
`src/ai/assistant/aiAssistantService.js:84-87` (also `aiAssistantStreamService.js:80-81`)

### The Code

```js
// Line 73 — destructures ONLY 3 fields from the function call
const { name, args, id } = part.functionCall

// Lines 84-87 — reconstructs function call with ONLY those 3 fields
const functionCallContent = {
  role: 'model',
  parts: [{ functionCall: { name, args, id } }],
}

// Lines 94-97 — includes the malformed function call in the second request
const finalResponse = await generateContent({
  contents: [...contents, functionCallContent, functionResponseContent],
  config: { temperature: 0.1, tools },
})
```

### What happens

1. The model returns a function call WITHOUT `thought_signature`
2. The code reconstructs a new function call part with only `{ name, args, id }`
3. This part is sent back to the API in `contents[1]`
4. The Gemini 3.x API requires `thought_signature` on function call parts in history — even though the model itself didn't return one
5. The API returns 400

### Additional issues

Attempting to add `thought_signature: ''` to the function call object fails with:
```
Unknown name "thought_signature" at 'contents[1].parts[0].function_call': Cannot find field.
```
This confirms `thought_signature` is NOT a field inside `functionCall` — it's a Part-level field that the model didn't emit.

## Working Approaches Tested

| Approach | Result |
|----------|--------|
| **Skip functionCall part in history** | **OK** ✅ |
| Include functionCall (destructured) | 400 ❌ |
| Include functionCall (full spread `{...fcPart.functionCall}`) | 400 ❌ |
| Add `thought_signature: ''` inside functionCall | 400 ❌ |
| Use `thinkingConfig.includeThoughts: true` | No effect (model still returns no thought_signature) |

## Fix

Remove the function call part from the second request's contents. Only include the function response.

### aiAssistantService.js (lines 84-97)

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

### aiAssistantStreamService.js (lines 80-86)

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

## Affected Files

| File | Line(s) | Change |
|------|---------|--------|
| `src/ai/assistant/aiAssistantService.js` | 84-87, 95 | Remove `functionCallContent` from contents array |
| `src/ai/assistant/aiAssistantStreamService.js` | 80-81, 84-86 | Remove `fcContent` from contents array |
