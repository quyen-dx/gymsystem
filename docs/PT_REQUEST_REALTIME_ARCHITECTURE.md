# Kiến trúc Realtime — Yêu cầu PT 1-1 & PT nhóm (PT_REQUEST_REALTIME_ARCHITECTURE)

> Toàn bộ module Yêu cầu PT (PT 1-1 **và** PT nhóm) đồng bộ realtime qua socket —
> **không polling, không setInterval**. Mỗi thay đổi trạng thái backend emit đúng
> **một** sự kiện; mọi component đang subscribe tự cập nhật **đúng record** thay đổi
> (không reload cả trang).

---

## 1. Socket Events

Backend emit qua helper `emitPtRequestEvent(event, { request, memberName })`
(`gym-backend/src/services/socketService.js`). Helper phát đồng thời tới:
- room `staff` (admin / super_admin / staff),
- room riêng của **member** (nếu có `memberId`),
- room riêng của **PT** (nếu có `assignedTrainerId`).

Payload chuẩn: `{ request, memberName }` trong đó `request` đã được populate
(`memberId`, `assignedTrainerId`, `assignedClassId`, ...).

| Event | Ý nghĩa | Điều kiện / nơi emit |
|-------|---------|----------------------|
| `pt_request_created` | Hội viên tạo yêu cầu mới | `createRequest` (pt1on1 **và** group) → status `pending` |
| `pt_request_updated` | Thay đổi chung (gửi đề xuất) | `sendMessage` → status `message_sent` |
| `pt_request_waiting_assignment` | Hội viên đồng ý đổi PT | `respondToMessage` (`accept`) → status `waiting_assignment` |
| `pt_request_assigned` | Admin phân công PT / xếp lớp | `assignTrainer` **và** `assignToClass` → status `assigned` |
| `pt_request_rejected` | Hội viên từ chối đổi PT | `respondToMessage` (`reject`) → status `declined_by_member` |
| `pt_request_cancelled` | Hủy yêu cầu | `cancelMyRequest` (member, cả 2 loại) → status `cancelled` |
| `pt_request_deleted` | Xóa yêu cầu | (dự phòng — chưa có endpoint xóa) |

Các sự kiện cũ (`pt1on1:new_request`, `pt1on1:status_changed`, `pt1on1:assign_required`)
đã được gỡ khỏi backend. Riêng room `pt1on1-active-view` + event
`pt1on1:join-active-view` / `pt1on1:leave-active-view` vẫn giữ để backend
**bỏ qua tạo notification trùng** khi admin đang mở màn hình phân công.

> Lưu ý: từ bản này `pt_request_*` áp dụng cho **cả 2 loại** — thành viên khi hủy yêu
> cầu nhóm hoặc admin xếp lớp (assignToClass) cũng phát event tương ứng.

---

## 2. Event Flow

```
MEMBER                         BACKEND                         ADMIN / STAFF
  │                               │                                 │
  │ gửi yêu cầu PT 1-1            │                                 │
  │──────────────────────────────►│ createRequest                    │
  │                               │ emit pt_request_created ───────►│ (store: thêm record, +1 pending)
  │                               │ createNotif PT_REQUEST_NEW ────►│ (notification center)
  │                               │                                 │
  │     Admin "Gửi tin nhắn"      │                                 │
  │◄──────────────────────────────│ sendMessage                      │◄─ emit pt_request_updated
  │ notif PT_REASSIGN_REQUEST     │                                 │    (store: update record)
  │                               │                                 │
  │ [Đồng ý] ───────────────────► │ respondToMessage accept          │
  │                               │ emit pt_request_waiting_assignment ──► (store: update + badge)
  │                               │ createNotif ACTION_REQUIRED ────►│ (notification center)
  │                               │ (bỏ qua nếu room active-view)    │
  │                               │                                 │
  │     Admin "Phân công PT"      │                                 │
  │◄──────────────────────────────│ assignTrainer                    │◄─ emit pt_request_assigned
  │ notif PT_ASSIGNED ───────────►│                                 │    (store: update + badge)
  │                               │ createNotif PT_REQUEST_ASSIGNED ──►│ (notification center)
  │                               │                                 │
  │ [Từ chối] ──────────────────► │ respondToMessage reject          │
  │                               │ emit pt_request_rejected ───────►│ (store: update + badge)
  │                               │ createNotif PT_REASSIGN_DECLINED ──►│ (notification center)
  │                               │                                 │
  │ hủy yêu cầu ────────────────► │ cancelMyRequest                  │
  │                               │ emit pt_request_cancelled ──────►│ (store: update + badge)
```

