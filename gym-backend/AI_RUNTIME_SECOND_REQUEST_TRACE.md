# AI Runtime Second Request Trace

## Instrumentation Summary

Three instrumentation layers added to trace every step from assistant to API.

### Layer 1 — aiAssistantService.js (line 84-100)

Logs the exact values right before Request #2 is built:

```
[ASSISTANT] Request #2 PREP: result={...}
[ASSISTANT] Request #2 PREP: frPart={...}
[ASSISTANT] Request #2 PREP: frPart keys=[...]
[ASSISTANT] Request #2 PREP: functionResponseContent={...}
```

### Layer 1b — aiAssistantStreamService.js (line 80-92)

Same as above for streaming path:

```
[ASSISTANT-STREAM] Request #2 PREP: toolResult={...}
[ASSISTANT-STREAM] Request #2 PREP: frPart={...}
[ASSISTANT-STREAM] Request #2 PREP: frPart keys=[...]
[ASSISTANT-STREAM] Request #2 PREP: frContent={...}
```

### Layer 2 — chatProvider.js (line 40-54)

Logs which provider is selected and whether it's available:

```
[FAILOVER] fn=generateContent order=[google,deepseek,openrouter]
[FAILOVER] trying google...
[FAILOVER] google prov=true isAvail=true
[FAILOVER] google: calling generateContent
```

If Google fails:
```
[FAILOVER] google: error code=PROVIDER_EXHAUSTED msg=...
```

### Layer 3 — googleChatProvider.js (line 77-110)

Logs the EXACT full payload for every `generateContent()` call:

```
########## REQUEST #1 [generateContent] ##########
Model: gemini-flash-latest
Contents: 1 items
  [0] role=user parts=1
    [0] {"text":"..."}
##########################################

########## REQUEST #2 [generateContent] ##########
Model: gemini-flash-lite-latest
Contents: 2 items
  [0] role=user parts=1
    [0] {"text":"..."}
  [1] role=user parts=1
    [0] {"functionResponse":{"id":"...","name":"databaseQuery","response":{...}}}
##########################################
```

Flags malformed parts:
- `*** PART IS null ***`
- `*** PART IS undefined ***`
- `*** PART IS {} (empty object) ***`
- `*** contents is NULL/UNDEFINED ***`
- `*** parts is NULL/UNDEFINED ***`

## Modified Files

| File | Change | Lines |
|------|--------|-------|
| `src/ai/assistant/aiAssistantService.js` | Added pre-Request #2 tracing for `result`, `frPart`, `functionResponseContent` | 84-100 |
| `src/ai/assistant/aiAssistantStreamService.js` | Same tracing for streaming path | 80-92 |
| `src/ai/providers/chat/chatProvider.js` | Added `[FAILOVER]` logging: provider order, availability, errors | 40-54 |
| `src/ai/providers/chat/googleChatProvider.js` | Added `_dump()` function: full payload dump for every API call | 75-114 |

## How to Restart Manually

In the `gym-backend` directory:

```powershell
# Stop all Node processes
taskkill /f /im node.exe

# Start the server
node --env-file=.env server.js
```

For watch mode (auto-reload):
```powershell
npx nodemon --env-file=.env server.js
```

## How to Test

1. **Restart the backend** using the command above
2. **Log in** (POST to `/api/auth/login` with `{"identifier":"daoxuanquyen333@gmail.com","password":"123456"}`)
3. **Trigger AI chat** (POST to `/api/ai/chat` with header `Authorization: Bearer <token>` and body `{"message":"Ví tôi còn bao nhiêu?"}`)
4. **Copy the FULL console output** from the server terminal
5. **Send the output back to me**

## What to Look For in the Logs

Expected log flow (if everything works):

```
[FAILOVER] fn=generateContent order=[google,deepseek,openrouter]
[FAILOVER] trying google...
[FAILOVER] google prov=true isAvail=true
[FAILOVER] google: calling generateContent

########## REQUEST #1 [generateContent] ##########
  (user message with text part)
##########################################

[ASSISTANT] Request #2 PREP: result={...}           ← tool result
[ASSISTANT] Request #2 PREP: frPart={"functionResponse":{...}}  ← must have functionResponse key
[ASSISTANT] Request #2 PREP: functionResponseContent=...

########## REQUEST #2 [generateContent] ##########
  [0] user message
  [1] functionResponse part                          ← must NOT be {}
##########################################
```

If Google is skipped:
```
[FAILOVER] google prov=false isAvail=false
```
→ this means API keys not loaded in the server's environment

If Request #2 has a malformed part, you'll see:
```
*** PART IS {} (empty object) ***
*** PART IS null ***
*** PART IS undefined ***
```
→ send the exact lines around the malformed part
