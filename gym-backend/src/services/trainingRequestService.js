import TrainingRequest from '../models/TrainingRequest.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'

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
  return {
    requests: items,
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
    const activeCount = await TrainingAssignment.countDocuments({ classId, status: 'active' })
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
    await TrainingAssignment.create({
      memberId: request.memberId,
      classId,
      requestId: request._id,
      trainerId: trainingClass.ptId || undefined,
      assignedBy: assignedBy || undefined,
      status: 'active',
      startDate: new Date(),
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
