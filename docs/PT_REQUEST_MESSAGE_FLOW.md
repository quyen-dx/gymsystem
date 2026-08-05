# Luồng Gửi Tin Nhắn — Yêu cầu PT 1-1 (PT_REQUEST_MESSAGE_FLOW)

> Thay đổi nghiệp vụ xử lý yêu cầu PT 1-1: **Admin không được hủy yêu cầu**.
> Admin chỉ tư vấn & đề xuất; **hội viên là người quyết định**.

---

## 1. Flow mới

```
Hội viên gửi yêu cầu PT 1-1
        │
        ▼
Admin xem yêu cầu (trạng thái PENDING)
        │
        ├── PT mong muốn CÒN nhận học viên
        │         │
        │         ▼
        │   Admin bấm "Phân công PT"
        │         │
        │         ▼
        │   Phân công như hiện tại (ASSIGNED — popup KHÔNG thay đổi)
        │
        └── PT mong muốn KHÔNG thể nhận thêm học viên
                  (PT đầy / nghỉ phép / nghỉ việc / không nhận lịch / lý do khác)
                  │
                  ▼
          Admin bấm "Gửi tin nhắn" (KHÔNG được hủy)
                  │
                  ▼
          Modal "Thông báo đến hội viên" — Admin chỉnh sửa nội dung → Gửi
                  │
                  ▼
          Yêu cầu → MESSAGE_SENT
          Hội viên nhận Notification kèm nút [Từ chối] [Đồng ý]
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
     [Từ chối]           [Đồng ý]
        │                   │
        ▼                   ▼
  DECLINED_BY_MEMBER     WAITING_ASSIGNMENT
   (Kết thúc, đóng        Admin nhận thông báo
    yêu cầu, không         "Có yêu cầu PT cần phân công"
    phân công PT)          → Admin mở lại "Phân công PT"
                                 │
                                 ▼
                              ASSIGNED
```

---

## 2. State machine

```
PENDING ──────────► MESSAGE_SENT ──────────► WAITING_ASSIGNMENT ──► ASSIGNED
   │                   │                          │
   │ (admin phân công   │ (member từ chối)         │
   │  trực tiếp)        ▼                          ▼
   └────────► ASSIGNED  DECLINED_BY_MEMBER (Kết thúc)

PENDING ──────────► CANCELLED  (chỉ HỘI VIÊN tự hủy — cancelMyRequest)
```

| State | Ý nghĩa | Người thao tác |
|-------|---------|----------------|
| `pending` | Đang chờ admin xử lý | Admin: Phân công PT / Gửi tin nhắn |
| `message_sent` | Admin đã gửi tin nhắn, chờ hội viên phản hồi | Hội viên: Đồng ý / Từ chối |
| `waiting_assignment` | Hội viên đồng ý đổi PT, chờ admin phân công lại | Admin: Phân công PT |
| `declined_by_member` | Hội viên từ chối đổi PT — yêu cầu đóng (Kết thúc) | — |
| `assigned` | Đã phân công PT thành công | — |
| `cancelled` | Hội viên tự hủy yêu cầu | Hội viên |

**KHÔNG còn** hành động `cancel` của Admin (`PATCH /:id/cancel` đã bị gỡ).

---

## 3. Notification flow

