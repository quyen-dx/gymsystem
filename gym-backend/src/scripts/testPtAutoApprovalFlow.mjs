import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainerSchedule from '../models/TrainerSchedule.js'
import TrainingRequest from '../models/TrainingRequest.js'
import Booking from '../models/Booking.js'
import Notification from '../models/Notification.js'
import UserActivity from '../models/UserActivity.js'
import { createRequest as createRequestController } from '../controllers/trainingRequestController.js'

const EMAILS = ['pt.auto.member1@example.com', 'pt.auto.member2@example.com', 'pt.auto.trainer@example.com']
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

const removeUserData = async (user) => {
  if (!user) return
  const userId = user._id
  await Promise.all([
    Booking.deleteMany({ $or: [{ memberId: userId }, { ptId: userId }] }),
    TrainingRequest.deleteMany({ $or: [{ memberId: userId }, { preferredTrainerId: userId }, { assignedTrainerId: userId }] }),
    PTAssignment.deleteMany({ $or: [{ memberId: userId }, { ptId: userId }] }),
    TrainerSchedule.deleteMany({ trainerId: userId }),
    MembershipPeriod.deleteMany({ memberId: userId }), MembershipCycle.deleteMany({ memberId: userId }), Membership.deleteMany({ memberId: userId }),
    Notification.deleteMany({ receiverId: userId }), UserActivity.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

const createMemberWithPrivatePlan = async ({ email, plan }) => {
  const password = await bcrypt.hash('Test@1234', 10)
  const member = await User.create({ email, name: email.split('@')[0], role: 'member', provider: 'email', password, identityStatus: 'approved' })
  const now = new Date()
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const membership = await Membership.create({ memberId: member._id, planId: plan._id, status: 'active', source: 'manual' })
  await MembershipCycle.create({ memberId: member._id, currentMembershipId: membership._id, currentPlanId: plan._id, startDate: now, endDate, activatedAt: now, expiresAt: endDate, durationDays: 30, status: 'active' })
  await MembershipPeriod.create({ membershipId: membership._id, planId: plan._id, memberId: member._id, startDate: now, endDate, totalDays: 30, price: plan.price, status: 'ACTIVE', activatedAt: now })
  return member
}

const invokeCreateRequest = async ({ member, preferredTrainerId, day, slot }) => {
  const req = {
    user: { _id: member._id, role: 'member', name: member.name, email: member.email },
    body: {
      type: 'pt1on1', specialization: 'GYM', preferredTrainerId, weeks: 1,
      daySlots: [{ day, slot }], contactEmail: member.email,
    },
    headers: {}, ip: '127.0.0.1', method: 'POST', originalUrl: '/api/training-requests',
  }
  const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await createRequestController(req, res)
  return res
}

await mongoose.connect(process.env.MONGO_URI)
try {
  for (const email of EMAILS) await removeUserData(await User.findOne({ email }))
  const privateFeature = await PlanFeature.findOne({ code: 'BOOK_PT_PRIVATE' }).lean()
  if (!privateFeature) throw new Error('Thiếu feature BOOK_PT_PRIVATE để kiểm thử PT 1-1')
  const plan = await Plan.findOne({ isActive: { $ne: false }, featureIds: privateFeature._id }).lean()
  if (!plan) throw new Error('Không có gói tập active hỗ trợ BOOK_PT_PRIVATE')

  const password = await bcrypt.hash('Test@1234', 10)
  const trainer = await User.create({
    email: EMAILS[2], name: 'pt.auto.trainer', fullName: 'PT Auto Test', role: 'pt', provider: 'email', password,
    specialties: ['GYM'], isActive: true, status: 'active', availabilityStatus: 'ACTIVE',
  })
  const target = new Date()
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 1)
  const day = target.getDay()
  const slot = '06:00-08:00'
  await TrainerSchedule.create({ trainerId: trainer._id, dayOfWeek: day, shift: 'morning', startTime: '06:00', endTime: '12:00', status: 'active' })

  console.log('CASE 1: PT cụ thể còn lịch -> tự duyệt')
  const firstMember = await createMemberWithPrivatePlan({ email: EMAILS[0], plan })
  const first = await invokeCreateRequest({ member: firstMember, preferredTrainerId: trainer._id, day, slot })
  const firstRequest = await TrainingRequest.findOne({ memberId: firstMember._id }).lean()
  const firstBooking = await Booking.findOne({ memberId: firstMember._id }).lean()
  const firstAssignment = await PTAssignment.findOne({ memberId: firstMember._id, ptId: trainer._id, status: 'active' }).lean()
  check(first.statusCode === 201 && first.body?.autoApproved === true, 'API tự xác nhận yêu cầu chọn PT cụ thể còn lịch')
  check(firstRequest?.status === 'confirmed', 'yêu cầu PT được xác nhận')
  check(firstBooking?.status === 'confirmed' && firstBooking?.paymentStatus === 'not_required', 'tạo lịch PT xác nhận, không phát sinh thanh toán')
  check(Boolean(firstAssignment), 'tạo đúng phân công PT cho hội viên')

  console.log('CASE 2: PT cụ thể trùng lịch -> chờ Admin')
  const secondMember = await createMemberWithPrivatePlan({ email: EMAILS[1], plan })
  const second = await invokeCreateRequest({ member: secondMember, preferredTrainerId: trainer._id, day, slot })
  const secondRequest = await TrainingRequest.findOne({ memberId: secondMember._id }).lean()
  const secondBookingCount = await Booking.countDocuments({ memberId: secondMember._id })
  const secondAssignment = await PTAssignment.findOne({ memberId: secondMember._id, status: 'active' }).lean()
  check(second.statusCode === 201 && second.body?.autoApproved === false, 'trùng lịch không tự duyệt')
  check(secondRequest?.status === 'pending', 'yêu cầu trùng lịch được giữ chờ Admin')
  check(secondBookingCount === 0 && !secondAssignment, 'không tạo booking/phân công sai khi PT trùng lịch')

  console.log('PT AUTO-APPROVAL INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
