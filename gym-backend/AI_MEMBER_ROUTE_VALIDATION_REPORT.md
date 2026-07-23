# AI Member Route Validation Report

## Problem

The action detector was returning buttons with routes that don't exist in the frontend:

| Wrong Route | Correct Route |
|------------|---------------|
| `/wallet` | `/deposit` |
| `/bookings` | `/booking` |
| `/my-bookings` | `/booking` |
| `/shop` | `/store` |
| `/trainers` | `/booking` |

## Fix

### `src/ai/ui/actionDetector.js` — Complete Rewrite

Three layers of defense:

**Layer 1 — `VALID_MEMBER_ROUTES` (source of truth from App.tsx)**
```js
const VALID_MEMBER_ROUTES = new Set([
  '/account/profile', '/', '/dashboard', '/deposit', '/checkout',
  '/orders', '/store', '/plans', '/my-membership', '/booking',
  '/workout', '/checkin', '/notifications', '/feedback',
  '/my-activity', '/help', '/policies', '/cart', ...
])
```

**Layer 2 — `FEATURE_ROUTES` (mapping validated at module load)**
```js
const FEATURE_ROUTES = {
  deposit:     { route: '/deposit',        icon: 'wallet',   label: 'Nạp tiền' },
  plans:       { route: '/plans',           icon: 'document', label: 'Xem gói tập' },
  membership:  { route: '/my-membership',   icon: 'id-card',  label: 'Hội viên của tôi' },
  booking:     { route: '/booking',         icon: 'calendar', label: 'Đặt lịch tập' },
  store:       { route: '/store',           icon: 'shop',     label: 'Cửa hàng' },
  // ... 16 features total
}
```

Self-check at module load: every `FEATURE_ROUTES.*.route` must exist in `VALID_MEMBER_ROUTES` or it logs an error.

**Layer 3 — Runtime validation before return**
```js
if (!VALID_MEMBER_ROUTES.has(entry.route)) {
  console.warn(`Discarding action "${key}": route "${entry.route}" not in App.tsx member routes`)
  continue  // <-- action discarded, never returned
}
```

### Feature → Route Mapping (16 features)

| Feature | Route | Icon | Label |
|---------|-------|------|-------|
| deposit | `/deposit` | wallet | Nạp tiền |
| plans | `/plans` | document | Xem gói tập |
| membership | `/my-membership` | id-card | Hội viên của tôi |
| booking | `/booking` | calendar | Đặt lịch tập |
| store | `/store` | shop | Cửa hàng |
| notifications | `/notifications` | bell | Thông báo |
| workout | `/workout` | dumbbell | Kế hoạch tập |
| help | `/help` | info | Trợ giúp |
| policies | `/policies` | shield | Chính sách |
| orders | `/orders` | package | Đơn hàng |
| cart | `/cart` | cart | Giỏ hàng |
| activity | `/my-activity` | chart | Hoạt động |
| feedback | `/feedback` | message | Phản hồi |
| profile | `/account/profile` | user | Tài khoản |
| dashboard | `/dashboard` | home | Bảng tin |
| checkin | `/checkin` | scan | Check-in |

### Frontend Icon Map Updated

`AiChatWidget.tsx` — `ICON_MAP` expanded with all new icon keys.

## Files Modified

| File | Change |
|------|--------|
| `gym-backend/src/ai/ui/actionDetector.js` | Complete rewrite — validated routes from App.tsx, 3-layer defense |
| `gym-frontend/src/components/chat/AiChatWidget.tsx` | Expanded `ICON_MAP` with new icon keys |
