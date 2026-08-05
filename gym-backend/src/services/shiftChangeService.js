import ShiftChangeRequest from '../models/ShiftChangeRequest.js'
import ShiftChangeItem from '../models/ShiftChangeItem.js'
import ScheduleReplacement from '../models/ScheduleReplacement.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import User from '../models/User.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { emitNotificationToUser, emitNotificationToStaff, emitNotificationUpdated, emitShiftChangeCountUpdate, emitShiftChangeUpdated, emitShiftChangeMyUpdated } from './socketService.js'

const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

const toDayStart = (d) => {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

const toMinutes = (hhmm) => {
  if (!hhmm) return 0
  const [h, m] = String(hhmm).split(':').map(Number)
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

const formatDateHour = (d) => new Date(d).toLocaleDateString('vi-VN')

const timeHasPassed = (date, endTime) => {
  if (!date) return false
  const end = new Date(date)
  if (endTime) {
    const [h, m] = String(endTime).split(':').map(Number)
    end.setHours(Number(h) || 23, Number(m) || 59, 59, 999)
  } else {
    end.setHours(23, 59, 59, 999)
  }
  return new Date() >= end
}

const REQUEST_OPEN_STATUSES = ['pending', 'waiting_assignment', 'assigned']
// Trạng thái chặn tạo mới yêu cầu cho cùng một ca (PT + Class + Date)
const REQUEST_BLOCKING_STATUSES = [...REQUEST_OPEN_STATUSES, 'accepted']

/**
 * Lấy các lớp (ca) của PT A vào đúng ngày targetDate từ TrainingAssignment (không đổi assignedTrainer).
 * Bao gồm cả lớp PT đang cover qua ScheduleReplacement (người thay) còn hiệu lực đúng ngày.
 */
const getPtClassesForDate = async ({ ptId, targetDate }) => {
  const dayOfWeek = new Date(targetDate).getDay()
  const dayStart = toDayStart(targetDate)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const assignments = await TrainingAssignment.find({ trainerId: ptId, status: 'active' })
    .populate({
      path: 'classId',
      populate: [
        { path: 'floorId', select: 'name' },
        { path: 'zoneId', select: 'name' },
      ],
    })
    .lean()
  const classes = assignments.map((a) => a.classId).filter(Boolean)
  const ownClasses = classes.filter((c) => (c.daysOfWeek || []).includes(dayOfWeek))

  // Lớp PT đang cover qua ScheduleReplacement còn hiệu lực trong ngày (người thay)
  const repls = await ScheduleReplacement.find({
    replacementTrainerId: ptId,
    date: { $gte: dayStart, $lt: dayEnd },
    status: 'approved',
  })
    .populate({
      path: 'classId',
      populate: [
        { path: 'floorId', select: 'name' },
        { path: 'zoneId', select: 'name' },
      ],
    })
    .lean()
  const replClasses = repls
    .filter((r) => !timeHasPassed(r.date, r.endTime))
    .map((r) => r.classId)
    .filter(Boolean)

  const seen = new Map()
  for (const c of [...ownClasses, ...replClasses]) {
    seen.set(String(c._id), c)
  }
  return [...seen.values()].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
}

const buildItemSnapshot = (cls) => {
  const floor = cls.floorId && typeof cls.floorId === 'object' ? cls.floorId : null
  const zone = cls.zoneId && typeof cls.zoneId === 'object' ? cls.zoneId : null
  return {
    classId: cls._id,
    className: cls.name || '',
    classCode: cls.code || '',
    startTime: cls.startTime || '',
    endTime: cls.endTime || '',
    floorId: floor?._id || null,
    floorName: floor?.name || '',
    zoneId: zone?._id || null,
    zoneName: zone?.name || '',
    specialization: cls.specialization || '',
    status: 'pending',
    replacementStatus: 'pending',
  }
}

/**
 * Tạo yêu cầu thay ca (PT A): chọn ngày + 1..n ca trong ngày đó + lý do.
 */
export const createShiftChangeRequest = async ({ ptId, targetDate, reason, classIds }) => {
  const d = toDayStart(targetDate)
  if (isNaN(d.getTime())) throw Object.assign(new Error('Ngày không hợp lệ'), { statusCode: 400 })
  const today = toDayStart(new Date())
  if (d < today) throw Object.assign(new Error('Chỉ được đăng ký thay ca cho ngày hôm nay hoặc tương lai'), { statusCode: 400 })

  const dateClasses = await getPtClassesForDate({ ptId, targetDate: d })
  if (dateClasses.length === 0) {
    throw Object.assign(new Error('Bạn không có ca dạy nào trong ngày đã chọn'), { statusCode: 400 })
  }

  let selected = dateClasses
  if (Array.isArray(classIds) && classIds.length > 0) {
    const idSet = new Set(classIds.map(String))
    selected = dateClasses.filter((c) => idSet.has(String(c._id)))
  }
  if (selected.length === 0) {
    throw Object.assign(new Error('Không tìm thấy ca nào khớp với lựa chọn của bạn'), { statusCode: 400 })
  }

  // Chỉ khóa theo đúng CA: một ca (classId) chỉ có tối đa 1 yêu cầu chưa kết thúc trong ngày.
  // PT vẫn được gửi nhiều yêu cầu trong cùng ngày nếu khác ca (PT + Class + Date).
  const openRequests = await ShiftChangeRequest.find({
    requestingPtId: ptId,
    targetDate: d,
    status: { $in: REQUEST_BLOCKING_STATUSES },
  }).select('_id').lean()
  const openItems = openRequests.length
    ? await ShiftChangeItem.find({ requestId: { $in: openRequests.map((r) => r._id) } }).select('classId').lean()
    : []
  const lockedClassIds = new Set(openItems.map((it) => String(it.classId)))
  const conflictClasses = selected.filter((c) => lockedClassIds.has(String(c._id)))
  if (conflictClasses.length > 0) {
    const names = conflictClasses.map((c) => `${c.name || 'Lớp'} (${c.startTime || '--:--'}-${c.endTime || '--:--'})`).join(', ')
    throw Object.assign(new Error(`Ca ${names} đã có yêu cầu thay ca đang xử lý`), { statusCode: 409 })
  }

  const request = await ShiftChangeRequest.create({
    requestingPtId: ptId,
    targetDate: d,
    reason: reason || '',
    status: 'pending',
  })
  await ShiftChangeItem.insertMany(selected.map((c) => ({ ...buildItemSnapshot(c), requestId: request._id })))

  const pt = await User.findById(ptId).select('name fullName email').lean()
  const notif = await createNotification({
    receiverId: null,
    receiverRole: 'admin',
    notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_REQUEST,
    title: 'Yêu cầu thay ca mới',
    content: `PT ${pt?.fullName || pt?.name || '—'} cần thay ${selected.length} ca vào ${DAY_LABELS[d.getDay()]}, ngày ${formatDateHour(d)}${reason ? `.\nLý do: ${reason}` : ''}`,
    relatedId: request._id,
    relatedType: 'ShiftChangeRequest',
    redirectUrl: '/admin/shift-change-requests',
    createdBy: 'PT',
    priority: 'high',
  })
  emitNotificationToStaff(notif)
  emitShiftChangeCountUpdate()

  return request
}

/**
 * Danh sách yêu cầu (admin view) — có items để hiển thị Ca/Thời gian/Lớp/Phòng/Tầng/Khu.
 */
export const getAllShiftChangeRequests = async ({ page = 1, limit = 20, status, mine = false, ptId } = {}) => {
  const filter = {}
  if (status) filter.status = status
  if (mine && ptId) filter.requestingPtId = ptId

  const [docs, total] = await Promise.all([
    ShiftChangeRequest.find(filter)
      .populate('requestingPtId', 'name fullName email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    ShiftChangeRequest.countDocuments(filter),
  ])

  const requests = await Promise.all(docs.map(async (req) => {
    const items = await ShiftChangeItem.find({ requestId: req._id }).lean()
    const populatedItems = await populateItems(items)
    return {
      ...req,
      items: populatedItems,
      itemCount: items.length,
      // Trạng thái hiển thị (completed/expired) được suy ra — không cần cron
      displayStatus: computeRequestDisplayStatus(req, items),
    }
  }))

  return { docs: requests, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
}

const populateItems = async (items) => {
  if (!items.length) return items
  const ptIds = new Set()
  for (const it of items) {
    if (it.replacementTrainerId) ptIds.add(String(it.replacementTrainerId))
    for (const id of it.rejectedTrainerIds || []) ptIds.add(String(id))
    for (const rj of it.rejections || []) {
      if (rj.trainerId) ptIds.add(String(rj.trainerId))
    }
  }
  const users = ptIds.size ? await User.find({ _id: { $in: [...ptIds] } }).select('name fullName email').lean() : []
  const userMap = new Map(users.map((u) => [String(u._id), u]))
  return items.map((it) => ({
    ...it,
    replacementTrainer: it.replacementTrainerId ? (userMap.get(String(it.replacementTrainerId)) || null) : null,
    rejectedTrainers: (it.rejectedTrainerIds || [])
      .map((id) => userMap.get(String(id)))
      .filter(Boolean),
    rejections: (it.rejections || []).map((rj) => ({
      ...rj,
      trainer: rj.trainerId ? (userMap.get(String(rj.trainerId)) || null) : null,
    })),
  }))
}

export const getShiftChangeRequestDetail = async (id) => {
  const request = await ShiftChangeRequest.findById(id)
    .populate('requestingPtId', 'name fullName email')
    .lean()
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })
  const items = await ShiftChangeItem.find({ requestId: id }).sort({ startTime: 1 }).lean()
  const populatedItems = await populateItems(items)
  return {
    request: { ...request, displayStatus: computeRequestDisplayStatus(request, items) },
    items: populatedItems,
  }
}

export const getMyShiftChangeRequests = async ({ ptId, status }) => {
  const filter = { requestingPtId: ptId }
  if (status) filter.status = status
  const docs = await ShiftChangeRequest.find(filter)
    .sort({ createdAt: -1 })
    .lean()
  const result = await Promise.all(docs.map(async (req) => {
    const items = await ShiftChangeItem.find({ requestId: req._id }).lean()
    const populatedItems = await populateItems(items)
    return { ...req, items: populatedItems, itemCount: items.length, displayStatus: computeRequestDisplayStatus(req, items) }
  }))
  return result
}

export const getMyReplacementAssignments = async ({ ptId, status }) => {
  const filter = { replacementTrainerId: ptId }
  if (status) filter.replacementStatus = status
  const items = await ShiftChangeItem.find(filter)
    .sort({ createdAt: -1 })
    .lean()
  const requests = await ShiftChangeRequest.find({ _id: { $in: items.map((i) => i.requestId) } }).lean()
  const reqMap = new Map(requests.map((r) => [String(r._id), r]))
  return items.map((it) => {
    const req = reqMap.get(String(it.requestId)) || {}
    return { ...it, request: req }
  })
}

/**
 * Kiểm tra điều kiện chọn PT thay cho một ca:
 * - availabilityStatus = ACTIVE (không nghỉ/ốm/treo)
 * - khác PT gốc
 * - không nằm trong rejectedTrainerIds của ca
 * - không trùng giờ với ca khác của PT đó trong cùng ngày (TrainingClass)
 * - không được gán cho 1 ca khác cùng giờ trong cùng yêu cầu
 */
export const getAvailableReplacementPTs = async ({ requestId, itemId }) => {
  const item = await ShiftChangeItem.findById(itemId).lean()
  if (!item) throw Object.assign(new Error('Không tìm thấy ca'), { statusCode: 404 })
  const request = await ShiftChangeRequest.findById(requestId).lean()
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })

  const targetDate = new Date(request.targetDate)
  const dayOfWeek = targetDate.getDay()
  const startMin = toMinutes(item.startTime)
  const endMin = toMinutes(item.endTime) || startMin + 60
  const rejected = (item.rejectedTrainerIds || []).map(String)
  const itemSpec = (item.specialization || '').trim().toUpperCase()

  const overlapping = (aStart, aEnd, bStart, bEnd) => toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)

  // Các ca khác trong cùng yêu cầu đã có PT thay — tránh gán 1 PT cho 2 ca trùng giờ
  const siblingItems = await ShiftChangeItem.find({
    requestId,
    _id: { $ne: itemId },
    replacementTrainerId: { $ne: null },
  }).lean()

  // Lấy toàn bộ PT (KHÔNG lọc availabilityStatus ở mức query) để đánh giá từng PT.
  // Rule kinh doanh giữ nguyên ở vòng lặp.
  const allPTs = await User.find({ role: 'pt', _id: { $ne: request.requestingPtId } })
    .select('name fullName email availabilityStatus status isLocked isActive specialties')
    .lean()

  const dayStart = toDayStart(request.targetDate)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const available = []
  for (const pt of allPTs) {
    let reason = null

    if ((pt.availabilityStatus || '').trim() !== 'ACTIVE') {
      reason = pt.availabilityStatus
        ? `nghỉ phép/không sẵn sàng (availabilityStatus=${pt.availabilityStatus})`
        : 'nghỉ phép/không sẵn sàng (thiếu availabilityStatus — dữ liệu cũ chưa migrate)'
    } else if (pt.isLocked || pt.status === 'locked' || pt.isActive === false) {
      reason = 'tài khoản bị khóa (locked/inactive)'
    } else if (rejected.includes(String(pt._id))) {
      reason = 'PT này đã từ chối nhận ca trước đó'
    } else if (
      itemSpec
      && (pt.specialties || []).length > 0
      && !(pt.specialties || []).map((s) => String(s).trim().toUpperCase()).includes(itemSpec)
    ) {
      reason = `chuyên môn không khớp (PT có: ${(pt.specialties || []).join(', ')})`
    } else {
      // Trùng giờ với ca riêng của PT trong cùng ngày
      const ptAssignments = await TrainingAssignment.find({ trainerId: pt._id, status: 'active' })
        .populate('classId', 'name daysOfWeek startTime endTime status')
        .lean()
      const dayClasses = ptAssignments
        .map((a) => a.classId)
        .filter((c) => c && (c.daysOfWeek || []).includes(dayOfWeek))
      for (const c of dayClasses) {
        if (c.status === 'closed') continue
        if (overlapping(startMin, endMin, toMinutes(c.startTime), toMinutes(c.endTime) || toMinutes(c.startTime) + 60)) {
          reason = `trùng giờ với ca riêng "${c.name || ''}" (${c.startTime}-${c.endTime})`
          break
        }
      }
      // Trùng giờ với ca PT đang cover qua ScheduleReplacement (đã chấp nhận) trong cùng ngày
      if (!reason) {
        const covers = await ScheduleReplacement.find({
          replacementTrainerId: pt._id,
          date: { $gte: dayStart, $lt: dayEnd },
          status: 'approved',
        })
          .populate('classId', 'name startTime endTime')
          .lean()
        for (const cov of covers) {
          const covCls = cov.classId && typeof cov.classId === 'object' ? cov.classId : null
          if (!covCls) continue
          // Loại trừ chính ca hiện tại (request/session đang xét) khỏi danh sách "ca bận"
          if (item.classId && String(covCls._id) === String(item.classId)) continue
          const covStart = toMinutes(cov.startTime) || toMinutes(covCls.startTime)
          const covEnd = toMinutes(cov.endTime) || toMinutes(covCls.endTime) || covStart + 60
          if (overlapping(startMin, endMin, covStart, covEnd)) {
            reason = `trùng giờ với ca đang cover "${covCls.name || ''}" (${cov.startTime || covCls.startTime}-${cov.endTime || covCls.endTime})`
            break
          }
        }
      }
      if (!reason) {
        for (const s of siblingItems) {
          if (String(s.replacementTrainerId) !== String(pt._id)) continue
          if (overlapping(startMin, endMin, toMinutes(s.startTime), toMinutes(s.endTime) || toMinutes(s.startTime) + 60)) {
            reason = `đã được gán cho ca khác trùng giờ (${s.startTime}-${s.endTime}) trong cùng yêu cầu`
            break
          }
        }
      }
    }

    if (!reason) {
      available.push({
        _id: pt._id,
        name: pt.fullName || pt.name || pt.email,
        email: pt.email,
        availabilityStatus: pt.availabilityStatus,
      })
    }
  }

  // Danh sách PT đã từ chối (kèm lý do + thời gian) — admin thấy rõ ai từng từ chối ca này.
  // Gộp từ item.rejections (lịch sử mới) + rejectedTrainerIds (dữ liệu cũ) — PT từ chối vẫn phải xuất hiện (disabled).
  const rejectionEntries = (item.rejections || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at))
  const rejectionByPt = new Map()
  for (const rj of rejectionEntries) {
    const id = String(rj.trainerId)
    rejectionByPt.set(id, { reason: rj.reason || '', at: rj.at })
  }
  const rejectedPTs = []
  const seenRejected = new Set()
  if (rejectionByPt.size > 0) {
    const rejectionUsers = await User.find({ _id: { $in: [...rejectionByPt.keys()] } }).select('name fullName email').lean()
    const uMap = new Map(rejectionUsers.map((u) => [String(u._id), u]))
    for (const [id, meta] of rejectionByPt) {
      const u = uMap.get(id)
      if (!u) continue
      seenRejected.add(id)
      rejectedPTs.push({ _id: u._id, name: u.fullName || u.name || u.email, reason: meta.reason, at: meta.at })
    }
  }
  // Dữ liệu cũ: PT chỉ có trong rejectedTrainerIds mà chưa có bản ghi rejections vẫn phải xuất hiện
  const missingRejectedIds = rejected.filter((id) => !seenRejected.has(id))
  if (missingRejectedIds.length > 0) {
    const oldPTs = await User.find({ _id: { $in: missingRejectedIds } }).select('name fullName email').lean()
    for (const u of oldPTs) {
      rejectedPTs.push({ _id: u._id, name: u.fullName || u.name || u.email, reason: '', at: null })
    }
  }

  return { available, rejected: rejectedPTs }
}

