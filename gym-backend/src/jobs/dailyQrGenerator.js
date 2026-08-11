import crypto from 'crypto'
import DailyQRCode from '../models/DailyQRCode.js'

const CHECK_INTERVAL_MS = 60 * 1000

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Tự động tạo mã QR hằng ngày khi server chuyển sang ngày mới (00:00).
 * Lặp 60s/lần chỉ để check "đã có QR active cho hôm nay chưa" — nếu chưa thì tạo,
 * nên dù server chạy lại giữa đêm hay khởi động lần đầu lúc nào cũng đảm bảo có QR.
 * Admin/staff không cần bấm tạo nữa (vẫn có thể bấm "Tạo lại" để đổi mã giữa ngày).
 */
export const runDailyQrGeneratorJob = async () => {
  const now = new Date()
  const today = startOfDay(now)
  const eod = endOfDay(today)

  const existing = await DailyQRCode.findOne({
    date: { $gte: today, $lte: eod },
    isActive: true,
  }).lean()

  if (existing) return { created: false, reason: 'already_active' }

  // Vô hiệu mọi QR cũ còn sót active (các ngày trước, phòng hờ khi server tắt giữa kỳ)
  await DailyQRCode.updateMany(
    { isActive: true },
    { $set: { isActive: false } },
  )

  const qrCode = await DailyQRCode.create({
    token: crypto.randomUUID(),
    date: today,
    createdBy: null, // hệ thống tự tạo
    isActive: true,
    expiresAt: eod,
  })

  console.log(`[dailyQrGenerator] Tự động tạo QR cho ${today.toLocaleDateString('vi-VN')}: ${qrCode.token}`)
  return { created: true, qrCode }
}

export const startDailyQrGeneratorJob = () => {
  runDailyQrGeneratorJob().catch((error) => console.error('[dailyQrGenerator] Lỗi tạo QR:', error.message))
  return setInterval(() => {
    runDailyQrGeneratorJob().catch((error) => console.error('[dailyQrGenerator] Lỗi tạo QR:', error.message))
  }, CHECK_INTERVAL_MS)
}
