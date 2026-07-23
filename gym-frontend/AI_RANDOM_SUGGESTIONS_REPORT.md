# AI Random Suggestions Report

## Problem

Default suggestions were always the same 3 prompts, regardless of page or session.

## Solution

Route-specific suggestions for special pages. Random 3-pick from a 45-prompt pool for all other pages. Re-randomizes every time the widget opens.

## Behavior

| Route | Suggestions |
|-------|-------------|
| `/help` | Help-specific (5 items, all shown) |
| `/policies` | Policy-specific (5 items, all shown) |
| `/feedback`, `/my-feedback` | Feedback-specific (5/3 items) |
| **All other routes** | **3 random picks from 45-prompt pool** |

### Randomization

- Shuffles `SUGGESTION_POOL` using Fisher-Yates
- Takes first 3 items
- Re-shuffled every time `isOpen` transitions (`useMemo` depends on `isOpen`)
- Closing and reopening the widget yields different suggestions

### Prompt Pool (45 items across 5 categories)

| Category | Count | Examples |
|----------|-------|---------|
| **Nutrition** | 10 | "Thực đơn giảm cân trong 1 tuần?", "Nên ăn gì trước khi tập gym?" |
| **Workout** | 10 | "Bài tập giảm mỡ bụng hiệu quả", "Lịch tập cho người mới bắt đầu" |
| **GymPro Features** | 10 | "Các gói tập có gì khác nhau?", "Check-in bằng QR code thế nào?" |
| **Fitness Tips** | 10 | "Ngủ bao nhiêu tiếng là đủ cho gymer?", "Làm sao duy trì động lực tập?" |
| **General** | 5 | "Phân tích body của tôi", "Lợi ích của tập gym với sức khỏe" |

### No Duplicates

Fisher-Yates shuffle ensures all 3 picks are unique within a session.

### Hides After First Message

Existing behavior unchanged — empty state (and suggestions) only renders when `messages.length === 0 && !isLoading`.

## Files Modified

| File | Change |
|------|--------|
| `src/components/chat/AiChatWidget.tsx` | Replaced per-route maps with `ROUTE_SUGGESTIONS` (4 special routes only), added `SUGGESTION_POOL` (45 items), `pickRandom()` (Fisher-Yates shuffle), `resolveSuggestions` returns pool-picks for all other routes, `isOpen` added to `useMemo` deps |