Mỗi transition emit **một** event duy nhất — không spam, không kèm `pt_request_updated` trùng lặp.

---

## 3. Store cập nhật (Frontend)

Store: `gym-frontend/src/context/PtRequestProvider.tsx` (mount ở `App.tsx`, chỉ hoạt động với admin/super_admin/staff).

### Khởi tạo (1 lần khi mount)
- `GET /api/training-requests/pt1on1/counts` → `countsByStatus` (chính xác cho badge).
- `GET /api/training-requests?type=pt1on1&limit=500` → cache `requests`.
- Giữ map `statusByRequestId` để biết trạng thái cũ khi có event.

### Khi nhận event `pt_request_*`
- **Upsert đúng 1 record** theo `_id` (thay thế phần tử trong list, hoặc thêm đầu list nếu mới).
- **Điều chỉnh counts** theo transition:
  - Record cũ đã biết + status đổi → `counts[old]--`, `counts[new]++`.
  - Record mới chưa biết → `counts[new]++`.
  - `pt_request_deleted` → xóa record + `counts[status]--`.
- **Không refetch list** — chỉ update record thay đổi.

### API expose
| Field | Mô tả |
|-------|-------|
| `requests` | Toàn bộ yêu cầu pt1on1 trong cache (sắp theo `createdAt` desc) |
| `countsByStatus` | Số lượng theo từng status: `pending, message_sent, waiting_assignment, assigned, declined_by_member, cancelled` |
| `loading` / `hasLoaded` | Trạng thái load ban đầu |
| `reload()` | Fetch lại từ đầu (khi cần) |
| `latestRequestForMember(memberId)` | Yêu cầu gần nhất chưa kết thúc (`declined_by_member`/`cancelled` không tính) |

---

## 4. Các component subscribe

| Component | Subscribe | Cập nhật |
|-----------|-----------|----------|
| `PtRequestProvider` (store) | Tất cả `pt_request_*` | cache `requests` + `countsByStatus` |
| `DashboardLayout` — sidebar "Hội viên" (`/admin/members`) | qua store | badge = `badgeCount` (same value nút) |
| `AdminMembersPage` — nút "Yêu cầu PT 1-1" | qua store | badge = `badgeCount` = `counts.pending + counts.waiting_assignment` |
| `AdminMembersPage` — modal "Yêu cầu PT 1-1" | qua store | list = `requests` lọc theo tab; badge chỉ ở tab Chờ xử lý + Chờ phân công; status tag |
| `AdminMembersPage` — bảng thành viên | qua store | cột "Yêu cầu PT" = `latestRequestForMember(memberId)` |
| `App.tsx` — `RealtimeAssignmentListener` | `pt_request_created`, `_waiting_assignment`, `_rejected`, `_assigned`, `_cancelled` | toast realtime khi admin KHÔNG ở `/admin/members`; click → điều hướng tới tab tương ứng. **Phân biệt role**: member nhận toast thông tin click → `/booking` (không bao giờ `/admin/*`) |
| `NotificationCenter` | `notification:new` + `notification:updated` | nhận `PT_REQUEST_NEW`, `ACTION_REQUIRED`, `PT_REASSIGN_DECLINED`, `PT_REQUEST_ASSIGNED`; PT nhận card `MEMBER_ASSIGNED` ([Chấp nhận]/[Từ chối] + modal lý do); member nhận `PT_REASSIGNING` ("Hệ thống đang tìm PT phù hợp hơn") realtime |
| `BookingPage` (member) | `pt_request_*` (qua room cá nhân) | reload yêu cầu pt1on1 của hội viên |

### Chi tiết từng màn hình

**1. Badge nút "Yêu cầu PT 1-1"** — store cung cấp `badgeCount` = `counts.pending + counts.waiting_assignment`, tự đổi khi có bất kỳ event nào. Sidebar "Hội viên" dùng đúng giá trị `badgeCount` này (không tự tính lại).

