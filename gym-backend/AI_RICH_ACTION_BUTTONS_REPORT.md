# AI Rich Action Buttons Report

## Summary

Added structured `actions` to the AI response. When the assistant detects that navigating to a GymPro feature would be helpful, it returns clickable action buttons alongside the text response.

## Schema

```json
{
  "actions": [
    {
      "label": "Xem ví",
      "route": "/wallet",
      "icon": "wallet",
      "variant": "secondary"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Button text (Vietnamese) |
| `route` | string | Frontend route path |
| `icon` | string | Icon key for frontend rendering |
| `variant` | string | `"primary"` or `"secondary"` |

## Route Mapping

| Feature | Route | Icon | Label |
|---------|-------|------|-------|
| Wallet | `/wallet` | `wallet` | Xem ví |
| Plans | `/plans` | `document` | Xem gói tập |
| Membership | `/my-membership` | `id-card` | Hội viên của tôi |
| Booking | `/bookings` | `calendar` | Đặt lịch tập |
| Schedule | `/my-bookings` | `clock` | Lịch tập của tôi |
| Shop | `/shop` | `shop` | Cửa hàng |
| PT List | `/trainers` | `user` | Danh sách HLV |

## Detection Strategy

Two signal sources — combined with deduplication:

### 1. Tool Result (high confidence)
When `databaseQuery` returns structured data, the detector checks for:
- `balance` field → wallet action
- `currentMembership` / `statusType` / `planName` → membership action
- `bookings` / `count` → schedule action

### 2. LLM Text Keywords (lower confidence)
The response text is scanned for Vietnamese/English keywords:
- `"ví"`, `"số dư"`, `"nạp tiền"`, `"wallet"` → wallet
- `"gói tập"`, `"đăng ký gói"`, `"plans"` → plans
- `"hội viên"`, `"gia hạn"`, `"membership"` → membership
- `"đặt lịch"`, `"booking"`, `"lịch tập"` → booking
- `"huấn luyện viên"`, `"PT"`, `"trainer"` → PT list
- etc.

## Response Format

### Non-streaming (POST /api/ai/chat)

```json
{
  "reply": "...",
  "cards": [...],
  "suggestions": [...],
  "deeplinks": [...],
  "actions": [
    { "label": "Xem ví", "route": "/wallet", "icon": "wallet", "variant": "secondary" }
  ]
}
```

### Streaming (POST /api/ai/chat/stream)

New SSE event type:
```
event: action
data: {"label":"Xem ví","route":"/wallet","icon":"wallet","variant":"secondary"}
```

Emitted after cards/suggestions/deeplinks, before `done`.

## Backward Compatibility

- `actions` defaults to `[]` (empty array) when no feature recommendations are detected
- Frontend: if `actions` is empty, render text normally
- No breaking changes to existing `cards`, `suggestions`, `deeplinks` fields

## Files Modified

| File | Change |
|------|--------|
| `src/ai/ui/actionDetector.js` | **New** — keyword + tool-result based action detection |
| `src/ai/ui/responseBuilder.js` | Added `detectActions()` call, `actions` in return object |
| `src/ai/assistant/aiAssistantService.js` | `actions: []` on all return paths; `detectActions()` on non-tool path |
| `src/ai/assistant/aiAssistantStreamService.js` | `actions: []` in richResponse; yields `action` SSE events for both tool and non-tool paths |
| `src/controllers/aiController.js` | Added `actions: result.actions \|\| []` to JSON response |
| `src/controllers/aiStreamController.js` | Added `event: action` SSE handler |

### Unchanged Files
- `src/ai/ui/cardRegistry.js` — existing card system unchanged
- `src/ai/tools/*` — tool execution unchanged
- `src/ai/providers/chat/*` — API calls unchanged
