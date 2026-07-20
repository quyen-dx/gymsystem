# Task 0.5 — Implementation Report

> **Task:** 0.5 — AI Core Infrastructure
> **Sprint:** 0 (Foundation)
> **Status:** Complete
> **Date:** 2026-07-20

---

## Objective

Build the AI infrastructure layer — provider abstraction, factory, registry, tool registry, error types, and constants. Zero business module dependencies. Designed as a platform that Sprint 6 (Full AI Subsystem) plugs into. No conversational AI, no RAG, no tool calling, no business integration.

---

## Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `src/ai/aiConstants.js` | Immutable constants for health status values, provider types, and error codes. Single source of truth for AI-specific enum values used across all AI modules. |
| 2 | `src/ai/aiErrors.js` | Five AI-specific error classes extending `AppError`: `AIProviderError` (base), `AIProviderUnavailableError` (503), `AIProviderQuotaError` (429), `AIToolNotFoundError` (404), `AIToolExecutionError` (500). Each carries contextual metadata (provider name, tool name, cause). |
| 3 | `src/ai/providerFactory.js` | Factory that creates provider instances from type + config. Currently supports `gemini` type via `createProvider('gemini', { apiKey, model, maxTokens, temperature, name })`. Extensible via `FACTORIES` map — add `'claude'` or `'groq'` without changing any other code. |
| 4 | `src/ai/providerRegistry.js` | Registry managing named provider instances. Supports `register`, `get`, `setActive`, `list`, `remove`, `isReady`. Used by `config/ai.js` to register the default Gemini provider. Used by Sprint 6 to add fallback providers. |
| 5 | `src/ai/toolRegistry.js` | Registry managing named tool handlers with optional Zod schema validation. Supports `register`, `get`, `execute`, `list`, `remove`. `execute` validates parameters against schema and wraps handler errors in `AIToolExecutionError`. Currently empty — Sprint 6 populates with business tools. |

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/config/ai.js` | Refactored to use `providerFactory.createProvider()` and `providerRegistry.registerProvider()` instead of direct Gemini SDK usage. Public API unchanged: `isConfigured()`, `getModel()`, `getError()`, `checkAiHealth()`. `checkAiHealth()` now delegates to the active provider's `healthCheck()` method. |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CONFIG LAYER                             │
│                                                              │
│  src/config/env.js                                           │
│    │  exports: gemini { apiKey, model, maxTokens, temp }     │
│    ▼                                                         │
│  src/config/ai.js                                            │
│    │  Uses providerFactory + providerRegistry to init        │
│    │  Exports: isConfigured, getModel, checkAiHealth         │
│    ▼                                                         │
├─────────────────────────────────────────────────────────────┤
│                     AI INFRASTRUCTURE LAYER                   │
│                                                              │
│  src/ai/                                                     │
│    │                                                         │
│    ├── aiConstants.js                                        │
│    │   Exports: AI_HEALTH_STATUS, PROVIDER_TYPES,            │
│    │            AI_ERROR_CODES                               │
│    │                                                        │
│    ├── aiErrors.js                                           │
│    │   AIProviderError → AIProviderUnavailableError          │
│    │                   → AIProviderQuotaError                │
│    │                   → AIToolNotFoundError                 │
│    │                   → AIToolExecutionError                │
│    │                                                        │
│    ├── providerFactory.js                                    │
│    │   createProvider(type, config) → Provider               │
│    │   FACTORIES: { gemini: createGeminiProvider }           │
│    │                                                        │
│    ├── providerRegistry.js                                   │
│    │   registerProvider | getProvider | getActiveProvider    │
│    │   setActiveProvider | listProviders | isReady           │
│    │                                                        │
│    └── toolRegistry.js                                       │
│        registerTool | getTool | executeTool                  │
│        listTools | hasTool | removeTool                      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                     CONSUMERS (FUTURE)                        │
│                                                              │
│  Sprint 6: Intent Classifier, Planner, Permission Engine     │
│  Sprint 6: DB Tools, RAG Tools, Search Tools, Vision Tools   │
│  Health Routes: GET /api/v1/health/ai (via config/ai.js)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Provider Abstraction Diagram

```
                   Provider Interface (implicit contract)
                   ====================================
                   {
                     name: string,
                     type: string,
                     model: string,
                     generateContent(prompt): Promise<{ text, model, provider }>,
                     healthCheck(): Promise<{ status, model, latencyMs? }>,
                     dispose(): void
                   }
                          ▲
                          │ implements
            ┌─────────────┴─────────────┐
            │                           │
     GeminiProvider              ClaudeProvider
     (implemented)               (future — Sprint 6+)
            ▲                           ▲
            │                           │
            └───────────┬───────────────┘
                        │ creates
                  ┌─────┴─────┐
                  │  Provider  │
                  │  Factory   │
                  └───────────┘
                        │
                  createProvider(type, config)
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
         gemini       claude       groq
       (today)      (future)     (future)
