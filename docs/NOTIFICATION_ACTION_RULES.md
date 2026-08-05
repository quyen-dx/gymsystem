# Quy tắc Notification có Hành động — NOTIFICATION_ACTION_RULES

> Các Notification yêu cầu người dùng đưa ra quyết định (**Action Required**) KHÔNG được đánh dấu đã đọc khi bấm **"Đánh dấu tất cả đã đọc"**, nhằm tránh bỏ sót các thông báo quan trọng có nút thao tác.

---

## 1. Phân loại Notification

### 1.1. Notification thông thường

Ví dụ: thanh toán thành công, đổi gói thành công, check-in thành công, đặt lịch thành công, PT đã được phân công, hệ thống bảo trì, khuyến mãi...

- Có thể: đánh dấu đã đọc (từng cái), đánh dấu tất cả đã đọc.
- `requiresAction = false`, `actions = []`.

### 1.2. Action Notification

Notification có **nút thao tác** — bắt buộc người dùng phản hồi:

- Đồng ý / Từ chối đổi PT
- Chấp nhận / Từ chối lời mời
- Xác nhận gia hạn
- Xác nhận hoàn tiền
- … bất kỳ notification có button

Đánh dấu bằng: `requiresAction = true` **hoặc** `actions.length > 0`.

---

## 2. Quy tắc mới

- Nếu Notification có `actions.length > 0` **hoặc** `requiresAction = true` thì:
  - **KHÔNG** bị `markAsRead` khi bấm **"Đánh dấu tất cả đã đọc"**.
- Chỉ được đánh dấu đã đọc khi:
  - Người dùng bấm **Đồng ý** / **Từ chối**, hoặc
  - Action đã hoàn thành.

---

## 3. State Machine

```
PENDING_ACTION  ──►  COMPLETED  ──►  READ
   (mới tạo,          (user bấm          (isRead = true,
    requiresAction=true,                  requiresAction=false)
    isRead=false)
```

| Giai đoạn | `isRead` | `requiresAction` | `actions` | Ghi chú |
|-----------|----------|------------------|-----------|---------|
| PENDING_ACTION | `false` | `true` | `['accept','reject',...]` | Nổi bật, badge "Cần phản hồi", nằm trên đầu |
| COMPLETED | `false→true` | `true→false` | giữ nguyên | Khi user phản hồi xong |
| READ | `true` | `false` | giữ nguyên | Hết cần phản hồi, badge không còn tính |

> Chuyển trạng thái xảy ra khi gọi `markAsRead(id)` (service tự set `requiresAction: false`) — được frontend gọi ngay sau khi hành động `accept`/`reject` thành công.

---

## 4. Badge Logic

- Badge **"Chưa đọc"** (unread-count) đếm `isRead: false` — vẫn tính Action Notification.
- Sau khi "Đánh dấu tất cả đã đọc", Action Notification **vẫn chưa đọc** → vẫn được tính vào badge cho đến khi user bấm Đồng ý / Từ chối.
- Frontend hiển thị nhãn **"Cần phản hồi"** cho Action Notification chưa xử lý.

---

## 5. API thay đổi

### `PUT /api/notifications/read-all` (mark-all-read)

Chỉ update những notification có:

```
requiresAction = false
```

Tức query mới:

```js
Notification.updateMany(
  { receiverId: userId, isRead: false, deletedAt: null, requiresAction: { $ne: true } },
  { isRead: true, readAt: new Date() },
)
```

- **KHÔNG** update các notification `requiresAction = true`.

### `PUT /api/notifications/:id/read` (mark single read)

```js
Notification.findByIdAndUpdate(
  id,
  { isRead: true, readAt: new Date(), requiresAction: false },
  { new: true },
)
```

- Dùng sau khi action hoàn thành → chuyển PENDING_ACTION → READ, xoá cờ cần phản hồi.

### Tạo Action Notification

`createNotification({ ..., requiresAction: true, actions: ['accept', 'decline'] })` — 2 field mới được lưu vào schema.

### Các notification đang được đánh dấu `requiresAction`

| NotificationType | Người nhận | actions | Nơi tạo |
|------------------|-----------|---------|---------|
| `PT_CLASS_REQUEST` | PT | `['accept', 'decline']` | `ptAssignmentController.requestClassAssignment` |
| `PT_REASSIGN_REQUEST` | Hội viên | `['accept', 'reject']` | `trainingRequestController.sendMessage` |
| `MEMBER_ASSIGNED` | PT (được phân công hội viên PT 1-1) | `['accept', 'reject']` | `trainingRequestService.assignTrainer` |

### Notification chỉ định PT (PT 1-1)

