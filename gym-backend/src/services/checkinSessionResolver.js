import WorkoutSchedule from '../models/WorkoutSchedule.js'
import Booking from '../models/Booking.js'

// Business rule hiện tại của project (đã tồn tại trong daily QR flow):
// check-in hợp lệ trong khoảng [giờ bắt đầu - 30 phút, giờ kết thúc].
// KHÔNG tự ý thay đổi vì chưa có business rule mới nào được định nghĩa.
const EARLY_CHECKIN_MINUTES = 30

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

const parseHHMM = (t) => {
  const [h, m] = String(t || '').split(':').map(Number)
  if (!Number.isFinite(h)) return null
  return h * 60 + (m || 0)
}

// Rule ưu tiên khi có NHIỀU lịch hợp lệ tại cùng thời điểm (không chọn ngẫu nhiên):
//   1. Booking PT 1-1/nhóm đã confirmed + đã thanh toán
//   2. Buổi lớp nhóm (session có classCode)
//   3. Buổi giáo án cá nhân
// Tie-break: buổi bắt đầu sớm hơn → ổn định theo _id.
const TIER_BOOKING = 1
const TIER_CLASS = 2
const TIER_PLAN = 3

/**
 * Backend là nơi quyết định cuối cùng: check-in là SCHEDULED nếu tìm thấy
 * lịch hợp lệ tại thời điểm check-in, ngược lại là FREE_TRAINING.
 * Client chỉ có thể "gợi ý" (scheduleId/sessionIndex/bookingId) — backend validate lại.
 *
 * @returns {null | {
 *   sessionType: 'SCHEDULED',
 *   scheduleId, sessionIndex, sessionDate, sessionTitle, sessionTime,
 *   classCode, bookingId, ptId,
 * }}
 */
export const resolveCheckinSession = async ({
  memberId,
  now = new Date(),
  clientScheduleId,
  clientSessionIndex,
  clientBookingId,
}) => {
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const candidates = []

  const isInWindow = (timeStr, endTimeStr) => {
    const start = parseHHMM(timeStr)
    const end = parseHHMM(endTimeStr)
    if (start === null || end === null) return false
    return nowMinutes >= start - EARLY_CHECKIN_MINUTES && nowMinutes <= end
  }

  const pushScheduleSession = ({ schedule, sessionIndex, session }) => {
    if (!session?.date || !session.time || !session.endTime) return
    if (startOfDay(new Date(session.date)).getTime() !== todayStart.getTime()) return
    if (session.status !== 'pending') return
    if (!isInWindow(session.time, session.endTime)) return
    candidates.push({
      tier: session.classCode ? TIER_CLASS : TIER_PLAN,
      startMinutes: parseHHMM(session.time),
      scheduleId: schedule._id,
      sessionIndex,
      session,
      ptId: schedule.assignedBy || null,
    })
  }

  // a) Client gợi ý một buổi cụ thể → validate lại (không tin client)
  if (clientScheduleId) {
    const schedule = await WorkoutSchedule.findOne({
      _id: clientScheduleId,
      memberId,
      status: 'active',
    }).lean()
    if (schedule?.sessions?.[clientSessionIndex]) {
      pushScheduleSession({ schedule, sessionIndex: clientSessionIndex, session: schedule.sessions[clientSessionIndex] })
    }
  }

  // b) Tự tìm toàn bộ lịch hợp lệ của member tại thời điểm check-in
  const schedules = await WorkoutSchedule.find({ memberId, status: 'active' }).lean()
  for (const schedule of schedules) {
    for (let i = 0; i < (schedule.sessions || []).length; i++) {
      pushScheduleSession({ schedule, sessionIndex: i, session: schedule.sessions[i] })
    }
  }

  // c) Client gợi ý booking → validate lại
  if (clientBookingId) {
    const booking = await Booking.findOne({
      _id: clientBookingId,
      memberId,
      status: 'confirmed',
      paymentStatus: 'paid',
    }).lean()
    if (booking) {
      const [startT, endT] = String(booking.slot || '').split('-')
      if (startT && endT && isInWindow(startT, endT) &&
          startOfDay(new Date(booking.date)).getTime() === todayStart.getTime()) {
        candidates.push({ tier: TIER_BOOKING, startMinutes: parseHHMM(startT), booking })
      }
    }
  }

  // d) Tự tìm booking PT (1-1/nhóm) đã thanh toán tại thời điểm check-in
  const bookings = await Booking.find({
    memberId,
    date: { $gte: todayStart, $lte: todayEnd },
    status: 'confirmed',
    paymentStatus: 'paid',
  }).lean()
  for (const booking of bookings) {
    const [startT, endT] = String(booking.slot || '').split('-')
    if (!startT || !endT || !isInWindow(startT, endT)) continue
    candidates.push({ tier: TIER_BOOKING, startMinutes: parseHHMM(startT), booking })
  }

  if (candidates.length === 0) return null

  // Rule ưu tiên + tie-break ổn định → luôn chọn đúng 1 lịch (không random, không tạo nhiều bản ghi)
  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes
    const idA = a.booking?._id?.toString() || a.scheduleId?.toString() || ''
    const idB = b.booking?._id?.toString() || b.scheduleId?.toString() || ''
    return idA.localeCompare(idB)
  })

  const top = candidates[0]
  if (top.booking) {
    const [startT, endT] = String(top.booking.slot || '').split('-')
    return {
      sessionType: 'SCHEDULED',
      bookingId: top.booking._id,
      ptId: top.booking.ptId,
      scheduleId: null,
      sessionIndex: null,
      sessionDate: top.booking.date,
      sessionTitle: top.booking.trainingType === 'group' ? 'Buổi tập nhóm (PT)' : 'Buổi PT 1-1',
      sessionTime: startT && endT ? `${startT}-${endT}` : top.booking.slot,
      classCode: null,
    }
  }

  const s = top.session
  return {
    sessionType: 'SCHEDULED',
    bookingId: null,
    ptId: top.ptId,
    scheduleId: top.scheduleId,
    sessionIndex: top.sessionIndex,
    sessionDate: s.date,
    sessionTitle: s.title || null,
    sessionTime: s.time && s.endTime ? `${s.time}-${s.endTime}` : null,
    classCode: s.classCode || null,
  }
}
