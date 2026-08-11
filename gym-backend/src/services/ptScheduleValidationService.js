import TrainerSchedule from '../models/TrainerSchedule.js'
import User from '../models/User.js'
import Booking from '../models/Booking.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingClass from '../models/TrainingClass.js'
import ScheduleReplacement from '../models/ScheduleReplacement.js'

export const SHIFT_RANGES = {
  morning: { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '22:00' },
}

export const SHIFT_LABELS = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
}

export const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

export const toMinutes = (time) => {
  if (!time) return 0
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + (m || 0)
}

export const timesOverlap = (start1, end1, start2, end2) =>
  toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1)

/**
 * Chuẩn hóa slot đặt lịch về khung [start, end) (phút).
 * Hỗ trợ cả dạng "HH:mm" (1 điểm thời gian) và "HH:mm-HH:mm" (dải giờ).
 */
export const normalizeSlot = (slot) => {
  const value = String(slot || '').trim()
  const rangeMatch = value.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
  if (rangeMatch) {
    return { start: toMinutes(rangeMatch[1]), end: toMinutes(rangeMatch[2]) || toMinutes(rangeMatch[1]) + 60, raw: value }
  }
  return { start: toMinutes(value), end: toMinutes(value) + 60, raw: value }
}

/**
 * Lấy các khung giờ làm việc (window) của PT trong 1 ngày cụ thể
 * dựa trên TrainerSchedule (lịch làm việc cố định theo tuần).
 * Trả về [{ shift, start, end }] với giờ dạng "HH:mm".
 */
export const getWorkingWindows = async ({ trainerId, date, session }) => {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return []
  const dayOfWeek = d.getDay()

  const filter = { trainerId, dayOfWeek, status: 'active' }
  const schedules = session
    ? await TrainerSchedule.find(filter).session(session).lean()
    : await TrainerSchedule.find(filter).lean()

  return schedules.map((s) => {
    const range = SHIFT_RANGES[s.shift] || {}
    return {
      shift: s.shift,
      start: s.startTime || range.start,
      end: s.endTime || range.end,
    }
  })
}

/**
 * Kiểm tra tính hợp lệ khi phân công PT cho 1 buổi tập (date + slot).
 * Thứ tự kiểm tra theo quy tắc nghiệp vụ:
 *  1. PT có làm việc vào ngày đó không.
 *  2. Ca làm việc có phù hợp với khung giờ yêu cầu không.
 *  3. PT có đang nghỉ phép/không sẵn sàng không.
 *  4. PT có đang cover (thay ca) lớp khác trong khung giờ đó không.
 *  5. PT có trùng giờ với lớp PT nhóm đang dạy không.
 * Trả về { ok: true } hoặc { ok: false, message }.
 */
export const validatePTAssignment = async ({ trainerId, date, slot, session }) => {
  const windows = await getWorkingWindows({ trainerId, date, session })
  const dayLabel = DAY_LABELS[new Date(date).getDay()] || 'ngày này'
  const slotRange = normalizeSlot(slot)

  if (windows.length === 0) {
    return { ok: false, message: `PT không làm việc vào ${dayLabel} này. Vui lòng chọn ngày hoặc PT khác.` }
  }

  const fitted = windows.find((w) => slotRange.start >= toMinutes(w.start) && slotRange.end <= toMinutes(w.end))
  if (!fitted) {
    const windowText = windows.map((w) => `${SHIFT_LABELS[w.shift] || w.shift} (${w.start} - ${w.end})`).join(', ')
    return {
      ok: false,
      message: `Khung giờ "${slotRange.raw}" nằm ngoài ca làm việc của PT (${windowText}). Vui lòng chọn khung giờ khác.`,
    }
  }

  const user = await User.findOne({ _id: trainerId, role: 'pt' }).select('availabilityStatus isActive status isLocked').lean()
  if (user && String(user.availabilityStatus || '').trim() !== 'ACTIVE') {
    const statusText = user.availabilityStatus === 'ON_LEAVE' ? 'đang nghỉ phép'
      : user.availabilityStatus === 'SICK' ? 'đang ốm'
        : user.availabilityStatus === 'SUSPENDED' ? 'đang bị tạm ngừng'
          : 'không sẵn sàng làm việc'
    return { ok: false, message: `PT đang ${statusText} trong thời gian này. Vui lòng chọn PT khác.` }
  }
  if (user && (user.isLocked || user.status === 'locked' || user.isActive === false)) {
    return { ok: false, message: 'PT đang bị khóa tài khoản, không thể phân công.' }
  }

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const covers = await ScheduleReplacement.find({
    replacementTrainerId: trainerId,
    date: { $gte: dayStart, $lt: dayEnd },
    status: 'approved',
  })
    .populate('classId', 'name startTime endTime')
    .lean()

  for (const cov of covers) {
    const covCls = cov.classId && typeof cov.classId === 'object' ? cov.classId : null
    if (!covCls) continue
    const covStart = toMinutes(cov.startTime) || toMinutes(covCls.startTime)
    const covEnd = toMinutes(cov.endTime) || toMinutes(covCls.endTime) || covStart + 60
    if (timesOverlap(slotRange.start, slotRange.end, covStart, covEnd)) {
      return {
        ok: false,
        message: `PT đang phụ trách thay ca lớp "${covCls.name || ''}" trong khung giờ này. Vui lòng chọn khung giờ khác.`,
      }
    }
  }

  const classes = await TrainingClass.find({
    ptId: trainerId,
    status: { $nin: ['closed', 'inactive'] },
    daysOfWeek: { $ne: [] },
  })
    .select('name daysOfWeek startTime endTime status')
    .lean()

  for (const cls of classes) {
    if (!cls.startTime || !cls.endTime) continue
    if (!(cls.daysOfWeek || []).includes(new Date(date).getDay())) continue
    const clsStart = toMinutes(cls.startTime)
    const clsEnd = toMinutes(cls.endTime) || clsStart + 60
    if (timesOverlap(slotRange.start, slotRange.end, clsStart, clsEnd)) {
      return {
        ok: false,
        message: `PT đang dạy lớp tập nhóm "${cls.name || ''}" (${cls.startTime} - ${cls.endTime}) trùng khung giờ. Vui lòng chọn khung giờ khác.`,
      }
    }
  }

  return { ok: true }
}

