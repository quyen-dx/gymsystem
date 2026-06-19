# GymPro Navigation Map

Navigation map is the official route reference for GymPro AI.

AI must not hard-code navigation answers in prompts. AI loads this document through `aiDocsService`, resolves the route with backend code, checks the current user role, then returns a natural answer plus navigation links.

Navigation map chỉ được dùng khi user hỏi:

- ở đâu
- vào đâu
- bấm chỗ nào
- mở trang nào
- cách thao tác trong UI

Không dùng navigation map để trả lời câu hỏi dữ liệu/report như:

- doanh thu tháng này
- bao nhiêu hội viên
- PT đang nhận bao nhiêu học viên
- member nào sắp hết hạn
- gói Premium giá bao nhiêu

Nếu câu hỏi là dữ liệu/report, phải quay lại Permission/Auth check và Database/tool flow. Không fallback sang route guard chỉ vì user tự xưng role.

## Data Rule

For navigation, help, account, booking, check-in, workout, health, product, order, FAQ, policy, payment and authentication questions that are actually asking where/how to operate in the UI:

1. Use FAQ database first when the question is support/how-to.
2. Use Policy database first when the question is a rule, term, refund, payment or privacy policy.
3. Use this navigation map to attach the correct route.
4. Do not return a route outside the current user's role.
5. If a route has a disabled feature flag, explain that the feature is currently unavailable and do not render the link.

## Member Routes

| Label | Path | Subject | Description | Requires Auth | Feature Flag |
| --- | --- | --- | --- | --- | --- |
| Trang chủ | `/` | home | Trang chính của GymPro | no | |
| AI Chat | `/ai-chat` | ai | Trợ lý AI GymPro | yes | |
| Nạp tiền | `/deposit` | payment | Nạp tiền vào ví/tài khoản | yes | |
| Cửa hàng | `/store` | product | Mua sản phẩm như whey, phụ kiện | no | |
| Giỏ hàng | `/cart` | cart | Xem sản phẩm đã chọn | no | |
| Thanh toán | `/checkout` | payment | Thanh toán đơn hàng | yes | |
| Đơn hàng | `/orders` | order | Xem lịch sử đơn hàng | yes | |
| Theo dõi đơn hàng | `/track/:id` | order | Theo dõi trạng thái đơn hàng | no | |
| Đặt lịch PT | `/booking` | booking | Xem PT và đặt lịch tập | yes | `pt.memberBookingEnabled` |
| Sức khỏe | `/health` | health | Xem chỉ số và nhật ký sức khỏe | yes | |
| Lộ trình tập | `/workout` | workout | Xem lộ trình và bài tập | yes | |
| Check-in | `/checkin` | checkin | Check-in tại phòng gym | yes | |
| Gửi phản hồi | `/feedback` | feedback | Gửi phản hồi cho GymPro | yes | |
| Phản hồi của tôi | `/my-feedback` | feedback | Xem phản hồi đã gửi | yes | |
| Hoạt động của tôi | `/my-activity` | activity | Xem hoạt động gần đây | yes | |
| Hồ sơ cá nhân | `/account/profile` | account | Hồ sơ, tài khoản và bảo mật | yes | |
| FAQ | `/help` | faq | Xem câu hỏi thường gặp | no | |
| Chính sách | `/policies` | policy | Xem chính sách và điều khoản | no | |
| Đăng nhập | `/login` | auth | Đăng nhập tài khoản | no | |
| Đăng ký | `/register` | auth | Tạo tài khoản mới | no | |
| Quên mật khẩu | `/forgot-password` | forgot_password | Nhận OTP và đặt lại mật khẩu | no | |

## PT Routes

| Label | Path | Subject | Description | Requires Auth |
| --- | --- | --- | --- | --- |
| Lịch PT | `/pt/schedule` | schedule | Xem lịch dạy của PT | yes |
| Lịch chờ xác nhận | `/pt/schedule/pending` | schedule | Xem lịch đang chờ xác nhận | yes |
| Học viên của tôi | `/pt/clients` | pt_clients | Xem danh sách học viên PT phụ trách | yes |
| Lộ trình quản lý | `/pt/workouts` | workout | Quản lý lộ trình tập cho học viên | yes |
| Hồ sơ cá nhân | `/account/profile` | account | Hồ sơ, tài khoản và bảo mật | yes |

## Staff Routes

| Label | Path | Subject | Description | Requires Auth |
| --- | --- | --- | --- | --- |
| Quét QR check-in | `/staff/checkin` | checkin | Check-in hội viên tại quầy | yes |
| Danh sách hội viên | `/staff/members` | members | Xem và hỗ trợ hội viên | yes |
| Thanh toán | `/staff/payments` | payment | Xem và xử lý thanh toán | yes |
| Thông báo | `/staff/notifications` | notifications | Xem thông báo nội bộ | yes |
| Hồ sơ cá nhân | `/account/profile` | account | Hồ sơ, tài khoản và bảo mật | yes |

