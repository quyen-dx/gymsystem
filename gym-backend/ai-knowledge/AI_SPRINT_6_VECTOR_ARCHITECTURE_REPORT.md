# AI Sprint 6 — Vector Knowledge (RAG Foundation)

## 1. Files Created

| File | Purpose |
|------|---------|
| `src/ai/providers/vectorProvider.js` | Embedding + vector search abstraction (Gemini `gemini-embedding-001`, file-based JSON store, cosine similarity). Follows same facade pattern as `visionProvider.js`. |
| `src/ai/tools/vectorTool.js` | `VECTOR_QUERY_DECLARATION` function definition, query validation, error handling, standardized response normalization. Exports `vectorQuery`. |
| `src/ai/prompts/vectorPrompt.md` | RAG prompt — guides LLM to use `vectorQuery`, never hallucinate policies, say "không có thông tin" if empty. |
| `scripts/seedKnowledge.js` | Seeder — scans `ai-knowledge/` recursively, reads `.md` files, chunks by configurable `chunkSize`/`chunkOverlap`, embeds via Gemini, saves to `.vectors.json`. |
| `ai-knowledge/.vectors.json` | Generated vector store (26 document chunks, 13 source files). |
| `ai-knowledge/faq/general.md` | FAQ: hours, registration, cancellation, towel service, shop. |
| `ai-knowledge/membership/refund-policy.md` | Refund policy: 7-day window, 100% refund, process, exceptions. |
| `ai-knowledge/membership/freeze-policy.md` | Freeze policy: 30d max, 2x/year, fees, process. |
| `ai-knowledge/membership/benefits.md` | Plan benefits: Tháng (500k), Quý (1.2M), Năm (4M), Premium (8M). |
| `ai-knowledge/membership/renewal.md` | Renewal: auto/manual, discounts, bonus months/PT. |
| `ai-knowledge/policies/gym-rules.md` | Gym rules: attire, equipment, safety, zones, violation tiers. |
| `ai-knowledge/policies/terms-of-use.md` | Terms: account, rights/obligations, termination. |
| `ai-knowledge/shop/return-policy.md` | Shop return: 7-day return, exclusions, refund method. |
| `ai-knowledge/pt/pt-policy.md` | PT policy: booking, cancellation, rights per plan, change PT. |
| `ai-knowledge/exercise/guide.md` | Exercise guide: warm-up, beginner routine, weekly schedule. |
| `ai-knowledge/nutrition/guide.md` | Nutrition guide: macros, pre/post meals, foods to avoid. |
| `ai-knowledge/guides/checkin.md` | Check-in guide: at counter, via app, failure handling. |
| `ai-knowledge/system/overview.md` | GymPro intro: services, contact info. |

## 2. Files Modified

| File | Change |
|------|--------|
| `src/ai/utils/toolRegistry.js` | Added `VECTOR_QUERY_DECLARATION` import + registration to `getAllDeclarations()`. |
| `src/ai/assistant/aiAssistantService.js` | Added `import { vectorQuery }`, dispatch case `name === 'vectorQuery'` before `webQuery`. |
| `ai-knowledge/prompts/system-prompt-vi.md` | Added tool #3 (`vectorQuery`), routing rule (policies → `vectorQuery`), error handling for 3 error codes + empty documents. |

## 3. Provider Abstraction

`vectorProvider.js` is a **direct implementation** (not a facade), providing:
- `embedQuery(text)` — calls Gemini `gemini-embedding-001`, returns embedding vector (3072d).
- `searchKnowledge(query, { topK, minScore })` — embed → cosine similarity → filter → sort → trim.
- `isVectorAvailable()` — checks `.vectors.json` exists and has documents.

Future providers (Pinecone, MongoDB Atlas, Chroma, Qdrant) follow same interface:
```js
export async function searchKnowledge(query, options) { ... }
export async function embedQuery(text) { ... }
export async function isVectorAvailable() { ... }
```

Swap via `VECTOR_PROVIDER` env var or direct import replacement.

## 4. Seeder Design