/**
 * Admin gán PT thay cho từng ca. assignments = [{ itemId, ptId }].
 */
export const assignReplacementPTs = async ({ requestId, handledBy, assignments }) => {
  const request = await ShiftChangeRequest.findById(requestId)
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })
  if (!REQUEST_OPEN_STATUSES.includes(request.status)) {
    throw Object.assign(new Error('Yêu cầu đã kết thúc, không thể gán PT thay'), { statusCode: 400 })
  }
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw Object.assign(new Error('Vui lòng chọn PT thay thế cho ít nhất 1 ca'), { statusCode: 400 })
  }

  const itemIds = assignments.map((a) => a.itemId)
  const items = await ShiftChangeItem.find({ requestId, _id: { $in: itemIds } }).lean()
  const itemMap = new Map(items.map((i) => [String(i._id), i]))

  const result = []
  for (const { itemId, ptId } of assignments) {
    const item = itemMap.get(String(itemId))
    if (!item) throw Object.assign(new Error('Không tìm thấy ca trong yêu cầu'), { statusCode: 400 })
    if (!ptId) throw Object.assign(new Error(`Chưa chọn PT thay cho ca ${item.className || '—'}`), { statusCode: 400 })
    if (String(ptId) === String(request.requestingPtId)) {
      throw Object.assign(new Error('Không thể chọn PT gốc làm PT thay'), { statusCode: 400 })
    }
    if ((item.rejectedTrainerIds || []).map(String).includes(String(ptId))) {
      throw Object.assign(new Error('PT này đã từ chối nhận ca.'), { statusCode: 409 })
    }
    const pt = await User.findById(ptId).select('role availabilityStatus status isLocked').lean()
    if (!pt || pt.role !== 'pt') throw Object.assign(new Error('Không tìm thấy PT'), { statusCode: 404 })
    if (pt.availabilityStatus !== 'ACTIVE' || pt.isLocked || pt.status === 'locked') {
      throw Object.assign(new Error('PT này hiện không sẵn sàng nhận ca'), { statusCode: 400 })
    }

    await ShiftChangeItem.updateOne(
      { _id: item._id },
      { replacementTrainerId: ptId, replacementStatus: 'assigned', status: 'assigned' },
    )
    result.push({ itemId: item._id, ptId })
  }

  request.status = 'assigned'
  request.handledBy = handledBy
  request.handledAt = new Date()
  request.approvedAt = new Date()
  await request.save()

  // Notification cho từng PT thay (PT B) — có nút Chấp nhận / Từ chối
  const requestor = await User.findById(request.requestingPtId).select('name fullName').lean()
  const requestorName = requestor?.fullName || requestor?.name || 'PT'
  const dateLabel = `${DAY_LABELS[new Date(request.targetDate).getDay()]}, ngày ${formatDateHour(request.targetDate)}`
  const dayLabel = DAY_LABELS[new Date(request.targetDate).getDay()]

  for (const { itemId, ptId } of result) {
    const item = await ShiftChangeItem.findById(itemId).lean()
    const parts = [
      `Ngày: ${dateLabel}`,
      `Thời gian: ${item.startTime} - ${item.endTime || ''}`,
      item.className ? `Lớp: ${item.className}` : '',
      item.floorName ? `Phòng: ${item.floorName}` : '',
      item.floorName ? `Tầng: ${item.floorName}` : '',
      item.zoneName ? `Khu: ${item.zoneName}` : '',
      `PT gốc: ${requestorName}`,
      request.reason ? `Lý do: ${request.reason}` : '',
    ].filter(Boolean).join('\n')

    const notif = await createNotification({
      receiverId: ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_ASSIGNED,
      title: 'Bạn được đề nghị nhận thay ca',
      content: `PT ${requestorName} cần thay ca.\n\n${parts}`,
      relatedId: itemId,
      relatedType: 'ShiftChangeItem',
      redirectUrl: '/pt/schedule',
      createdBy: 'Admin',
      sendEmail: false,
      requiresAction: true,
      actions: ['accept', 'reject'],
      priority: 'high',
    })
    emitNotificationToUser({ userId: ptId, notification: notif })
    emitShiftChangeMyUpdated({ userId: ptId, data: { requestId: request._id, type: 'assigned', itemId } })
  }

  emitShiftChangeUpdated({ requestId: request._id, status: request.status })
  emitShiftChangeCountUpdate()
  return { request: await ShiftChangeRequest.findById(requestId).lean(), result }
}