| Bước | Người gửi | Người nhận | Type | Nội dung | Nút |
|------|-----------|-----------|------|----------|-----|
| Member gửi yêu cầu | System | Hội viên | `PT_REQUEST_NEW` | "Bạn đã gửi yêu cầu PT 1-1 thành công. Admin sẽ xử lý trong thời gian sớm nhất." (ngôi thứ hai) | — |
| Member gửi yêu cầu (có chỉ định PT) | System | PT được chỉ định | `PT_REQUEST_DESIGNATED` | "Hội viên X đã yêu cầu bạn làm PT riêng.\nYêu cầu đang chờ admin xử lý." (gửi riêng cho PT qua `receiverId`, realtime `notification:new`) | — |
| Gửi tin nhắn | Admin | Hội viên | `PT_REASSIGN_REQUEST` | Nội dung tin nhắn của Admin (mặc định: "PT bạn lựa chọn hiện không thể nhận thêm học viên...") | `[Từ chối]` `[Đồng ý]` |
| Member Đồng ý | System | Admin (room staff) | `ACTION_REQUIRED` | "Hội viên X đã đồng ý đổi PT. Vui lòng phân công PT mới." (`requiresAction: true`, `priority: high`) | `[Đi đến yêu cầu]` |
| Member Từ chối | System | Admin (room staff) | `PT_REASSIGN_DECLINED` | "Hội viên X đã từ chối đổi PT. Yêu cầu được đóng lại, không cần xử lý tiếp." | — |
| Phân công PT | System | PT được phân công | `MEMBER_ASSIGNED` | "Bạn vừa được phân công hội viên mới.\nHội viên: X (code)\nChuyên môn: ...\nMục tiêu: ...\nNgày bắt đầu: ..." (`requiresAction: true`, `priority: high`) | `[Từ chối]` `[Chấp nhận]` |
| PT Chấp nhận | PT | Admin (room staff) | `PT_REASSIGN_ACCEPTED` | "PT X đã chấp nhận phụ trách hội viên Y." | — |
| PT Chấp nhận | PT | Hội viên | `PT_ASSIGNED` | "PT X đã xác nhận phụ trách bạn.\nPT sẽ chủ động liên hệ với bạn qua SĐT hoặc Email." | — |
| PT Từ chối | PT | Admin (room staff) | `PT_REASSIGN_DECLINED` | "PT X đã từ chối phụ trách hội viên Y. Lý do: ..." → request quay về `waiting_assignment` để admin phân công PT khác | — |
| PT Từ chối | PT | Hội viên | `PT_REASSIGNING` | "Hệ thống đang tìm PT phù hợp hơn cho bạn. Vui lòng chờ trong giây lát." | — |

- Notification gửi cho Admin dùng `receiverId: null, receiverRole: 'admin'` (phát vào room `staff`).
- Notification cho hội viên gắn `relatedId` + `relatedType: 'TrainingRequest'` để frontend hiển thị nút phản hồi.
- Notification `ACTION_REQUIRED` cho Admin: `redirectUrl: '/admin/members?pt1on1=1&pt1on1Status=waiting_assignment'`, `actions: ['go_to_request']`, `requiresAction: true` (không bị "Đánh dấu tất cả đã đọc" xóa), `priority: 'high'`.
- **Role filtering**: `getNotificationsForUser`/`countUnread` chỉ trả broadcast admin/staff/super_admin cho chính nhóm role đó. Member/PT/Seller **không bao giờ** nhận notification admin (`Có yêu cầu PT cần phân công`, `Hội viên đã đồng ý đổi PT`, ...).

---

## 4. API mới

| Method | Path | Quyền | Body | Mô tả |
|--------|------|-------|------|-------|
| `POST` | `/api/training-requests/:id/send-message` | admin, super_admin, staff | `{ content }` | Chuyển yêu cầu `pending`/`message_sent` → `message_sent`, lưu `lastMessage`/`messageSentAt`, tạo notification `PT_REASSIGN_REQUEST` cho hội viên |
| `POST` | `/api/training-requests/:id/respond` | member | `{ action: 'accept' \| 'reject' }` | `accept` → `waiting_assignment` + notify admin `ACTION_REQUIRED`; `reject` → `declined_by_member` + notify admin `PT_REASSIGN_DECLINED` |
| `POST` | `/api/training-requests/:id/pt-respond` | pt | `{ action: 'accept' \| 'reject', reason? }` | PT xác nhận nhận hội viên: `accept` → notif PT thành "Bạn đã chấp nhận hội viên này." + admin `PT_REASSIGN_ACCEPTED` + member `PT_ASSIGNED`; `reject` (bắt buộc lý do) → request về `waiting_assignment` (bỏ `assignedTrainerId`) + admin `PT_REASSIGN_DECLINED` + member `PT_REASSIGNING` |

