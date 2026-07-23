# Sprint 3 — Database Integration Report

## Goal
Integrate Gemini function calling with GymPro database via `databaseQuery` for 5 personal-data intents.

## Intents Implemented
| Intent | Service Called | Description |
|---|---|---|
| `wallet_balance` | `walletService.getWalletByUser` | Số dư ví hiện tại |
| `membership_status` | `membershipService.getMembershipInfo` | Trạng thái gói tập |
| `membership_expiry` | `membershipService.getMembershipInfo` | Ngày hết hạn & số ngày còn lại |
| `upcoming_booking` | `bookingService.getUpcomingBookings` | Lịch PT sắp tới |
| `unread_notifications` | `notificationService.countUnread` | Thông báo chưa đọc |

## Architecture
- **File**: `src/services/aiAssistantService.js` — single file, no separate `databaseQuery` service.
- **Two-turn flow**: `generateContent` with `tools` → if Gemini returns `functionCall` → execute → `generateContent` with `functionResponse`.
- **SDK**: `@google/genai` — `createPartFromFunctionResponse` utility used for response parts.
- **System prompt**: `ai-knowledge/prompts/system-prompt-vi.md` — fallback text replaced with `databaseQuery` instructions (5 intents, error handling, `page` identifiers).

## Files Changed
1. **`src/services/aiAssistantService.js`**
   - Added imports: `createPartFromFunctionResponse`, `getWalletByUser`, `getMembershipInfo`, `getUpcomingBookings`, `countUnread`
   - Added `SUPPORTED_INTENTS` array (5 intents)
   - Added `DATABASE_QUERY_DECLARATION` (FunctionDeclaration schema for Gemini)
   - Added `databaseQuery(intent, user)` — dispatches to correct service, catches errors
   - Upgraded `process()` — two-turn function calling with tools config

2. **`ai-knowledge/prompts/system-prompt-vi.md`**
   - Removed "CHƯA được tích hợp" fallback paragraph
   - Added `databaseQuery` instructions listing all 5 intents
   - Added error handling rules (`UNSUPPORTED_INTENT`, `NO_ACTIVE_MEMBERSHIP`)
   - Added `page` suggestions per intent (no deeplinks)

## Error Handling
| Error | Response |
|---|---|
| `UNSUPPORTED_INTENT` | "Tôi chưa thể hỗ trợ câu hỏi này." |
| `NO_ACTIVE_MEMBERSHIP` | Thông báo user chưa có gói tập |
| `INTERNAL_ERROR` | Prompt instructs "chưa thể hỗ trợ" (via Gemini) |
| Gemini API error (4xx/5xx) | "Xin lỗi, tôi đang gặp sự cố kết nối." |
| No API key | "Trợ lý hiện không khả dụng." |

## Verification Results

### Unit Tests (52/52 passed)
- All imports resolve correctly
- File syntax valid
- All 5 services callable with correct signatures
- Real DB returns expected data for all 4 service functions
- Error objects (`UNSUPPORTED_INTENT`, `NO_ACTIVE_MEMBERSHIP`, `INTERNAL_ERROR`) handled
- Schema valid (type OBJECT, 5 enum values, intent required)

### Real Gemini Integration
- **Greeting**: Gemini replied normally — no `databaseQuery` call, no fabricated data ✅
- **Wallet/Membership**: Gemini called `databaseQuery` with correct intents (`wallet_balance`, `membership_expiry`) ✅
- **Error fallback**: DB timeout caught → user sees friendly message, no crash ✅
- **Rate limit**: 429 caught → graceful fallback message ✅

## Key Design Decisions
1. `databaseQuery` dispatch lives inside `aiAssistantService.js` (no separate file).
2. Gemini sees intent names (`wallet_balance`), never internal service names.
3. Return `page` identifier instead of `deeplink` to avoid coupling AI to frontend URLs.
4. `current_plan` excluded (membershipService.getActivePlans returns available plans, not user's subscription; `membership_status` covers the user's plan).
