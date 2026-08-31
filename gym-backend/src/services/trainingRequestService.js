import mongoose from 'mongoose'
import TrainingRequest, { ACTIVE_TRAINING_REQUEST_STATUSES } from '../models/TrainingRequest.js'
import TrainerSchedule from '../models/TrainerSchedule.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import PTAssignment from '../models/PTAssignment.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Plan from '../models/Plan.js'
import Booking from '../models/Booking.js'
import PT from '../models/PT.js'
import { ensureEnrollment as ensureClassEnrollment } from './classEnrollmentService.js'
import { notifyPtMemberChanged } from './notificationService.js'
import { applyWalletTransaction } from './walletService.js'
import { calculateRemainingDays } from '../utils/dateUtils.js'
import { checkMemberFeature } from '../utils/featureCheck.js'
import { getActivePeriodEndDate } from '../utils/membershipDays.js'

const ALLOWED_SPECIALIZATIONS = new Set([
  'GYM',
  'CARDIO',
  'STRENGTH TRAINING',
  'YOGA',
  'BOXING',
  'CROSSFIT',
  'PILATES',
  'ZUMBA',
])

function normalizeSpecialization(value) {
  const specialization = String(value || 'GYM').trim().toUpperCase()
  if (!ALLOWED_SPECIALIZATIONS.has(specialization)) {
    const err = new Error('Chuyen mon khong hop le')
    err.statusCode = 400
    throw err
  }
  return specialization
}

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// Định dạng tên ngày: day 0 = "Chủ nhật" (không thêm "Thứ"), còn lại "Thứ 2".."Thứ 7"
const formatDayName = (day) => (Number(day) === 0 ? 'Chủ nhật' : `Thứ ${Number(day) + 1}`)

const SHIFT_FALLBACK = {
  morning: ['06:00', '12:00'],
  afternoon: ['12:00', '18:00'],
  evening: ['18:00', '22:00'],
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'awaiting_payment', 'confirmed']

const ALLOWED_TIME_SLOTS = new Set([
  '06:00-08:00',
  '08:00-10:00',
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00',
  '20:00-22:00',
])

// Chuẩn hóa dữ liệu ngày -> khung giờ của PT 1-1 thành [{ day, slot }], mỗi ngày 1 khung giờ.
// Vẫn hỗ trợ dữ liệu cũ (daysOfWeek + 1 timeSlot áp dụng cho mọi ngày).
const normalizeDaySlots = (data) => {
  let raw = Array.isArray(data.daySlots) && data.daySlots.length
    ? data.daySlots
    : null

  if (!raw && Array.isArray(data.daysOfWeek) && data.daysOfWeek.length) {
    const slots = Array.isArray(data.timeSlots) ? data.timeSlots.filter(Boolean) : []
    if (slots.length === 1) {
      raw = data.daysOfWeek.map((day) => ({ day: Number(day), slot: slots[0] }))
    }
  }
  if (!raw) return []

  const seen = new Set()
  const result = []
  for (const item of raw) {
    const day = Number(item?.day)
    const slot = String(item?.slot || '').trim()
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      const err = new Error('Ngày tập không hợp lệ')
      err.statusCode = 400
      throw err
    }
    if (!ALLOWED_TIME_SLOTS.has(slot)) {
      const err = new Error(`Khung giờ "${slot}" không hợp lệ`)
      err.statusCode = 400
      throw err
    }
    if (seen.has(day)) {
      const err = new Error(`Ngày ${DAY_NAMES[day]} chỉ được chọn 1 khung giờ`)
      err.statusCode = 400
      throw err
    }
    seen.add(day)
    result.push({ day, slot })
  }
  return result.sort((a, b) => a.day - b.day)
}

// Lấy cặp ngày->giờ hiệu lực của 1 request (hỗ trợ dữ liệu cũ lưu daysOfWeek/timeSlots)
const requestDaySlots = (request) => {
  const daySlots = Array.isArray(request.daySlots) && request.daySlots.length
    ? request.daySlots
    : null
  if (daySlots) return daySlots
  const days = Array.isArray(request.daysOfWeek) ? request.daysOfWeek : []
  const slots = Array.isArray(request.timeSlots) ? request.timeSlots.filter(Boolean) : []
  if (!days.length) return []
  // Legacy: 1 slot áp dụng cho mọi ngày
  if (slots.length === 1) return days.map((day) => ({ day: Number(day), slot: slots[0] }))
  return []
}