/**
 * Admin từ chối toàn bộ yêu cầu.
 */
export const rejectShiftChangeRequest = async ({ requestId, handledBy, reason }) => {
  const request = await ShiftChangeRequest.findById(requestId)
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })
  if (!REQUEST_OPEN_STATUSES.includes(request.status)) {
    throw Object.assign(new Error('Yêu cầu đã kết thúc, không thể từ chối'), { statusCode: 400 })
  }

  request.status = 'rejected'
  request.handledBy = handledBy
  request.handledAt = new Date()
  request.rejectReason = reason || ''
  await request.save()

  await ShiftChangeItem.updateMany({ requestId }, { status: 'rejected', replacementStatus: 'rejected' })

  const requestor = await User.findById(request.requestingPtId).select('name fullName email').lean()
  const notif = await createNotification({
    receiverId: request.requestingPtId,
    receiverRole: 'pt',
    notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_REJECTED,
    title: 'Yêu cầu thay ca bị từ chối',
    content: `Yêu cầu thay ca ${DAY_LABELS[new Date(request.targetDate).getDay()]}, ngày ${formatDateHour(request.targetDate)} đã bị từ chối.${reason ? `\nLý do: ${reason}` : ''}`,
    relatedId: request._id,
    relatedType: 'ShiftChangeRequest',
    redirectUrl: '/pt/schedule',
    createdBy: 'Admin',
    sendEmail: false,
    priority: 'high',
  })
  emitNotificationToUser({ userId: request.requestingPtId, notification: notif })
  emitShiftChangeUpdated({ requestId: request._id, status: request.status })
  emitShiftChangeCountUpdate()

  return request
}

