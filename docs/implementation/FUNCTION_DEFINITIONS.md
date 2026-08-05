# GymPro AI Assistant — Function Definitions

> **Status:** Implementation Specification  
> **Purpose:** Define every callable function for Gemini function calling  
> **Architecture:** 4 core functions. databaseQuery dispatches to 12 domains via existing services.  
> **Rule:** Functions call services, never models.

---

## 1. Function Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GEMINI FUNCTION CALLING                      │
│                                                                  │
│  Gemini sees these 4 functions and decides which to call:        │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ databaseQuery  │  │  vectorQuery   │  │   webQuery     │     │
│  │                │  │                │  │                │     │
│  │ Dispatches to  │  │ MongoDB cosine │  │ Tavily API     │     │
│  │ 12 domains via │  │ similarity on  │  │ + domain       │     │
│  │ existing       │  │ VectorDocument │  │ filter         │     │
│  │ services       │  │ collection     │  │                │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
│                                                                  │
│  ┌────────────────┐                                              │
│  │  visionQuery   │  (only if user attaches images)              │
│  │                │                                              │
│  │ Gemini Vision  │                                              │
│  │ API (base64)   │                                              │
│  └────────────────┘                                              │
│                                                                  │
│  ⚠ userId is ALWAYS injected server-side.                        │
│    Gemini CANNOT specify userId. It is taken from req.user._id.  │
│    This prevents any possibility of cross-user data access.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. databaseQuery

### 2.1 Gemini Declaration (What Gemini Sees)

```json
{
  "name": "databaseQuery",
  "description": "Truy xuất dữ liệu cá nhân của người dùng hiện tại từ GymPro. Dùng khi câu hỏi có từ 'tôi', 'của tôi', hoặc liên quan đến dữ liệu cá nhân. KHÔNG dùng cho câu hỏi về chính sách chung.",
  "parameters": {
    "type": "object",
    "properties": {
      "domain": {
        "type": "string",
        "enum": ["wallet", "membership", "bookings", "orders", "health", "nutrition", "checkin", "notifications", "plans", "products", "payments", "pt"],
        "description": "Lĩnh vực dữ liệu cần truy xuất"
      },
      "query": {
        "type": "string",
        "description": "Câu hỏi cụ thể của người dùng để lọc kết quả phù hợp (tùy chọn)"
      }
    },
    "required": ["domain"]
  }
}
```

### 2.2 Server-Side Implementation

```javascript
// Pseudocode — actual implementation path
async function databaseQuery(args, userId, role) {
  const { domain, query } = args;
  // userId is INJECTED by the server, NOT from Gemini args
  // role is INJECTED by the server for permission checks

  switch (domain) {
    case "wallet":        return getWalletData(userId);
    case "membership":   return getMembershipData(userId);
    case "bookings":     return getBookingsData(userId);
    case "orders":       return getOrdersData(userId);
    case "health":       return getHealthData(userId);
    case "nutrition":    return getNutritionData(userId);
    case "checkin":      return getCheckinData(userId);
    case "notifications": return getNotificationsData(userId, role);
    case "plans":        return getPlansData();
    case "products":     return getProductsData(userId);
    case "payments":     return getPaymentsData(userId);
    case "pt":           return getPTData(userId, role);
    default:
      return { error: "UNKNOWN_DOMAIN", availableDomains: DOMAINS };
  }
}
```

### 2.3 Domain Details

---

#### DOMAIN: wallet

| Field | Value |
|-------|-------|
| **Purpose** | Lấy số dư ví và điểm thưởng của người dùng hiện tại |
| **Service** | `walletService.getWalletByUser(userId)` |
| **Auth** | Member only. Returns own wallet. Admin: can query any member's wallet. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "wallet",
  "data": {
    "balance": 500000,
    "points": 120,
    "currency": "VND"
  },
  "empty": false,
  "deeplink": "/wallet"
}
```

**Empty Response:**
```json
{
  "source": "database",
  "domain": "wallet",
  "data": null,
  "empty": true,
  "deeplink": "/wallet",
  "message": "Chưa có ví. Truy cập trang Ví để tạo."
}
```

**Error Response:**
```json
{
  "source": "database",
  "domain": "wallet",
  "error": "SERVICE_ERROR",
  "message": "Không thể truy xuất dữ liệu ví."
}
```

**Example User Questions Matched:**
- "Số dư ví tôi?"
- "Còn bao nhiêu tiền trong ví?"
- "Tôi có bao nhiêu điểm thưởng?"
- "Ví tôi còn tiền không?"

---

#### DOMAIN: membership

| Field | Value |
|-------|-------|
| **Purpose** | Lấy thông tin gói tập hiện tại của người dùng |
| **Service** | `membershipService.getMyMembership({ userId })` |
| **Auth** | Member only. Returns own membership. Admin: can query any member. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "membership",
  "data": {
    "hasActiveMembership": true,
    "currentMembership": {
      "planName": "Gold",
      "status": "active",
      "startDate": "2026-01-15",
      "expiresAt": "2026-08-15",
      "remainingDays": 24,
      "canRenew": true
    },
    "pendingRenewals": [],
    "cancelRequests": []
  },
  "empty": false,
  "deeplink": "/membership"
}
```

