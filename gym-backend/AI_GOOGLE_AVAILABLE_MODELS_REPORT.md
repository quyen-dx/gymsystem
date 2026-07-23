# Google AI Available Models Audit

## SDK
`@google/genai` v1.0.0

## API Key
`AQ.Ab8RN6KJs...` (GEMINI_API_KEYS from .env)

## Query
```js
const g = new GoogleGenAI({ apiKey });
for await (const m of g.models.list({})) { ... }
```

## Results: 56 Total Models

### Chat Models (support `generateContent`)

| # | Model ID | Display Name | Input Tokens | Output Tokens | Cached Content |
|---|----------|-------------|-------------|--------------|----------------|
| 1 | `models/gemini-3.6-flash` | Gemini 3.6 Flash | 1,048,576 | 65,536 | Yes |
| 2 | `models/gemini-3.5-flash` | Gemini 3.5 Flash | 1,048,576 | 65,536 | Yes |
| 3 | `models/gemini-3.5-flash-lite` | Gemini 3.5 Flash Lite | 1,048,576 | 65,536 | Yes |
| 4 | `models/gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | 1,048,576 | 65,536 | Yes |
| 5 | `models/gemini-3.1-flash-lite` | Gemini 3.1 Flash Lite | 1,048,576 | 65,536 | Yes |
| 6 | `models/gemini-3.1-flash-lite-preview` | Gemini 3.1 Flash Lite Preview | 1,048,576 | 65,536 | Yes |
| 7 | `models/gemini-3.1-pro-preview-customtools` | Gemini 3.1 Pro Preview Custom Tools | 1,048,576 | 65,536 | Yes |
| 8 | `models/gemini-3-pro-preview` | Gemini 3 Pro Preview | 1,048,576 | 65,536 | Yes |
| 9 | `models/gemini-3-flash-preview` | Gemini 3 Flash Preview | 1,048,576 | 65,536 | Yes |
| 10 | `models/gemini-2.5-pro` | Gemini 2.5 Pro | 1,048,576 | 65,536 | Yes |
| 11 | `models/gemini-2.5-flash` | **Gemini 2.5 Flash** ← CURRENT | 1,048,576 | 65,536 | Yes |
| 12 | `models/gemini-2.5-flash-lite` | **Gemini 2.5 Flash-Lite** | 1,048,576 | 65,536 | Yes |
| 13 | `models/gemini-2.0-flash` | Gemini 2.0 Flash | 1,048,576 | 8,192 | Yes |
| 14 | `models/gemini-2.0-flash-001` | Gemini 2.0 Flash 001 | 1,048,576 | 8,192 | Yes |
| 15 | `models/gemini-2.0-flash-lite` | Gemini 2.0 Flash-Lite | 1,048,576 | 8,192 | Yes |
| 16 | `models/gemini-2.0-flash-lite-001` | Gemini 2.0 Flash-Lite 001 | 1,048,576 | 8,192 | Yes |
| 17 | `models/gemini-flash-latest` | Gemini Flash Latest (alias) | 1,048,576 | 65,536 | Yes |
| 18 | `models/gemini-flash-lite-latest` | Gemini Flash-Lite Latest (alias) | 1,048,576 | 65,536 | Yes |
| 19 | `models/gemini-pro-latest` | Gemini Pro Latest (alias) | 1,048,576 | 65,536 | Yes |
| 20 | `models/gemini-omni-flash-preview` | Gemini Omni Flash Preview | 131,072 | 65,536 | No |
| 21 | `models/gemma-4-26b-a4b-it` | Gemma 4 26B A4B IT | 262,144 | 32,768 | No |
| 22 | `models/gemma-4-31b-it` | Gemma 4 31B IT | 262,144 | 32,768 | No |

### Specialized Chat Models

| # | Model ID | Display Name | Use Case |
|---|----------|-------------|----------|
| 23 | `models/gemini-2.5-flash-image` | Nano Banana | Image generation |
| 24 | `models/gemini-3-pro-image-preview` | Nano Banana Pro | Image generation |
| 25 | `models/gemini-3-pro-image` | Nano Banana Pro | Image generation |
| 26 | `models/nano-banana-pro-preview` | Nano Banana Pro | Image generation |
| 27 | `models/gemini-3.1-flash-image-preview` | Nano Banana 2 | Image generation |
| 28 | `models/gemini-3.1-flash-image` | Nano Banana 2 | Image generation |
| 29 | `models/gemini-3.1-flash-lite-image` | Nano Banana 2 Lite | Image generation |
| 30 | `models/gemini-2.5-flash-preview-tts` | Gemini 2.5 Flash TTS | Text-to-speech (8K in, 16K out) |
| 31 | `models/gemini-2.5-pro-preview-tts` | Gemini 2.5 Pro TTS | Text-to-speech (8K in, 16K out) |
| 32 | `models/lyria-3-clip-preview` | Lyria 3 Clip Preview | Audio generation |
| 33 | `models/lyria-3-pro-preview` | Lyria 3 Pro Preview | Audio generation |
| 34 | `models/gemini-robotics-er-1.5-preview` | Robotics-ER 1.5 | Robotics |
| 35 | `models/gemini-robotics-er-1.6-preview` | Robotics-ER 1.6 | Robotics |
| 36 | `models/gemini-2.5-computer-use-preview-10-2025` | Computer Use | Agent |
| 37 | `models/antigravity-preview-05-2026` | Antigravity Agent | Agent |
| 38 | `models/deep-research-max-preview-04-2026` | Deep Research Max | Research |
| 39 | `models/deep-research-preview-04-2026` | Deep Research | Research |
| 40 | `models/deep-research-pro-preview-12-2025` | Deep Research Pro | Research |

### Live/Bidirectional Models (`bidiGenerateContent`)

| # | Model ID | Display Name |
|---|----------|-------------|
| 41 | `models/gemini-2.5-flash-native-audio-latest` | Gemini 2.5 Flash Native Audio |
| 42 | `models/gemini-2.5-flash-native-audio-preview-09-2025` | Native Audio Preview |
| 43 | `models/gemini-2.5-flash-native-audio-preview-12-2025` | Native Audio Preview |
| 44 | `models/gemini-3.1-flash-live-preview` | Gemini 3.1 Flash Live |
| 45 | `models/gemini-3.5-live-translate-preview` | Gemini 3.5 Live Translate |

### Embedding Models

| # | Model ID | Display Name | Input Tokens |
|---|----------|-------------|-------------|
| 46 | `models/gemini-embedding-001` | Gemini Embedding 001 | 2,048 |
| 47 | `models/gemini-embedding-2-preview` | Gemini Embedding 2 Preview | 8,192 |
| 48 | `models/gemini-embedding-2` | Gemini Embedding 2 | 8,192 |
| 49 | `models/aqa` | Attributed Question Answering | 7,168 |

### Image/Video Generation Models (`predict`/`predictLongRunning`)

| # | Model ID | Display Name |
|---|----------|-------------|
| 50 | `models/imagen-4.0-generate-001` | Imagen 4 |
| 51 | `models/imagen-4.0-ultra-generate-001` | Imagen 4 Ultra |
| 52 | `models/imagen-4.0-fast-generate-001` | Imagen 4 Fast |
| 53 | `models/veo-3.1-generate-preview` | Veo 3.1 |
| 54 | `models/veo-3.1-fast-generate-preview` | Veo 3.1 Fast |
| 55 | `models/veo-3.1-lite-generate-preview` | Veo 3.1 Lite |
| 56 | `models/gemini-3.1-flash-tts-preview` | Gemini 3.1 Flash TTS |

## Analysis

### `gemini-2.5-flash` IS available
It appears as item #11 in the list with full `generateContent` support. If you are receiving a 404, the cause is NOT model deprecation — the model is live. Possible causes:
- API key quota/region restriction
- Transient API error
- Request format issue

### Current `GOOGLE_MODELS` in .env
```
GOOGLE_MODELS=gemini-2.5-flash
```
Single model, no fallback. If the API returns a transient 404/5xx for this model, there is no rotation within the provider.

### `gemini-2.5-flash-lite` IS available (#12)
This model was in the original config (`gemini-2.5-flash-lite,gemini-2.5-flash`) but is now absent from .env. It is live and supports `generateContent` + `createCachedContent`.

## Recommendation

Replace `GOOGLE_MODELS` in `.env` with a rotation chain:

```
GOOGLE_MODELS=gemini-3.6-flash,gemini-2.5-flash,gemini-2.5-flash-lite
```

| Position | Model | Role |
|----------|-------|------|
| 1 | `gemini-3.6-flash` | **Newest** — latest stable flash, 1M context |
| 2 | `gemini-2.5-flash` | **Current** — known working, 1M context |
| 3 | `gemini-2.5-flash-lite` | **Fallback** — lite variant, lower cost |

### Why this order

- `gemini-3.6-flash` is the newest generation — best performance/cost ratio
- `gemini-2.5-flash` is the currently-configured model, confirmed available
- `gemini-2.5-flash-lite` provides a cost-effective last-resort fallback

### Alternative (conservative)

```
GOOGLE_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite
```

If you prefer to stay on the v2.5 family and not use preview/newer models.

### For Embedding

Current embedding model is `gemini-embedding-001`. Both v2 models are available:

```
EMBEDDING_MODEL=gemini-embedding-2
# or
EMBEDDING_MODEL=gemini-embedding-2-preview
```

`gemini-embedding-2` has 4x the input token limit (8,192 vs 2,048) compared to `gemini-embedding-001`.