/**
 * Sinh danh sách khung giờ trống (10 phút/cái) cho member chọn.
 * Chỉ hiển thị giờ nằm trong lịch làm việc của PT, loại trừ:
 *  - slot đã được đặt (Booking active)
 *  - thời gian PT đang cover lớp khác (ScheduleReplacement approved)
 *  - thời gian PT dạy lớp nhóm (TrainingClass.ptId)
 */
export const getAvailabilitySlots = async ({ trainerId, date, session }) => {
  const windows = await getWorkingWindows({ trainerId, date, session })
  const availability = {}
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dayEnd = new Date(d.getTime() + 24 * 60 * 60 * 1000)

  // PT nghỉ phép/ốm/bị khóa → không có ca trống nào
  const user = await User.findOne({ _id: trainerId, role: 'pt' }).select('availabilityStatus isActive status isLocked').lean()
  if (user && (String(user.availabilityStatus || '').trim() !== 'ACTIVE' || user.isLocked || user.status === 'locked' || user.isActive === false)) {
    return { availability, windows: [], schedules: [] }
  }

  const busySlots = new Set()

  const bookings = await Booking.find({ ptId: trainerId, date: d, status: { $in: ['pending', 'awaiting_payment', 'confirmed'] } })
  for (const b of bookings) {
    const range = normalizeSlot(b.slot)
    for (let m = range.start; m < range.end; m += 10) {
      busySlots.add(m)
    }
  }

  const covers = await ScheduleReplacement.find({
    replacementTrainerId: trainerId,
    date: { $gte: d, $lt: dayEnd },
    status: 'approved',
  }).lean()
  const coverRanges = covers.map((cov) => ({
    start: toMinutes(cov.startTime),
    end: toMinutes(cov.endTime) || toMinutes(cov.startTime) + 60,
  }))

  const classes = await TrainingClass.find({
    ptId: trainerId,
    status: { $nin: ['closed', 'inactive'] },
    daysOfWeek: { $ne: [] },
  })
    .select('name daysOfWeek startTime endTime status')
    .lean()
  const classRanges = classes
    .filter((c) => c.startTime && c.endTime && (c.daysOfWeek || []).includes(d.getDay()))
    .map((c) => ({
      start: toMinutes(c.startTime),
      end: toMinutes(c.endTime) || toMinutes(c.startTime) + 60,
    }))

  for (const w of windows) {
    const start = toMinutes(w.start)
    const end = toMinutes(w.end)
    for (let m = start; m < end; m += 10) {
      const slotMinutes = m
      const conflict = busySlots.has(slotMinutes)
        || coverRanges.some((r) => slotMinutes >= r.start && slotMinutes < r.end)
        || classRanges.some((r) => slotMinutes >= r.start && slotMinutes < r.end)
      const hh = String(Math.floor(slotMinutes / 60)).padStart(2, '0')
      const mm = String(slotMinutes % 60).padStart(2, '0')
      availability[`${hh}:${mm}`] = !conflict
    }
  }

  return {
    availability,
    windows: windows.map((w) => ({ shift: w.shift, start: w.start, end: w.end })),
    schedules: windows.map((w) => w.shift),
  }
}

/**
 * Kiểm tra trùng khung giờ của PT với member KHÁC (cả Booking lẫn WorkoutSchedule).
 * Dùng chung cho: tạo lịch tập (PT tự gán), đổi lịch (member), để không tạo
 * tình trạng 1 PT có 2 buổi 1-1 cùng thời điểm.
 * Returns: [{ source: 'booking'|'schedule', memberName, memberId, date, slot, className }]
 */