**Empty Response:**
```json
{
  "source": "database",
  "domain": "membership",
  "data": { "hasActiveMembership": false },
  "empty": true,
  "deeplink": "/membership/plans",
  "message": "Bạn chưa đăng ký gói tập nào."
}
```

**Example User Questions Matched:**
- "Gói tập của tôi khi nào hết hạn?"
- "Tôi đang dùng gói nào?"
- "Gói tập còn bao nhiêu ngày?"
- "Membership của tôi còn active không?"

---

#### DOMAIN: bookings

| Field | Value |
|-------|-------|
| **Purpose** | Lấy danh sách lịch tập PT sắp tới của người dùng |
| **Service** | `bookingService.getUpcomingBookings({ userId })` |
| **Auth** | Member: own bookings. PT: assigned members' bookings. Admin: all. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "bookings",
  "data": {
    "count": 5,
    "bookings": [
      {
        "id": "booking_001",
        "ptName": "Nguyễn Văn Nam",
        "specialties": ["Bodybuilding", "Giảm cân"],
        "date": "2026-07-24",
        "slot": "09:00 - 10:00",
        "status": "confirmed"
      }
    ]
  },
  "empty": false,
  "deeplink": "/pt-booking"
}
```

**Empty Response:**
```json
{
  "source": "database",
  "domain": "bookings",
  "data": { "count": 0, "bookings": [] },
  "empty": true,
  "deeplink": "/pt-booking",
  "message": "Bạn chưa có lịch tập PT nào sắp tới."
}
```

**Example User Questions Matched:**
- "Còn bao nhiêu buổi PT?"
- "Lịch tập tuần này?"
- "Buổi PT tiếp theo khi nào?"
- "HLV nào dạy tôi?"

---

#### DOMAIN: orders

| Field | Value |
|-------|-------|
| **Purpose** | Lấy danh sách đơn hàng gần đây của người dùng |
| **Service** | `orderService.getOrdersByUser(userId)` |
| **Auth** | Member: own orders. Seller: own shop orders. Admin: all. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "orders",
  "data": {
    "count": 3,
    "orders": [
      {
        "id": "order_001",
        "items": [{ "productName": "Whey Protein", "quantity": 1, "price": 890000 }],
        "totalAmount": 890000,
        "status": "delivered",
        "createdAt": "2026-07-15"
      }
    ]
  },
  "empty": false,
  "deeplink": "/orders"
}
```

**Example User Questions Matched:**
- "Đơn hàng gần đây?"
- "Đơn hàng của tôi đâu rồi?"
- "Track my order?"
- "Kiểm tra đơn hàng?"

---

#### DOMAIN: health

| Field | Value |
|-------|-------|
| **Purpose** | Lấy chỉ số sức khỏe gần nhất của người dùng |
| **Service** | `healthService.getByUserId(userId)` or `HealthLog` model via service wrapper |
| **Auth** | Member: own health. PT: assigned members. Admin: all. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "health",
  "data": {
    "latest": {
      "date": "2026-07-20",
      "weight": 82.5,
      "bodyFat": 18.2,
      "muscle": 38.5,
      "bmi": 24.1
    },
    "history": [
      { "date": "2026-07-13", "weight": 83.0 },
      { "date": "2026-07-06", "weight": 83.5 }
    ]
  },
  "empty": false,
  "deeplink": "/health"
}
```

**Example User Questions Matched:**
- "Cân nặng hiện tại của tôi?"
- "Body fat của tôi bao nhiêu?"
- "Tôi đã giảm bao nhiêu kg?"
- "Chỉ số sức khỏe gần đây?"

---

#### DOMAIN: nutrition

| Field | Value |
|-------|-------|
| **Purpose** | Lấy nhật ký dinh dưỡng gần đây của người dùng |
| **Service** | `nutritionService.getByUserId(userId)` or equivalent |
| **Auth** | Member: own nutrition. PT: assigned members. Admin: all. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "nutrition",
  "data": {
    "today": {
      "date": "2026-07-22",
      "meals": [
        { "name": "Bữa sáng", "calories": 450, "protein": 35, "carbs": 50, "fat": 12 },
        { "name": "Bữa trưa", "calories": 650, "protein": 55, "carbs": 70, "fat": 18 }
      ],
      "totalCalories": 1100,
      "goalCalories": 2200,
      "remaining": 1100
    }
  },
  "empty": false,
  "deeplink": "/nutrition"
}
```

