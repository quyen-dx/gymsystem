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
- Ordered list Markdown (`1. `, `2. `) — frontend renderer không hỗ trợ `<ol>`/`<li>`, thay bằng `PT 1: Name`
- Markdown link (`[text](url)`) — frontend renderer chỉ hỗ trợ `https://`, không hỗ trợ `mailto:`
- mailto: link
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

## Markdown Hierarchy

Frontend renderer (`AssistantMessageBubble.tsx`) xử lý từng dòng với các rule:

### Entity title (uppercase, bold, accent color)

Dòng độc lập, không chứa `:`, độ dài <= 72 ký tự, bắt đầu bằng `Gói`/`Plan`/`PT`/`Huấn luyện viên`/`Trainer`:

```text
GÓI VIP
PT CGPT 1
WHEY PROTEIN
```

### Numbered entity

Dùng `PT 1: Name` thay vì `1. Name`:

```text
PT 1: CGPT 1
PT 2: JUAN
```

Không dùng:

```text
1. CGPT 1
2. JUAN
```

### Label

Label kết thúc bằng `:`:

```text
Giá:
Thời hạn:
Chuyên môn:
Liên hệ:
SĐT:
Email:
Quyền lợi:
```

### Value

Value là dữ liệu thực tế, text bình thường:

```text
250.000đ
365 ngày
Boxing • Gym
```

### Inline rich text

Frontend hỗ trợ trong cùng dòng:

- `**bold**` → `<strong>`
- `` `code` `` → `<code>`
- URL `https://...` → `<a>` link (chỉ https, không mailto)

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
- abc@gmail.com

**Không dùng Markdown link cho email** — frontend renderer không hỗ trợ `mailto:`:

Sai:

```text
Email: [abc@gmail.com](mailto:abc@gmail.com)
```

Đúng:

```text
Email: abc@gmail.com
```

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
GÓI CƠ BẢN

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

Không dùng ordered list cho danh sách gói:

Sai:

```text
1. GÓI CƠ BẢN
2. GÓI VIP
```

Đúng:

```text
GÓI CƠ BẢN
...
────────────────────────
GÓI VIP
...
```

## PT List

```text
PT 1: CGPT 1

Chuyên môn:
Boxing • Gym • Personal Training

Liên hệ:
SĐT: 0234566777
Email: abc@gmail.com

────────────────────────

PT 2: JUAN

Chuyên môn:
Yoga • Fitness

Liên hệ:
SĐT: 0123456798
Email: pt123@gmail.com
```

Email phải ở cùng dòng với label. Không dùng `[email](mailto:email)`.

Sai:

```text
Email: [abc@gmail.com](mailto:abc@gmail.com)
```

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

## Recommendation

```text
Mình gợi ý gói **Basic** cho bạn.

Vì: Chi phí thấp nhất, Phù hợp nhu cầu tiết kiệm

Giá: 300.000đ
Thời hạn: 30 ngày

Quyền lợi:

• Check-in QR
• Sử dụng phòng tập

Ngoài ra bạn cũng có thể tham khảo:
PLUS — 500.000đ — 60 ngày
PRO — 1.200.000đ — 90 ngày
```

## Membership Status

```text
Gói tập hiện tại của bạn là **Basic** (còn hạn).

Ngày bắt đầu: 1/7/2026
Ngày kết thúc: 31/7/2026
Bạn còn 30 ngày sử dụng.

Bạn có 2 kỳ gia hạn sắp tới:
- **Premium**: bắt đầu 1/8/2026, kết thúc 31/8/2026
- **VIP**: bắt đầu 1/9/2026, kết thúc 30/9/2026
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
- `Email: [abc@gmail.com](mailto:abc@gmail.com)`
- `1. Tên` (ordered list — frontend renderer không support)
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
