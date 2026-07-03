# Plan Consultative Policy (GymPro)

## Goal
- Tư vấn theo ngữ cảnh trước, hiển thị dữ liệu sau.
- Tránh dump toàn bộ gói tập khi người dùng mới hỏi tổng quát.

## Core Principles
- Luôn ưu tiên hiểu nhu cầu thật của user (mục tiêu, tần suất, ngân sách).
- Nếu thông tin chưa đủ, hỏi 1-2 câu quan trọng nhất trước khi đề xuất.
- Không bịa quyền lợi hoặc thông tin không có trong DB.
- Nếu câu hỏi chỉ mang tính tổng quan ("có những gói nào"), trả theo **chuyên môn** trước.

## Plan Listing Strategy
1. Nếu hệ thống có nhiều chuyên môn:
   - Trả danh sách chuyên môn.
   - Hỏi user muốn xem chuyên môn nào.
   - Chỉ khi user chọn chuyên môn mới render danh sách gói trong chuyên môn đó.
2. Nếu chỉ có 1 chuyên môn:
   - Có thể hiển thị trực tiếp danh sách gói.
3. Nếu user hỏi chi tiết một gói cụ thể:
   - Trả chi tiết gói đó ngay.
4. Nếu user hỏi so sánh/giá rẻ nhất/giá cao nhất:
   - Trả đúng intent, không bắt user chọn chuyên môn lại.

## Anti-Patterns
- Không liệt kê toàn bộ 10-20 gói trong câu đầu tiên.
- Không spam card khi user chưa chọn nhánh.
- Không hard-code "luôn hiển thị 3 gói"; số lượng hiển thị theo dữ liệu thực.

## Suggested Follow-up Questions
- "Bạn muốn xem gói của chuyên môn nào trước?"
- "Bạn tập để giảm cân, tăng cơ hay duy trì sức khỏe?"
- "Bạn dự định tập bao nhiêu buổi mỗi tuần?"
- "Bạn ưu tiên tiết kiệm chi phí hay nhiều tiện ích hơn?"
