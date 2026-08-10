import Booking from '../models/Booking.js'
import CheckIn from '../models/CheckIn.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
// Đóng booking sau khi buổi kết thúc 2 tiếng mà PT chưa ghi nhận kết quả
const GRACE_AFTER_END_MS = 2 * 60 * 60 * 1000

const getSessionEnd = (date, slot) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const end = String(slot || '').split('-')[1]?.trim()
  const [hour = 0, minute = 0] = end ? end.split(':').map(Number) : [23, 59]
  d.setHours(hour || 0, minute || 0, 0, 0)
  return d
}

export const runNoShowSweeperJob = async () => {
  const now = new Date()
  const cutoff = new Date(now.getTime() - GRACE_AFTER_END_MS)

  // Booking confirmed + đã qua giờ kết thúc buổi + quá thời gian grace
  const overdueBookings = await Booking.find({
    status: 'confirmed',
    paymentStatus: 'paid',
    date: { $lte: cutoff },
  })
    .select('_id memberId ptId date slot')
    .lean()

  let completed = 0
  let noShow = 0

  for (const booking of overdueBookings) {
    const sessionEnd = getSessionEnd(booking.date, booking.slot)
    if (sessionEnd > cutoff) continue

    // Member đã check-in buổi này → coi như hoàn thành
    const memberCheckedIn = await CheckIn.exists({
      memberId: booking.memberId,
      bookingId: booking._id,
      status: 'success',
    })

    if (memberCheckedIn) {
      const result = await Booking.updateOne(
        { _id: booking._id, status: 'confirmed' },
        { $set: { status: 'completed', completedAt: now } },
      )
      if (result.modifiedCount) {
        completed += 1
        createNotification({
          receiverId: booking.memberId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.PT_SESSION_COMPLETED,
          title: 'Buổi tập hoàn thành',
          content: `Buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} đã được chốt là hoàn thành (có check-in).`,
          relatedId: booking._id,
          relatedType: 'Booking',
          redirectUrl: '/my-bookings',
          createdBy: 'System',
        }).catch((err) => console.error('Notify auto-complete failed:', err.message))
      }
      continue
    }

    // Không có check-in và PT không ghi nhận → mặc định member no-show (giữ tiền, tiêu 1 buổi)
    const result = await Booking.updateOne(
      { _id: booking._id, status: 'confirmed' },
      { $set: { status: 'member_no_show', noShowMarkedAt: now, noShowMarkedBy: null, autoNoShow: true } },
    )
    if (result.modifiedCount) {
      noShow += 1
      createNotification({
        receiverId: booking.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
        title: 'Vắng buổi tập PT',
        content: `Buổi PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} không được chốt hoàn thành và không có check-in nên được tính là no-show.`,
        relatedId: booking._id,
        relatedType: 'Booking',
        redirectUrl: '/my-bookings',
        createdBy: 'System',
      }).catch((err) => console.error('Notify auto no-show failed:', err.message))
    }
  }

  return { completed, noShow }
}

export const startNoShowSweeperJob = () => {
  runNoShowSweeperJob().catch((error) => console.error('[noShowSweeper] Lỗi chạy job:', error.message))
  return setInterval(() => {
    runNoShowSweeperJob().catch((error) => console.error('[noShowSweeper] Lỗi chạy job:', error.message))
  }, CHECK_INTERVAL_MS)
}