### Xóa
- `PATCH /api/training-requests/:id/cancel` (Admin hủy) — **đã gỡ**.

### Còn lại (không đổi)
- `PATCH /api/training-requests/:id/assign-trainer` — phân công PT. Backend chỉ chấp nhận khi `status ∈ { pending, waiting_assignment }`.
- `PATCH /api/training-requests/my/:id/cancel` — hội viên tự hủy yêu cầu (giữ nguyên).

---

## 5. UI thay đổi

### Admin — `AdminMembersPage.tsx`
- Bảng yêu cầu PT 1-1: nút **"Hủy yêu cầu"** → thay bằng **"Gửi tin nhắn"**.
- `pending`: `[Phân công PT]` + `[Gửi tin nhắn]`.
- `waiting_assignment`: `[Phân công PT]` (cho phép mở lại màn hình phân công).
- `message_sent`: nhãn "Chờ hội viên phản hồi".
- Modal "Thông báo đến hội viên": tiêu đề + textarea nội dung có sẵn (Admin chỉnh sửa) + nút `Gửi`.
- Thêm tabs trạng thái: `message_sent` (Đã gửi tin), `waiting_assignment` (Chờ phân công), `declined_by_member` (Đã từ chối).

### Hội viên — `BookingPage.tsx`
- Khi hội viên có yêu cầu đang xử lý (per type: `pending`, `message_sent`, `waiting_assignment`, `assigned`) → `/booking` hiển thị **"Yêu cầu của bạn"** (thay cho form đăng ký / lựa chọn PT nhóm / PT 1-1).
- Panel hiển thị **full-width** phía trên các card dịch vụ (không còn nằm trong cột của grid 2 cột).
- Realtime subscribe `pt_request_*` reload cả 2 loại yêu cầu (group + pt1on1).

### Hội viên — `YourRequestPanel.tsx` (MỚI)
- Card lớn, bố cục dọc đơn cột: header (tiêu đề `YÊU CẦU PT RIÊNG 1-1` / `YÊU CẦU TẬP LUYỆN NHÓM` + Badge trạng thái) → thông tin yêu cầu (row `label:value`, `min-w-0` chống wrap) → timeline dọc (✓ bước hoàn thành / ● bước hiện tại / ○ bước sắp tới) → mô tả trạng thái → hành động.
- Thông tin pt1on1: Chuyên môn, Mục tiêu, PT mong muốn, Số điện thoại, Email, Ngày gửi, Ghi chú. Group: thêm Số buổi/tuần, Khung giờ, Ngày trong tuần; khi `assigned` hiện Lớp được xếp.
- Nút hành động theo trạng thái:
  - `pending`: `[Hủy yêu cầu]` (confirm).
  - `message_sent`: hộp "Đề xuất mới từ Admin" + nút `[Từ chối]` / `[Đồng ý]` inline — **KHÔNG có nút hủy**.
  - `waiting_assignment`: `[Hủy yêu cầu]` vẫn được phép (hội viên chưa có PT, có thể hủy trước khi phân công).
  - `assigned` (pt1on1): `[Xem PT]` / `[Đặt lịch]` → `/booking/:ptId`, `[Nhắn tin]` → toast "đang phát triển" (chưa có chat PT); ẩn nút hủy.
  - `assigned` (group): dòng ghi chú "Bạn đã được xếp vào lớp".
- Mô tả trạng thái dưới timeline: `pending` "Admin đã tiếp nhận yêu cầu và đang xem xét."; `message_sent` "Admin đã gửi phản hồi. Vui lòng đọc thông báo và chọn Đồng ý hoặc Từ chối."; `waiting_assignment` "Admin đang tìm PT phù hợp. Bạn vẫn có thể hủy yêu cầu trước khi PT được phân công."; `assigned` "PT đã được phân công thành công. Bạn có thể bắt đầu đặt lịch với PT."