export const findPTMemberConflicts = async ({ ptId, date, slot, excludeScheduleId, excludeMemberId, excludeBookingId, session }) => {
  const conflicts = []
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const slotRange = normalizeSlot(slot)

  const bookingFilter = {
    ptId,
    date: { $gte: dayStart, $lt: dayEnd },
    status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
  }
  if (excludeBookingId) bookingFilter._id = { $ne: excludeBookingId }

  const bookings = session
    ? await Booking.find(bookingFilter).session(session).populate('memberId', 'name fullName').lean()
    : await Booking.find(bookingFilter).populate('memberId', 'name fullName').lean()

  for (const b of bookings) {
    if (excludeMemberId && String(b.memberId?._id || b.memberId) === String(excludeMemberId)) continue
    const bRange = normalizeSlot(b.slot)
    if (timesOverlap(slotRange.start, slotRange.end, bRange.start, bRange.end)) {
      const m = b.memberId && typeof b.memberId === 'object' ? b.memberId : null
      conflicts.push({
        source: 'booking',
        memberId: String(b.memberId?._id || b.memberId),
        memberName: m?.fullName || m?.name || 'hội viên khác',
        date: b.date,
        slot: b.slot,
      })
    }
  }

  const scheduleFilter = {
    assignedBy: ptId,
    status: 'active',
    deletedAt: null,
    ...(excludeScheduleId ? { _id: { $ne: excludeScheduleId } } : {}),
  }

  const schedules = session
    ? await WorkoutSchedule.find(scheduleFilter).session(session).populate('memberId', 'name fullName').lean()
    : await WorkoutSchedule.find(scheduleFilter).populate('memberId', 'name fullName').lean()

  for (const s of schedules) {
    if (excludeMemberId && String(s.memberId?._id || s.memberId) === String(excludeMemberId)) continue
    for (const sess of s.sessions || []) {
      if (sess.status !== 'pending') continue
      if (!sess.date || !sess.time) continue
      const sDate = new Date(sess.date)
      sDate.setHours(0, 0, 0, 0)
      if (sDate.getTime() !== dayStart.getTime()) continue
      const sRange = normalizeSlot(sess.time.split('-')[0].trim())
      if (timesOverlap(slotRange.start, slotRange.end, sRange.start, sRange.end)) {
        const m = s.memberId && typeof s.memberId === 'object' ? s.memberId : null
        conflicts.push({
          source: 'schedule',
          memberId: String(s.memberId?._id || s.memberId),
          memberName: m?.fullName || m?.name || 'hội viên khác',
          date: sess.date,
          slot: sess.time,
        })
      }
    }
  }

  return conflicts
}

/**
 * Kiểm tra lịch làm việc của PT có bao phủ thời gian của lớp nhóm hay không
 * (dùng khi tạo/cập nhật lớp tập gắn PT).
 */
export const validateClassPTWorkingSchedule = async ({ trainerId, daysOfWeek = [], startTime, endTime }) => {
  if (!trainerId || !daysOfWeek || daysOfWeek.length === 0 || !startTime || !endTime) return

  const schedules = await TrainerSchedule.find({ trainerId, status: 'active', dayOfWeek: { $in: daysOfWeek } }).lean()
  if (schedules.length === 0) {
    const dayLabel = DAY_LABELS[daysOfWeek[0]] || `thứ ${daysOfWeek[0] + 1}`
    throw new Error(`PT không làm việc vào ${dayLabel}. Vui lòng cập nhật lịch làm việc của PT trước.`)
  }

  const classStart = toMinutes(startTime)
  const classEnd = toMinutes(endTime) || classStart + 60

  for (const day of daysOfWeek) {
    const daySchedules = schedules.filter((s) => s.dayOfWeek === day)
    const windows = daySchedules.map((s) => {
      const range = SHIFT_RANGES[s.shift] || {}
      return { start: toMinutes(s.startTime || range.start), end: toMinutes(s.endTime || range.end) }
    })
    const fitted = windows.some((w) => classStart >= w.start && classEnd <= w.end)
    if (!fitted) {
      const dayLabel = DAY_LABELS[day] || `thứ ${day + 1}`
      const windowText = windows.map((w) => `${String(Math.floor(w.start / 60)).padStart(2, '0')}:${String(w.start % 60).padStart(2, '0')} - ${String(Math.floor(w.end / 60)).padStart(2, '0')}:${String(w.end % 60).padStart(2, '0')}`).join(', ')
      throw new Error(`PT không có ca làm việc phù hợp cho ${dayLabel} trong khung giờ ${startTime} - ${endTime}. Ca làm việc hiện tại: ${windowText || 'không có'}.`)
    }
  }
}