- **Scan**: Recursive walk of `ai-knowledge/`, excludes `prompts/`, `.vectors.json`, `AI_*` reports.
- **Read**: Extracts title (`# Heading` or filename), category (parent folder name), source (relative path), `updatedAt` (file mtime).
- **Chunk**: Configurable `CHUNK_SIZE` (default 500) / `CHUNK_OVERLAP` (default 50). Splits at newline boundaries when possible.
- **Embed**: Calls Gemini `models.embedContent` with model `gemini-embedding-001`. Each failed chunk is logged and skipped.
- **Save**: Writes `{ documents: [...], metadata: { totalDocuments, chunkSize, chunkOverlap, seededAt } }` to `.vectors.json`.

Usage:
```bash
node --env-file=.env scripts/seedKnowledge.js
# Or with custom chunk config:
CHUNK_SIZE=300 CHUNK_OVERLAP=30 node --env-file=.env scripts/seedKnowledge.js
```

## 5. Chunk Strategy

- **chunkSize**: 500 characters (configurable via `CHUNK_SIZE` env).
- **chunkOverlap**: 50 characters (configurable via `CHUNK_OVERLAP` env).
- **Boundary awareness**: Prefers `\n` boundaries within the window to avoid mid-sentence splits.
- **Metadata per chunk**: `id`, `title`, `category`, `source`, `content`, `updatedAt`, `embedding`.

## 6. Future Migration Strategy

| Provider | Migration Path |
|----------|---------------|
| **MongoDB Atlas Vector Search** | Create `vectorMongoProvider.js` using `mongodb` driver + `$vectorSearch`. Replace import. |
| **Pinecone** | Create `vectorPineconeProvider.js` using Pinecone SDK. Same interface. |
| **Chroma** | Create `vectorChromaProvider.js` using Chroma client. Same interface. |
| **Qdrant** | Create `vectorQdrantProvider.js` using Qdrant client. Same interface. |
| **Different embedding model** | Change `EMBEDDING_MODEL` or abstract `embedQuery()` behind a model-agnostic call. |

The seeder's output format (`.vectors.json`) is the **single source of truth** — migration scripts can read this, re-embed with provider-specific models, and bulk-insert to target databases.

## 7. Compatibility Analysis

| Component | Status | Evidence |
|-----------|--------|----------|
| Existing AI still works | **✔** | Orchestration unchanged: `databaseQuery`, `webQuery` dispatch order preserved. New `vectorQuery` case added before them. |
| Database Tool unchanged | **✔** | `src/ai/tools/databaseTool.js` — zero changes. |
| Web Tool unchanged | **✔** | `src/ai/tools/webTool.js` — zero changes. |
| Vision Tool unchanged | **✔** | `src/ai/tools/visionTool.js` — zero changes. |
| Vector Tool registered | **✔** | `toolRegistry.js` now returns 3 declarations: `databaseQuery`, `webQuery`, `vectorQuery`. |
| Seeder reads markdown | **✔** | 13 source files → 26 chunks, verified on real run. |
| Knowledge directory detected | **✔** | 9 category folders under `ai-knowledge/`. |
| Vector search returns results | **✔** | Verified: "Chính sách hoàn tiền" → 5 documents, "Hướng dẫn check-in" → 5 documents. |
| Empty query returns error | **✔** | Returns `{ error: 'INVALID_QUERY' }`. |
| Provider abstraction | **✔** | Direct implementation with documented interface for future swap. |
| Configurable chunking | **✔** | `CHUNK_SIZE`, `CHUNK_OVERLAP` env vars. |
| Standardized response | **✔** | `{ source, success, documents, suggestions, metadata }`. |

## Sprint Summary

Sprint 6 delivers a complete RAG foundation: vector provider with Gemini embeddings, search tool with function declaration and standardized response, knowledge base with 13 documents across 9 categories, configurable seeder, and system prompt integration. The architecture is provider-agnostic — Pinecone, MongoDB Atlas Vector Search, or other backends can replace the file-based store without changing the AI assistant or tool layer.
