# GymPro AI Docs

Thư mục này là nguồn tài liệu reasoning/prompt/render chính thức cho AI backend GymPro.

Frontend không đọc hoặc xử lý các tài liệu này. Frontend chỉ render UI và dữ liệu đã được backend trả về.

## Files

- `AI_RENDER_GUIDE.md`: chỉ dùng cho format hiển thị. Tài liệu này hướng dẫn cách render câu trả lời, danh sách, card text, typography, separator và các lỗi hiển thị cần tránh. Không dùng file này để quyết định business logic, tool calling, database, memory hoặc intent.
- `AI_GYMPRO_REASONING_MASTER.md`: luật suy luận nghiệp vụ chính. Tài liệu này định nghĩa data-first rule, tool planning, memory, web search, safety, response rule và các domain chính của GymPro.
- `AI_REASONING_ARCHITECTURE.md`: kiến trúc flow suy luận nhiều layer. Tài liệu này mô tả query understanding, intent classification, tool planning, data priority, context reasoning, entity resolution, response planning và rendering separation.
- `GYMPRO_BUSINESS_BRAIN.md`: hiểu nghiệp vụ GymPro và cross-module reasoning. Tài liệu này dùng cho quyết định giữa membership, PT, workout, nutrition, check-in, booking, product, policy và các tình huống business phức tạp.
- `NAVIGATION_MAP.md`: bản đồ route chính thức của GymPro. Tài liệu này dùng cho navigation intelligence, role-aware route suggestion, FAQ/Policy link fallback và hướng dẫn người dùng đi tới đúng màn hình.
- `LEGACY_REASONING_ARCHITECTURE.md`: tài liệu cũ/tham khảo cho kiến trúc agent LLM-based reasoning, memory và entity resolver. Giữ lại để đối chiếu khi refactor hoặc debug luồng cũ.

## Constitutional Database-First Rule

Mọi tài liệu và code AI phải theo thứ tự:

1. Permission/Auth check
2. Current user context
3. Database / fresh tool result
4. Valid cache
5. Conversation memory chỉ dùng để resolve entity/context
6. Internal docs / navigation map / FAQ / policy
7. Web search cho kiến thức ngoài GymPro
8. LLM knowledge là fallback cuối

Memory không được đứng trên database cho dữ liệu động như giá, lịch, doanh thu, số lượng, trạng thái thanh toán hoặc check-in hiện tại.

Navigation map chỉ dùng cho câu hỏi UI như ở đâu, vào đâu, bấm chỗ nào, mở trang nào hoặc cách thao tác. Không dùng navigation để trả lời câu hỏi dữ liệu/report.

## Loading Rule

Backend phải dùng `src/ai/services/aiDocsService.js` để load section liên quan. Không nhét toàn bộ Markdown vào mọi prompt.

Ví dụ:

- Gói tập: load section Plan, data rule, tool planning và render plan.
- PT: load section PT, memory/entity resolver và render PT.
- Dinh dưỡng: load section Nutrition, safety, web search và render nutrition.
- Tài khoản/navigation: load account/navigation, data priority và safety.
- Navigation/support: load `NAVIGATION_MAP.md` section theo role và dùng FAQ/Policy database làm nội dung trả lời thật nếu có.
- Follow-up như "người thứ 2": load memory/context reasoning/entity resolver.
