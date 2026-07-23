# AI Chat Copy UI Update Report

## Change Summary

Replaced the icon-based message actions (📋 🔄 👍 👎) with a single "Sao chép" text action. Added copy success toast via antd `message`.

## File Modified

`gym-frontend/src/components/chat/AiChatWidget.tsx`

## Changes

### 1. Import

Added `message` from antd for toast notifications.

### 2. State removed

| Removed | Reason |
|---------|--------|
| `hoveredMsgId` | No longer needed — copy action is always visible |

### 3. Handlers removed

| Removed | Reason |
|---------|--------|
| `handleRetry` | Retry button removed |

### 4. Handler updated

| Handler | Before | After |
|---------|--------|-------|
| `handleCopy` | Silently copies text | Copies text + shows `message.success('✓ Đã sao chép')` |

### 5. Actions section

#### Before (per message)
```jsx
{isHovered && msg.role === 'assistant' && (
  <div>
    <button>📋</button>  {/* copy */}
    <button>🔄</button>  {/* retry */}
    <button>👍</button>  {/* helpful */}
    <button>👎</button>  {/* not helpful */}
  </div>
)}
{isHovered && msg.role === 'user' && (
  <button>📋</button>  {/* copy */}
)}
```

#### After (per message)
```jsx
{msg.role === 'assistant' && msg.content && (progress === undefined || progress >= msg.content.length) && (
  <button onClick={() => handleCopy(msg.content)}>Sao chép</button>
)}
```

- Always visible on completed assistant messages (not hover-dependent)
- `user-select: none` prevents text selection while clicking
- Color: `var(--theme-muted)` with hover → `var(--theme-text)` + underline

### 6. Unused removed

- `hoveredMsgId` state
- `handleRetry` handler
- `isHovered` variable
- Icon buttons (📋 🔄 👍 👎)
- Mouse enter/leave handlers on message div

## Behaviour

| Action | Result |
|--------|--------|
| Click "Sao chép" | Clipboard API copies message text |
| Toast | `✓ Đã sao chép` via antd `message.success()`, auto-dismiss ~2s |
| Streaming message | No action shown until typing animation completes |
| User messages | No action shown |

## Unchanged

- Message bubble rendering
- Markdown display
- Cards, suggestions, deeplinks
- Streaming logic
- AI behavior
- Message layout and spacing
