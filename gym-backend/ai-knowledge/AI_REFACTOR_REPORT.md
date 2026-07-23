# AI Refactor — Clean Architecture

## Before

```
src/services/
    aiAssistantService.js        ← 251 lines, monolithic
```

All responsibilities mixed in one file: provider init, prompt loading, tool declarations, tool execution, response parsing, orchestration.

## After

```
src/ai/
    assistant/
        aiAssistantService.js    ← 79 lines (orchestration only)
    providers/
        googleProvider.js        ← 42 lines (Gemini SDK wrapper)
    tools/
        databaseTool.js          ← 167 lines (databaseQuery logic)
        webTool.js               ← 37 lines (webQuery logic)
    prompts/
        systemPromptLoader.js    ← 18 lines (load + cache prompt)
    utils/
        toolRegistry.js          ← 9 lines (declarations registry)
        responseParser.js        ← 12 lines (extract text/functionCall)

src/services/
    aiAssistantService.js        ← 1 line (re-export shim)
```

## Files moved

| Old location | New location | Lines |
|---|---|---|
| — | `src/ai/prompts/systemPromptLoader.js` | 18 (new) |
| — | `src/ai/providers/googleProvider.js` | 42 (new) |
| — | `src/ai/tools/databaseTool.js` | 167 (new) |
| — | `src/ai/tools/webTool.js` | 37 (new) |
| — | `src/ai/utils/toolRegistry.js` | 9 (new) |
| — | `src/ai/utils/responseParser.js` | 12 (new) |
| — | `src/ai/assistant/aiAssistantService.js` | 79 (new) |
| `src/services/aiAssistantService.js` | — | 1 (re-export shim) |

## Responsibilities of every file

### `assistant/aiAssistantService.js` — Orchestration

```
process()
  → build context (prompt + user info)
  → register tools (from toolRegistry)
  → call provider.generateContent()
  → if functionCall: execute tool, call provider again with functionResponse
  → return text or fallback
```

Contains:
- `ROLE_LABELS` mapping
- `buildContents()` — resolves prompt templates with user data
- `process()` — the main orchestration flow
- Tool dispatch logic (`if name === 'webQuery'`)

**No provider logic, no tool logic, no prompt loading.**

### `providers/googleProvider.js` — Provider

Contains:
- GoogleGenAI client initialization
- `isAvailable()` — checks client readiness
- `getModel()` — returns model name
- `makeFunctionResponsePart()` — wraps `createPartFromFunctionResponse` from SDK
- `generateContent()` — calls `aiClient.models.generateContent()`

**No business logic, no tool logic, no orchestration.**

### `tools/databaseTool.js` — Database tool

Contains:
- `SUPPORTED_INTENTS` array
- `DATABASE_QUERY_DECLARATION` (function definition for Gemini)
- `determineStatus()` — internal helper
- `databaseQuery(intent, user)` — queries wallet, membership, booking, notification services

**No Gemini SDK imports, no orchestration.**

### `tools/webTool.js` — Web search tool

Contains:
- `WEB_QUERY_DECLARATION` (function definition for Gemini)
- `webQuery(query)` — calls webSearchService, returns `{ results }` or `{ error: 'NO_RESULT' }`

**No Gemini SDK imports, no orchestration.**

### `prompts/systemPromptLoader.js` — Prompt loader

Contains:
- Prompt file path resolution
- File read at module scope (cache)
- `getSystemPrompt()` — returns cached prompt text

**No AI logic, no orchestration.**

### `utils/toolRegistry.js` — Tool registry

Contains:
- Imports both tool declarations
- `getAllDeclarations()` — returns array for Gemini API

**Single responsibility: provide available tool definitions.**

### `utils/responseParser.js` — Response parser

Contains:
- `getFirstPart(response)` — extracts first part from Gemini response
- `hasFunctionCall(part)` — checks if part contains a function call
- `extractText(response)` — extracts text safely with `|| ''` fallback

**Single responsibility: parse Gemini response structure.**

### `src/services/aiAssistantService.js` — Shim

```js
export { process } from '../ai/assistant/aiAssistantService.js'
```

One-line re-export so `aiController.js` (and any other existing importer) works without changes.

## Why future providers become easier

To add a new AI provider (e.g., OpenAI, Anthropic):

1. Create `src/ai/providers/openaiProvider.js`
   - Export `isAvailable()`, `generateContent()`, `makeFunctionResponsePart()`, `getModel()`
2. Update `assistant/aiAssistantService.js` to use the new provider

**No tool changes, no prompt changes, no response parser changes.**

To add a new tool (e.g., Vision, Vector, Memory):

1. Create `src/ai/tools/visionTool.js`
   - Export `VISION_DECLARATION` and `visionQuery()`
2. Add to `src/ai/utils/toolRegistry.js`
3. Add dispatch case in `assistant/aiAssistantService.js`

**No provider changes, no prompt loader changes.**

## Verification

All tests passed — modules load, imports resolve, exports match:

```
systemPromptLoader OK — exports: [getSystemPrompt]
googleProvider OK — exports: [generateContent, getModel, isAvailable, makeFunctionResponsePart]
databaseTool OK — exports: [DATABASE_QUERY_DECLARATION, SUPPORTED_INTENTS, databaseQuery]
webTool OK — exports: [WEB_QUERY_DECLARATION, webQuery]
toolRegistry OK — exports: [getAllDeclarations]
responseParser OK — exports: [extractText, getFirstPart, hasFunctionCall]
aiAssistantService OK — exports: [process]
Shim exports process: true
Shim same as new assistant: true
Prompt loaded: YES (3152 chars)
Declarations: 2 (databaseQuery, webQuery)
Controller import works: true
```

## Behavior preservation

| Aspect | Original | Refactored | Match? |
|---|---|---|---|
| `process('Xin chào', user)` → greeting | ✓ | ✓ | Same code path |
| `process` calls `databaseQuery` for personal data | ✓ | ✓ | Same logic in databaseTool.js |
| `process` calls `webQuery` for web search | ✓ | ✓ | Same logic in webTool.js |
| Two-turn function calling flow | ✓ | ✓ | Same orchestration |
| Fallback messages (4 variants) | ✓ | ✓ | Exact strings preserved |
| Error handling (429, catch block) | ✓ | ✓ | Same try/catch |
| Gemini SDK init | ✓ | ✓ | Moved to googleProvider.js |
| Prompt loading | ✓ | ✓ | Moved to systemPromptLoader.js |
| `ROLE_LABELS` | ✓ | ✓ | Same mapping |
| `buildContents()` | ✓ | ✓ | Same template resolution |
