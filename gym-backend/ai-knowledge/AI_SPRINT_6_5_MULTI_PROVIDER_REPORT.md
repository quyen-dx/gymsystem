# AI Sprint 6.5 — Multi AI Provider Architecture

## 1. Before Architecture

```
aiAssistantService
  ↓  (direct import)
googleProvider.js          ← imports @google/genai SDK directly
  ↓
Gemini API

visionController.js
  ↓
visionProvider.js (facade)
  ↓
googleVisionProvider.js   ← imports @google/genai SDK directly

vectorTool.js
  ↓
vectorProvider.js          ← combined embedding + vector store + @google/genai import
  ↓
Gemini Embedding API + .vectors.json
```

All providers were tightly coupled to Google/Gemini SDK. The assistant and tools imported vendor-specific modules directly.

## 2. After Architecture

```
aiAssistantService
  ↓  (facade only, no SDK import)
chat/chatProvider.js       ← reads CHAT_PROVIDER env
  ↓
chat/googleChatProvider.js ← wraps @google/genai (swappable)

visionController.js
  ↓  (shim, unchanged path)
visionProvider.js (shim)   ← re-exports from vision/
  ↓
vision/visionProvider.js   ← reads VISION_PROVIDER env
  ↓
vision/googleVisionProvider.js

vectorTool.js
  ↓  (shim, unchanged path)
vectorProvider.js (shim)   ← re-exports from vector/
  ↓
vector/vectorStore.js      ← reads VECTOR_STORE env, calls embedding provider
  ↓                           ↓
embedding/embeddingProvider.js    jsonVectorStore.js
  ↓
embedding/geminiEmbeddingProvider.js
```

## 3. Folder Structure

```
src/ai/
  assistant/
    aiAssistantService.js       ← only imports chat/chatProvider.js
  factory/
    providerFactory.js          ← reads env vars, provides config + helpers
  providers/
    chat/
      chatProvider.js           ← facade (CHAT_PROVIDER env)
      googleChatProvider.js     ← Gemini implementation
    vision/
      visionProvider.js         ← facade (VISION_PROVIDER env)
      googleVisionProvider.js   ← Gemini implementation
    embedding/
      embeddingProvider.js      ← facade (EMBEDDING_PROVIDER env)
      geminiEmbeddingProvider.js ← Gemini implementation
    vector/
      vectorStore.js            ← facade (VECTOR_STORE env), embeds + searches
      jsonVectorStore.js        ← file-based implementation
    vectorProvider.js           ← SHIM → re-exports vector/vectorStore.js
    visionProvider.js           ← SHIM → re-exports vision/visionProvider.js
  tools/                        ← UNCHANGED
  utils/                        ← UNCHANGED
  prompts/                      ← UNCHANGED
```

## 4. Provider Interfaces

### Chat Provider
```js
interface ChatProvider {
  isAvailable()                  → boolean
  generateContent({contents, config}) → Response  (Gemini-compatible)
  makeFunctionResponsePart(id, name, result) → Part
}
```

### Vision Provider
```js
interface VisionProvider {
  isVisionAvailable()                → boolean
  analyzeImage({imageData, mimeType, prompt}) → Response
}
```

### Embedding Provider
```js
interface EmbeddingProvider {
  embed(text)                        → number[] (vector)
}
```

### Vector Store
```js
interface VectorStore {
  search(embedding, {topK, minScore}) → Document[]
  isAvailable()                       → boolean
}
```

## 5. Factory Design

`src/ai/factory/providerFactory.js` provides:

```js
getProviderConfig()         → { chat, chatModel, vision, visionModel, embedding, embeddingModel, vectorStore }
isProvider(name)           → reads any PROVIDER env var
isProviderType(type, name) → checks specific provider type
```

Each facade (`chatProvider.js`, `visionProvider.js`, `embeddingProvider.js`, `vectorStore.js`) reads its own env var via top-level `await import()`, keeping routing logic co-located with the interface.

## 6. Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHAT_PROVIDER` | `google` | Chat model provider |
| `CHAT_MODEL` | `gemini-2.5-flash-lite` | Chat model name |
| `VISION_PROVIDER` | `google` | Vision model provider |
| `VISION_MODEL` | `gemini-2.5-flash-lite` | Vision model name |
| `EMBEDDING_PROVIDER` | `gemini` | Embedding model provider |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model name |
| `VECTOR_STORE` | `json` | Vector store backend |
| `VECTOR_STORAGE_PATH` | `ai-knowledge/.vectors.json` | (existing) JSON store path |

## 7. Backward Compatibility

| Component | Status | How |
|-----------|--------|-----|
| Assistant (`process()`) | **✔** | Updated import path only; all function names identical |
| Vision Controller | **✔** | `visionProvider.js` shim at old path re-exports from `vision/` |
| Vector Tool | **✔** | `vectorProvider.js` shim at old path re-exports from `vector/` |
| Database Tool | **✔** | No changes |
| Web Tool | **✔** | No changes |
| Vision Tool | **✔** | No changes |
| Vector Tool exports | **✔** | `vectorQuery` + `VECTOR_QUERY_DECLARATION` identical |
| API routes | **✔** | No changes |
| Frontend | **✔** | No changes |

## 8. Future Migration Strategy

### Adding a new Chat Provider (e.g., OpenAI)
```js
// providers/chat/openaiChatProvider.js
export function isAvailable() { return !!apiKey }
export async function generateContent({contents, config}) { /* OpenAI API */ }
export function makeFunctionResponsePart(id, name, result) { /* OpenAI format */ }

// providers/chat/chatProvider.js — add case:
case 'openai':
  provider = await import('./openaiChatProvider.js')
  break
```

### Adding a new Embedding Provider (e.g., OpenAI)
```js
// providers/embedding/openaiEmbeddingProvider.js
export async function embed(text) { /* OpenAI embeddings API */ }

// providers/embedding/embeddingProvider.js — add case:
case 'openai':
  provider = await import('./openaiEmbeddingProvider.js')
  break
```

### Adding a new Vector Store (e.g., Pinecone)
```js
// providers/vector/pineconeVectorStore.js
export function search(embedding, options) { /* Pinecone query */ }
export function isAvailable() { /* ping Pinecone */ }

// providers/vector/vectorStore.js — add case:
case 'pinecone':
  provider = await import('./pineconeVectorStore.js')
  break
```

No changes to `aiAssistantService.js`, tools, or controllers are needed for any new provider or store.

## 9. Verification Results

| Check | Result |
|-------|--------|
| Chat provider loads | ✅ `isAvailable`, `generateContent`, `makeFunctionResponsePart` |
| Vision provider loads | ✅ `analyzeImage`, `isVisionAvailable` |
| Embedding provider loads | ✅ `embed` |
| Vector store loads | ✅ `searchKnowledge`, `isVectorAvailable` |
| Factory provides config | ✅ reads all 6 env vars |
| Assistant loads | ✅ exports `process` |
| Vector search works | ✅ "Chính sách hoàn tiền" → 5 docs, score 0.79 |
| Empty query handled | ✅ returns `INVALID_QUERY` |
| Old path shims work | ✅ `visionProvider.js` and `vectorProvider.js` re-export correctly |
| No Google SDK import in assistant | ✅ imports `chat/chatProvider.js` (facade) |