**Example User Questions Matched:**
- "Hôm nay tôi ăn bao nhiêu calo?"
- "Tôi đã ăn gì hôm nay?"
- "Còn bao nhiêu calo nữa?"
- "Dinh dưỡng hôm nay?"

---

#### DOMAIN: checkin

| Field | Value |
|-------|-------|
| **Purpose** | Lấy thống kê điểm danh của người dùng |
| **Service** | `checkInService.getCheckinStats({ userId })` |
| **Auth** | Member: own checkins. Staff/Admin: all members. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "checkin",
  "data": {
    "stats": {
      "total": 145,
      "thisMonth": 18,
      "thisWeek": 4,
      "last30Days": 22,
      "lastCheckin": "2026-07-22T08:15:00.000Z",
      "streak": 15
    }
  },
  "empty": false,
  "deeplink": "/checkin"
}
```

**Example User Questions Matched:**
- "Tôi điểm danh bao nhiêu ngày rồi?"
- "Streak của tôi bao nhiêu ngày?"
- "Tháng này tôi đi bao nhiêu buổi?"
- "Lần cuối tôi đến gym là khi nào?"

---

#### DOMAIN: notifications

| Field | Value |
|-------|-------|
| **Purpose** | Lấy thông báo của người dùng |
| **Service** | `notificationService.getNotificationsForUser(userId, role)` + `countUnread(userId, role)` |
| **Auth** | Own notifications only. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "notifications",
  "data": {
    "unreadCount": 3,
    "recent": [
      {
        "id": "notif_001",
        "title": "Lịch PT ngày mai",
        "content": "Bạn có buổi tập với HLV Nam vào 9:00 ngày mai.",
        "isRead": false,
        "createdAt": "2026-07-21"
      }
    ]
  },
  "empty": false,
  "deeplink": "/notifications"
}
```

**Example User Questions Matched:**
- "Có thông báo gì mới không?"
- "Thông báo của tôi?"
- "Bao nhiêu thông báo chưa đọc?"

---

#### DOMAIN: plans

| Field | Value |
|-------|-------|
| **Purpose** | Lấy danh sách gói tập đang hoạt động (không phải dữ liệu cá nhân) |
| **Service** | `planService.getActivePlans()` |
| **Auth** | Public (any authenticated user). |

**Success Response:**
```json
{
  "source": "database",
  "domain": "plans",
  "data": {
    "count": 3,
    "plans": [
      {
        "id": "plan_001",
        "nameVi": "Gold",
        "price": 1500000,
        "durationDays": 90,
        "descriptionVi": "Gói tập cao cấp...",
        "featuresVi": ["Phòng tập VIP", "HLV 1-1", "Miễn phí gửi xe"],
        "color": "#FFD700"
      }
    ]
  },
  "empty": false,
  "deeplink": "/membership/plans"
}
```

**Example User Questions Matched:**
- "Các gói tập hiện có?"
- "Gói Gold bao nhiêu tiền?"
- "So sánh gói Gold và Platinum?"
- "Gói nào rẻ nhất?"

---

#### DOMAIN: products

