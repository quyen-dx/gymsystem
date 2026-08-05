# Thông Báo Realtime — Yêu Cầu PT Cần Phân Công (PT_ASSIGNMENT_REALTIME_NOTIFICATION)

> Khi hội viên bấm `[Đồng ý]` đổi PT trong luồng gửi tin nhắn (yêu cầu chuyển sang
> trạng thái **WAITING_ASSIGNMENT**), hệ thống phải thông báo **realtime** cho Admin/Staff:
> toast + thêm vào notification center + điều hướng tới màn hình phân công PT.

---

## 1. Điều kiện kích hoạt

- Hội viên nhận `PT_REASSIGN_REQUEST` (do Admin "Gửi tin nhắn") và bấm `[Đồng ý]`.
- Backend cập nhật yêu cầu → `waiting_assignment` (`respondToMessage` trong `trainingRequestController.js`).

## 2. Notification tới Admin/Staff

| Thuộc tính | Giá trị |
|------------|---------|
| `receiverId` | `null` |
| `receiverRole` | `admin` (phát vào room `staff` — bao gồm admin, super_admin, staff) |
| `notificationType` | `ACTION_REQUIRED` |
| `category` | `BOOKING_PT` |
| Title | `Có yêu cầu PT cần phân công` |
| Content | `Hội viên {Tên hội viên} đã đồng ý đổi PT. Vui lòng phân công PT mới.` |
| `requiresAction` | `true` (không bị "Đánh dấu tất cả đã đọc" xóa) |
| `actions` | `['go_to_request']` |
| `priority` | `high` |
| `redirectUrl` | `/admin/members?pt1on1=1&pt1on1Status=waiting_assignment` |
| `relatedId` / `relatedType` | `request._id` / `TrainingRequest` |

## 3. Socket events

| Event | Nơi emit | Payload | Người nhận |
|-------|----------|---------|------------|
| `pt1on1:status_changed` | `respondToMessage` | `{ request }` | room `staff` + member |
| `pt1on1:assign_required` | `respondToMessage` (chỉ khi member `accept`) | `{ request, memberName }` | room `staff` |
| `notification:new` | `createNotification` | document Notification | admin/staff qua room `staff` |

Backend vẫn luôn emit cả `status_changed` lẫn `assign_required`.

## 4. Logic "chỉ thông báo khi KHÔNG đang nhìn màn hình phân công"

- Admin/Staff đang mở modal **"Phân công PT"** (hoặc "Yêu cầu PT 1-1") → join room socket `pt1on1-active-view`:
  - Frontend: `socketService.emit('pt1on1:join-active-view')` khi `assignModalOpen === true`.
  - Backend socketService xử lý event `pt1on1:join-active-view` / `pt1on1:leave-active-view`.
- Khi member đồng ý, backend kiểm tra room `pt1on1-active-view`:
  - **Có người trong room** → KHÔNG tạo notification (tránh spam) — admin đang xử lý, list tự reload qua socket.
  - **Không ai trong room** → tạo notification `ACTION_REQUIRED` như §2.
- Emit `pt1on1:assign_required` vẫn diễn ra trong cả 2 trường hợp.

## 5. UI — Toast realtime

Nơi lắng nghe: `App.tsx` → component `RealtimeAssignmentListener` (nằm trong `<AntdApp>`). Listener **phân biệt theo role** (`user.role`):

- **Admin/Staff**: toast điều hướng tới màn hình xử lý PT của admin.
  - Nếu đang ở path `/admin/members` → **không toast** (màn hình đó tự reload list + cập nhật badge).
  - Ngược lại → toast `notification.warning`:
    - Message: `🔔 Có yêu cầu PT cần phân công`
    - Description: `Hội viên {Tên hội viên} đã đồng ý đổi PT. [Đi đến yêu cầu]`
    - Click toast → `navigate('/admin/members?pt1on1=1&pt1on1Status=waiting_assignment&ts=...')`.
- **Hội viên**: toast thông tin, click **chỉ mở trang member** (`/booking` — "Yêu cầu của bạn"), tuyệt đối không điều hướng sang `/admin/*`.
  - `pt_request_assigned` → success "Đã phân công PT" → click `/booking`.
  - `pt_request_waiting_assignment` → info "Yêu cầu đang chờ phân công" → click `/booking`.
  - `pt_request_cancelled` → info "Yêu cầu PT đã bị hủy" → click `/booking`.
  - `pt_request_created` / `pt_request_rejected`: hội viên tự khởi tạo → không toast.

## 6. UI — AdminMembersPage (`/admin/members`)

- **URL param**: `?pt1on1=1&pt1on1Status=waiting_assignment` → tự mở modal "Yêu cầu PT 1-1" + chọn tab "Chờ phân công".
  - `ts` param (timestamp) giúp bấm nhiều lần vẫn kích hoạt lại effect.