### Hội viên — `NotificationCenter.tsx`
- Card riêng cho `PT_REASSIGN_REQUEST` (khi `receiverRole === 'member'`): hiển thị nội dung + nút `[Từ chối]` / `[Đồng ý]`.
- **Lifecycle action** (chỉ thao tác được 1 lần):
  - Backend lưu `actionStatus: 'accepted' | 'rejected'` + `actionAt` ngay trên notification khi hội viên phản hồi (`respondToMessage`) — không phụ thuộc trạng thái request.
  - Render theo `actionStatus`: `accepted` → `✓ Bạn đã đồng ý`, `rejected` → `✕ Bạn đã từ chối`; chỉ `pending` mới hiện 2 button.
  - Refresh / mở lại Notification: trạng thái lấy từ notification nên không bao giờ hiện lại button (fallback dữ liệu cũ dùng `requestStatus`).
  - Socket `notification:updated` emit tới room member → mọi tab đang mở đều đổi ngay.
- **Role-guard click** (`safeRedirect`): member/pt KHÔNG navigate tới `redirectUrl` bắt đầu bằng `/admin`; card `ACTION_REQUIRED` chỉ render cho admin/staff. Đảm bảo hội viên click notification không bao giờ sang trang Admin.

### PT 1-1 — PT chấp nhận → Hội viên xuất hiện trong "Học viên của tôi"
- `respondPtAssignment` (`accept`) → gọi `ptAssignmentService.createAssignment({ memberId, ptId })` tạo `PTAssignment` (status `active`) — tạo quan hệ PT ↔ Member, idempotent (tái sử dụng nếu đã có active cùng cặp).
- Emit `pt_clients:updated` (`{ action: 'added', memberId }`) tới room riêng của PT → `PTClientsPage` nghe sự kiện và `fetchClients()` ngay — counter "0 học viên" → "1 học viên" không cần F5.
- Danh sách lấy từ API `GET /pt-assignments/pt/clients` (`findActiveAssignmentByPt` — query `PTAssignment` active) — sau khi reload trang hội viên vẫn còn vì đã lưu DB. Frontend chỉ render từ dữ liệu backend, không hardcode.
- Khi PT `reject`: KHÔNG tạo `PTAssignment` → hội viên không xuất hiện trong danh sách.

### KHÔNG THAY ĐỔI
- Popup **"Phân công PT"** (render toàn bộ danh sách PT) — giữ nguyên, không lọc theo PT mong muốn.

---

## 6. Business Rules

- **BR1** — Admin KHÔNG được hủy yêu cầu PT 1-1 của hội viên.
- **BR2** — Nếu PT mong muốn không thể nhận thêm học viên, Admin chỉ được "Gửi tin nhắn" đề xuất đổi PT.
- **BR3** — Hội viên là người quyết định: chọn `[Đồng ý]` hoặc `[Từ chối]`.
- **BR4** — `[Từ chối]` → `declined_by_member`, đóng yêu cầu, KHÔNG phân công PT, không cần xử lý tiếp.
- **BR5** — `[Đồng ý]` → `waiting_assignment`; chỉ khi đó Admin mới được mở lại "Phân công PT" và chọn PT khác.
- **BR6** — Popup phân công PT giữ nguyên hành vi cũ (hiện danh sách PT đầy đủ).
- **BR7** — Chỉ hội viên (chủ sở hữu yêu cầu) được phản hồi; yêu cầu phải đang ở `message_sent`.
- **BR8** — Chỉ admin/super_admin/staff được gửi tin nhắn; yêu cầu phải ở `pending` hoặc `message_sent`.

---

## 7. File bị ảnh hưởng

