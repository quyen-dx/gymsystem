import TrainingRequest, { ACTIVE_TRAINING_REQUEST_STATUSES } from '../models/TrainingRequest.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import PTAssignment from '../models/PTAssignment.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Plan from '../models/Plan.js'
import { ensureEnrollment as ensureClassEnrollment } from './classEnrollmentService.js'
import { notifyPtMemberChanged } from './notificationService.js'
import { calculateRemainingDays } from '../utils/dateUtils.js'
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

  const base = {
    memberId,
    type,
    specialization: normalizeSpecialization(data.specialization),
    goals: data.goals || [],
    note: data.note || '',
    status: 'pending',
  }
  if (type === 'pt1on1') {
    base.contactPhone = data.contactPhone || ''
    base.contactEmail = data.contactEmail || ''
    base.preferredTrainerId = data.preferredTrainerId || null
    base.healthNotes = data.healthNotes || ''
  } else {
    base.desiredSessions = data.desiredSessions || 3
    base.timeSlots = data.timeSlots || []
    base.daysOfWeek = data.daysOfWeek || []
    base.healthNotes = data.healthNotes || ''
    base.isNewToGym = data.isNewToGym || false
  }
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
    .populate('assignedTrainerId', 'name fullName avatar specialties')
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
      .populate('assignedTrainerId', 'name fullName avatar specialties')
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
    .populate('assignedTrainerId', 'name fullName avatar specialties')
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

  const zone = trainingClass.zoneId
  if (zone?.maxCapacity) {
    const activeCount = await TrainingAssignment.countDocuments({ classId, status: { $in: ['active', 'waiting_pt'] } })
    if (activeCount >= zone.maxCapacity) {
      const err = new Error('Lớp học đã đầy')
      err.statusCode = 400
      throw err
    }
  }

  const requestSpec = normalizeSpecialization(existing.specialization)
  const classSpec = normalizeSpecialization(trainingClass.specialization)
  if (requestSpec !== classSpec) {
    const err = new Error('Lop duoc chon khong khop chuyen mon yeu cau')
    err.statusCode = 400
    throw err
  }

  const existingEnrollment = await Promise.all([
    TrainingAssignment.exists({ memberId: existing.memberId, status: { $in: ['active', 'waiting_pt'] } }),
    ClassEnrollment.exists({ memberId: existing.memberId, status: 'active' }),
    PTAssignment.exists({ memberId: existing.memberId, status: 'active' }),
  ])
  if (existingEnrollment.some(Boolean)) {
    const err = new Error('Hoi vien dang co PT/lop active, khong the xep them')
    err.statusCode = 409
    throw err
  }

  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'assigned',
      assignedClassId: classId,
      assignedAt: new Date(),
      assignedBy: assignedBy || undefined,
    },
    { new: true },
  )

  if (request) {
    const hasActivePt = trainingClass.status === 'active' && trainingClass.ptId
    // Tạo TrainingAssignment — nếu lớp đã có PT active thì gán luôn
    await TrainingAssignment.create({
      memberId: request.memberId,
      classId,
      requestId: request._id,
      trainerId: hasActivePt ? trainingClass.ptId : null,
      assignedBy: assignedBy || undefined,
      status: hasActivePt ? 'active' : 'waiting_pt',
      acceptedAt: hasActivePt ? new Date() : null,
      startDate: new Date(),
    })

    // Authoritative ClassEnrollment (idempotent)
    await ensureClassEnrollment({
      classId,
      memberId: request.memberId,
      sourceReason: 'assigned_by_pt',
    })

    // Notify PT nếu lớp đã có PT active
    const member = await (await import('../models/User.js')).default.findById(request.memberId).select('fullName name').lean()
    const memberName = member?.fullName || member?.name || ''
    notifyPtMemberChanged({
      action: 'joined',
      memberName,
      className: trainingClass.name || '',
      classId,
      ptId: trainingClass.ptId || null,
    })
  }

  return request
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
    const err = new Error('Hoi vien da co PT 1-1 dang hoat dong')
    err.statusCode = 409
    throw err
  }

  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      status: 'assigned',
      assignedTrainerId: trainerId,
      assignedAt: new Date(),
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

// Admin rút lại phân công khi PT từ chối nhận hội viên → đưa yêu cầu về trạng thái chờ phân công lại
export const unassignTrainer = async ({ requestId, rejectedPtId }) => {
  return TrainingRequest.findByIdAndUpdate(
    requestId,
    {
      $set: { status: 'waiting_assignment', assignedTrainerId: null, assignedAt: null },
      ...(rejectedPtId ? { $addToSet: { rejectedPtIds: rejectedPtId } } : {}),
    },
    { new: true },
  )
}

export const cancelRequest = async ({ requestId, reason = '' }) => {
  const requestBeforeCancel = await TrainingRequest.findById(requestId).select('_id status').lean()
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
  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
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