**2. Modal "Yêu cầu PT 1-1"** — 7 tab đều realtime:
- Chờ xử lý / Đã gửi tin / Chờ phân công / Đã phân công / Đã từ chối / Đã hủy / Tất cả.
- Chỉ tab **Chờ xử lý** và **Chờ phân công** hiển thị badge số lượng (từ `countsByStatus`); các tab còn lại không badge. Danh sách lọc theo tab từ store.
- Khi yêu cầu đổi status → record chuyển tab tức thì (chỉ record đó).

**3. Trang `/admin/members`** — bảng thành viên có cột **"Yêu cầu PT"**:
- Hiển thị tag trạng thái của yêu cầu PT 1-1 gần nhất của hội viên.
- Click tag → mở modal PT 1-1 đúng tab tương ứng.
- Request chuyển `pending → waiting_assignment` → tag + badge + nút thao tác trong modal đổi ngay, không F5.

**4. Notification Center Admin** — nhận realtime `notification:new`:
- Yêu cầu mới → `PT_REQUEST_NEW` (click → tab Chờ xử lý).
- Chờ phân công → `ACTION_REQUIRED` (card riêng, nút "Đi đến yêu cầu").
- Bị từ chối → `PT_REASSIGN_DECLINED`.
- Hoàn thành → `PT_REQUEST_ASSIGNED` (click → tab Đã phân công).

**5. Toast realtime** — khi admin KHÔNG mở modal / không ở `/admin/members`:
- `pt_request_created` → "🔔 Có yêu cầu PT 1-1 mới"
- `pt_request_waiting_assignment` → "🔔 Có yêu cầu PT cần phân công"
- `pt_request_rejected` / `pt_request_assigned` / `pt_request_cancelled` → thông báo tương ứng
- Click toast → điều hướng tới tab tương ứng trong modal.

---

## 5. Backend — nơi emit

Mọi emit nằm trong `gym-backend/src/controllers/trainingRequestController.js`:

| Controller | Event | Kèm hành động |
|------------|-------|---------------|
| `createRequest` | `pt_request_created` | + notif admin `PT_REQUEST_NEW` + notif member xác nhận "Bạn đã gửi yêu cầu" + (nếu chỉ định PT) notif PT `PT_REQUEST_DESIGNATED` |
| `sendMessage` | `pt_request_updated` | + notif member `PT_REASSIGN_REQUEST` |
| `respondToMessage` accept | `pt_request_waiting_assignment` | + notif admin `ACTION_REQUIRED` (bỏ qua nếu room `pt1on1-active-view` đang có người) |
| `respondToMessage` reject | `pt_request_rejected` | + notif admin `PT_REASSIGN_DECLINED` |
| `assignTrainer` | `pt_request_assigned` | + notif admin `PT_REQUEST_ASSIGNED` + notif PT `MEMBER_ASSIGNED` (action: Chấp nhận/Từ chối) trong service |
| `respondPtAssignment` accept | — | notif PT → "Bạn đã chấp nhận hội viên này." (`notification:updated`); **tạo `PTAssignment` active + emit `pt_clients:updated`** (Học viên của tôi realtime); admin `PT_REASSIGN_ACCEPTED`; member `PT_ASSIGNED` |
| `respondPtAssignment` reject | `pt_request_waiting_assignment` | request về `waiting_assignment` (bỏ PT); admin `PT_REASSIGN_DECLINED`; member `PT_REASSIGNING` |
| `cancelMyRequest` | `pt_request_cancelled` | — |

Notification model có 2 type mới: `PT_REQUEST_NEW`, `PT_REQUEST_ASSIGNED` (category `BOOKING_PT`). Thêm `MEMBER_ASSIGNED` (action PT 1-1), `MEMBERSHIP_REJECTED`, `PT_REASSIGNING`.

Endpoint mới: `GET /api/training-requests/pt1on1/counts` → `{ counts }` (admin/super_admin/staff); `POST /api/training-requests/:id/pt-respond` (PT xác nhận nhận hội viên).

**Role filtering (backend)**: `notificationService.getNotificationsForUser` / `countUnread` chỉ trả broadcast admin/staff/super_admin cho chính nhóm role đó — member/PT/seller không nhận notification admin.

---

## 6. Sequence Diagram