export const cancelShiftChangeRequest = async ({ requestId, ptId }) => {
  const request = await ShiftChangeRequest.findById(requestId)
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })
  if (String(request.requestingPtId) !== String(ptId)) {
    throw Object.assign(new Error('Không có quyền hủy yêu cầu này'), { statusCode: 403 })
  }
  if (!REQUEST_OPEN_STATUSES.includes(request.status)) {
    throw Object.assign(new Error('Yêu cầu đã kết thúc, không thể hủy'), { statusCode: 400 })
  }
  request.status = 'cancelled'
  request.cancelledBy = ptId
  await request.save()
  await ShiftChangeItem.updateMany({ requestId }, { status: 'cancelled', replacementStatus: 'rejected' })

  const notif = await createNotification({
    receiverId: null,
    receiverRole: 'admin',
    notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_CANCELLED,
    title: 'PT đã hủy yêu cầu thay ca',
    content: `PT đã hủy yêu cầu thay ca ${DAY_LABELS[new Date(request.targetDate).getDay()]}, ngày ${formatDateHour(request.targetDate)}.`,
    relatedId: request._id,
    relatedType: 'ShiftChangeRequest',
    redirectUrl: '/admin/shift-change-requests',
    createdBy: 'PT',
  })
  emitNotificationToStaff(notif)
  emitShiftChangeUpdated({ requestId: request._id, status: request.status })
  emitShiftChangeCountUpdate()
  return request
}