| Field | Value |
|-------|-------|
| **Purpose** | Lấy danh sách sản phẩm được đề xuất |
| **Service** | `productService.getRecommendedProducts({ goal })` |
| **Auth** | Public. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "products",
  "data": {
    "count": 8,
    "goal": "general",
    "products": [
      {
        "id": "prod_001",
        "name": "Whey Protein Isolate",
        "price": 890000,
        "category": "Thực phẩm bổ sung",
        "image": "https://...",
        "stock": 25,
        "rating": 4.8,
        "reviewCount": 120,
        "link": "/shop/product/prod_001"
      }
    ]
  },
  "empty": false,
  "deeplink": "/shop"
}
```

**Example User Questions Matched:**
- "Có whey protein không?"
- "Sản phẩm bán chạy?"
- "Shop có gì mới?"

---

#### DOMAIN: payments

| Field | Value |
|-------|-------|
| **Purpose** | Lấy lịch sử thanh toán của người dùng |
| **Service** | `paymentService.getByUserId(userId)` (via membershipService.listPayments or direct query) |
| **Auth** | Own payments only. Admin: all. |

**Success Response:**
```json
{
  "source": "database",
  "domain": "payments",
  "data": {
    "count": 5,
    "payments": [
      {
        "id": "pay_001",
        "amount": 1500000,
        "currency": "VND",
        "status": "completed",
        "paymentMethod": "wallet",
        "paidAt": "2026-07-15",
        "description": "Gia hạn gói Gold 3 tháng"
      }
    ]
  },
  "empty": false,
  "deeplink": "/wallet/transactions"
}
```

**Example User Questions Matched:**
- "Lịch sử thanh toán?"
- "Tôi đã trả bao nhiêu tiền tháng này?"
- "Thanh toán gần đây?"

---

#### DOMAIN: pt

| Field | Value |
|-------|-------|
| **Purpose** | Lấy danh sách PT (cho member) hoặc thông tin PT được gán (cho member) |
| **Service** | Member: `ptService.getAvailablePTs({})`. PT: own schedule via `ptAssignmentService`. Admin: all. |
| **Auth** | Member: public PT list. PT: own data. Admin: all. |

**Success Response (member viewing PT list):**
```json
{
  "source": "database",
  "domain": "pt",
  "data": {
    "count": 12,
    "pts": [
      {
        "id": "pt_001",
        "name": "Nguyễn Văn Nam",
        "fullName": "Nguyễn Văn Nam",
        "avatar": "https://...",
        "specialties": ["Bodybuilding", "Giảm cân"],
        "rating": 4.9,
        "experienceYears": 5,
        "bio": "5 năm kinh nghiệm..."
      }
    ]
  },
  "empty": false,
  "deeplink": "/pt-booking"
}
```

**Success Response (member with assigned PT):**
```json
{
  "source": "database",
  "domain": "pt",
  "data": {
    "assignedPT": {
      "id": "pt_001",
      "name": "Nguyễn Văn Nam",
      "specialties": ["Bodybuilding"],
      "rating": 4.9,
      "assignedDate": "2026-06-01"
    }
  },
  "empty": false,
  "deeplink": "/pt-booking"
}
```

**Example User Questions Matched:**
- "Có những PT nào?"
- "PT của tôi là ai?"
- "HLV nào giỏi nhất?"
- "PT nào chuyên về giảm cân?"

---

## 3. vectorQuery

### 3.1 Gemini Declaration

```json
{
  "name": "vectorQuery",
  "description": "Tìm kiếm kiến thức nội bộ GymPro: chính sách, FAQ, hướng dẫn tập luyện, quy định phòng gym. Dùng khi câu hỏi về 'chính sách', 'quy định', 'hướng dẫn', 'cách', 'làm sao để'.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Câu hỏi cần tìm kiếm trong cơ sở kiến thức GymPro (bằng tiếng Việt)"
      },
      "source": {
        "type": "string",
        "enum": ["faq", "policy", "guide", "exercise", "nutrition", "gym_rules", "business_rules"],
        "description": "Giới hạn nguồn kiến thức (tùy chọn, để lại trống nếu không chắc)"
      }
    },
    "required": ["query"]
  }
}
```

### 3.2 Server-Side Implementation

| Field | Value |
|-------|-------|
| **Embedding** | Gemini `text-embedding-004` → float[768] |
| **Storage** | MongoDB `VectorDocument` collection |
| **Search** | Cosine similarity (dot product of L2-normalized vectors) |
| **Top K** | 5 |
| **Threshold** | 0.75 (below = return empty, signal fallback) |
| **Source Filter** | Optional. If `source` is provided, only search chunks with matching `VectorDocument.source` |
| **Language Filter** | Auto-detected from user message. Filter `VectorDocument.language` |

**Success Response:**
```json
{
  "source": "vector",
  "results": [
    {
      "content": "Chính sách hoàn tiền: Bạn được hoàn tiền trong vòng 7 ngày kể từ ngày đăng ký, với điều kiện chưa sử dụng bất kỳ quyền lợi nào của gói (check-in, đặt lịch PT, tham gia lớp học, sử dụng tính năng yêu cầu quyền của gói)...",
      "sourceType": "policy",
      "title": "Chính sách hoàn tiền",
      "score": 0.94,
      "sourceId": "policy-refund-001"
    },
    {
      "content": "Đối với gói Gold, hoàn tiền chỉ áp dụng khi còn trong 7 ngày kể từ ngày đăng ký và chưa sử dụng quyền lợi nào của gói...",
      "sourceType": "business_rules",
      "title": "Quy tắc hoàn tiền",
      "score": 0.87,
      "sourceId": "business-refund-001"
    }
  ],
  "empty": false
}
```

**Empty Response (fallback to webQuery):**
```json
{
  "source": "vector",
  "results": [],
  "empty": true,
  "fallback": true
}
```

---

## 4. webQuery

### 4.1 Gemini Declaration

```json
{
  "name": "webQuery",
  "description": "Tìm kiếm kiến thức chung trên web về fitness, dinh dưỡng, sức khỏe, giấc ngủ, thực phẩm bổ sung. KHÔNG dùng cho dữ liệu cá nhân. KHÔNG dùng cho chính sách GymPro.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Câu hỏi viết bằng TIẾNG ANH để có kết quả tìm kiếm web tốt nhất. Loại bỏ thông tin cá nhân."
      }
    },
    "required": ["query"]
  }
}
```

### 4.2 Server-Side Implementation

| Field | Value |
|-------|-------|
| **API** | Tavily Search API (`https://api.tavily.com/search`) |
| **API Key** | `TAVILY_API_KEY` from environment |
| **Search Depth** | `"advanced"` |
| **Max Results** | 5 |
| **Timeout** | 10 seconds |
| **Domain Whitelist** | pubmed.ncbi.nlm.nih.gov, mayoclinic.org, nhs.uk, who.int, cdc.gov, healthline.com, examine.com, acefitness.org, nsca.com, strongerbyscience.com, sleepfoundation.org, nutrition.org |
| **Domain Blacklist** | reddit.com, quora.com, facebook.com, twitter.com, instagram.com, tiktok.com, youtube.com, amazon.com, shopee.vn, lazada.vn, *.blogspot.*, *.wordpress.*, *.medium.com |