```
Admin           Frontend store (PtRequestProvider)          Backend                    Member
  │                         │                                │                           │
  │  mở trang /admin/members │                                │                           │
  │────────────────────────►│                                │                           │
  │                         │ GET /pt1on1/counts            │                           │
  │                         │──────────────────────────────►│                           │
  │                         │◄────────── { counts } ────────│                           │
  │                         │ GET /training-requests?type=pt1on1                        │
  │                         │──────────────────────────────►│                           │
  │                         │◄────────── { requests } ──────│                           │
  │                         │                                │  Hội viên tạo yêu cầu     │
  │                         │                                │◄──────────────────────────│
  │                         │                                │ emit pt_request_created   │
  │                         │◄──────────────────────────────│                           │
  │  badge nút + modal +    │ upsert record + counts +1     │                           │
  │  bảng thành viên tự đổi │                                │                           │
  │◄────────────────────────│                                │                           │
  │                         │                                │  Admin gửi tin / member   │
  │                         │                                │  đồng ý / từ chối / ...   │
  │                         │◄──── emit pt_request_* ────────│                           │
  │                         │ upsert ĐÚNG record + counts    │                           │
  │  (nếu không ở /admin/members) toast realtime             │                           │
  │◄────────────────────────────────────────────────────────│ (App.tsx listener)        │
```

---

## 7. Quy tắc

- **R1** — Mỗi thay đổi trạng thái emit đúng **1** event; payload luôn là `{ request, memberName }`.
- **R2** — Frontend chỉ **upsert/xóa đúng record** theo `_id` — không reload list, không reload trang.
- **R3** — Không polling, không `setInterval` cho PT 1-1. Dữ liệu khởi tạo fetch 1 lần khi mount store.
- **R4** — Toast chỉ hiện khi admin/staff KHÔNG ở `/admin/members`.
- **R5** — Notification `ACTION_REQUIRED` (chờ phân công) không bị "Đánh dấu tất cả đã đọc" xóa.
- **R6** — Hội viên nhận event qua room riêng; admin/staff nhận qua room `staff`; PT nhận qua room riêng khi được phân công.
- **R7** — Trùng yêu cầu: mỗi hội viên chỉ có **1** yêu cầu đang xử lý **mỗi loại** (`pending`, `message_sent`, `waiting_assignment`, `assigned`). Gửi yêu cầu mới khi đã có → HTTP `409` `"Bạn đang có một yêu cầu PT đang được xử lý."`
- **R8** — Hủy yêu cầu (trạng thái `pending` / `waiting_assignment`): hủy → emit `pt_request_cancelled` → notify admin (và PT nếu đã được phân công) → hội viên quay lại form đăng ký. `message_sent` KHÔNG có nút hủy (chỉ Đồng ý / Từ chối).
- **R9** — Hội viên thấy đề xuất đổi PT (`message_sent`) ngay trên trang "Yêu cầu của bạn" với nút [Từ chối] / [Đồng ý]; phản hồi chạy qua endpoint `POST /api/training-requests/:id/respond`.
- **R10** — `assigned` (pt1on1): card hiển thị [Xem PT] / [Đặt lịch] (→ `/booking/:ptId`) và [Nhắn tin] (toast fallback, chưa có chat PT); ẩn nút hủy.

---

## 8. File bị ảnh hưởng

