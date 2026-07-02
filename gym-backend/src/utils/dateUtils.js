/**
 * dateUtils.js - Tiện ích xử lý ngày giờ theo múi giờ Việt Nam (UTC+7)
 *
 * Nhờ có TZ=Asia/Ho_Chi_Minh trong .env, tất cả new Date() và setHours()
 * đều tự động dùng giờ Việt Nam. File này cung cấp các hàm helper rõ ràng.
 *
 * Lưu ý MongoDB Atlas:
 *   - MongoDB luôn lưu và hiển thị UTC (đây là chuẩn quốc tế).
 *   - Ví dụ: 00:00:00 VN = 17:00:00 ngày hôm trước theo UTC → đây là đúng.
 *   - Frontend dùng toLocaleDateString('vi-VN') sẽ hiển thị đúng giờ VN.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Trả về thời điểm 00:00:00.000 của ngày hôm nay theo giờ Việt Nam
 * VD: gọi lúc 15:30 ngày 2/7/2026 VN → trả về 2026-07-02T00:00:00 VN
 *     = 2026-07-01T17:00:00.000Z trong MongoDB Atlas
 */
export const startOfTodayVN = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // setHours dùng local time → VN time (nhờ TZ env)
  return now
}

/**
 * Trả về thời điểm 23:59:59.999 của một ngày cho trước (theo giờ VN)
 * VD: endOfDayVN(2/7/2026) → 2026-07-02T23:59:59.999 VN
 *     = 2026-07-02T16:59:59.999Z trong MongoDB Atlas
 * @param {Date|string} date
 */
export const endOfDayVN = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Tính số ngày còn lại của membership (làm tròn lên)
 * Trả về 0 nếu đã hết hạn
 * @param {Date|string} endDate
 */
export const calculateRemainingDays = (endDate) => {
  const end = endOfDayVN(endDate)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY))
}

/**
 * Tính endDate của membership mới dựa trên startDate + số ngày
 * Kết quả là 23:59:59.999 VN của ngày cuối cùng
 * VD: startDate=2/7, durationDays=31 → endDate=1/8 23:59:59 VN
 * @param {Object} params
 * @param {Date} params.baseDate - Ngày bắt đầu (hoặc ngày gia hạn)
 * @param {number} params.durationDays - Số ngày gói tập
 */
export const calcMembershipEndDate = ({ baseDate, durationDays }) => {
  const end = new Date(baseDate)
  end.setDate(end.getDate() + Number(durationDays))
  return endOfDayVN(end)
}