**Success Response:**
```json
{
  "source": "web",
  "results": [
    {
      "title": "Protein Intake — How Much Protein Should You Eat Per Day?",
      "url": "https://www.healthline.com/nutrition/how-much-protein-per-day",
      "snippet": "The recommended dietary allowance for protein is 0.8g per kg of body weight...",
      "publishedDate": "2025"
    }
  ],
  "empty": false
}
```

**Empty Response:**
```json
{
  "source": "web",
  "results": [],
  "empty": true
}
```

**Error Response:**
```json
{
  "source": "web",
  "error": "WEB_SEARCH_FAILED",
  "message": "Không thể tìm kiếm web lúc này.",
  "results": []
}
```

---

## 5. visionQuery

### 5.1 Gemini Declaration

```json
{
  "name": "visionQuery",
  "description": "Phân tích ảnh người dùng tải lên: ảnh cơ thể, bữa ăn, tư thế tập, so sánh tiến bộ. CHỈ dùng khi người dùng gửi ảnh.",
  "parameters": {
    "type": "object",
    "properties": {
      "imageBase64": {
        "type": "string",
        "description": "Ảnh đã encode base64"
      },
      "type": {
        "type": "string",
        "enum": ["body", "meal", "posture", "progress"],
        "description": "Loại phân tích ảnh (tùy chọn). Để trống nếu không chắc chắn, AI Vision sẽ tự phân loại."
      }
    },
    "required": ["imageBase64"]
  }
}
```

### 5.2 Server-Side Implementation

| Field | Value |
|-------|-------|
| **API** | Gemini 2.5 Flash (multimodal) |
| **Input** | Base64 image + analysis type prompt |
| **Max Image Size** | 5 MB (validated before sending to Gemini) |
| **Formats** | jpg, png, webp |
| **Safety** | Gemini built-in safety filter + server-side NSFW check |

**Vision Prompts by Type:**

