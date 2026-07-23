# AI Sprint 8.1 — Rich Response Architecture Review

## 1. Current Architecture (Before)

```
responseBuilder.js
  └── INTENT_CARD_MAP { wallet_balance → wallet, membership_status → membership, ... }
       └── build(cardName, toolResult) → Card
```

**Problems:**
- `responseBuilder.js` contained a hardcoded `INTENT_CARD_MAP` — it knew which AI intents map to which cards. This is business logic leaking into the UI layer.
- `responseBuilder.js` had `if/else if` on `functionName` — knowledge of tool names.
- Soft guards in card builders (`if (result.error)` only) caused false matches when try-all approach was introduced.

## 2. Applied Changes

### 2.1 ResponseBuilder — Zero Business Logic

**Before:**
```js
const INTENT_CARD_MAP = { wallet_balance: 'wallet', ... }

export function buildRichResponse(fnName, args, result, text) {
  let cardName = INTENT_CARD_MAP[args?.intent]  // ← business logic
  const card = build(cardName, result)
  // ...
}
```

**After:**
```js
import { all } from './cardRegistry.js'

export function buildRichResponse(fnName, args, result, text) {
  for (const [, builder] of all()) {
    const card = builder(result)   // ← each builder self-determines
    if (card) { ... }
  }
}
```

ResponseBuilder has NO knowledge of:
- Intents (`wallet_balance`, `membership_status`)
- Tool names (`databaseQuery`, `webQuery`)
- Card types (`wallet`, `membership`)

It simply iterates all registered builders and collects the ones that produce a card.

### 2.2 Card Registry — Pure Type→Builder Mapping

Unchanged in structure (`Map<name, builder>`). Each builder now:
1. Contains a strict self-check guard (returns `null` if data doesn't match its type)
2. Returns a full card object with the new schema

### 2.3 Strengthened Guards

| Builder | Old Guard | New Guard |
|---------|-----------|-----------|
| `walletCard` | `result.error \|\| result.balance === undefined` | (unchanged — already strict) |
| `membershipCard` | `result.error` | `result.error \|\| !result.currentMembership \|\| !result.statusType` |
| `planCard` | `result.error` | `result.error \|\| !result.planName` |
| `bookingCard` | `result.error \|\| !result.bookings` | `result.error \|\| !result.bookings \|\| !result.count && result.count !== 0` |
| `notificationCard` | `result.error \|\| result.count === undefined` | `result.error \|\| result.count === undefined \|\| result.bookings` ← prevents booking overlap |
| `searchResultCard` | `result.error \|\| !result.answer` | (unchanged) |
| `generalInfoCard` | `!result.success \|\| !result.documents?.length` | `!result \|\| !result.success \|\| !result.documents?.length` |

Each builder only triggers when its specific data shape is present. A wallet result (`{balance: 500000}`) won't trigger membershipCard because `result.currentMembership` is missing.

## 3. Updated Card Schema

**Before:**
```js
{ type, title, data, deeplink }
```

**After:**
```js
{
  id: string,          // "card_wallet_1712345..."
  type: string,        // "wallet" | "membership" | "plan" | "booking" | ...
  title: string,       // "Ví GymPro"
  subtitle: string,    // "500.000 VNĐ" — human-readable summary
  status: string|null, // "ACTIVE" | "PENDING" | "CANCELLED" | null
  icon: string,        // "💰" | "🎫" | "📋" | "📅" | "🔔" | "🔍" | "📚"
  data: {},            // type-specific payload
  actions: Action[],   // [ { label, type, path } ]
  deeplink: string,    // "/wallet"
}
```

### Actions Array

```ts
interface Action {
  label: string   // "Xem chi tiết", "Nạp tiền", "Gia hạn"
  type: string    // "view" | "pay" | "renew" | "book" | "buy"
  path: string    // "/wallet" | "/my-membership" | "/bookings"
}
```

Supports future action types without schema changes.

### AICardRenderer Rendering

| Field | Rendered As |
|-------|------------|
| `icon` | Emoji badge (left of title) |
| `title` | Bold heading |
| `status` | Color-coded pill (green=ACTIVE, amber=PENDING, blue=RENEWING, red=CANCELLED, grey=EXPIRED) |
| `subtitle` | Subtext below title |
| `actions` | Pill buttons (clickable, stopPropagation) |
| `deeplink` | "Xem chi tiết →" link |

## 4. Why Try-All-Builders > Intent Mapping

| Aspect | INTENT_CARD_MAP | Try-All-Builders |
|--------|-----------------|-------------------|
| Coupling | ResponseBuilder knows business intents | ResponseBuilder knows nothing |
| New card type | Add entry to INTENT_CARD_MAP + new builder | Just add new builder with `register()` |
| Multiple cards per result | Impossible (single lookup) | Possible (all matching builders fire) |
| Guard logic | In responseBuilder (business) | In each builder (self-contained) |
| Testability | Must mock responseBuilder | Test each builder independently |

## 5. Files Changed

| File | Change Summary |
|------|---------------|
| `src/ai/ui/responseBuilder.js` | Removed `INTENT_CARD_MAP`, replaced with `for (const [, builder] of all())` loop |
| `src/ai/ui/cardRegistry.js` | Added `all()` export, `id`, `subtitle`, `status`, `icon`, `actions` to all 7 builders; strengthened guards; added `makeId()` and `makeActions()` helpers |
| `gym-frontend/.../AICardRenderer.tsx` | Rewritten to render new schema — status pills with color coding, action buttons, icon + title layout |
| `gym-frontend/.../AssistantMessageBubble.tsx` | Import path updated (no behavior change) |

## 6. Files NOT Changed (Compliant)

- `src/ai/assistant/aiAssistantService.js`
- `src/ai/tools/databaseTool.js`
- `src/ai/tools/webTool.js`
- `src/ai/tools/visionTool.js`
- `src/ai/tools/vectorTool.js`
- `src/ai/memory/conversationMemory.js`
- `src/ai/memory/memoryStore.js`
- `src/ai/factory/providerFactory.js`
- `src/controllers/aiController.js`
- `gym-frontend/src/services/api.ts`

## 7. Compatibility Analysis

| Check | Result |
|-------|--------|
| 7 card types registered | ✅ |
| Wallet → exactly 1 card | ✅ |
| Membership → exactly 1 card | ✅ |
| Plan → exactly 1 card | ✅ |
| Booking → exactly 1 card (not also notification) | ✅ |
| Notification → exactly 1 card | ✅ |
| Error path → 0 cards | ✅ |
| All 9 schema fields present | ✅ `id, type, title, subtitle, status, icon, data, actions, deeplink` |
| ResponseBuilder zero intent knowledge | ✅ no `INTENT_MAP`, no `.intent` reference |
| Registry zero business logic | ✅ `Map<name, builder>`, no intent/function knowledge |
| Registry zero intent knowledge | ✅ |
| Assistant unchanged | ✅ exports `process` |
| Controller unchanged | ✅ exports `postChat` |
| Frontend API unchanged | ✅ |
| Plain text still works | ✅ `{ message, cards: [], ... }` |
