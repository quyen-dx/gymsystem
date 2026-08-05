import 'dotenv/config'
import mongoose from 'mongoose'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingRequest, { ACTIVE_TRAINING_REQUEST_STATUSES } from '../models/TrainingRequest.js'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym'
try {
  await mongoose.connect(uri)
  const requests = await TrainingRequest.find({}).select('_id memberId status deleted cancelledAt completedAt membershipId membershipCycleId assignmentId createdAt').sort({ createdAt: 1 }).lean()
  const counts = requests.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
  const stale = []
  for (const r of requests.filter((item) => ['assigned', ...ACTIVE_TRAINING_REQUEST_STATUSES].includes(item.status))) {
    const [membership, cycle, pt, training] = await Promise.all([
      Membership.findOne({ memberId: r.memberId, status: 'active' }).select('_id endDate').lean(),
      MembershipCycle.findOne({ memberId: r.memberId, status: 'active' }).select('_id expiresAt').lean(),
      PTAssignment.exists({ memberId: r.memberId, status: 'active' }),
      TrainingAssignment.exists({ memberId: r.memberId, status: 'active' }),
    ])
    const reasons = []
    if (!membership) reasons.push('no_active_membership')
    if (membership?.endDate && new Date(membership.endDate) < new Date()) reasons.push('membership_expired')
    if (!cycle) reasons.push('no_active_membership_cycle')
    if (cycle?.expiresAt && new Date(cycle.expiresAt) < new Date()) reasons.push('membership_cycle_expired')
    if (r.status === 'assigned' && !pt && !training) reasons.push('assigned_without_active_assignment')
    if (reasons.length) stale.push({
      id: String(r._id), memberId: String(r.memberId), status: r.status,
      deleted: r.deleted ?? null, cancelledAt: r.cancelledAt ?? null, completedAt: r.completedAt ?? null,
      membershipId: r.membershipId ? String(r.membershipId) : membership ? String(membership._id) : null,
      membershipCycleId: r.membershipCycleId ? String(r.membershipCycleId) : cycle ? String(cycle._id) : null,
      assignmentId: r.assignmentId ? String(r.assignmentId) : null, createdAt: r.createdAt, reasons,
    })
  }
  console.log(JSON.stringify({ activeStatuses: ACTIVE_TRAINING_REQUEST_STATUSES, total: requests.length, counts, stale }, null, 2))
} finally {
  await mongoose.disconnect()
}
