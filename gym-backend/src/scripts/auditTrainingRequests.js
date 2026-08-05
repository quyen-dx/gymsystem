import 'dotenv/config'
import mongoose from 'mongoose'

import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingRequest, { ACTIVE_TRAINING_REQUEST_STATUSES } from '../models/TrainingRequest.js'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym'

const stringify = (value) => value == null ? null : String(value)

try {
  await mongoose.connect(uri)
  const now = new Date()
  const requests = await TrainingRequest.find({
    status: { $in: [...ACTIVE_TRAINING_REQUEST_STATUSES, 'assigned', 'class_assigned', 'active', 'completed', 'ended', 'cancelled'] },
  }).lean()

  console.log(JSON.stringify({
    activeStatuses: ACTIVE_TRAINING_REQUEST_STATUSES,
    count: requests.length,
    requests: await Promise.all(requests.map(async (request) => {
      const [membership, cycle, ptAssignments, trainingAssignments] = await Promise.all([
        Membership.findOne({ memberId: request.memberId, status: 'active' }).sort({ createdAt: -1 }).lean(),
        MembershipCycle.findOne({ memberId: request.memberId, status: 'active' }).sort({ createdAt: -1 }).lean(),
        PTAssignment.find({ memberId: request.memberId }).sort({ createdAt: -1 }).select('_id status membershipId workoutId createdAt').lean(),
        TrainingAssignment.find({ memberId: request.memberId }).sort({ createdAt: -1 }).select('_id status membershipId classId createdAt').lean(),
      ])
      const staleReasons = []
      if (!membership) staleReasons.push('no_active_membership')
      if (membership?.endDate && new Date(membership.endDate) < now) staleReasons.push('membership_expired')
      if (!cycle) staleReasons.push('no_active_membership_cycle')
      if (cycle?.expiresAt && new Date(cycle.expiresAt) < now) staleReasons.push('membership_cycle_expired')
      if (request.status === 'assigned' && ptAssignments.every((item) => item.status !== 'active') && trainingAssignments.every((item) => item.status !== 'active')) {
        staleReasons.push('assigned_without_active_assignment')
      }

      return {
        id: stringify(request._id),
        memberId: stringify(request.memberId),
        status: request.status,
        deleted: request.deleted ?? null,
        cancelledAt: request.cancelledAt ?? null,
        completedAt: request.completedAt ?? null,
        membershipId: request.membershipId ? stringify(request.membershipId) : stringify(membership?._id),
        membershipCycleId: request.membershipCycleId ? stringify(request.membershipCycleId) : stringify(cycle?._id),
        assignmentId: request.assignmentId ? stringify(request.assignmentId) : null,
        createdAt: request.createdAt ?? null,
        blockingByCanonicalDefinition: ACTIVE_TRAINING_REQUEST_STATUSES.includes(request.status),
        legacyCreateBlockedByAssigned: request.status === 'assigned',
        activeMembership: membership ? { id: stringify(membership._id), status: membership.status, endDate: membership.endDate ?? null } : null,
        activeMembershipCycle: cycle ? { id: stringify(cycle._id), status: cycle.status, expiresAt: cycle.expiresAt ?? null } : null,
        assignments: { pt: ptAssignments, training: trainingAssignments },
        staleReasons,
      }
    })),
  }, null, 2))
} finally {
  await mongoose.disconnect()
}
