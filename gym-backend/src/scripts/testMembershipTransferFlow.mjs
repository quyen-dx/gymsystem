import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipTransferRequest from '../models/MembershipTransferRequest.js'
import Booking from '../models/Booking.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingRequest from '../models/TrainingRequest.js'
import Notification from '../models/Notification.js'
import UserActivity from '../models/UserActivity.js'
import { createMembershipTransferRequest, respondToMembershipTransferRequest, approveMembershipTransferRequest } from '../services/membershipTransferService.js'

const EMAILS = ['transfer.sender.test@example.com', 'transfer.recipient.test@example.com', 'transfer.pt.test@example.com', 'transfer.admin.test@example.com']
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

const removeUserData = async (user) => {
  if (!user) return
  const userId = user._id
  await Promise.all([
    MembershipTransferRequest.deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }, { reviewedBy: userId }] }),
    Booking.deleteMany({ $or: [{ memberId: userId }, { ptId: userId }] }), PTAssignment.deleteMany({ $or: [{ memberId: userId }, { ptId: userId }] }),
    TrainingRequest.deleteMany({ $or: [{ memberId: userId }, { assignedTrainerId: userId }, { preferredTrainerId: userId }] }),
    MembershipPeriod.deleteMany({ memberId: userId }), MembershipCycle.deleteMany({ memberId: userId }), Membership.deleteMany({ memberId: userId }),
    Notification.deleteMany({ receiverId: userId }), UserActivity.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

await mongoose.connect(process.env.MONGO_URI)
try {
  for (const email of EMAILS) await removeUserData(await User.findOne({ email }))
  const password = await bcrypt.hash('Test@1234', 10)
  const memberNumberBase = Date.now()
  const [sender, recipient, trainer, admin] = await User.create([
    { email: EMAILS[0], name: 'transfer.sender.test', role: 'member', provider: 'email', password, identityStatus: 'approved', memberNumber: memberNumberBase + 1 },
    { email: EMAILS[1], name: 'transfer.recipient.test', role: 'member', provider: 'email', password, identityStatus: 'approved', memberNumber: memberNumberBase + 2 },
    { email: EMAILS[2], name: 'transfer.pt.test', role: 'pt', provider: 'email', password, isActive: true, memberNumber: memberNumberBase + 3 },
    { email: EMAILS[3], name: 'transfer.admin.test', role: 'admin', provider: 'email', password, isActive: true, memberNumber: memberNumberBase + 4 },
  ])
  const plan = await Plan.findOne({ isActive: { $ne: false } }).sort({ price: 1 }).lean()
  if (!plan) throw new Error('Không có gói tập để kiểm thử chuyển nhượng')
  const now = new Date(); const endDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000)
  const sourceMembership = await Membership.create({ memberId: sender._id, planId: plan._id, status: 'active', source: 'manual' })
  const sourceCycle = await MembershipCycle.create({ memberId: sender._id, currentMembershipId: sourceMembership._id, currentPlanId: plan._id, startDate: now, endDate, activatedAt: now, expiresAt: endDate, durationDays: 20, status: 'active' })
  await MembershipPeriod.create({ membershipId: sourceMembership._id, planId: plan._id, memberId: sender._id, startDate: now, endDate, totalDays: 20, price: plan.price, status: 'ACTIVE', activatedAt: now })
  const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  await Booking.create({ memberId: sender._id, ptId: trainer._id, date: future, slot: '10:00-12:00', trainingType: 'one_to_one', status: 'confirmed', paymentStatus: 'not_required' })
  await PTAssignment.create({ memberId: sender._id, ptId: trainer._id, membershipId: sourceMembership._id, status: 'active' })
  await TrainingRequest.create({ memberId: sender._id, type: 'pt1on1', specialization: 'GYM', status: 'pending', daySlots: [{ day: future.getDay(), slot: '10:00-12:00' }] })

  console.log('CASE: A gửi -> B xác nhận -> Admin duyệt')
  const request = await createMembershipTransferRequest({ senderId: sender._id, recipientLookup: recipient.email, note: 'Kiểm thử chuyển nhượng' })
  const lockedCycle = await MembershipCycle.findById(sourceCycle._id).lean()
  check(request.status === 'PENDING_RECIPIENT' && lockedCycle.transferPending === true, 'tạo yêu cầu và khóa gói nguồn trong lúc chờ')
  await respondToMembershipTransferRequest({ recipientId: recipient._id, requestId: request._id, accept: true })
  const reviewed = await approveMembershipTransferRequest({ requestId: request._id, staffId: admin._id })

  const [sourceAfter, targetCycle, targetMembership, bookingAfter, assignmentAfter, trainingRequestAfter, requestAfter] = await Promise.all([
    MembershipCycle.findById(sourceCycle._id).lean(), MembershipCycle.findOne({ memberId: recipient._id, status: 'active' }).lean(),
    Membership.findOne({ memberId: recipient._id, status: 'active' }).lean(), Booking.findOne({ memberId: sender._id }).lean(),
    PTAssignment.findOne({ memberId: sender._id }).lean(), TrainingRequest.findOne({ memberId: sender._id }).lean(), MembershipTransferRequest.findById(request._id).lean(),
  ])
  check(reviewed.status === 'COMPLETED' && requestAfter.status === 'COMPLETED', 'Admin duyệt hoàn tất yêu cầu')
  check(sourceAfter.status === 'cancelled' && sourceAfter.transferPending === false, 'khóa MembershipCycle nguồn và gỡ cờ chờ chuyển nhượng')
  check(Boolean(targetMembership) && Boolean(targetCycle) && String(targetCycle.currentPlanId) === String(plan._id), 'tạo Membership/Cycle active cho người nhận')
  check(new Date(targetCycle.expiresAt).getTime() === endDate.getTime(), 'người nhận giữ đúng hạn dùng còn lại')
  check(bookingAfter.status === 'cancelled', 'hủy booking tương lai của người chuyển')
  check(assignmentAfter.status === 'cancelled', 'kết thúc đúng phân công PT của người chuyển')
  check(trainingRequestAfter.status === 'cancelled', 'đóng yêu cầu PT còn đang xử lý của người chuyển')
  console.log('MEMBERSHIP TRANSFER INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