```

Each provider implements the same contract. The factory creates the right implementation from `type`. The registry manages multiple providers and switches between them.

---

## Factory Pattern Explanation

```
  Request: createProvider('gemini', { apiKey: '...', model: '...' })
      │
      ▼
  providerFactory.js
      │
      ├── Look up factory function in FACTORIES map by type string
      │   FACTORIES = { gemini: createGeminiProvider }
      │
      ├── Call factory(config)
      │       │
      │       ├── Validate apiKey → null if missing
      │       ├── new GoogleGenerativeAI(apiKey)
      │       ├── genAI.getGenerativeModel({ model, ... })
      │       └── Return provider object:
      │           { name, type, model, generateContent, healthCheck, dispose }
      │
      └── Return provider (or null on failure)
```

**Why a factory?**
- New provider types (Claude, Groq) added by adding one function to `FACTORIES` map.
- Provider instantiation logic is encapsulated — callers don't know about Gemini SDK internals.
- Configuration is injected, not hardcoded. Providers can be created with different models/temperatures.
- Factory returns `null` on failure instead of throwing — callers decide how to handle.

**Why a registry?**
- Multiple providers can coexist (primary + fallbacks).
- Runtime provider switching (`setActiveProvider`) without restart.
- Sprint 6 fallback chain: if Gemini fails, switch to Claude via registry.
- Health monitoring: iterate all registered providers, check status.

---

## Registry Design

### Provider Registry

| Method | Signature | Description |
|--------|-----------|-------------|
| `registerProvider` | `(name, provider) → void` | Register a new provider instance |
| `getProvider` | `(name) → Provider \| null` | Get provider by name |
| `getActiveProvider` | `() → Provider \| null` | Get currently active provider |
| `getActiveProviderName` | `() → string \| null` | Get name of active provider |
| `setActiveProvider` | `(name) → void` | Switch active provider (throws if not found) |
| `listProviders` | `() → string[]` | All registered provider names |
| `hasProvider` | `(name) → boolean` | Check if provider exists |
| `removeProvider` | `(name) → boolean` | Remove provider from registry |
| `isReady` | `() → boolean` | True when at least one provider registered |

### Tool Registry

| Method | Signature | Description |
|--------|-----------|-------------|
| `registerTool` | `(name, handler, schema?) → void` | Register a tool with optional Zod schema |
| `getTool` | `(name) → { handler, schema } \| undefined` | Get tool definition by name |
| `executeTool` | `(name, params) → Promise<any>` | Execute tool with parameter validation |
| `listTools` | `() → { name, hasSchema }[]` | All registered tools |
| `hasTool` | `(name) → boolean` | Check if tool exists |
| `removeTool` | `(name) → boolean` | Remove tool from registry |

---

## Public Interfaces

### `config/ai.js` (Backward Compatible)

```js
export const isConfigured = () => boolean
export const getModel = () => Provider | null
export const getError = () => string | null
export const checkAiHealth = () => Promise<{
  status: 'healthy' | 'unhealthy' | 'skipped',
  model: string,
  latencyMs?: number,
  error?: string,
}>
```

### `ai/providerRegistry.js`

```js
export const registerProvider = (name: string, provider: Provider) => void
export const getActiveProvider = () => Provider | null
export const setActiveProvider = (name: string) => void
export const listProviders = () => string[]
export const isReady = () => boolean
```

### `ai/providerFactory.js`

```js
export const createProvider = (type: string, config: ProviderConfig) => Provider | null
export const registerProviderTypes = { GEMINI: 'gemini' }
```

### `ai/toolRegistry.js`

```js
export const registerTool = (name: string, handler: Function, schema?: ZodSchema) => void
export const executeTool = (name: string, params: any) => Promise<any>
export const listTools = () => { name: string, hasSchema: boolean }[]
```

### `ai/aiErrors.js`

```js
class AIProviderError extends AppError
class AIProviderUnavailableError extends AIProviderError
class AIProviderQuotaError extends AIProviderError
class AIToolNotFoundError extends AIProviderError
class AIToolExecutionError extends AIProviderError
```

---

## Future Extension Points

| Extension Point | How to Extend | Sprint |
|-----------------|---------------|--------|
| New AI provider (Claude, Groq) | Add `createClaudeProvider()` to `providerFactory.js`; register via `registerProvider('claude', provider)` | 6 |
| Provider fallback chain | In `providerRegistry.js`: try active, catch → `setActiveProvider('fallback')` → retry | 6 |
| Business tools (query_memberships, etc.) | Call `registerTool('query_memberships', handler, schema)` from each module's tool file | 6 |
| Tool parameter validation | Pass Zod schema as third arg to `registerTool` — `executeTool` validates automatically | 6 |
| RAG integration | New `ragRegistry.js` modeled after `toolRegistry.js` — `registerVectorStore`, `search` | 6 |
| Vision integration | New provider type in factory (`vision`) or tools registered as vision handlers | 6 |
| Multi-model routing | `setActiveProvider(name)` switches between models at runtime | 6 |
| AI conversation history | Add `conversationRegistry.js` modeled after `toolRegistry.js` | 6 |

---

## Dependency Verification

### Zero Business Module Dependencies

| AI Module | Imports From | Business Deps |
|-----------|-------------|---------------|
| `aiConstants.js` | None | ✅ None |
| `aiErrors.js` | `utils/appError.js` | ✅ None |
| `providerFactory.js` | `@google/generative-ai`, `config/logger.js`, `ai/aiErrors.js` | ✅ None |
| `providerRegistry.js` | `config/logger.js`, `ai/aiErrors.js` | ✅ None |
| `toolRegistry.js` | `config/logger.js`, `ai/aiErrors.js` | ✅ None |
| `config/ai.js` | `config/env.js`, `ai/providerFactory.js`, `ai/providerRegistry.js` | ✅ None |

No imports from: `models/`, `services/`, `controllers/`, `routes/`, `modules/`.

---

## Self-Review

Per `AI_CODING_CONSTITUTION.md` Part 14:

### Business Logic
- [x] Did I change any business rules? No.
- [x] Did I introduce new business rules? No.
- [x] Did I implement conversational AI, RAG, or business integration? No — strictly infrastructure.

### Scope
- [x] Did I stay within Sprint 0 AI scope? Yes — provider abstraction, factory, registry, tool registry, errors, constants.
- [x] Did I implement any Sprint 6 features? No.
- [x] Did I add "nice-to-have" features? `aiConstants.js` added for enum standardization — useful and within scope.

### Documentation
- [x] Did I update affected documentation? This report.
- [x] Did I create new documentation? This report only.

### Code Quality
- [x] Did I introduce duplicate logic? No — removed duplication: config/ai.js now delegates to providerFactory/registry.
- [x] Did I add console.log? No.
- [x] Did I add TODO/FIXME? No.
- [x] Did I leave commented-out code? No.

### Architecture
- [x] Did I violate dependency direction? No. AI modules are leaf nodes → import from config/ and utils/ only.
- [x] Did I introduce circular dependencies? No. config/ai.js → providerFactory/providerRegistry → aiErrors → utils/appError.
- [x] Did I violate module isolation? No. Zero cross-module dependencies.

### Permissions
- [x] Did I add endpoints without permission checks? N/A.

---

## Files Summary

| # | File | Type | Status |
|---|------|------|--------|
| 1 | `src/ai/aiConstants.js` | **Created** | ✅ Verified |
| 2 | `src/ai/aiErrors.js` | **Created** | ✅ Verified |
| 3 | `src/ai/providerFactory.js` | **Created** | ✅ Verified |
| 4 | `src/ai/providerRegistry.js` | **Created** | ✅ Verified |
| 5 | `src/ai/toolRegistry.js` | **Created** | ✅ Verified |
| 6 | `src/config/ai.js` | **Modified** | ✅ Refactored |

---

**Task 0.5 complete. Zero business module dependencies. Infrastructure ready for Sprint 6.**