/**
 * PT B phản hồi ca được gán. action: accept | reject (reject bắt buộc reason).
 */
export const respondShiftChangeItem = async ({ itemId, ptId, action, reason, notificationId }) => {
  const item = await ShiftChangeItem.findById(itemId)
  if (!item) throw Object.assign(new Error('Không tìm thấy ca'), { statusCode: 404 })
  if (!item.replacementTrainerId || String(item.replacementTrainerId) !== String(ptId)) {
    throw Object.assign(new Error('Ca này không được gán cho bạn'), { statusCode: 403 })
  }
  if (!['accept', 'reject'].includes(action)) {
    throw Object.assign(new Error('action phải là accept hoặc reject'), { statusCode: 400 })
  }
  if (action === 'reject' && !(reason || '').trim()) {
    throw Object.assign(new Error('Vui lòng nhập lý do từ chối'), { statusCode: 400 })
  }
  if (item.replacementStatus === 'accepted' || item.replacementStatus === 'rejected') {
    throw Object.assign(new Error('Ca này đã được phản hồi'), { statusCode: 400 })
  }

  const request = await ShiftChangeRequest.findById(item.requestId)
  if (!request) throw Object.assign(new Error('Không tìm thấy yêu cầu'), { statusCode: 404 })

  const pt = await User.findById(ptId).select('name fullName email').lean()
  const ptName = pt?.fullName || pt?.name || 'PT'
  const dayLabel = DAY_LABELS[new Date(request.targetDate).getDay()]
  const dateLabel = `${dayLabel}, ngày ${formatDateHour(request.targetDate)}`

  // Cập nhật notification action (chỉ thao tác 1 lần)
  const notifs = await Notification.find({
    receiverId: ptId,
    notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_ASSIGNED,
    relatedId: itemId,
    deletedAt: null,
  })
  const actionStatus = action === 'accept' ? 'accepted' : 'rejected'
  for (const n of notifs) {
    n.actionStatus = actionStatus
    n.actionAt = new Date()
    n.isRead = true
    n.readAt = new Date()
    n.requiresAction = false
    n.content = action === 'accept'
      ? `Bạn đã chấp nhận nhận thay ca ${dateLabel}.`
      : `Bạn đã từ chối ca ${dateLabel}.${reason ? ` Lý do: ${reason}` : ''}`
    await n.save()
    emitNotificationUpdated({ userId: ptId, notification: n.toObject() })
  }
  if (notificationId) {
    try { await Notification.findByIdAndUpdate(notificationId, { actionStatus, actionAt: new Date(), isRead: true, requiresAction: false }) } catch { /* ignore */ }
  }

  if (action === 'accept') {
    // Tạo bản ghi thay ca — KHÔNG ghi đè assignedTrainer của lớp
    const replacement = await ScheduleReplacement.create({
      requestId: request._id,
      itemId: item._id,
      classId: item.classId,
      originalTrainerId: request.requestingPtId,
      replacementTrainerId: ptId,
      date: request.targetDate,
      startTime: item.startTime,
      endTime: item.endTime,
      status: 'approved',
    })
    item.replacementStatus = 'accepted'
    item.status = 'accepted'
    item.scheduleReplacementId = replacement._id
    item.rejectReason = ''
    await item.save()

    const ptANotif = await createNotification({
      receiverId: request.requestingPtId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_ACCEPTED,
      title: 'Đã có PT nhận thay ca',
      content: `PT ${ptName} đã chấp nhận nhận thay ca ${dateLabel}.`,
      relatedId: request._id,
      relatedType: 'ShiftChangeRequest',
      redirectUrl: '/pt/schedule',
      createdBy: 'System',
      sendEmail: false,
    })
    emitNotificationToUser({ userId: request.requestingPtId, notification: ptANotif })
    emitShiftChangeMyUpdated({ userId: request.requestingPtId, data: { requestId: request._id, type: 'accepted', itemId: item._id } })

    const adminNotif = await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_ACCEPTED,
      title: 'PT đã chấp nhận nhận thay ca',
      content: `PT ${ptName} đã chấp nhận nhận thay ca ${dateLabel}.`,
      relatedId: request._id,
      relatedType: 'ShiftChangeRequest',
      redirectUrl: '/admin/shift-change-requests',
      createdBy: 'System',
    })
    emitNotificationToStaff(adminNotif)
    emitShiftChangeMyUpdated({ userId: ptId, data: { requestId: request._id, type: 'accepted', itemId: item._id } })
  } else {
    // Từ chối → thêm vào rejectedTrainerIds + rejections (lịch sử), giải phóng ca để admin gán PT khác
    item.replacementTrainerId = null
    item.replacementStatus = 'rejected'
    item.status = 'rejected'
    item.rejectReason = reason || ''
    item.scheduleReplacementId = null
    if (!item.rejectedTrainerIds.includes(ptId)) item.rejectedTrainerIds.push(ptId)
    item.rejections = item.rejections || []
    item.rejections.push({ trainerId: ptId, reason: reason || '', at: new Date() })
    await item.save()

    const adminNotif = await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SHIFT_CHANGE_PT_DECLINED,
      title: 'PT từ chối nhận thay ca',
      content: `PT ${ptName} đã từ chối ca ${dateLabel}${reason ? `.\nLý do: ${reason}` : ''}. Admin cần chọn PT thay khác.`,
      relatedId: request._id,
      relatedType: 'ShiftChangeRequest',
      redirectUrl: '/admin/shift-change-requests',
      createdBy: 'System',
      priority: 'high',
    })
    emitNotificationToStaff(adminNotif)
  }

  // Tính lại trạng thái request dựa trên các item
  await recomputeRequestStatus(request)

  emitShiftChangeUpdated({ requestId: request._id, status: request.status })
  emitShiftChangeCountUpdate()
  return { item: await ShiftChangeItem.findById(itemId).lean() }
}