function toMinutes(t) {
  if (!t) return 0
  const [h, m] = String(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function slotsOverlap(a, b) {
  const parse = (s) => {
    const [start, end] = String(s || '').split('-')
    return [toMinutes(start), toMinutes(end)]
  }
  const [as, ae] = parse(a)
  const [bs, be] = parse(b)
  if (!ae || !be) return true
  return as < be && bs < ae
}

function normalizeDayMs(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function nextDateForDay(dayOfWeek, weekOffset = 0) {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const currentDay = today.getDay()
  let diff = Number(dayOfWeek) - currentDay
  if (diff < 0) diff += 7
  const target = new Date(today)
  target.setDate(today.getDate() + diff + weekOffset * 7)
  return target
}

// Chặn 2 hội viên đặt cùng 1 PT trùng ngày + trùng khung giờ (kiểm tra cả booking đang hoạt động
// lẫn request đang xử lý của member khác). Kiểm tra theo từng cặp (day, slot) của yêu cầu,
// so sánh overlap theo thời gian thực. Trả về danh sách xung đột hoặc null.
const findCrossMemberConflict = async ({ trainerId, daySlots, weeks = 1, excludeMemberId, excludeRequestId }) => {
  const weekCount = Math.min(Math.max(Number(weeks) || 1, 1), 12)
  const pairs = (Array.isArray(daySlots) ? daySlots : []).filter((p) => p && p.day !== undefined && p.slot)
  if (!pairs.length) return null

  const from = normalizeDayMs(new Date())
  const to = from + (weekCount * 7 + 7) * 24 * 60 * 60 * 1000

  // 1) Trùng với booking đang hoạt động của PT (do hội viên khác đặt)
  const bookings = await Booking.find({
    ptId: trainerId,
    date: { $gte: new Date(from), $lt: new Date(to) },
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .select('date slot memberId')
    .lean()

  const conflicts = new Map() // `${day}|${slot}` -> { day, slot }

  const addConflict = (day, slot) => {
    const key = `${Number(day)}|${slot}`
    if (!conflicts.has(key)) conflicts.set(key, { day: Number(day), slot })
  }

  for (const pair of pairs) {
    for (const b of bookings) {
      if (excludeMemberId && String(b.memberId) === String(excludeMemberId)) continue
      if (b.date.getDay() !== pair.day) continue
      const weekDiff = Math.round((normalizeDayMs(b.date) - from) / (7 * 24 * 60 * 60 * 1000))
      if (weekDiff < 0 || weekDiff >= weekCount) continue
      if (slotsOverlap(pair.slot, b.slot)) addConflict(pair.day, pair.slot)
    }
  }

  // 2) Trùng với lịch của chính member này (bất kỳ PT nào)
  const memberBookings = await Booking.find({
    memberId: excludeMemberId,
    date: { $gte: new Date(from), $lt: new Date(to) },
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .select('date slot')
    .lean()

  for (const pair of pairs) {
    for (const b of memberBookings) {
      if (b.date.getDay() !== pair.day) continue
      const weekDiff = Math.round((normalizeDayMs(b.date) - from) / (7 * 24 * 60 * 60 * 1000))
      if (weekDiff < 0 || weekDiff >= weekCount) continue
      if (slotsOverlap(pair.slot, b.slot)) addConflict(pair.day, pair.slot)
    }
  }

  // 3) Trùng với request PT 1-1 đang xử lý của member khác cùng chọn PT này
  const requests = await TrainingRequest.find({
    _id: { $ne: excludeRequestId },
    type: 'pt1on1',
    status: { $in: ACTIVE_TRAINING_REQUEST_STATUSES },
    memberId: { $ne: excludeMemberId },
    $or: [
      { preferredTrainerId: trainerId },
      { assignedTrainerId: trainerId },
    ],
  })
    .select('daysOfWeek timeSlots daySlots')
    .lean()

  for (const r of requests) {
    const rPairs = requestDaySlots(r)
    if (rPairs.length) {
      for (const rp of rPairs) {
        for (const pair of pairs) {
          if (rp.day === pair.day && slotsOverlap(pair.slot, rp.slot)) addConflict(pair.day, pair.slot)
        }
      }
      continue
    }
    // Legacy không xác định được cặp → so ngày chung với mọi khung giờ của request kia
    const rDays = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : []
    const rSlots = Array.isArray(r.timeSlots) ? r.timeSlots.filter(Boolean) : []
    for (const pair of pairs) {
      const sameDay = rDays.find((d) => d === pair.day)
      if (sameDay === undefined) continue
      if (rSlots.some((rs) => slotsOverlap(pair.slot, rs))) addConflict(pair.day, pair.slot)
    }
  }

  return conflicts.size ? [...conflicts.values()] : null
}

// Kiểm tra ngày/giờ member chọn có nằm trong lịch làm việc (TrainerSchedule) của PT mong muốn.
// Trả về danh sách lỗi theo từng cặp (day, slot) hoặc null. PT chưa có lịch → không validate.
const findScheduleConflict = async ({ trainerId, daySlots, ptLabel = 'PT mong muốn' }) => {
  const schedules = await TrainerSchedule.find({ trainerId, status: 'active' }).lean()
  if (!schedules.length) return null

  const windowsByDay = new Map()
  for (const s of schedules) {
    const [fallbackStart, fallbackEnd] = SHIFT_FALLBACK[s.shift] || ['', '']
    if (!windowsByDay.has(s.dayOfWeek)) windowsByDay.set(s.dayOfWeek, [])
    windowsByDay.get(s.dayOfWeek).push({
      start: s.startTime || fallbackStart,
      end: s.endTime || fallbackEnd,
    })
  }

  const errors = []
  for (const pair of (daySlots || [])) {
    const windows = windowsByDay.get(pair.day)
    const [start, end] = String(pair.slot).split('-').map((x) => x.trim())
    const fits = windows && windows.some(
      (w) => toMinutes(start) >= toMinutes(w.start) && toMinutes(end) <= toMinutes(w.end),
    )
    if (!fits) {
      errors.push(`${formatDayName(pair.day)} lúc ${pair.slot} không nằm trong lịch làm việc của ${ptLabel}`)
    }
  }
  return errors.length ? errors : null
}

// Trùng với lớp nhóm đang hoạt động do PT phụ trách (cùng ngày, khung giờ overlap).
// Trả về danh sách lỗi theo từng cặp (day, slot) hoặc null.
const findClassConflict = async ({ trainerId, daySlots }) => {
  const pairs = (Array.isArray(daySlots) ? daySlots : []).filter((p) => p && p.day !== undefined && p.slot)
  if (!pairs.length) return null
  const days = [...new Set(pairs.map((p) => p.day))]

  const classes = await TrainingClass.find({
    ptId: trainerId,
    status: { $nin: ['closed', 'inactive'] },
    daysOfWeek: { $elemMatch: { $in: days } },
  })
    .select('name daysOfWeek startTime endTime')
    .lean()

  if (!classes.length) return null

  const errors = []
  for (const pair of pairs) {
    for (const c of classes) {
      if (!(c.daysOfWeek || []).includes(pair.day)) continue
      if (!c.startTime || !c.endTime) continue
      if (slotsOverlap(pair.slot, `${c.startTime}-${c.endTime}`)) {
        errors.push(`${formatDayName(pair.day)} lúc ${pair.slot} trùng với lớp nhóm "${c.name}" của PT này`)
      }
    }
  }
  return errors.length ? errors : null
}

export const reconcileStaleRequests = async ({ memberId } = {}) => {
  // `assigned` is the single state waiting for PT confirmation. It must not
  // be treated as stale merely because PTAssignment is not active yet.
  const staleAssignmentStatuses = ['class_assigned', 'active']
  const reconcileStatuses = [...ACTIVE_TRAINING_REQUEST_STATUSES, 'assigned', ...staleAssignmentStatuses]
  const filter = { status: { $in: reconcileStatuses } }
  if (memberId) filter.memberId = memberId
  const requests = await TrainingRequest.find(filter).select('_id memberId type status').lean()
  const memberIds = [...new Set(requests.map((request) => String(request.memberId)))]
  const now = new Date()
  let cancelledCount = 0

  for (const currentMemberId of memberIds) {
    const cycle = await MembershipCycle.findOne({ memberId: currentMemberId, status: 'active' })
      .select('_id status expiresAt').sort({ createdAt: -1 }).lean()
    const invalid = !cycle || (cycle.expiresAt && new Date(cycle.expiresAt) <= now)
    const hasActiveAssignment = await Promise.all([
      PTAssignment.exists({ memberId: currentMemberId, status: 'active' }),
      TrainingAssignment.exists({ memberId: currentMemberId, status: 'active' }),
      ClassEnrollment.exists({ memberId: currentMemberId, status: 'active' }),
    ])
    // A pending/waiting request has no assignment by design. Only requests that
    // had already reached an assignment state can be stale because their
    // assignment was cleaned up.
    const staleAssignedTypes = [...new Set(
      requests
        .filter((request) => String(request.memberId) === String(currentMemberId))
        .filter((request) => staleAssignmentStatuses.includes(request.status))
        .map((request) => request.type)
        .filter(Boolean),
    )]
    const staleAssigned = !hasActiveAssignment.some(Boolean) && staleAssignedTypes.length > 0
    if (!invalid && !staleAssigned) continue

    const updateFilter = {
      memberId: currentMemberId,
      status: invalid
        ? { $in: reconcileStatuses }
        : { $in: staleAssignmentStatuses },
      ...(staleAssigned && !invalid ? { type: { $in: staleAssignedTypes } } : {}),
    }
    const requestsBeforeCancel = await TrainingRequest.find(updateFilter).select('_id status').lean()
    for (const requestBeforeCancel of requestsBeforeCancel) {
      console.log('[REQUEST CANCELLED]', {
        file: import.meta.url,
        function: 'reconcileStaleRequests',
        requestId: requestBeforeCancel._id,
        oldStatus: requestBeforeCancel.status,
        reason: invalid ? 'membership/membership cycle không còn hiệu lực' : 'assignment đã được cleanup',
        stack: new Error().stack,
      })
    }
    const result = await TrainingRequest.updateMany(
      updateFilter,
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          endedAt: now,
          cancelReason: invalid
            ? 'Tự đóng do membership/membership cycle không còn hiệu lực'
            : 'Tự đóng do assignment đã được cleanup',
        },
      },
    )
    cancelledCount += result.modifiedCount || 0
  }

  return { cancelledCount }
}

export const createRequest = async ({ memberId, data }) => {
  const type = data.type || 'group'
  if (!['group', 'pt1on1'].includes(type)) {
    const err = new Error('Loai yeu cau khong hop le')
    err.statusCode = 400
    throw err
  }

  const requiredFeature = type === 'pt1on1' ? 'BOOK_PT_PRIVATE' : 'BOOK_PT_GROUP'
  const entitlement = await checkMemberFeature(memberId, requiredFeature)
  if (!entitlement.allowed) {
    const err = new Error(entitlement.reason)
    err.statusCode = 403
    throw err
  }

  await reconcileStaleRequests({ memberId })

  // Chặn trùng: 1 hội viên chỉ có 1 yêu cầu đang xử lý cho mỗi loại dịch vụ
  const existingActive = await TrainingRequest.findOne({
    memberId,
    type,
    status: { $in: ACTIVE_TRAINING_REQUEST_STATUSES },
  })
  if (existingActive) {
    const err = new Error(type === 'pt1on1' ? 'Bạn đang có một yêu cầu PT đang được xử lý.' : 'Bạn đang có một yêu cầu tập luyện nhóm đang được xử lý.')
    err.statusCode = 409
    throw err
  }

  // Chặn đăng ký PT 1-1 khi hội viên đã có PT phụ trách đang hoạt động
  // (tránh tạo yêu cầu "treo" mà Admin không thể phân công PT)
  if (type === 'pt1on1') {
    const activeAssignment = await PTAssignment.exists({ memberId, status: 'active' })
    if (activeAssignment) {
      const err = new Error('Bạn đã có PT phụ trách đang hoạt động. Vui lòng rời dịch vụ PT hiện tại trước khi đăng ký PT khác.')
      err.statusCode = 409
      throw err
    }
  }

  const weeks = Math.min(Math.max(Number(data.weeks) || 1, 1), 12)

  // Hội viên chọn PT cụ thể mà không chọn chuyên môn → lấy chuyên môn đầu tiên của PT đó
  // (để Admin vẫn phân công được đúng PT đã chọn, không bị chặn do lệch chuyên môn).
  let specValue = data.specialization
  if (type === 'pt1on1' && !specValue && data.preferredTrainerId) {
    const preferredPt = await (await import('../models/User.js')).default.findById(data.preferredTrainerId).select('specialties').lean()
    const firstSpec = (preferredPt?.specialties || []).find((s) => ALLOWED_SPECIALIZATIONS.has(String(s).trim().toUpperCase()))
    if (firstSpec) specValue = firstSpec
  }

  const base = {
    memberId,
    type,
    specialization: normalizeSpecialization(specValue),
    goals: data.goals || [],
    note: data.note || '',
    weeks,
    status: 'pending',
  }
  base.timeSlots = data.timeSlots || []
  base.daysOfWeek = data.daysOfWeek || []
  base.healthNotes = data.healthNotes || ''
  base.preferredTrainerId = data.preferredTrainerId || null
  if (type === 'pt1on1') {
    base.contactPhone = data.contactPhone || ''
    base.contactEmail = data.contactEmail || ''

    // Mỗi ngày chọn 1 khung giờ riêng (daySlots); giữ daysOfWeek/timeSlots gộp để tương thích hiển thị cũ
    base.daySlots = normalizeDaySlots(data)
    if (!base.daySlots.length) {
      const err = new Error('Vui lòng chọn ít nhất 1 ngày và khung giờ tập')
      err.statusCode = 400
      throw err
    }
    if (base.daySlots.length) {
      base.daysOfWeek = [...new Set(base.daySlots.map((p) => p.day))].sort((a, b) => a - b)
      base.timeSlots = [...new Set(base.daySlots.map((p) => p.slot))]
    } else if (base.timeSlots.length > 1) {
      const err = new Error('Mỗi ngày chỉ được chọn 1 khung giờ tập. Vui lòng chọn 1 khung giờ cho từng ngày.')
      err.statusCode = 400
      throw err
    }
  } else {
    base.isNewToGym = data.isNewToGym || false
  }

  // A request cannot wait for Admin beyond the first requested session.
  if (type === 'pt1on1' && base.daySlots.length) {
    const now = new Date()
    const starts = base.daySlots.map(({ day, slot }) => {
      const target = new Date(now)
      target.setHours(0, 0, 0, 0)
      let offset = Number(day) - target.getDay()
      if (offset < 0) offset += 7
      target.setDate(target.getDate() + offset)
      const [hour = 0, minute = 0] = String(slot || '').split('-')[0].trim().split(':').map(Number)
      target.setHours(hour, minute, 0, 0)
      if (target <= now) target.setDate(target.getDate() + 7)
      return target
    })
    base.adminDeadline = new Date(Math.min(...starts.map((date) => date.getTime())))
  }

  // Khi hội viên chỉ định PT, việc kiểm tra lịch/chuyên môn được thực hiện ở
  // bước tự duyệt. Nếu không đạt, vẫn lưu request pending để Admin dùng danh
  // sách PT gợi ý thay vì từ chối yêu cầu ngay từ đầu.
  const request = await TrainingRequest.create(base)
  return request
}

export const getMyRequests = async ({ memberId, type, status, activeOnly = false }) => {
  if (activeOnly) await reconcileStaleRequests({ memberId })
  const filter = { memberId }
  if (type) filter.type = type
  if (status) filter.status = status
  if (activeOnly) filter.status = { $in: ACTIVE_TRAINING_REQUEST_STATUSES }
  return TrainingRequest.find(filter)
    .populate('memberId', 'name fullName email phone avatar memberCode')
    .populate('assignedClassId', 'name trainerId schedule')
    .populate('assignedTrainerId', 'name fullName avatar specialties phone email')
    .populate('preferredTrainerId', 'name fullName avatar')
    .sort({ createdAt: -1 })
  }


const getMemberMembershipInfo = async (memberId) => {
  // Cycle active là nguồn sự thật duy nhất (kích hoạt ngay sau thanh toán)
  const cycle = await MembershipCycle.findOne({
    memberId,
    status: 'active',
  }).populate('currentPlanId', 'nameVi nameEn price durationDays').sort({ createdAt: -1 }).lean()

  if (!cycle) return null

  const plan = cycle.currentPlanId
  const periodEndDate = await getActivePeriodEndDate({ membershipId: cycle.currentMembershipId, cycle })
  const remainingDays = periodEndDate ? calculateRemainingDays(periodEndDate) : 0

  // Tính tổng ngày còn lại bao gồm cả gia hạn chưa sử dụng
  const periods = await MembershipPeriod.find({
    membershipId: cycle.currentMembershipId,
    status: 'PENDING',
  }).sort({ startDate: 1 }).lean()

  const nowMs = Date.now()
  let totalRemainingDays = Math.max(0, remainingDays)
  let pendingRenewalsCount = 0

  for (const p of periods) {
    const start = new Date(p.startDate).getTime()
    if (nowMs < start) {
      pendingRenewalsCount++
      totalRemainingDays += p.totalDays
    }
  }

  return {
    planName: plan?.nameVi || plan?.nameEn || '',
    remainingDays: Math.max(0, remainingDays),
    totalRemainingDays,
    pendingRenewalsCount,
    isPending: false,
    hasMembership: true,
    planPrice: plan?.price || 0,
  }
}

export const getAllRequests = async ({ type, status, activeOnly = false, page = 1, limit = 20 }) => {
  if (activeOnly) await reconcileStaleRequests()
  const filter = {}
  if (type) filter.type = type
  if (status) filter.status = status
  if (activeOnly) filter.status = { $in: ACTIVE_TRAINING_REQUEST_STATUSES }
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    TrainingRequest.find(filter)
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .populate('assignedClassId', 'name trainerId schedule')
      .populate('assignedTrainerId', 'name fullName avatar specialties phone email')
      .populate('preferredTrainerId', 'name fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainingRequest.countDocuments(filter),
  ])

  // Thêm thông tin membership cho từng request
  const enrichedRequests = await Promise.all(items.map(async (req) => {
    const reqObj = req.toObject ? req.toObject() : req
    const memberId = typeof reqObj.memberId === 'object' ? reqObj.memberId._id : reqObj.memberId
    if (memberId) {
      reqObj.membershipInfo = await getMemberMembershipInfo(memberId)
    }
    return reqObj
  }))

  return {
    requests: enrichedRequests,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

export const markAsAssigned = async ({ memberId, classId, assignedBy }) => {
  // Mark the latest pending request as assigned
  const request = await TrainingRequest.findOneAndUpdate(
    { memberId, status: 'pending' },
    {
      status: 'assigned',
      assignedClassId: classId,
      assignedAt: new Date(),
      assignedBy: assignedBy || undefined,
    },
    { new: true, sort: { createdAt: -1 } },
  )
  return request
}
export const getPt1on1Counts = async () => {
  const defaultCounts = {
    pending: 0, processing: 0, message_sent: 0, waiting_member: 0,
    waiting_assignment: 0, waiting_reassign: 0, assigned: 0,
    declined_by_member: 0, cancelled: 0,
  }
  const agg = await TrainingRequest.aggregate([
    { $match: { type: 'pt1on1' } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  for (const row of agg) {
    if (row._id && row._id in defaultCounts) defaultCounts[row._id] = row.count
  }
  return defaultCounts
}

export const getRequestById = async (requestId) => {
  return TrainingRequest.findById(requestId)
    .populate('memberId', 'name fullName email phone avatar memberCode')
    .populate('assignedClassId', 'name trainerId schedule')
    .populate('assignedTrainerId', 'name fullName avatar specialties phone email')
    .populate('preferredTrainerId', 'name fullName avatar')
  }


export const assignToClass = async ({ requestId, classId, assignedBy }) => {
  const existing = await TrainingRequest.findById(requestId)
  if (!existing) return null
  if (existing.type !== 'group') {
    const err = new Error('Yeu cau nay khong phai yeu cau PT nhom')
    err.statusCode = 400
    throw err
  }
  if (!['pending', 'waiting_assignment', 'waiting_reassign'].includes(existing.status)) {
    const err = new Error('Yeu cau khong o trang thai cho phep xep lop')
    err.statusCode = 400
    throw err
  }

  const trainingClass = await TrainingClass.findById(classId).populate('zoneId', 'maxCapacity').lean()
  if (!trainingClass) {
    const err = new Error('Không tìm thấy lớp tập')
    err.statusCode = 404
    throw err
  }

  const requestSpec = normalizeSpecialization(existing.specialization)
  const classSpec = normalizeSpecialization(trainingClass.specialization)
  if (requestSpec !== classSpec) {
    const err = new Error('Lop duoc chon khong khop chuyen mon yeu cau')
    err.statusCode = 400
    throw err
  }

  // Request, assignment và ClassEnrollment phải được tạo chung một transaction.
  // ensureEnrollment dùng capacityRevision để các yêu cầu đồng thời không vượt chỗ.
  const session = await mongoose.startSession()
  try {
    let request
    await session.withTransaction(async () => {
      const freshRequest = await TrainingRequest.findOne({
        _id: requestId,
        type: 'group',
        status: { $in: ['pending', 'waiting_assignment', 'waiting_reassign'] },
      }).session(session)
      if (!freshRequest) {
        const err = new Error('Yêu cầu không còn ở trạng thái có thể xếp lớp')
        err.statusCode = 409
        throw err
      }

      const existingEnrollment = await Promise.all([
        TrainingAssignment.exists({ memberId: freshRequest.memberId, status: { $in: ['active', 'waiting_pt'] } }).session(session),
        ClassEnrollment.exists({ memberId: freshRequest.memberId, status: 'active' }).session(session),
        PTAssignment.exists({ memberId: freshRequest.memberId, status: 'active' }).session(session),
      ])
      if (existingEnrollment.some(Boolean)) {
        const err = new Error('Hội viên đang có PT/lớp active, không thể xếp thêm')
        err.statusCode = 409
        throw err
      }

      await ensureClassEnrollment({
        classId,
        memberId: freshRequest.memberId,
        sourceReason: 'assigned_by_pt',
        session,
      })

      const hasActivePt = trainingClass.status === 'active' && trainingClass.ptId
      await TrainingAssignment.create([{
        memberId: freshRequest.memberId,
        classId,
        requestId: freshRequest._id,
        trainerId: hasActivePt ? trainingClass.ptId : null,
        assignedBy: assignedBy || undefined,
        status: hasActivePt ? 'active' : 'waiting_pt',
        acceptedAt: hasActivePt ? new Date() : null,
        startDate: new Date(),
      }], { session })

      freshRequest.status = 'assigned'
      freshRequest.assignedClassId = classId
      freshRequest.assignedAt = new Date()
      freshRequest.assignedBy = assignedBy || undefined
      await freshRequest.save({ session })
      request = freshRequest
    })

    const member = await (await import('../models/User.js')).default.findById(request.memberId).select('fullName name').lean()
    const memberName = member?.fullName || member?.name || ''
    notifyPtMemberChanged({
      action: 'joined',
      memberName,
      className: trainingClass.name || '',
      classId,
      ptId: trainingClass.ptId || null,
    })
    return request
  } finally {
    await session.endSession()
  }
}

export const assignTrainer = async ({ requestId, trainerId, assignedBy }) => {
  const existing = await TrainingRequest.findById(requestId)
  if (!existing) return null
  if (existing.type !== 'pt1on1') {
    const err = new Error('Yeu cau nay khong phai yeu cau PT 1-1')
    err.statusCode = 400
    throw err
  }
  if (!['pending', 'waiting_assignment', 'waiting_reassign'].includes(existing.status)) {
    const err = new Error('Yeu cau khong o trang thai cho phep phan cong PT')
    err.statusCode = 400
    throw err
  }
  if ((existing.rejectedPtIds || []).some((id) => String(id) === String(trainerId))) {
    const err = new Error('PT nay da tu choi hoi vien nay. Vui long chon PT khac.')
    err.statusCode = 409
    throw err
  }

  const trainer = await (await import('../models/User.js')).default.findOne({
    _id: trainerId,
    role: 'pt',
    isActive: true,
  }).select('specialties').lean()
  if (!trainer) {
    const err = new Error('PT khong ton tai hoac dang bi khoa')
    err.statusCode = 404
    throw err
  }
  const requestSpec = normalizeSpecialization(existing.specialization)
  const trainerSpecs = (trainer.specialties || []).map((item) => String(item || '').trim().toUpperCase())
  if (trainerSpecs.length > 0 && !trainerSpecs.includes(requestSpec)) {
    const err = new Error('PT duoc chon khong khop chuyen mon yeu cau')
    err.statusCode = 400
    throw err
  }

  const activeAssignment = await PTAssignment.exists({ memberId: existing.memberId, status: 'active' })
  if (activeAssignment) {
    const err = new Error('Hội viên đã có PT 1-1 đang hoạt động. Vui lòng hủy yêu cầu hoặc yêu cầu hội viên rời dịch vụ PT hiện tại trước khi phân công.')
    err.statusCode = 409
    throw err
  }

  const crossConflict = await findCrossMemberConflict({
    trainerId,
    daySlots: requestDaySlots(existing),
    weeks: existing.weeks,
    excludeMemberId: existing.memberId,
    excludeRequestId: requestId,
  })
  if (crossConflict) {
    const list = crossConflict.map((c) => `${formatDayName(c.day)} lúc ${c.slot}`).join(', ')
    const err = new Error(`PT nay da co lich ban trung vao: ${list}. Vui long chon PT khac hoac dieu chinh ngay/gio cua yeu cau.`)
    err.statusCode = 409
    throw err
  }

  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'assigned',
      assignedTrainerId: trainerId,
      assignedAt: new Date(),
      ptConfirmationDeadline: new Date(Date.now() + (Number(process.env.PT_CONFIRM_TIMEOUT_HOURS) || 48) * 60 * 60 * 1000),
      assignedBy: assignedBy || undefined,
    },
    { new: true },
  )

  if (request) {
    const member = await (await import('../models/User.js')).default.findById(request.memberId)
      .select('fullName name memberCode memberNumber email phone').lean()
    const memberName = member?.fullName || member?.name || ''
    const memberCode = member?.memberCode || member?.memberNumber || ''

    const { createNotification } = await import('./notificationService.js')
    const { NOTIFICATION_TYPES } = await import('../models/Notification.js')

    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
    const isGroup = request.type === 'group'
    const assignedClass = isGroup && request.assignedClassId
      ? await TrainingClass.findById(request.assignedClassId).select('name').lean()
      : null
    const notificationTitle = isGroup
      ? 'Bạn vừa được phân công lớp tập nhóm'
      : 'Bạn vừa được phân công hội viên PT 1-1'
    const notificationContent = isGroup
      ? [
        'Bạn vừa được phân công hội viên tập nhóm.',
        `Hội viên: ${memberName}${memberCode ? ` (${memberCode})` : ''}`,
        `Lớp: ${assignedClass?.name || '—'}`,
        `Chuyên môn: ${request.specialization || '—'}`,
        `Mục tiêu: ${(request.goals || []).join(', ') || '—'}`,
        '',
        'Vui lòng xác nhận hoặc từ chối nhận phụ trách hội viên tập nhóm này.',
      ].join('\n')
      : [
        'Bạn vừa được phân công hội viên PT 1-1.',
        `Hội viên: ${memberName}${memberCode ? ` (${memberCode})` : ''}`,
        `Chuyên môn: ${request.specialization || '—'}`,
        `Mục tiêu: ${(request.goals || []).join(', ') || '—'}`,
        `Ngày bắt đầu: ${fmtDate(request.assignedAt || request.createdAt)}`,
        '',
        'Vui lòng xác nhận hoặc từ chối nhận phụ trách hội viên PT 1-1 này.',
      ].join('\n')

    // Notify PT — yêu cầu PT xác nhận (Chấp nhận / Từ chối) việc phụ trách hội viên mới
    createNotification({
      receiverId: trainerId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.MEMBER_ASSIGNED,
      title: notificationTitle,
      content: notificationContent,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/pt/clients',
      createdBy: 'Admin',
      requiresAction: true,
      actions: ['accept', 'reject'],
      priority: 'high',
    })
  }

  return request
}

// Gợi ý PT cho yêu cầu PT 1-1 (admin): sắp xếp theo
// đúng chuyên môn → ít xung đột lịch → ít học viên đang phụ trách → chưa từng bị từ chối
// → ít yêu cầu đang chờ xác nhận. Mỗi PT kèm danh sách xung đột cụ thể để admin thấy
// trước khi gán (thay vì chỉ nhận 409 sau khi submit).
export const getPtSuggestions = async ({ requestId }) => {
  const request = await TrainingRequest.findById(requestId).lean()
  if (!request) return null
  if (request.type !== 'pt1on1') {
    const err = new Error('Yeu cau nay khong phai yeu cau PT 1-1')
    err.statusCode = 400
    throw err
  }

  const daySlots = requestDaySlots(request)
  const requestSpec = normalizeSpecialization(request.specialization)
  const preferredTrainerId = request.preferredTrainerId ? String(request.preferredTrainerId) : null
  const rejectedSet = new Set((request.rejectedPtIds || []).map((id) => String(id && id._id ? id._id : id)))
  const rejectReasonMap = new Map(
    (request.rejectHistory || []).map((h) => [String(h.ptId && h.ptId._id ? h.ptId._id : h.ptId), h.reason || '']),
  )

  const User = (await import('../models/User.js')).default
  const pts = await User.find({ role: 'pt', isActive: true })
    .select('fullName name avatar email contactEmail specialties rating experienceYears')
    .lean()

  const ptModelMap = new Map()
  let waitingMap = new Map()
  let studentCountMap = new Map()
  let scheduleCountMap = new Map()
  if (pts.length) {
    const ptIds = pts.map((p) => p._id)

    const studentCounts = await PTAssignment.aggregate([
      { $match: { ptId: { $in: ptIds }, status: 'active' } },
      { $group: { _id: '$ptId', count: { $sum: 1 } } },
    ])
    studentCountMap = new Map(studentCounts.map((s) => [String(s._id), s.count]))

    const scheduleCounts = await TrainerSchedule.aggregate([
      { $match: { trainerId: { $in: ptIds }, status: 'active' } },
      { $group: { _id: '$trainerId', count: { $sum: 1 } } },
    ])
    scheduleCountMap = new Map(scheduleCounts.map((s) => [String(s._id), s.count]))

    const waitingRequests = await TrainingRequest.find({
      type: 'pt1on1',
      status: 'assigned',
      assignedTrainerId: { $in: ptIds },
    }).select('assignedTrainerId memberId').lean()
    // Loại trừ request đã được PT accept: cặp (ptId, memberId) có PTAssignment active
    const acceptedPairs = new Set(
      (await PTAssignment.find({ ptId: { $in: ptIds }, status: 'active' })
        .select('ptId memberId').lean())
        .map((a) => `${String(a.ptId)}|${String(a.memberId)}`),
    )
    const tempWaitingMap = new Map()
    for (const r of waitingRequests) {
      const key = `${String(r.assignedTrainerId)}|${String(r.memberId)}`
      if (acceptedPairs.has(key)) continue
      const pid = String(r.assignedTrainerId)
      tempWaitingMap.set(pid, (tempWaitingMap.get(pid) || 0) + 1)
    }
    waitingMap = tempWaitingMap
  }

  const results = []
  for (const pt of pts) {
    const ptId = pt._id
    const specs = (pt.specialties || []).map((s) => String(s || '').trim().toUpperCase())
    const specMatch = specs.length === 0 || specs.includes(requestSpec)

    const [scheduleConflicts, classConflicts, crossConflicts] = await Promise.all([
      findScheduleConflict({ trainerId: ptId, daySlots, ptLabel: 'PT này' }),
      findClassConflict({ trainerId: ptId, daySlots }),
      findCrossMemberConflict({
        trainerId: ptId,
        daySlots,
        weeks: request.weeks,
        excludeMemberId: request.memberId,
        excludeRequestId: request._id,
      }),
    ])

    const conflicts = []
    for (const c of scheduleConflicts || []) conflicts.push(c)
    for (const c of classConflicts || []) conflicts.push(c)
    for (const c of crossConflicts || []) {
      conflicts.push(`${formatDayName(c.day)} lúc ${c.slot} — PT đang có lịch trùng`)
    }

    const rejected = rejectedSet.has(String(ptId))
    const suggestion = {
      id: ptId,
      name: pt.fullName || pt.name,
      fullName: pt.fullName || pt.name,
      avatar: pt.avatar || '',
      email: pt.email || pt.contactEmail || '',
      specialties: pt.specialties || [],
      rating: pt.rating || 0,
      experienceYears: pt.experienceYears || 0,
      specMatch,
      rejected,
      rejectReason: rejectReasonMap.get(String(ptId)) || '',
      totalStudents: studentCountMap.get(String(ptId)) || 0,
      waitingConfirmation: waitingMap.get(String(ptId)) || 0,
      hasSchedule: (scheduleCountMap.get(String(ptId)) || 0) > 0,
      conflicts,
      // PT do hội viên chủ động chọn. Vẫn giữ thứ tự gợi ý theo độ phù hợp
      // để Admin có thể so sánh, nhưng UI cần nhận diện rõ lựa chọn này.
      isPreferred: preferredTrainerId === String(ptId),
    }
    suggestion.matchScore = computeMatchScore(suggestion)
    results.push(suggestion)
  }

  // Sắp xếp: điểm phù hợp → ít xung đột → ít học viên → chưa từng bị từ chối → ít đang chờ xác nhận
  results.sort((a, b) => {
    if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore
    if (a.conflicts.length !== b.conflicts.length) return a.conflicts.length - b.conflicts.length
    if (a.totalStudents !== b.totalStudents) return a.totalStudents - b.totalStudents
    if (a.rejected !== b.rejected) return a.rejected ? 1 : -1
    return a.waitingConfirmation - b.waitingConfirmation
  })

  return results
}

// Điểm phù hợp 0-100 cho đề xuất PT (đã chọn PT) — ẩn lý do chi tiết để admin
// thấy ngay mức độ phù hợp mà không cần đọc hết các yếu tố:
// chuyên môn 40đ, không xung đột lịch 25đ, ít hội viên 15đ, ít chờ xác nhận 10đ,
// rating 5★=10đ, có lịch làm việc ±5đ. PT đã từ chối = 0đ.
const computeMatchScore = (pt) => {
  if (pt.rejected) return 0
  let score = 0
  score += pt.specMatch ? 40 : 10
  score += Math.max(0, 25 - pt.conflicts.length * 12)
  score += Math.max(0, 15 - pt.totalStudents * 2)
  score += Math.max(0, 10 - pt.waitingConfirmation * 4)
  score += Math.min(10, (pt.rating || 0) * 2)
  score += pt.hasSchedule ? 5 : -5
  return Math.max(0, Math.min(100, Math.round(score)))
}

// Admin rút lại phân công khi PT từ chối nhận hội viên → đưa yêu cầu về trạng thái chờ phân công lại
export const unassignTrainer = async ({ requestId, rejectedPtId, reason = '' }) => {
  return TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      $set: { status: 'waiting_assignment', assignedTrainerId: null, assignedAt: null },
      ...(rejectedPtId
        ? {
          $addToSet: { rejectedPtIds: rejectedPtId },
          $push: { rejectHistory: { ptId: rejectedPtId, reason, rejectedAt: new Date() } },
        }
        : {}),
    },
    { new: true },
  )
}

/**
 * Hủy toàn bộ booking của 1 yêu cầu PT (kể cả booking đã xác nhận/thanh toán).
 * - pending/awaiting_payment: hủy trực tiếp.
 * - confirmed & đã thanh toán: hoàn tiền về ví nếu hủy trước 24h giờ tập (cùng chính sách cancelBooking);
 *   hủy trong 24h → giữ tiền phạt (isViolation) để không bao giờ để sót booking chặn slot PT.
 * Returns { cancelled, refunded }
 */
export const cancelRequestBookings = async ({ requestId, ptId = null, reason = '' }) => {
  const filter = { requestId, status: { $in: ['pending', 'awaiting_payment', 'confirmed'] } }
  if (ptId) filter.ptId = ptId
  const bookings = await Booking.find(filter)

  let refunded = 0
  const now = new Date()
  for (const booking of bookings) {
    const bookingDate = new Date(booking.date)
    const start = String(booking.slot || '').split('-')[0].trim()
    const [hour = 0, minute = 0] = start.split(':').map(Number)
    bookingDate.setHours(hour || 0, minute || 0, 0, 0)
    const diffHours = (bookingDate - now) / (1000 * 60 * 60)

    if (
      booking.status === 'confirmed' &&
      booking.paymentStatus === 'paid' &&
      Number(booking.totalAmount || 0) > 0 &&
      diffHours >= 24
    ) {
      try {
        await applyWalletTransaction({
          userId: booking.memberId,
          amount: Number(booking.totalAmount),
          type: 'refund',
          provider: 'wallet',
          source: 'pt_booking_refund',
          description: `Hoàn tiền hủy lịch PT ${new Date(booking.date).toLocaleDateString('vi-VN')} ${booking.slot} (hủy yêu cầu trước 24h)`,
          referenceId: booking._id.toString(),
          status: 'completed',
          metadata: { bookingId: booking._id.toString(), ptId: booking.ptId, reason: 'request_cancel' },
          idempotencyKey: `pt_booking_refund_${booking._id}`,
        })
        booking.paymentStatus = 'refunded'
        refunded++
      } catch (err) {
        console.error('[cancelRequestBookings] refund failed:', booking._id, err.message)
      }
    }

    const wasConfirmedPaid = booking.status === 'confirmed' && booking.paymentStatus === 'paid' && Number(booking.totalAmount || 0) > 0
    if (wasConfirmedPaid && diffHours < 24) {
      booking.isViolation = true
    }
    booking.status = 'cancelled'
    booking.cancelReason = reason || 'Hủy yêu cầu'
    await booking.save()
  }

  return { cancelled: bookings.length, refunded }
}

export const cancelRequest = async ({ requestId, memberId, reason = '' }) => {
  const requestBeforeCancel = await TrainingRequest.findOne({ _id: requestId, memberId }).select('_id status').lean()
  if (requestBeforeCancel) {
    console.log('[REQUEST CANCELLED]', {
      file: import.meta.url,
      function: 'cancelRequest',
      requestId: requestBeforeCancel._id,
      oldStatus: requestBeforeCancel.status,
      reason: reason || 'member cancelled request',
      stack: new Error().stack,
    })
  }
  if (!requestBeforeCancel) return null
  if (!ACTIVE_TRAINING_REQUEST_STATUSES.includes(requestBeforeCancel.status)) {
    const err = new Error('Request cannot be cancelled in its current status')
    err.statusCode = 400
    throw err
  }
  const request = await TrainingRequest.findOneAndUpdate(
    { _id: requestId, memberId },
    { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
    { new: true },
  )
  return request
}

// Admin/staff hủy yêu cầu (PT 1-1 hoặc nhóm) kèm lý do — cho phép xử lý các
// yêu cầu treo mà member không thể tự hủy (vd: member đã có PT active).
export const adminCancelRequest = async ({ requestId, reason = '', adminId }) => {
  const existing = await TrainingRequest.findById(requestId)
  if (!existing) return null
  if (['cancelled', 'declined_by_member'].includes(existing.status)) {
    const err = new Error('Yêu cầu đã kết thúc, không thể hủy')
    err.statusCode = 400
    throw err
  }
  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelledBy: adminId || undefined,
    },
    { new: true },
  )
  return request
}

export const sendMessage = async ({ requestId, content = '', proposal = null }) => {
  const existing = await TrainingRequest.findById(requestId)
  if (!existing) return null
  if (!['pending', 'message_sent'].includes(existing.status)) {
    const err = new Error('Yêu cầu không ở trạng thái cho phép gửi đề xuất')
    err.statusCode = 400
    throw err
  }

  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'message_sent',
      lastMessage: content,
      messageSentAt: new Date(),
      currentProposal: proposal || null,
      proposal: proposal || null,
      proposalAccepted: false,
      acceptedProposal: null,
      proposalAcceptedAt: null,
    },
    { new: true },
  )
  return request
}

export const respondToMessage = async ({ requestId, action, memberId, suggestion = '' }) => {
  const existing = await TrainingRequest.findById(requestId)
  if (!existing) return null
  if (existing.memberId.toString() !== memberId.toString()) {
    const err = new Error('Bạn không có quyền phản hồi yêu cầu này')
    err.statusCode = 403
    throw err
  }
  if (existing.status !== 'message_sent') {
    const err = new Error('Yêu cầu không còn ở trạng thái chờ phản hồi')
    err.statusCode = 400
    throw err
  }
  if (action === 'counter' && !suggestion.trim()) {
    const err = new Error('Vui lòng nhập thời gian/PT bạn muốn đề xuất')
    err.statusCode = 400
    throw err
  }

  let status
  if (action === 'accept') status = 'waiting_assignment'
  else if (action === 'counter') status = 'pending'
  else status = 'declined_by_member'

  const update = action === 'counter'
    ? {
      status,
      lastMessage: suggestion.trim(),
      messageSentAt: null,
      proposalAccepted: false,
      acceptedProposal: null,
      proposalAcceptedAt: null,
    }
    : action === 'accept'
      ? {
        status,
        acceptedProposal: existing.currentProposal || existing.proposal || null,
        proposalAccepted: true,
        proposalAcceptedAt: new Date(),
      }
      : { status }

  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    update,
    { new: true },
  )
  return request
}

export const getPtOneToOnePrice = async (trainerId) => {
  const profile = await PT.findOne({ userId: trainerId }).select('oneToOnePrice').lean()
  return Number(profile?.oneToOnePrice || 0)
}

export const updateRequestPaymentState = async ({ requestId, priceSnapshot, paymentDeadline }) =>
  TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'awaiting_payment',
      priceSnapshot: Number(priceSnapshot || 0),
      paymentDeadline,
    },
    { new: true },
  )

export const updateRequestStatus = async ({ requestId, status }) =>
  TrainingRequest.findByIdAndUpdate(requestId, { status }, { new: true })
