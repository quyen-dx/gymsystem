import TrainingRequest from '../models/TrainingRequest.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Plan from '../models/Plan.js'
import { ensureEnrollment as ensureClassEnrollment } from './classEnrollmentService.js'
import { notifyPtMemberChanged } from './notificationService.js'
import { calculateRemainingDays } from '../utils/dateUtils.js'

export const createRequest = async ({ memberId, data }) => {
  const type = data.type || 'group'
  const base = {
    memberId,
    type,
    specialization: data.specialization || 'GYM',
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

export const getMyRequests = async ({ memberId, type, status }) => {
  const filter = { memberId }
  if (type) filter.type = type
  if (status) filter.status = status
  return TrainingRequest.find(filter).sort({ createdAt: -1 })
}

const getMemberMembershipInfo = async (memberId) => {
  // Ưu tiên pending_initial_activation (vừa mua, chưa check-in), fallback sang active
  let cycle = await MembershipCycle.findOne({
    memberId,
    status: 'pending_initial_activation',
  }).populate('currentPlanId', 'nameVi nameEn price durationDays').sort({ createdAt: -1 }).lean()

  let isPending = !!cycle

  if (!cycle) {
    cycle = await MembershipCycle.findOne({
      memberId,
      status: 'active',
    }).populate('currentPlanId', 'nameVi nameEn price durationDays').sort({ createdAt: -1 }).lean()
  }

  if (!cycle) return null

  const plan = cycle.currentPlanId
  const remainingDays = isPending
    ? (cycle.durationDays || 0)
    : calculateRemainingDays(cycle.expiresAt)

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
    isPending,
    hasMembership: true,
    planPrice: plan?.price || 0,
  }
}

export const getAllRequests = async ({ type, status, page = 1, limit = 20 }) => {
  const filter = {}
  if (type) filter.type = type
  if (status) filter.status = status
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

export const getRequestById = async (requestId) => {
  return TrainingRequest.findById(requestId)
    .populate('memberId', 'name fullName email phone avatar memberCode')
    .populate('assignedClassId', 'name trainerId schedule')
    .populate('assignedTrainerId', 'name fullName avatar specialties')
    .populate('preferredTrainerId', 'name fullName avatar')
}

export const assignToClass = async ({ requestId, classId, assignedBy }) => {
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
      .select('fullName name email phone').lean()
    const trainer = await (await import('../models/User.js')).default.findById(trainerId)
      .select('fullName name').lean()
    const memberName = member?.fullName || member?.name || ''
    const trainerName = trainer?.fullName || trainer?.name || ''

    const { createNotification } = await import('./notificationService.js')
    const { NOTIFICATION_TYPES } = await import('../models/Notification.js')

    // Notify PT
    createNotification({
      receiverId: trainerId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.MEMBER_ASSIGNED,
      title: 'Phân công hội viên mới',
      content: `Bạn vừa được phân công hội viên ${memberName}.\nThông tin liên hệ: SĐT ${member?.phone || '—'}, Email ${member?.email || '—'}\nVui lòng chủ động liên hệ hội viên để trao đổi lịch tập.`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/pt/clients',
      createdBy: 'Admin',
    })

    // Notify member
    createNotification({
      receiverId: request.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_ASSIGNED,
      title: 'Đã được phân công PT',
      content: `Bạn đã được phân công PT ${trainerName}.\nPT sẽ chủ động liên hệ với bạn qua SĐT hoặc Email.`,
      relatedId: request._id,
      relatedType: 'TrainingRequest',
      redirectUrl: '/my-membership',
      createdBy: 'System',
    })
  }

  return request
}

export const cancelRequest = async ({ requestId, reason = '' }) => {
  const request = await TrainingRequest.findByIdAndUpdate(
    requestId,
    { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
    { new: true },
  )
  return request
}
