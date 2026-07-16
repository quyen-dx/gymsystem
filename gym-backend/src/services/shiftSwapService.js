import ShiftSwapRequest from '../models/ShiftSwapRequest.js'
import ShiftSwapItem from '../models/ShiftSwapItem.js'
import ScheduleOverride from '../models/ScheduleOverride.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingRequest from '../models/TrainingRequest.js'
import Notification from '../models/Notification.js'
import { emitShiftSwapNotification } from './socketService.js'

const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/**
 * Create a shift swap request with snapshots of affected sessions.
 */
export const createSwapRequest = async ({ ptId, targetDate, reason, classIds }) => {
  const d = new Date(targetDate)
  d.setHours(0, 0, 0, 0)
  const nextDay = new Date(d)
  nextDay.setDate(nextDay.getDate() + 1)

  // Check for existing pending/approved request on same date for this PT
  const existing = await ShiftSwapRequest.findOne({
    requestingPtId: ptId,
    targetDate: { $gte: d, $lt: nextDay },
    status: { $in: ['cho_duyet', 'da_duyet'] },
  })
  if (existing) {
    throw new Error('Bạn đã có yêu cầu thay ca cho ngày này rồi')
  }

  // Find affected workout schedules and their sessions on the target date
  const schedules = await WorkoutSchedule.find({
    assignedBy: ptId,
    status: 'active',
  }).populate('templateId').sort({ createdAt: -1 })

  const items = []
  for (const s of schedules) {
    for (let i = 0; i < (s.sessions || []).length; i++) {
      const session = s.sessions[i]
      const sessionDate = new Date(session.date)
      sessionDate.setHours(0, 0, 0, 0)
      if (sessionDate.getTime() !== d.getTime()) continue

      // Get member training preferences as snapshot
      let specialization = '', goals = [], healthNotes = ''
      const pref = await TrainingRequest.findOne({
        memberId: s.memberId,
        status: { $in: ['assigned', 'pending'] },
      }).sort({ createdAt: -1 }).select('specialization goals healthNotes').lean()
      if (pref) {
        specialization = pref.specialization || ''
        goals = pref.goals || []
        healthNotes = pref.healthNotes || ''
      }

      // Try to find matching class for session
      let classId = null, className = session.className || '', classCode = session.classCode || ''
      const sessionDow = sessionDate.getDay()
      const matchedClass = await TrainingClass.findOne({
        ptId, daysOfWeek: sessionDow, startTime: session.time,
      }).select('name code').lean()
      if (matchedClass) {
        classId = String(matchedClass._id)
        if (!className) className = matchedClass.name
        if (!classCode) classCode = matchedClass.code
      }

      // Filter by classIds if provided
      if (classIds?.length && classId && !classIds.map(String).includes(classId)) continue
      if (classIds?.length && !classId) continue

      // Count sessions AFTER this one in the same schedule on the same date
      // to compute sessionIndex correctly (the position within the schedule's sessions array)
      items.push({
        workoutScheduleId: s._id,
        sessionIndex: i,
        memberId: s.memberId,
        classId, className, classCode,
        sessionTime: session.time || '',
        sessionTitle: session.title || session.muscleGroup || '',
        specialization,
        goals,
        healthNotes,
      })
    }
  }

  if (items.length === 0) {
    throw new Error('Không có buổi tập nào trong ngày đã chọn')
  }

  const request = await ShiftSwapRequest.create({
    requestingPtId: ptId,
    targetDate: d,
    reason: reason || '',
    status: 'cho_duyet',
  })

  await ShiftSwapItem.insertMany(
    items.map(i => ({ ...i, swapRequestId: request._id }))
  )

  return request
}

/**
 * Get all swap requests (admin view), with pagination.
 */
export const getAllSwapRequests = async ({ page = 1, limit = 20, status } = {}) => {
  const filter = {}
  if (status) filter.status = status

  const [docs, total] = await Promise.all([
    ShiftSwapRequest.find(filter)
      .populate('requestingPtId', 'name fullName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ShiftSwapRequest.countDocuments(filter),
  ])

  return { docs, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) }
}

/**
 * Get a single swap request with all its items and available substitute PTs.
 */
export const getSwapRequestDetail = async (id) => {
  const request = await ShiftSwapRequest.findById(id)
    .populate('requestingPtId', 'name fullName email')
    .lean()
  if (!request) throw new Error('Không tìm thấy yêu cầu')

  const items = await ShiftSwapItem.find({ swapRequestId: id })
    .populate('memberId', 'name fullName')  
    .lean()

  return { request, items }
}

/**
 * Get available substitute PTs for a swap request.
 * Criteria: same specialization, no conflicting class OR schedule on target date.
 */
