import TrainingRequest from '../models/TrainingRequest.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Plan from '../models/Plan.js'
import { ensureEnrollment as ensureClassEnrollment } from './classEnrollmentService.js'
import { calculateRemainingDays } from '../utils/dateUtils.js'

export const createRequest = async ({ memberId, data }) => {
  const request = await TrainingRequest.create({
    memberId,
    specialization: data.specialization || 'GYM',
    goals: data.goals || [],
    desiredSessions: data.desiredSessions || 3,
    timeSlots: data.timeSlots || [],
    daysOfWeek: data.daysOfWeek || [],
    healthNotes: data.healthNotes || '',
    isNewToGym: data.isNewToGym || false,
    note: data.note || '',
    status: 'pending',
  })
  return request
}

export const getMyRequests = async ({ memberId, status }) => {
  const filter = { memberId }
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

export const getAllRequests = async ({ status, page = 1, limit = 20 }) => {
  const filter = {}
  if (status) filter.status = status
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    TrainingRequest.find(filter)
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .populate('assignedClassId', 'name trainerId schedule')
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
    // Tạo TrainingAssignment — trainerId = null (chờ PT nhận)
    await TrainingAssignment.create({
      memberId: request.memberId,
      classId,
      requestId: request._id,
      trainerId: null,
      assignedBy: assignedBy || undefined,
      status: 'waiting_pt',
      startDate: new Date(),
    })

    // Authoritative ClassEnrollment (idempotent)
    await ensureClassEnrollment({
      classId,
      memberId: request.memberId,
      sourceReason: 'assigned_by_pt',
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