const recomputeRequestStatus = async (request) => {
  const items = await ShiftChangeItem.find({ requestId: request._id }).lean()
  const accepted = items.filter((i) => i.replacementStatus === 'accepted').length
  const rejected = items.filter((i) => i.replacementStatus === 'rejected').length
  const assigned = items.filter((i) => i.replacementStatus === 'assigned').length

  if (accepted > 0 && accepted + rejected === items.length) {
    request.status = 'accepted'
  } else if (assigned === 0 && rejected > 0) {
    request.status = 'waiting_assignment'
  } else if (assigned > 0) {
    request.status = 'assigned'
  } else {
    request.status = 'pending'
  }
  await request.save()
}

/**
 * Suy trạng thái hiển thị completed/expired (không ghi DB, không cần cron).
 */
export const computeRequestDisplayStatus = (request, items = []) => {
  if (request.status === 'pending' || request.status === 'waiting_assignment' || request.status === 'assigned') {
    if (timeHasPassed(request.targetDate, null)) return 'expired'
  }
  if (request.status === 'accepted') {
    if (timeHasPassed(request.targetDate, null)) return 'completed'
  }
  return request.status
}

/**
 * Lấy danh sách ScheduleReplacement còn hiệu lực trong tuần cho PT (người thay hoặc bị thay).
 * Chỉ trả replacement chưa hết hạn (date + endTime >= now, status = approved).
 */
