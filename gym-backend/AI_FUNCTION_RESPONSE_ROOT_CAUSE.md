# AI Function Response Root Cause

## Error

```
400 INVALID_ARGUMENT
GenerateContentRequest.contents[1].parts[0].data required oneof field 'data'
```

## Evidence Chain

### Step 1: Database tool returns correctly
```
result = { balance: 93135241 }
```

### Step 2: `frPart` becomes `{}`
```
frPart = {}   ← should be { functionResponse: { id, name, response: {...} } }
```

### Step 3: Malformed payload sent to API
```
{
  "role": "user",
  "parts": [{}]    ← empty object, no valid oneof
}
```

## Root Cause

### File: `src/ai/assistant/aiAssistantService.js`, Line 84

```js
const frPart = makeFunctionResponsePart(id, name, result);  // MISSING await
```

### Why `{}` is produced

`makeFunctionResponsePart` in `chatProvider.js:71` is declared `async`:

```js
export async function makeFunctionResponsePart(id, name, result) {
  const gfn = await loadGoogleForParts()
  return gfn(id, name, result)
}
```

It's `async` because it internally `await`s a dynamic import (`loadGoogleForParts()`). The `async` keyword wraps the return value in a Promise.

When called **without** `await`, the function returns a **Promise object**, not the intended `{ functionResponse: {...} }` value.

A Promise has no enumerable own properties. When `JSON.stringify()` serializes it:
```js
JSON.stringify(Promise.resolve({ foo: 1 }))  // → "{}"
```

So `frPart = Promise {}` becomes `"{}"` in the HTTP request body. The API receives `parts: [{}]` — an empty object with no valid oneof field — and returns 400.

### Exact Trace

```
aiAssistantService.js:84
  const frPart = makeFunctionResponsePart(id, name, result)
       ↑ returns Promise (async function called without await)

chatProvider.js:71
  export async function makeFunctionResponsePart(id, name, result) {
    const gfn = await loadGoogleForParts()       // loads google's version
    return gfn(id, name, result)                  // returns { functionResponse: {...} }
  }
  // BUT: async wrapper wraps result in Promise

googleChatProvider.js:48
  export function makeFunctionResponsePart(id, name, result) {
    return createPartFromFunctionResponse(id, name, result)
  }
  // This returns correctly, but is never reached because
  // chatProvider.js is the entry point and its wrapper is async

aiAssistantService.js:95-98
  const functionResponseContent = { role: 'user', parts: [frPart] }
  // frPart is a Promise → serialized as {}
  // Result: { role: 'user', parts: [{}] }
```

### Same Bug

`src/ai/assistant/aiAssistantStreamService.js:80`:

```js
const frPart = makeFunctionResponsePart(id, name, toolResult);  // MISSING await
```

## Fix

Add `await` to both call sites:

### `src/ai/assistant/aiAssistantService.js:84`

```diff
- const frPart = makeFunctionResponsePart(id, name, result);
+ const frPart = await makeFunctionResponsePart(id, name, result);
```

### `src/ai/assistant/aiAssistantStreamService.js:80`

```diff
- const frPart = makeFunctionResponsePart(id, name, toolResult);
+ const frPart = await makeFunctionResponsePart(id, name, toolResult);
```

## Why This Was Always Broken

`makeFunctionResponsePart` in `chatProvider.js` has always been `async` (it uses `await loadGoogleForParts()` for lazy Google provider loading). But the call sites in both assistant services never used `await`. This means function calling (tool calls) has never worked in production — the second API request always sent `parts: [{}]`.

The first request (plain text, no tools) always worked because `generateContent` IS properly awaited.
