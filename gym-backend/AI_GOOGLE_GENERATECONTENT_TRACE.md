# AI Google generateContent Request Trace

## Environment

| Item | Value |
|------|-------|
| SDK | `@google/genai` v1.0.0 |
| API Endpoint | `https://generativelanguage.googleapis.com/` |
| API Key | `AQ.Ab8RN6KJs...` (GEMINI_API_KEYS from .env) |
| Current `GOOGLE_MODELS` | `gemini-2.5-flash` |
| Node.js | v20.19.4 |

## Exact generateContent Request

### Model string passed
```
gemini-2.5-flash
```

### SDK constructed HTTP request
```
POST https://generativelanguage.googleapis.com/models/gemini-2.5-flash:generateContent
```

The SDK automatically prepends `models/` and appends `:generateContent` to the model string. The user passes `gemini-2.5-flash` and the SDK constructs the path `models/gemini-2.5-flash:generateContent`.

### Request body
```json
{
  "contents": [
    {
      "parts": [{ "text": "Hi" }],
      "role": "user"
    }
  ]
}
```

No `model` field in the body — the model is embedded in the URL path only. No `generationConfig` sent (uses defaults).

### Response
```
HTTP 404 Not Found

{
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash is no longer available to new users. 
                Please update your code to use a newer model for the latest features and improvements.",
    "status": "NOT_FOUND"
  }
}
```

## list Models Request (for comparison)

### SDK constructed HTTP request
```
GET https://generativelanguage.googleapis.com/models
```

### Response includes
```
models/gemini-2.5-flash
  displayName: Gemini 2.5 Flash
  supportedActions: [generateContent, countTokens, createCachedContent, batchGenerateContent]
```

## Mismatch Analysis

| Aspect | list models | generateContent |
|--------|------------|-----------------|
| HTTP Method | GET | POST |
| Endpoint | `/models` | `/models/{model}:generateContent` |
| `gemini-2.5-flash` status | **LISTED** in catalog | **404** "no longer available to new users" |
| `gemini-2.5-flash-lite` status | **LISTED** in catalog | **404** "no longer available to new users" |
| `gemini-3.6-flash` status | **LISTED** in catalog | **200 OK** |

## Root Cause

Google's model catalog API (`GET /models`) returns **all models** including soft-deprecated ones. The `generateContent` endpoint enforces a per-API-key availability policy. Models `gemini-2.5-flash` and `gemini-2.5-flash-lite` are listed in the catalog but are **blocked at runtime** for this API key with the message *"no longer available to new users."*

This is **not** a code bug. It is a Google API-side availability restriction. The `list()` method is not a reliable indicator of generateContent availability.

## Working Models (empirically tested)

| Model | Status | Notes |
|-------|--------|-------|
| `gemini-3.6-flash` | **OK** | Latest stable flash |
| `gemini-3.5-flash` | **OK** | |
| `gemini-3.5-flash-lite` | **OK** | Lite variant |
| `gemini-3.1-flash-lite` | **OK** | |
| `gemini-3.1-flash-lite-preview` | **OK** | Preview |
| `gemini-3-flash-preview` | **OK** | Preview |
| `gemini-flash-latest` | **OK** | Alias → `gemini-3.6-flash` |
| `gemini-flash-lite-latest` | **OK** | Alias → `gemini-3.5-flash-lite` |
| `gemma-4-26b-a4b-it` | **OK** | Gemma open model |
| `gemma-4-31b-it` | **OK** | Gemma open model |

## Non-Working Models

| Model | Status | Reason |
|-------|--------|--------|
| `gemini-2.5-flash` | **404** | *"no longer available to new users"* |
| `gemini-2.5-flash-lite` | **404** | *"no longer available to new users"* |
| `gemini-2.5-pro` | 429 | Rate limited by API key tier |
| `gemini-2.0-flash` | 429 | Rate limited |
| `gemini-2.0-flash-001` | 429 | Rate limited |
| `gemini-2.0-flash-lite` | 429 | Rate limited |
| `gemini-2.0-flash-lite-001` | 429 | Rate limited |
| `gemini-3.1-pro-preview` | 429 | Rate limited |
| `gemini-3.1-pro-preview-customtools` | 429 | Rate limited |
| `gemini-3-pro-preview` | 429 | Rate limited |
| `gemini-pro-latest` | 429 | Rate limited |

## Recommendation

Replace `.env` `GOOGLE_MODELS` with a chain of confirmed-working models:

```
GOOGLE_MODELS=gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-latest,gemini-flash-lite-latest
```

Or use aliases for future-proofing:

```
GOOGLE_MODELS=gemini-flash-latest,gemini-flash-lite-latest
```

The alias `gemini-flash-latest` auto-resolves to the latest available flash model (currently `gemini-3.6-flash`). This avoids needing to update the env when Google promotes a new model.

## Why the 404 Rotation Fix Did Not Help

The 404 rotation fix correctly handles model rotation within the Google provider. However, with only one model configured (`GOOGLE_MODELS=gemini-2.5-flash`), there are no other models to rotate to. The provider throws `PROVIDER_EXHAUSTED` immediately and fails over to DeepSeek/OpenRouter — which is the correct failover behavior, but means the Google provider always exhausts instantly.
