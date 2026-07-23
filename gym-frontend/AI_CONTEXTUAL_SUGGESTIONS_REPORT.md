# AI Contextual Suggestions Report

## Problem

Suggestions were static and generic — repeatedly showing "Ví của tôi còn bao nhiêu?" and "Gói tập còn hạn không?" even when that information was already on screen.

## Solution

Route-aware suggestion engine. Suggestions change based on the current page.

## Architecture

```
useLocation().pathname
    ↓
resolveSuggestions(pathname)
    ↓
  exact match? → ROUTE_SUGGESTIONS[p]
    ↓ no
  prefix match? (e.g. /store/xyz → /store)
    ↓ no
  DEFAULT_SUGGESTIONS
    ↓
rendered in empty state
```

## Route → Suggestions Map

### `/policies`
| Text | Label |
|------|-------|
| Chính sách hoàn tiền như thế nào? | Hoàn tiền |
| Điều khoản sử dụng phòng gym? | Điều khoản |
| Chính sách hội viên có những gì? | Hội viên |
| Chính sách thanh toán ra sao? | Thanh toán |
| Bảo mật thông tin cá nhân thế nào? | Bảo mật |

### `/help`
| Text | Label |
|------|-------|
| Tôi quên mật khẩu, phải làm sao? | Quên mật khẩu |
| Cách đặt lịch tập với PT? | Đặt lịch PT |
| Làm sao để check-in? | Check-in |
| Cách gia hạn gói tập? | Gia hạn gói |
| Làm sao liên hệ hỗ trợ? | Liên hệ |

### `/feedback` / `/my-feedback`
| Text | Label |
|------|-------|
| Tôi muốn gửi góp ý về phòng gym | Góp ý |
| Báo lỗi ứng dụng | Báo lỗi |
| Đề xuất tính năng mới | Đề xuất |
| Khiếu nại về dịch vụ | Khiếu nại |
| Xem phản hồi của tôi | Phản hồi |

### `/plans`
| Text | Label |
|------|-------|
| So sánh các gói tập | So sánh |
| Gói nào phù hợp với tôi? | Tư vấn |
| Có ưu đãi gì cho hội viên mới? | Ưu đãi |

### `/store`
| Text | Label |
|------|-------|
| Sản phẩm bán chạy nhất | Bán chạy |
| Có thực phẩm bổ sung nào tốt? | Dinh dưỡng |
| Chính sách đổi trả hàng | Đổi trả |

### `/orders`
| Text | Label |
|------|-------|
| Cách theo dõi đơn hàng? | Đơn hàng |
| Thời gian giao hàng bao lâu? | Giao hàng |
| Tôi muốn đổi trả sản phẩm | Đổi trả |

### `/checkin`
| Text | Label |
|------|-------|
| Cách quét mã QR check-in? | QR Check-in |
| Xem lịch sử check-in | Lịch sử |
| Check-in bị lỗi thì sao? | Lỗi |

### `/booking`
| Text | Label |
|------|-------|
| Làm sao chọn PT phù hợp? | Chọn PT |
| Hủy lịch tập thế nào? | Hủy lịch |
| Có thể đổi PT không? | Đổi PT |

### `/my-activity`
| Text | Label |
|------|-------|
| Phân tích kết quả tập luyện | Phân tích |
| Làm sao cải thiện hiệu suất? | Cải thiện |
| Theo dõi tiến độ tập luyện | Tiến độ |

### Default (all other pages)
| Text | Label |
|------|-------|
| Phân tích bữa ăn hôm nay | Bữa ăn |
| Các bài tập giảm mỡ bụng? | Bài tập |
| Lịch tập tuần này của tôi | Lịch tập |

## Files Modified

| File | Change |
|------|--------|
| `src/components/chat/AiChatWidget.tsx` | Replaced static `SUGGESTED_QUESTIONS` with `ROUTE_SUGGESTIONS` map + `resolveSuggestions()` + `DEFAULT_SUGGESTIONS`. Added `useLocation`. Computed `suggestions` via `useMemo`. |

## Key Design Decisions

- **No data-redundant suggestions**: Pages showing wallet/membership/booking data do not suggest those topics
- **Sub-route matching**: `/store/:storeId` matches `/store` suggestions via prefix match
- **Extensible**: add a route key + array to `ROUTE_SUGGESTIONS` to support new pages