export const getActiveReplacementsForPT = async ({ ptId, weekStart }) => {
  const start = toDayStart(weekStart)
  if (isNaN(start.getTime())) throw Object.assign(new Error('weekStart không hợp lệ'), { statusCode: 400 })
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const now = new Date()

  const replacements = await ScheduleReplacement.find({
    $or: [
      { originalTrainerId: ptId },
      { replacementTrainerId: ptId },
    ],
    date: { $gte: start, $lt: end },
    status: 'approved',
  })
    .populate({
      path: 'classId',
      select: 'code name startTime endTime specialization floorId zoneId',
      populate: [
        { path: 'floorId', select: 'name' },
        { path: 'zoneId', select: 'name' },
      ],
    })
    .populate('originalTrainerId', 'name fullName')
    .lean()

  // Xác định PT gốc còn đang phụ trách lớp hay không (TrainingAssignment active).
  // Nếu PT gốc đã kết thúc phụ trách, card ca thay chỉ render khi lớp còn >= 2 hội viên.
  const relatedClassIds = [...new Set(replacements.map(r => r.classId?._id || r.classId).filter(Boolean))]
  const relatedTrainerIds = [...new Set(replacements.map(r => r.originalTrainerId?._id || r.originalTrainerId).filter(Boolean))]
  const activeAssignments = relatedClassIds.length && relatedTrainerIds.length
    ? await TrainingAssignment.find({
        trainerId: { $in: relatedTrainerIds },
        classId: { $in: relatedClassIds },
        status: 'active',
      }).select('trainerId classId').lean()
    : []
  const activeAssignmentKeys = new Set(activeAssignments.map(a => `${String(a.trainerId)}_${String(a.classId)}`))

  const active = []
  for (const r of replacements) {
    if (timeHasPassed(r.date, r.endTime)) continue // hết hạn → bỏ qua khi query lịch
    const cls = r.classId && typeof r.classId === 'object' ? r.classId : null
    const floor = cls?.floorId && typeof cls.floorId === 'object' ? cls.floorId : null
    const zone = cls?.zoneId && typeof cls.zoneId === 'object' ? cls.zoneId : null
    const original = r.originalTrainerId && typeof r.originalTrainerId === 'object' ? r.originalTrainerId : null
    const originalId = original?._id || r.originalTrainerId
    const classId = cls?._id || r.classId
    const originalTrainerActive = activeAssignmentKeys.has(`${String(originalId)}_${String(classId)}`)
    active.push({
      _id: r._id,
      classId: cls ? { _id: cls._id, code: cls.code || '', name: cls.name || '' } : r.classId,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      originalTrainerId: r.originalTrainerId,
      replacementTrainerId: r.replacementTrainerId,
      status: r.status,
      // Nội dung ca thay — chỉ để render lịch PT B, không đổi dữ liệu lớp gốc
      className: cls?.name || '',
      classCode: cls?.code || '',
      classStartTime: cls?.startTime || '',
      classEndTime: cls?.endTime || '',
      specialization: cls?.specialization || '',
      floorName: floor?.name || '',
      zoneName: zone?.name || '',
      originalTrainerName: original?.fullName || original?.name || '',
      // true: PT gốc còn phụ trách lớp; false: PT gốc đã kết thúc phụ trách
      originalTrainerActive,
    })
  }
  return active
}