- **Socket `pt1on1:assign_required`**: cập nhật badge count (pending + waiting_assignment).
- **Socket `pt1on1:status_changed`**: khi modal mở → merge/cập nhật yêu cầu trong list realtime (không cần F5).
- **Room `pt1on1-active-view`**: join khi mở modal "Phân công PT", leave khi đóng / unmount.
- **Badge "Yêu cầu PT 1-1"**: đếm `pending` + `waiting_assignment`.

## 7. UI — NotificationCenter (Admin)

- Card riêng cho `notificationType === 'ACTION_REQUIRED'` **chỉ hiển thị khi role là admin/super_admin/staff**:
  - Viền đỏ + tag "Cần phản hồi" khi chưa đọc.
  - Nút `[Đi đến yêu cầu]` → `handleMarkRead(item._id)` + điều hướng tới `redirectUrl` (kèm `ts` để re-trigger).
  - Khi đã đọc → hiển thị "Đã xử lý".
- **Role-guard click** (`safeRedirect`): với role khác staff (member/pt), redirectUrl bắt đầu bằng `/admin` sẽ **KHÔNG được navigate** (chỉ đánh dấu đã đọc). Áp dụng cho cả click card generic lẫn nút "Đi đến yêu cầu".
- Do `requiresAction: true`, notification này KHÔNG bị "Đánh dấu tất cả đã đọc" gộp, không có menu đánh dấu đã/chưa đọc.

## 8. State

- Trạng thái `waiting_assignment` (tên cũ `waiting_reassign` đã được đổi) — enum `TrainingRequest`:
  `['pending', 'message_sent', 'waiting_assignment', 'declined_by_member', 'assigned', 'cancelled']`.

## 9. Business Rules

- **R1** — Chỉ tạo notification `ACTION_REQUIRED` khi có hội viên đồng ý đổi PT (`respondToMessage` + `action === 'accept'`).
- **R2** — Không tạo notification nếu đang có admin/staff trong room `pt1on1-active-view` (đang xử lý phân công).
- **R3** — Toast chỉ hiện khi admin/staff KHÔNG ở màn hình `/admin/members`.
- **R4** — Badge "Yêu cầu PT 1-1" luôn đếm cả `pending` lẫn `waiting_assignment`.
- **R5** — Admin/Staff: click toast / notification dẫn tới màn hình "Quản lý thành viên → Yêu cầu PT 1-1 → Chờ phân công". **Hội viên: click toast chỉ mở trang member (`/booking`) — không bao giờ điều hướng sang `/admin/*`.**
- **R6** — Hội viên không được navigate tới `redirectUrl` `/admin/*` dù notification nằm trong danh sách (do `getNotificationsForUser` gộp cả notification `receiverRole: admin` với `receiverId: null`); `NotificationCenter` dùng `safeRedirect` để chặn.

## 10. File bị ảnh hưởng

| File | Thay đổi |
|------|----------|
| `gym-backend/src/controllers/trainingRequestController.js` | `respondToMessage`: thay `PT_REASSIGN_ACCEPTED` bằng `ACTION_REQUIRED` (+ `priority`, `actions`, `redirectUrl`); emit `pt1on1:assign_required`; bỏ qua tạo notification nếu có người trong room `pt1on1-active-view` |
| `gym-backend/src/services/socketService.js` | Xử lý event `pt1on1:join-active-view` / `pt1on1:leave-active-view` (join/leave room `pt1on1-active-view`) |
| `gym-backend/src/models/Notification.js` | Thêm type `ACTION_REQUIRED` + category map `BOOKING_PT`; thêm field `priority` |
| `gym-backend/src/services/notificationService.js` | `createNotification` nhận & lưu `priority` |
| `gym-backend/src/models/TrainingRequest.js` | Enum đổi `waiting_reassign` → `waiting_assignment` |
| `gym-backend/src/services/trainingRequestService.js` | Đổi state `waiting_assignment` trong `respondToMessage` + guard `assignTrainer` |
| `gym-frontend/src/App.tsx` | `RealtimeAssignmentListener`: toast realtime + điều hướng, phân biệt role (admin/staff → `/admin/members`; member → `/booking`, không bao giờ `/admin/*`) |
| `gym-frontend/src/services/socketService.ts` | Thêm `emit` |
| `gym-frontend/src/services/trainingRequestService.ts` | Union status `waiting_assignment` |
| `gym-frontend/src/pages/dashboard/admin/AdminMembersPage.tsx` | URL param mở modal + tab; socket `assign_required`; join/leave room `pt1on1-active-view`; badge đếm cả `waiting_assignment` |
| `gym-frontend/src/components/notifications/NotificationCenter.tsx` | Card riêng `ACTION_REQUIRED` với nút "Đi đến yêu cầu" |
| `gym-frontend/src/pages/dashboard/member/BookingPage.tsx` | Nhãn `waiting_assignment` → "Chờ phân công lại" |