### Backend
| File | Thay đổi |
|------|----------|
| `gym-backend/src/models/TrainingRequest.js` | Enum status thêm `message_sent`, `waiting_assignment`, `declined_by_member`; thêm `lastMessage`, `messageSentAt` |
| `gym-backend/src/models/Notification.js` | Thêm `PT_REASSIGN_REQUEST`, `ACTION_REQUIRED`, `PT_REASSIGN_DECLINED` + category `BOOKING_PT`; thêm field `priority`, `actionStatus` (`pending`/`accepted`/`rejected`), `actionAt` |
| `gym-backend/src/services/trainingRequestService.js` | Thêm `sendMessage`, `respondToMessage`; guard `assignTrainer` (chỉ `pending`/`waiting_assignment`); `getMyRequests` populate `assignedTrainerId`/`preferredTrainerId`/`assignedClassId` |
| `gym-backend/src/services/socketService.js` | Thêm helper `emitNotificationUpdated` (emit `notification:updated` tới room user); `emitPtClientsUpdated` (emit `pt_clients:updated`) |
| `gym-backend/src/controllers/trainingRequestController.js` | Gỡ `cancelByAdmin`; thêm `sendMessage`, `respondToMessage`; `respondToMessage` lưu `actionStatus`/`actionAt`/`isRead` vào notification `PT_REASSIGN_REQUEST` + emit `notification:updated`; `respondPtAssignment` (`accept`) → tạo `PTAssignment` active + emit `pt_clients:updated` |
| `gym-backend/src/routes/trainingRequestRoutes.js` | Gỡ `PATCH /:id/cancel`; thêm `POST /:id/send-message`, `POST /:id/respond` |

### Frontend
| File | Thay đổi |
|------|----------|
| `gym-frontend/src/services/trainingRequestService.ts` | Union status mới; bỏ `cancelByAdmin`; thêm `sendMessage`, `respond` |
| `gym-frontend/src/services/notificationService.ts` | Thêm `actionStatus`, `actionAt` vào type `NotificationItem` |
| `gym-frontend/src/pages/dashboard/admin/AdminMembersPage.tsx` | Nút "Gửi tin nhắn" + modal; tabs & nhãn trạng thái mới; phân công lại cho `waiting_assignment` |
| `gym-frontend/src/components/notifications/NotificationCenter.tsx` | Card `PT_REASSIGN_REQUEST` cho member với nút phản hồi; render theo `actionStatus` (`✓ Đã đồng ý` / `✕ Đã từ chối`, chỉ `pending` hiện button); subscribe `notification:updated` để đồng bộ mọi tab |
| `gym-frontend/src/components/member/YourRequestPanel.tsx` | Thiết kế lại: card lớn dọc đơn cột + timeline ✓/●/○ + mô tả trạng thái + hành động theo status (`pending`/`waiting_assignment` hủy; `message_sent` chỉ Đồng ý/Từ chối; `assigned` Xem PT/Đặt lịch/Nhắn tin) |
| `gym-frontend/src/pages/dashboard/member/BookingPage.tsx` | Nhãn trạng thái mới; panel "Yêu cầu của bạn" hiển thị full-width trên grid 2 card |
| `gym-frontend/src/pages/dashboard/pt/PTClientsPage.tsx` | Lắng nghe `pt_clients:updated` → `fetchClients()` realtime khi PT vừa chấp nhận hội viên PT 1-1 |

---

## 8. Socket events (real-time)

- `pt1on1:status_changed` — emit tới room `staff` và member khi: gửi tin nhắn, hội viên phản hồi, phân công PT, hủy.
- `pt1on1:assign_required` — emit tới room `staff` khi hội viên `[Đồng ý]` đổi PT: admin nhận toast realtime (App.tsx) hoặc reload list (AdminMembersPage). Chi tiết: `PT_ASSIGNMENT_REALTIME_NOTIFICATION.md`.
- `notification:new` — tự động phát qua `createNotification` (member nhận trực tiếp; admin/staff nhận qua room `staff`).
- `pt_clients:updated` — emit tới room riêng của PT khi PT vừa `[Chấp nhận]` hội viên PT 1-1; `PTClientsPage` (tab "Đang hướng dẫn") lắng nghe và tải lại danh sách + counter ngay.
- `notification:updated` — phát qua `emitNotificationUpdated` khi action notification được xử lý (ví dụ hội viên `Đồng ý`/`Từ chối` đề xuất đổi PT); mọi tab đang mở đều cập nhật ngay.