export const getAvailableSubstitutePTs = async ({ swapRequestId }) => {
  const req = await ShiftSwapRequest.findById(swapRequestId).lean()
  if (!req) throw new Error('Không tìm thấy yêu cầu')

  const items = await ShiftSwapItem.find({ swapRequestId }).lean()
  if (!items.length) return []

  const targetDow = new Date(req.targetDate).getDay()
  const d = new Date(req.targetDate)
  d.setHours(0, 0, 0, 0)
  const nextDay = new Date(d)
  nextDay.setDate(nextDay.getDate() + 1)

  const specs = [...new Set(items.map(i => i.specialization).filter(Boolean))]
  const itemTimes = [...new Set(items.map(i => i.sessionTime).filter(Boolean))]

  const User = (await import('../models/User.js')).default
  const allPTs = await User.find({
    role: 'pt',
    status: 'active',
    _id: { $ne: req.requestingPtId },
  }).select('name fullName email specialties status').lean()

  console.log(`[ShiftSwap] Total PTs found: ${allPTs.length}, specs: ${specs}, times: ${itemTimes}`)

  const available = []

  for (const pt of allPTs) {
    const ptName = pt.fullName || pt.name || pt.email
    // Normalize specialties to array
    const ptSpecs = Array.isArray(pt.specialties)
      ? pt.specialties.filter(Boolean)
      : (pt.specialties ? [pt.specialties] : [])

    console.log(`[ShiftSwap] Check ${ptName} specs=${JSON.stringify(ptSpecs)}`)

    // Enforce specialization filter
    if (specs.length > 0) {
      const hasMatch = specs.some(s =>
        ptSpecs.length === 0 || ptSpecs.some(ps =>
          (ps || '').toLowerCase().includes(s.toLowerCase())
          || s.toLowerCase().includes((ps || '').toLowerCase())
        )
      )
      console.log(`[ShiftSwap]   spec match: ${hasMatch}, specs=${specs}, ptSpecs=${JSON.stringify(ptSpecs)}`)
      if (!hasMatch) { console.log(`[ShiftSwap]   -> REJECTED (no spec match)`); continue }
    }

    // Time conflict: TrainingClass on same dayOfWeek with overlapping time
    const classes = await TrainingClass.find({ ptId: pt._id, daysOfWeek: targetDow }).lean()
    let conflicting = false
    for (const cls of classes) {
      if (!cls.startTime || !cls.endTime) continue
      for (const t of itemTimes) {
        if (t >= cls.startTime && t < cls.endTime) { conflicting = true; break }
      }
      if (conflicting) break
    }
    if (conflicting) { console.log(`[ShiftSwap]   -> REJECTED (TrainingClass conflict for ${ptName})`); continue }
    console.log(`[ShiftSwap]   TrainingClass check OK for ${ptName}`)

    // Time conflict: WorkoutSchedule assigned to this PT on target date
    const assignedSchedules = await WorkoutSchedule.find({
      assignedBy: pt._id,
      status: 'active',
    }).lean()
    let scheduleConflict = false
    for (const s of assignedSchedules) {
      for (const session of s.sessions || []) {
        if (!session.date) continue
        const sessionDate = new Date(session.date)
        sessionDate.setHours(0, 0, 0, 0)
        if (sessionDate.getTime() !== d.getTime()) continue
        for (const t of itemTimes) {
          if (session.time && session.time === t) { scheduleConflict = true; break }
        }
        if (scheduleConflict) break
      }
      if (scheduleConflict) break
    }
    if (scheduleConflict) { console.log(`[ShiftSwap]   -> REJECTED (WorkoutSchedule conflict for ${ptName})`); continue }
    console.log(`[ShiftSwap]   -> ACCEPTED ${ptName}`)

    available.push({
      _id: pt._id,
      name: pt.fullName || pt.name,
      email: pt.email,
      specialties: ptSpecs,
    })
  }

  console.log(`[ShiftSwap] Available: ${available.map(p => p.name).join(', ')}`)
  return available
}

/**
 * Approve a swap request with per-item PT assignments and create schedule overrides.
 * @param {object} params
 * @param {string} params.id - swap request ID
 * @param {string} params.approvedBy - admin user ID
 * @param {Array<{ swapItemId: string, ptId: string }>} params.assignments
 */
