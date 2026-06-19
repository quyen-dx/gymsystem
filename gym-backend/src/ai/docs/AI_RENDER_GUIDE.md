# AI Render Guide

File này chỉ định nghĩa cách hiển thị dữ liệu AI.

Không xử lý business logic, tool calling, database, cache, memory hoặc AI reasoning.

Mục tiêu duy nhất là biến dữ liệu AI thành nội dung dễ đọc, dễ scan, dễ so sánh, chuyên nghiệp, giống ChatGPT / Notion / Perplexity. Không render giống JSON, log terminal, debug output hoặc database dump.

## Nguyên Tắc Chung

Ưu tiên:

1. Typography
2. Khoảng trắng
3. Phân nhóm dữ liệu
4. Visual hierarchy
5. Theme consistency

Không dùng:

- Emoji trang trí
- Icon không cần thiết
- Màu ngẫu nhiên
- Markdown mailto bị tách dòng
- Raw URL
- JSON
- Object dump

Không render:

- undefined
- null
- NaN
- [object Object]
- Mongo ObjectId
- Internal ID
- Payload nội bộ

## Typography Rules

Tiêu đề chính dùng tên uppercase:

- GÓI VIP
- GÓI CƠ BẢN
- CGPT 1
- JUAN
- WHEY PROTEIN

Label nhỏ hơn tiêu đề:

- Giá:
- Thời hạn:
- Chuyên môn:
- Liên hệ:
- Quyền lợi:

Value là dữ liệu thực tế:

- 250.000đ
- 365 ngày
- Boxing • Gym
- [abc@gmail.com](mailto:abc@gmail.com)

## Separator

Dùng:

```text
────────────────────────
```

Không dùng:

- ---
- ===========
- ###########

## Plan List

```text
1. GÓI CƠ BẢN

Giá: 250.000đ
Thời hạn: 30 ngày

Quyền lợi:

• Sử dụng phòng tập
• Check-in QR

────────────────────────
```

Không xuống dòng giữa label và value.

Đúng:

```text
Giá: 250.000đ
```

Sai:

```text
Giá:

250.000đ
```

## PT List

```text
1. CGPT 1

Chuyên môn:
Boxing • Gym • Personal Training

Liên hệ:
SĐT: 0234566777
Email: [abc@gmail.com](mailto:abc@gmail.com)
```

Email phải ở cùng dòng với label.

## Product List

```text
WHEY PROTEIN

Giá: 850.000đ

Mô tả:

Hỗ trợ tăng cơ.
```

## Nutrition

```text
TRƯỚC BUỔI TẬP

Nên ăn:

• Chuối
• Yến mạch
• Bánh mì nguyên cám
```

## Workout

```text
KẾ HOẠCH TẬP

3 buổi mỗi tuần

Buổi 1

• Ngực
• Vai
• Tay sau
```

## Color Rules

Dark mode:

- Tiêu đề: theme color
- Text: trắng
- Label: xám
- Separator: xám mờ

Light mode:

- Tiêu đề: theme color
- Text: đen
- Label: xám đậm
- Separator: xám nhạt

## Anti Patterns

Không render:

- `Giá:\n\n250.000đ`
- `Email:\nmailto:abc@gmail.com`
- `{ "price": 250000 }`
- `[object Object]`
- debug log
- internal id
- Mongo ObjectId

## Mục Tiêu Cuối

Người dùng phải đọc được trong 3 giây:

- Tên là gì
- Giá bao nhiêu
- Có quyền lợi gì
- Liên hệ ai
- Chọn cái nào

Ưu tiên cảm giác giống ChatGPT và Notion, không giống terminal hoặc log kỹ thuật.