### Backend
| File | Thay đổi |
|------|----------|
| `gym-backend/src/services/socketService.js` | Helper `emitPtRequestEvent`; giữ room `pt1on1-active-view`; thêm `emitPtClientsUpdated` (`pt_clients:updated`) |
| `gym-backend/src/controllers/trainingRequestController.js` | Emit `pt_request_*` cho cả 2 loại; guard 409; notif `PT_REQUEST_NEW` (+ confirm member "Bạn đã gửi yêu cầu"), `PT_REQUEST_ASSIGNED`, `PT_REQUEST_CANCELLED`; endpoint `respondPtAssignment` (PT Chấp nhận/Từ chối) + accept → tạo `PTAssignment` active + emit `pt_clients:updated` |
| `gym-backend/src/models/Notification.js` | Thêm type `PT_REQUEST_NEW`, `PT_REQUEST_ASSIGNED`, `PT_REQUEST_CANCELLED`, `PT_REQUEST_DESIGNATED`, `MEMBERSHIP_REJECTED`, `PT_REASSIGNING` |
| `gym-backend/src/services/trainingRequestService.js` | Guard trùng yêu cầu (409) trong `createRequest`; thêm `getPt1on1Counts`; `getMyRequests` populate `assignedTrainerId`/`preferredTrainerId`/`assignedClassId`; `assignTrainer` → notif PT `MEMBER_ASSIGNED` action Chấp nhận/Từ chối; thêm `unassignTrainer` |
| `gym-backend/src/services/ptAssignmentService.js` | `findActiveAssignmentByPt`: gán `type` (`GROUP` cho TrainingAssignment, `PT_1_1` cho PTAssignment) + attach `membershipStartAt`/`membershipExpiresAt` (từ MembershipCycle) + `requestNote`/`requestContactPhone`/`requestContactEmail` (từ TrainingRequest) + `totalSessions`/`attendedSessions` (điểm danh từ WorkoutSchedule) — phục vụ UI 2 tab PT 1-1 / PT nhóm; `findPendingApprovals`/`findHistoryByPt` thêm `type` để lọc theo tab |
| `gym-backend/src/routes/trainingRequestRoutes.js` | Thêm `GET /pt1on1/counts`, `POST /:id/pt-respond` |
| `gym-backend/src/services/notificationService.js` | **Role filtering**: `getNotificationsForUser`/`countUnread` chỉ trả broadcast admin/staff cho nhóm role admin/staff (member/PT không thấy admin notification) |

### Frontend
| File | Thay đổi |
|------|----------|
| `gym-frontend/src/context/PtRequestProvider.tsx` | **Store realtime mới** (cache + counts + subscribe `pt_request_*`); expose `badgeCount` = `counts.pending + counts.waiting_assignment` |
| `gym-frontend/src/App.tsx` | Mount `PtRequestProvider`; `RealtimeAssignmentListener` toast cho 5 event |
| `gym-frontend/src/pages/dashboard/admin/AdminMembersPage.tsx` | Dùng store: badge nút, modal 7 tab realtime, cột "Yêu cầu PT" ở bảng thành viên; socket reload yêu cầu nhóm; bỏ polling cũ |
| `gym-frontend/src/components/layout/header/DashboardLayout.tsx` | Sidebar "Hội viên" dùng `badgeCount` từ store (bỏ state/polling/socket cũ) |
| `gym-frontend/src/components/notifications/NotificationCenter.tsx` | Card generic điều hướng theo `redirectUrl`; card riêng `MEMBER_ASSIGNED` cho PT ([Chấp nhận]/[Từ chối] + modal nhập lý do); subscribe `notification:updated` |
| `gym-frontend/src/services/trainingRequestService.ts` | Thêm `getPt1on1Counts`, `limit` param, `respondPtAssignment` |
| `gym-frontend/src/pages/dashboard/pt/PTClientsPage.tsx` | Lắng nghe `pt_clients:updated` → `fetchClients()` realtime; **tách 2 tab chính theo `assignment.type`**: `PT 1-1` (Đang phụ trách / Chờ duyệt / Đã kết thúc) và `PT nhóm` (Đang hướng dẫn / Chờ duyệt / Đã kết thúc) kèm badge đếm; mỗi tab chỉ render đúng loại (active/pending/history đều lọc theo type); PT 1-1 không có UI lịch/lớp/giao án, expand gồm 4 section (Hội viên/Gói/Liên hệ/Ghi chú) + Lưu ý, action duy nhất "Kết thúc phụ trách"; PT nhóm có cột Điểm danh (`attended/total buổi`) và giữ expand lịch tập + chuyển/rời lớp; bỏ filter "Tập theo lớp" |
| `gym-frontend/src/pages/dashboard/member/BookingPage.tsx` | **"Yêu cầu của bạn"**: khi có yêu cầu đang xử lý (per type) → hiển thị panel full-width thay form; realtime cả 2 loại |
| `gym-frontend/src/components/member/YourRequestPanel.tsx` | **Mới/thiết kế lại**: card lớn dọc đơn cột + timeline ✓/●/○ + mô tả trạng thái + hành động theo status (`pending`/`waiting_assignment` hủy; `message_sent` Đồng ý/Từ chối; `assigned` Xem PT/Đặt lịch/Nhắn tin) |