export const approveSwapRequest = async ({ id, approvedBy, assignments }) => {
  const request = await ShiftSwapRequest.findById(id)
  if (!request) throw new Error('Không tìm thấy yêu cầu')
  if (request.status !== 'cho_duyet') throw new Error('Yêu cầu này đã được xử lý')

  const items = await ShiftSwapItem.find({ swapRequestId: id }).lean()
  const itemMap = new Map(items.map(i => [String(i._id), i]))

  const overrides = []
  const errors = []

  for (const { swapItemId, ptId } of assignments) {
    const item = itemMap.get(swapItemId)
    if (!item) {
      errors.push(`Không tìm thấy buổi tập ${swapItemId}`)
      continue
    }
    if (!ptId) {
      errors.push(`Chưa chọn PT thay thế cho ${item.sessionTitle || 'buổi tập'}`)
      continue
    }

    overrides.push({
      swapRequestId: id,
      swapItemId: item._id,
      workoutScheduleId: item.workoutScheduleId,
      sessionIndex: item.sessionIndex,
      originalPtId: request.requestingPtId,
      overridePtId: ptId,
      overrideLocation: '', // keep same location by default
      effectiveDate: request.targetDate,
    })
  }

  if (errors.length) throw new Error(errors.join('; '))
  if (!overrides.length) throw new Error('Không có buổi tập nào được gán PT thay thế')

  await ScheduleOverride.insertMany(overrides)

  request.status = 'da_duyet'
  request.approvedBy = approvedBy
  request.approvedAt = new Date()
  await request.save()

  // Create notifications
  const User = (await import('../models/User.js')).default
  const requestingPt = await User.findById(request.requestingPtId).select('name fullName').lean()
  const targetDateStr = new Date(request.targetDate).toLocaleDateString('vi-VN')
  const dayOfWeek = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][new Date(request.targetDate).getDay()]

  // Nhóm các override theo PT thay thế để tạo thông báo chi tiết
  const ptOverrideMap = {}
  for (const o of overrides) {
    const ptId = String(o.overridePtId)
    if (!ptOverrideMap[ptId]) ptOverrideMap[ptId] = { count: 0, items: [] }
    ptOverrideMap[ptId].count++
    ptOverrideMap[ptId].items.push(o)
  }

  // Thông báo cho từng PT thay thế
  for (const [ptId, info] of Object.entries(ptOverrideMap)) {
    const notif = await Notification.create({
      userId: ptId,
      title: 'Lịch dạy thay mới',
      content: `Bạn được xếp dạy thay ${requestingPt?.fullName || requestingPt?.name || 'PT'} vào ${dayOfWeek}, ngày ${targetDateStr}. Số buổi: ${info.count}.`,
    })
    emitShiftSwapNotification({ userId: ptId, notification: notif })
  }

  // Thông báo cho PT yêu cầu (PT A) - biết yêu cầu đã được duyệt
  const replacePts = await User.find({ _id: { $in: Object.keys(ptOverrideMap) } }).select('name fullName').lean()
  const replacePtNames = replacePts.map(p => p.fullName || p.name).filter(Boolean).join(', ')
  const notifRequestor = await Notification.create({
    userId: request.requestingPtId,
    title: 'Yêu cầu đổi ca đã được duyệt',
    content: `Yêu cầu đổi ca của bạn vào ${dayOfWeek}, ngày ${targetDateStr} đã được admin duyệt. PT ${replacePtNames || 'khác'} sẽ dạy thay bạn.`,
  })
  emitShiftSwapNotification({ userId: request.requestingPtId, notification: notifRequestor })

  return { request: await ShiftSwapRequest.findById(id).lean(), overrides }
}

/**
 * Reject a swap request.
 */
export const rejectSwapRequest = async ({ id, approvedBy, reason }) => {
  const request = await ShiftSwapRequest.findById(id)
  if (!request) throw new Error('Không tìm thấy yêu cầu')
  if (request.status !== 'cho_duyet') throw new Error('Yêu cầu này đã được xử lý')

  request.status = 'tu_choi'
  request.approvedBy = approvedBy
  request.approvedAt = new Date()
  request.rejectReason = reason || ''
  await request.save()

  // Thông báo cho PT yêu cầu biết yêu cầu bị từ chối
  const targetDateStr = new Date(request.targetDate).toLocaleDateString('vi-VN')
  const notif = await Notification.create({
    userId: request.requestingPtId,
    title: 'Yêu cầu đổi ca bị từ chối',
    content: `Yêu cầu đổi ca ngày ${targetDateStr} của bạn đã bị từ chối. ${reason ? `Lý do: ${reason}` : 'Vui lòng liên hệ admin để biết thêm chi tiết.'}`,
  })
  emitShiftSwapNotification({ userId: request.requestingPtId, notification: notif })

  return request
}

/**
 * Get PT's own swap requests.
 */
export const getMySwapRequests = async ({ ptId, status }) => {
  const filter = { requestingPtId: ptId }
  if (status) filter.status = status

  return ShiftSwapRequest.find(filter)
    .sort({ createdAt: -1 })
    .lean()
}

/**
 * Apply schedule overrides to a list of schedules for a member view.
 * Returns the schedules with overrides applied for the matching sessions.
 */
export const applyOverridesToSchedules = async (schedules) => {
  if (!schedules.length) return schedules

  const scheduleIds = schedules.map(s => s._id)
  const overrides = await ScheduleOverride.find({
    workoutScheduleId: { $in: scheduleIds },
  }).populate('overridePtId', 'name fullName email').lean()

  const overrideMap = new Map()
  for (const o of overrides) {
    const key = `${o.workoutScheduleId}_${o.sessionIndex}_${new Date(o.effectiveDate).toISOString().slice(0, 10)}`
    overrideMap.set(key, o)
  }

  for (const schedule of schedules) {
    for (let i = 0; i < (schedule.sessions || []).length; i++) {
      const session = schedule.sessions[i]
      if (!session.date) continue
      const sessionDate = new Date(session.date).toISOString().slice(0, 10)
      const key = `${schedule._id}_${i}_${sessionDate}`
      const override = overrideMap.get(key)
      if (override) {
        session._overridePtId = override.overridePtId
        session._overrideLocation = override.overrideLocation || undefined
        session._isSwapOverride = true
      }
    }
  }

  return schedules
}