| Type | Gemini Prompt |
|------|--------------|
| `body` | "Analyze this physique photo. Describe body type, visible muscle development, symmetry, and estimated body fat percentage. Be objective. Add: 'Đây là ước tính AI, chỉ mang tính tham khảo. Không thay thế đánh giá chuyên môn (InBody, DEXA).' NEVER diagnose any medical condition. Answer in Vietnamese." |
| `meal` | "Analyze this meal photo. Identify food items, estimate portion sizes, estimated calories, estimated protein/carbs/fat. Be objective. Add: 'Đây là ước tính AI dựa trên hình ảnh. Calo thực tế có thể khác.' NEVER make health claims. Answer in Vietnamese." |
| `posture` | "Analyze this exercise form photo. Check joint alignment, spine position, range of motion. Identify potential form issues and suggest corrections. Add: 'Đây là đánh giá AI, chỉ mang tính tham khảo. Hãy tham khảo HLV để được hướng dẫn chính xác.' NEVER diagnose injury. Answer in Vietnamese." |
| `progress` | "Compare these two photos for visible physical changes. Note differences in muscle definition, body fat appearance, and overall physique. Add: 'Đây là so sánh trực quan. Không thay thế số đo cơ thể thực tế.' NEVER make medical claims. Answer in Vietnamese." |
| auto-detect | "Analyze this image. Determine if it's a body photo, meal photo, exercise form photo, or progress comparison. Then analyze accordingly using the appropriate analysis method. Add appropriate disclaimer. NEVER diagnose medical conditions. Answer in Vietnamese." |

**Success Response:**
```json
{
  "source": "vision",
  "type": "body",
  "analysis": "Dựa trên ảnh, tôi ước tính:\n- Dáng người: Mesomorph\n- Tỷ lệ mỡ cơ thể: Khoảng 15-18%\n- Vai cân đối, cơ lưng phát triển tốt\n- Cơ bụng bắt đầu lộ rõ\n\n⚠ Đây là ước tính AI, chỉ mang tính tham khảo. Không thay thế đánh giá chuyên môn (InBody, DEXA).",
  "disclaimer": "Đây là ước tính AI, chỉ mang tính tham khảo. Không thay thế đánh giá chuyên môn.",
  "empty": false
}
```

**Error Response:**
```json
{
  "source": "vision",
  "error": "VISION_FAILED",
  "message": "Không thể phân tích ảnh này. Vui lòng thử ảnh khác.",
  "empty": true
}
```

**Blocked Response (medical/safety):**
```json
{
  "source": "vision",
  "error": "BLOCKED",
  "message": "Tôi không thể phân tích ảnh này. Nếu bạn có vấn đề về sức khỏe, vui lòng gặp bác sĩ.",
  "empty": true
}
```

---

## 6. Error Handling (All Functions)

Every function must handle these error states:

| Error Type | Response Pattern | Gemini Sees |
|-----------|-----------------|-------------|
| Service throws | `{ error: "SERVICE_ERROR", message: "..." }` | LLM tells user: "Có lỗi khi truy xuất dữ liệu. Vui lòng thử lại." |
| Timeout (>10s) | `{ error: "TIMEOUT", message: "..." }` | LLM tells user: "Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại." |
| Empty result | `{ data: null/[], empty: true, deeplink: "..." }` | LLM tells user: "Tôi không tìm thấy thông tin này." + suggests page |
| Invalid domain | `{ error: "UNKNOWN_DOMAIN", availableDomains: [...] }` | LLM corrects and calls again with valid domain |
| Unauthorized | `{ error: "UNAUTHORIZED", message: "..." }` | LLM tells user: "Bạn không có quyền xem thông tin này." |

---

## 7. Function Execution Order

When Gemini calls multiple functions:

```
Gemini returns: [
  { name: "databaseQuery", args: { domain: "membership" } },
  { name: "vectorQuery", args: { query: "chính sách hoàn tiền", source: "policy" } }
]

Server executes IN PARALLEL (they are independent):
  Promise.all([
    databaseQuery({ domain: "membership" }, userId, role),
    vectorQuery({ query: "chính sách hoàn tiền", source: "policy" }, language)
  ])

Both results are sent back to Gemini in the same conversation turn.
Gemini merges into natural response.
```

---

## 8. Idempotency

All `databaseQuery` functions are read-only and naturally idempotent.

`visionQuery` and `vectorQuery` are also read-only and idempotent.

No idempotency key needed.

If in the future an action function is added (write operation), it MUST include idempotency key support.

---

## 9. Observability

Every function call logs:

```json
{
  "functionName": "databaseQuery",
  "domain": "wallet",
  "userId": "64a1b2...",
  "role": "member",
  "latencyMs": 45,
  "status": "success",
  "emptyResult": false,
  "errorType": null,
  "timestamp": "2026-07-22T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

Logs are written to stdout (structured JSON) and consumed by the existing logging pipeline. No new logging infrastructure needed.
