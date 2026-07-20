// DEPRECATED: Training assignments are now handled via TrainingClass.members (embedded enrollment).
// This file is kept as a stub to prevent import errors during transition.
// Please use trainingClassService.js for all new training class operations.

import TrainingAssignment from '../../models/TrainingAssignment.js'

export const createAssignment = async ({ memberId, trainerId, requestId, membershipId, classId, assignedBy }) => {
  // Stub — no longer creates new assignments
  console.warn('[DEPRECATED] trainingAssignmentService.createAssignment called — use trainingClassService.enrollMember instead')
  const existing = await TrainingAssignment.findOne({ memberId, status: 'active' })
  if (existing) return existing
  return null
}

export const findActiveAssignment = async ({ memberId, session }) => {
  return TrainingAssignment.findOne({ memberId, status: 'active' })
    .populate('trainerId', 'name fullName email phone avatar specialties')
    .populate('classId', 'name')
    .session(session || null)
}

export const findTrainerActiveAssignments = async ({ trainerId }) => {
  return TrainingAssignment.find({ trainerId, status: 'active' })
    .populate('memberId', 'name fullName email phone avatar memberCode')
    .populate('classId', 'name')
    .sort({ createdAt: -1 })
}

export const findTrainerAssignmentHistory = async ({ trainerId, page = 1, limit = 20 }) => {
  const filter = { trainerId, status: { $in: ['cancelled', 'completed'] } }
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    TrainingAssignment.find(filter)
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .populate('classId', 'name')
      .sort({ cancelledAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainingAssignment.countDocuments(filter),
  ])
  return {
    items,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

export const cancelAssignment = async ({ memberId, session, reason = 'Gói tập đã kết thúc' }) => {
  const opts = session ? { session } : {}
  await TrainingAssignment.updateMany(
    { memberId, status: 'active' },
    { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason } },
    opts,
  )
}