- `createRequest` (pt1on1) với `preferredTrainerId` → tạo `PT_REQUEST_DESIGNATED` (category `BOOKING_PT`) gửi riêng cho PT được chỉ định (`receiverRole: 'pt'`), nội dung "Hội viên X đã yêu cầu bạn làm PT riêng" → hiển thị realtime qua `notification:new`. (`trainingRequestController.createRequest`)

### Role routing

- `getNotificationsForUser` / `countUnread` chỉ trả broadcast (`receiverId: null`, `receiverRole: admin/staff/super_admin`) cho chính nhóm role đó — **member/PT/seller không nhận notification admin**. (`services/notificationService.js`)
- `receiverRole` chỉ nhận giá trị trong enum `['member','pt','admin','staff','super_admin']`. (Sửa `partnershipRequestController`: `'seller'` → `'member'` để notification cá nhân không bị fail validation.)

### Luồng PT 1-1 — PT xác nhận nhận hội viên

- `assignTrainer` → tạo `MEMBER_ASSIGNED` cho PT (kèm thông tin hội viên: tên, mã, chuyên môn, mục tiêu, ngày bắt đầu) với `requiresAction: true, actions: ['accept','reject']`.
- `POST /api/training-requests/:id/pt-respond` (PT):
  - `accept` → update notification (actionStatus `accepted`, content "Bạn đã chấp nhận hội viên này.") + tạo `PTAssignment` active (quan hệ PT ↔ Member) + emit `pt_clients:updated` (PTClientsPage realtime) + admin `PT_REASSIGN_ACCEPTED` + member `PT_ASSIGNED`.
  - `reject` (+ `reason`) → update notification (actionStatus `rejected`) + request về `waiting_assignment` + admin `PT_REASSIGN_DECLINED` + member `PT_REASSIGNING` (KHÔNG tạo PTAssignment).

Endpoint `POST /api/notifications/send` cũng hỗ trợ truyền `requiresAction` / `actions` để tạo Action Notification chủ động.

---

## 6. Frontend thay đổi

### `notificationService.ts`
- Thêm `requiresAction?: boolean` và `actions?: string[]` vào `NotificationItem`.
- Export alias `Notification` để các component cũ dùng chung.

### `NotificationCenter.tsx`
- Helper `isActionNotification(item) = !!requiresAction || actions.length > 0`.
- **"Đánh dấu tất cả đã đọc"**: local state chỉ set `isRead: true` cho notification thường; Action Notification giữ nguyên.
- **Sắp xếp**: Action Notification chưa phản hồi luôn nằm **trên đầu** danh sách (bất kể sort mới/cũ).
- **UX nổi bật**: viền + shadow màu `--gs-danger`, icon `WarningOutlined`, tag **"Cần phản hồi"** cho cả card thường và card tùy chỉnh (PT_CLASS_REQUEST, PT_REASSIGN_REQUEST).
- Card tùy chỉnh chỉ hiện tag khi chưa xử lý (`action === 'pending'` / `!isDone`).

### `NotificationBell.tsx`
- Nút **"Đọc tất cả"** cũng bỏ qua Action Notification (không set `isRead` local).
- Bấm vào 1 Action Notification **không** đánh dấu đọc (chỉ bấm thông thường mới mark read).
- Hiển thị chấm đỏ cạnh title cho Action Notification chưa đọc.

---

## 7. File bị ảnh hưởng

### Backend
| File | Thay đổi |
|------|----------|
| `gym-backend/src/models/Notification.js` | Thêm field `requiresAction` (Boolean), `actions` (String[]) |
| `gym-backend/src/services/notificationService.js` | `createNotification` nhận + lưu 2 field; `markAsRead` xoá `requiresAction`; `markAllAsRead` chỉ update `requiresAction: { $ne: true }` |
| `gym-backend/src/controllers/notificationController.js` | `sendNotification` hỗ trợ truyền `requiresAction` / `actions` |
| `gym-backend/src/controllers/ptAssignmentController.js` | `PT_CLASS_REQUEST` đánh dấu `requiresAction: true, actions: ['accept','decline']` |
| `gym-backend/src/controllers/trainingRequestController.js` | `PT_REASSIGN_REQUEST` đánh dấu `requiresAction: true, actions: ['accept','reject']` |

### Frontend
| File | Thay đổi |
|------|----------|
| `gym-frontend/src/services/notificationService.ts` | Thêm `requiresAction`/`actions`; alias `Notification` |
| `gym-frontend/src/components/notifications/NotificationCenter.tsx` | Skip action khi mark-all-read; sort action lên đầu; badge + highlight "Cần phản hồi" |
| `gym-frontend/src/components/notifications/NotificationBell.tsx` | Skip action khi "Đọc tất cả"; chặn mark-read khi click action; chấm đỏ chỉ báo |
