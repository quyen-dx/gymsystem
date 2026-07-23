# AI Environment Configuration Report

## 1. New Files

| File | Purpose |
|------|---------|
| `src/config/aiConfig.js` | Central AI configuration module. Typed exports for chat, vision, embedding, vector, memory. All providers and tools consume this instead of `process.env`. |

## 2. Modified Files

| File | Change |
|------|--------|
| `src/config/aiConfig.js` | **NEW** — central AI config with typed sections + backward compat fallbacks |
| `src/ai/providers/chat/chatProvider.js` | Uses `chat.provider` from aiConfig |
| `src/ai/providers/chat/googleChatProvider.js` | Uses `chat.model` + `chat.apiKey` from aiConfig (was `GEMINI_API_KEY`) |
| `src/ai/providers/vision/visionProvider.js` | Uses `vision.provider` from aiConfig |
| `src/ai/providers/vision/googleVisionProvider.js` | Uses `vision.model` + `vision.apiKey` from aiConfig (was `GEMINI_API_KEY`) |
| `src/ai/providers/embedding/embeddingProvider.js` | Uses `embedding.provider` from aiConfig |
| `src/ai/providers/embedding/geminiEmbeddingProvider.js` | Uses `embedding.model` + `embedding.apiKey` from aiConfig (was `GEMINI_API_KEY`) |
| `src/ai/providers/vector/vectorStore.js` | Uses `vector.store` from aiConfig |
| `src/ai/memory/memoryStore.js` | Uses `memory.provider` + `memory.ttl` from aiConfig |
| `src/ai/memory/conversationMemory.js` | Uses `memory.ttl` from aiConfig |
| `src/ai/factory/providerFactory.js` | Uses aiConfig for `getProviderConfig()` |
| `scripts/seedKnowledge.js` | Uses `embedding.model` + `embedding.apiKey` from aiConfig |
| `.env` | Reorganized into 17 labeled sections |

## 3. Environment Variables — Before / After

### Removed (renamed)
None — all existing variables retained for backward compatibility.

### Provider-Specific API Keys (NEW)
| New Variable | Fallback | Purpose |
|-------------|----------|---------|
| `CHAT_API_KEY` | `GEMINI_API_KEY` | Chat provider API key |
| `VISION_API_KEY` | `GEMINI_API_KEY` | Vision provider API key |
| `EMBEDDING_API_KEY` | `GEMINI_API_KEY` | Embedding provider API key |

These are **optional** — when not set, each falls back to `GEMINI_API_KEY`.

### Deprecated (still supported)
| Variable | Status |
|----------|--------|
| `GEMINI_API_KEY` | **Legacy** — retained as fallback. Providers now prefer `CHAT_API_KEY`, `VISION_API_KEY`, `EMBEDDING_API_KEY`. |

### Active AI Variables
| Variable | Default | Provider |
|----------|---------|----------|
| `CHAT_PROVIDER` | `google` | Chat |
| `CHAT_MODEL` | `gemini-2.5-flash-lite` | Chat |
| `CHAT_API_KEY` | (falls back to `GEMINI_API_KEY`) | Chat |
| `VISION_PROVIDER` | `google` | Vision |
| `VISION_MODEL` | `gemini-2.5-flash-lite` | Vision |
| `VISION_API_KEY` | (falls back to `GEMINI_API_KEY`) | Vision |
| `EMBEDDING_PROVIDER` | `gemini` | Embedding |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding |
| `EMBEDDING_API_KEY` | (falls back to `GEMINI_API_KEY`) | Embedding |
| `VECTOR_STORE` | `json` | Vector |
| `VECTOR_STORAGE_PATH` | `ai-knowledge/.vectors.json` | Vector |
| `MEMORY_PROVIDER` | `memory` | Memory |
| `MEMORY_TTL` | `30` (minutes) | Memory |

### Unused / Experimental Keys
| Variable | Status |
|----------|--------|
| `GEMINI_API_KEY_ADMIN` | Not referenced in any AI provider code |
| `OPENROUTER_API_KEY` | Reserved for future OpenRouter provider |
| `GROQ_API_KEY` | Reserved for future Groq provider |
| `OPENAI_API_KEY` | Commented out — reserved for future OpenAI provider |