## Admin Routes

| Label | Path | Subject | Description | Requires Auth |
| --- | --- | --- | --- | --- |
| Bảng quản trị | `/admin` | admin | Trang tổng quan quản trị | yes |
| Quản lý gói tập | `/admin/plans` | membership | Tạo và quản lý gói tập | yes |
| Quản lý người dùng | `/admin/users` | users | Quản lý tài khoản người dùng | yes |
| Quản lý hội viên | `/admin/members` | members | Quản lý hội viên | yes |
| Quản lý PT | `/admin/trainers` | pt | Quản lý huấn luyện viên | yes |
| Báo cáo | `/admin/reports` | reports | Xem báo cáo hệ thống | yes |
| Quản lý check-in | `/admin/checkin` | checkin | Xem dữ liệu check-in | yes |
| Quản lý FAQ | `/admin/faqs` | faq | Xem và quản lý FAQ | yes |
| Tạo FAQ | `/admin/faqs/create` | faq | Tạo FAQ mới | yes |
| Quản lý chính sách | `/admin/policies` | policy | Xem và quản lý chính sách | yes |
| Tạo chính sách | `/admin/policies/create` | policy | Tạo chính sách mới | yes |
| Cài đặt hệ thống | `/admin/system-settings` | system | Quản lý cấu hình hệ thống | yes |
| Hồ sơ cá nhân | `/account/profile` | account | Hồ sơ, tài khoản và bảo mật | yes |

## Seller Routes

| Label | Path | Subject | Description | Requires Auth |
| --- | --- | --- | --- | --- |
| Sản phẩm của tôi | `/seller/products` | product | Quản lý sản phẩm của shop | yes |
| Thêm sản phẩm | `/seller/products/create` | product | Tạo sản phẩm mới | yes |
| Đơn hàng shop | `/seller/orders` | order | Xem đơn hàng của shop | yes |
| Shop của tôi | `/seller/shop` | shop | Xem cửa hàng người bán | yes |
| Doanh thu | `/seller/revenue` | revenue | Xem doanh thu người bán | yes |
| Hồ sơ cá nhân | `/account/profile` | account | Hồ sơ, tài khoản và bảo mật | yes |

## Intent Examples

### MEMBER
- `xem lịch của tôi ở đâu` -> `/booking` (từ chối `/pt/schedule`)
- `đặt lịch PT ở đâu` -> `/booking`
- `check-in ở đâu` -> `/checkin`
- `đổi mật khẩu ở đâu` -> `/account/profile`
- `quên mật khẩu` -> `/forgot-password`
- `xem đơn hàng ở đâu` -> `/orders`
- `xem sức khỏe ở đâu` -> `/health`
- `xem lộ trình ở đâu` -> `/workout`
- `xem FAQ` -> `/help`
- `xem chính sách hoàn tiền` -> đọc policy + `/policies`
- `mua whey ở đâu` -> `/store`
- `muốn xem lịch tập` -> `/booking`
- `vào xem sức khỏe` -> `/health`
- `nạp tiền ở đâu` -> `/deposit`
- `feedback ở đâu` -> `/feedback`

### PT
- `xem lịch của tôi ở đâu` -> `/pt/schedule`
- `lịch chờ xác nhận ở đâu` -> `/pt/schedule/pending`
- `học viên của tôi ở đâu` -> `/pt/clients`
- `lộ trình tôi quản lý ở đâu` -> `/pt/workouts`

### STAFF
- `quét QR ở đâu` -> `/staff/checkin`
- `xem hội viên ở đâu` -> `/staff/members`
- `xem thanh toán ở đâu` -> `/staff/payments`

### ADMIN
- `quản lý PT ở đâu` -> `/admin/trainers`
- `quản lý FAQ ở đâu` -> `/admin/faqs`
- `quản lý chính sách ở đâu` -> `/admin/policies`
- `quản lý gói tập ở đâu` -> `/admin/plans`

### SELLER
- `sản phẩm của tôi ở đâu` -> `/seller/products`
- `thêm sản phẩm ở đâu` -> `/seller/products/create`
- `đơn hàng shop ở đâu` -> `/seller/orders`
- `doanh thu ở đâu` -> `/seller/revenue`

### Edge cases
- `muốn xem lịch tập` (không có "ở đâu") -> `/booking`
- `check-in` (không có "ở đâu") -> `/checkin`
- `làm sao để đặt PT` -> `/booking`
- `trang chủ ở đâu` -> `/`

## Security Examples

If a member asks `vào admin ở đâu`, do not return `/admin`.

Answer:

Trang này chỉ dành cho quản trị viên. Với tài khoản hội viên, bạn có thể dùng các chức năng dành cho hội viên trong GymPro.

If a member asks `xem lịch PT ở đâu`, return `/booking`, not `/pt/schedule`.
