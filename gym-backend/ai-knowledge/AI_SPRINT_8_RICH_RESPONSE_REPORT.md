# AI Sprint 8 — Rich Response Framework (AI Cards)

## 1. Architecture

```
User → Controller → Assistant → LLM → Tool Call → Tool Result
                                                      ↓
                                              responseBuilder.js
                                              (Intent → Card Registry)
                                                      ↓
                                              Rich Response
                                              { message, cards, suggestions, deeplinks }
                                                      ↓
                                              Controller (JSON)
                                                      ↓
                                              Frontend Renderer (AICardRenderer.tsx)
```

**Before:** Assistant returns plain text string → `{ reply: "text" }`

**After:** Assistant returns structured object → `{ message, cards, suggestions, deeplinks }` → Controller normalizes to `{ reply, cards, suggestions, deeplinks }` (backward compatible: `reply` always present)

## 2. New Files

| File | Purpose |
|------|---------|
| `src/ai/ui/cardRegistry.js` | Map-based card registry + 7 card builder functions. `register()` / `build()` / `getRegistered()`. |
| `src/ai/ui/responseBuilder.js` | Maps function names + intents to card types, calls registry, returns `RichResponse`. |
| `gym-frontend/src/components/chat/AICardRenderer.tsx` | React component rendering cards in `{ type, title, data, deeplink }` format. |

## 3. Modified Files

| File | Change |
|------|--------|
| `src/ai/assistant/aiAssistantService.js` | Imports `buildRichResponse`. All return paths changed from `string` to `{ message, cards, suggestions, deeplinks }`. Function-call path calls `buildRichResponse(name, args, result, text)` to build cards. |
| `src/controllers/aiController.js` | Unwraps rich response: `reply = result.message`, then `res.json({ reply, cards, suggestions, deeplinks })`. |
| `gym-frontend/src/services/api.ts` | Updated `sendChatMessage` return type to include `cards`, `suggestions`, `deeplinks`. |
| `gym-frontend/src/components/chat/AiChatWidget.tsx` | Propagates `data.cards`, `data.suggestions`, `data.deeplinks` into `ChatMessage`. |
| `gym-frontend/src/components/chat/AssistantMessageBubble.tsx` | Imports + renders `<AICardRenderer>` in fallback render path. |

## 4. Card Schema

```ts
interface RichResponse {
  message: string           // LLM text (always present)
  cards: Card[]             // optional UI cards
  suggestions: string[]     // follow-up suggestions
  deeplinks: string[]       // navigation deep links
}

interface Card {
  type: string              // wallet | membership | plan | booking | notification | searchResult | generalInfo
  title: string             // display title
  data: Record<string, any> // type-specific data payload
  deeplink?: string         // navigation path (optional)
  suggestions?: string[]    // card-specific suggestions
}
```

## 5. Card Builders (Registry)

| Card Type | Triggered By | Data Payload |
|-----------|-------------|--------------|
| `wallet` | `databaseQuery(wallet_balance)` → `{ balance }` | balance, points |
| `membership` | `databaseQuery(membership_status)` → `{ statusType, currentMembership }` | status, planName, endDate, remainingDays |
| `plan` | `databaseQuery(membership_expiry)` → `{ statusType, endDate, remainingDays }` | status, planName, endDate, remainingDays |
| `booking` | `databaseQuery(upcoming_booking)` → `{ count, bookings[] }` | count, bookings (ptName, date, slot, status) |
| `notification` | `databaseQuery(unread_notifications)` → `{ count }` | unreadCount |
| `searchResult` | `webQuery(query)` → `{ answer, sources }` | answer, sources |
| `generalInfo` | `vectorQuery(query)` → `{ documents[] }` | summary, sources |

Each builder returns `null` if the tool result contains an `error` field, so cards are never built for failed queries.

## 6. Registry Design

```js
const builders = new Map()

export function register(name, builder)  // add builder
export function build(name, data)        // call builder → Card | null
export function getRegistered()          // list all registered types

// Self-registering:
register('wallet', walletCard)
register('membership', membershipCard)
// ...
```

No switch statements. Each builder is a pure function: `(toolResult) → Card | null`.

## 7. Backward Compatibility

| Aspect | Status |
|--------|--------|
| `reply` always present | ✅ — `{ reply: "text", cards: [...], ... }` |
| Plain text still works | ✅ — direct response (no tool call) returns `{ message, cards:[], suggestions:[], deeplinks:[] }` |
| Cards optional | ✅ — frontend renders `<AICardRenderer>` only when cards exist |
| Error path no cards | ✅ — builders return null on `{ error: ... }` |
| Database Tool unchanged | ✅ — zero changes |
| Web Tool unchanged | ✅ — zero changes |
| Vision Tool unchanged | ✅ — zero changes |
| Vector Tool unchanged | ✅ — zero changes |
| Memory unchanged | ✅ — zero changes |
| Provider Factory unchanged | ✅ — zero changes |

## 8. Future Expansion

Add new card types without changing the assistant:

```js
// cardRegistry.js
function workoutCard(result) { ... }
function coachCard(result) { ... }
function invoiceCard(result) { ... }
register('workout', workoutCard)
register('coach', coachCard)
register('invoice', invoiceCard)

// responseBuilder.js — add intent mapping
if (intent === 'workout_summary') cardName = 'workout'
```

## 9. Verification Results

| Check | Result |
|-------|--------|
| 7 card types registered | ✅ wallet, membership, plan, booking, notification, searchResult, generalInfo |
| wallet card built | ✅ `{ type: "wallet", data: { balance: 500000 }, deeplink: "/wallet" }` |
| membership card built | ✅ `{ type: "membership", data: { status: "ACTIVE" }, deeplink: "/my-membership" }` |
| booking card built | ✅ `{ type: "booking", data: { count: 2 } }` |
| vector query card built | ✅ `{ type: "generalInfo", data: { summary: "..." } }` |
| Error path → no cards | ✅ `cards.length === 0` |
| Direct text → no cards | ✅ `{ message: "Xin chào", cards: [] }` |
| Response schema valid | ✅ `message`, `cards`, `suggestions`, `deeplinks` all present |
| Assistant exports unchanged | ✅ `process` |
| Frontend type compatible | ✅ `ChatMessage` already has `cards`, `suggestions`, `links` |
| Registry pattern (no switch) | ✅ `Map<name, builder>` |