## 4. .env Section Organization

```
APPLICATION         → PORT, NODE_ENV, TZ
DATABASE            → MONGO_URI
JWT                 → JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET
CLOUDINARY          → CLOUDINARY_*
GOOGLE OAUTH        → GOOGLE_CLIENT_*
FACEBOOK OAUTH      → FACEBOOK_APP_*
EMAIL               → EMAIL_*
SMS                 → ESMS_*, SPEEDSMS_*, TWILIO_*
PAYMENT             → STRIPE_*, VNPAY_*, EXCHANGE_RATE_*
APP URLS            → BACKEND_URL, CLIENT_URL
AI - SHARED         → GEMINI_API_KEY (legacy fallback)
AI - CHAT           → CHAT_PROVIDER, CHAT_MODEL, CHAT_API_KEY
AI - VISION         → VISION_PROVIDER, VISION_MODEL, VISION_API_KEY
AI - EMBEDDING      → EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_API_KEY
AI - VECTOR         → VECTOR_STORE, VECTOR_STORAGE_PATH
AI - MEMORY         → MEMORY_PROVIDER, MEMORY_TTL
AI - WEB SEARCH     → TAVILY_API_KEY
AI - OTHER          → OPENROUTER_API_KEY, GROQ_API_KEY, OPENAI_API_KEY
```

## 5. Provider Independence

Before this refactor, all Google Gemini providers hardcoded `process.env.GEMINI_API_KEY`:

```js
// googleChatProvider.js (BEFORE)
const API_KEY = process.env.GEMINI_API_KEY || ''
```

After this refactor, each provider type has its own API key namespace:

```js
// googleChatProvider.js (AFTER)
import { chat as cfg } from '../../../config/aiConfig.js'
const API_KEY = cfg.apiKey   // reads CHAT_API_KEY, falls back to GEMINI_API_KEY
```

No AI provider code references `GEMINI_API_KEY` or any vendor-specific env var directly. All 3 provider implementations (chat, vision, embedding) + the seeder use the central `aiConfig.js` module.

## 6. Migration Guide

### Zero migration needed for existing projects
`GEMINI_API_KEY` is still read as a fallback. All existing `.env` files work unchanged.

### To switch to provider-specific keys (recommended)
```env
# Remove GEMINI_API_KEY from .env, add:
CHAT_API_KEY=your-chat-key
VISION_API_KEY=your-vision-key
EMBEDDING_API_KEY=your-embedding-key
```

### To switch an entire provider (e.g., OpenAI for chat)
```env
CHAT_PROVIDER=openai
CHAT_MODEL=gpt-4o-mini
CHAT_API_KEY=sk-...
```
No code changes needed — just env vars and a new `openaiChatProvider.js` file implementing the chat interface.

### To switch vector store to Pinecone
```env
VECTOR_STORE=pinecone
PINECONE_API_KEY=...
PINECONE_INDEX=gympro-knowledge
```
Implement `pineconeVectorStore.js` with `search()` and `isAvailable()`.

## 7. Verification Results

| Check | Result |
|-------|--------|
| aiConfig exports all sections | ✅ chat, vision, embedding, vector, memory |
| GEMINI_API_KEY fallback works | ✅ all apiKey fields resolve to the legacy key |
| Chat provider loads | ✅ `isAvailable`, `generateContent`, `makeFunctionResponsePart` |
| Vision provider loads | ✅ `analyzeImage`, `isVisionAvailable` |
| Embedding provider loads | ✅ `embed` |
| Vector store loads | ✅ `searchKnowledge`, `isVectorAvailable` |
| Memory loads | ✅ `loadMemory`, `updateMemory`, `buildMemoryPrompt`, `deleteMemory` |
| Factory config matches | ✅ all provider/model names correct |
| Assistant exports `process` | ✅ |
| Vector search works | ✅ 5 docs returned |
| Zero `process.env.GEMINI_API_KEY` in AI code | ✅ (confirmed via grep) |
