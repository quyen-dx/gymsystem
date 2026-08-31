import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Floor from '../models/Floor.js'
import Zone from '../models/Zone.js'
import TrainingClass from '../models/TrainingClass.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import { ensureEnrollment } from '../services/classEnrollmentService.js'

const EMAILS = ['class.capacity.member1@example.com', 'class.capacity.member2@example.com']
const FLOOR_NAME = 'AUTOTEST_CAPACITY_FLOOR'
const ZONE_NAME = 'AUTOTEST_CAPACITY_ZONE'
const CLASS_CODE = 'AUTOTEST_CAPACITY_CLASS'
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

await mongoose.connect(process.env.MONGO_URI)
try {
  const oldClass = await TrainingClass.findOne({ code: CLASS_CODE }).lean()
  if (oldClass) await ClassEnrollment.deleteMany({ classId: oldClass._id })
  await TrainingClass.deleteMany({ code: CLASS_CODE })
  for (const email of EMAILS) {
    const user = await User.findOne({ email })
    if (user) { await ClassEnrollment.deleteMany({ memberId: user._id }); await User.deleteOne({ _id: user._id }) }
  }
  const oldFloor = await Floor.findOne({ name: FLOOR_NAME }).lean()
  if (oldFloor) await Zone.deleteMany({ floorId: oldFloor._id })
  await Floor.deleteMany({ name: FLOOR_NAME })

  const password = await bcrypt.hash('Test@1234', 10)
  const base = Date.now()
  const [member1, member2] = await User.create([
    { email: EMAILS[0], name: 'class.capacity.member1', role: 'member', provider: 'email', password, memberNumber: base + 1 },
    { email: EMAILS[1], name: 'class.capacity.member2', role: 'member', provider: 'email', password, memberNumber: base + 2 },
  ])
  const floor = await Floor.create({ name: FLOOR_NAME, order: 9999, status: 'active' })
  const zone = await Zone.create({ name: ZONE_NAME, floorId: floor._id, maxCapacity: 1, status: 'active' })
  const trainingClass = await TrainingClass.create({ code: CLASS_CODE, name: 'AUTOTEST Capacity 1', zoneId: zone._id, status: 'active' })

  console.log('CASE: hai hội viên đăng ký đồng thời vào lớp chỉ có 1 chỗ')
  const results = await Promise.allSettled([
    ensureEnrollment({ classId: trainingClass._id, memberId: member1._id }),
    ensureEnrollment({ classId: trainingClass._id, memberId: member2._id }),
  ])
  const fulfilled = results.filter((result) => result.status === 'fulfilled')
  const rejected = results.filter((result) => result.status === 'rejected')
  const activeCount = await ClassEnrollment.countDocuments({ classId: trainingClass._id, status: 'active' })
  check(fulfilled.length === 1 && rejected.length === 1, 'chỉ một yêu cầu đồng thời được chấp nhận')
  check(activeCount === 1, 'số hội viên active không vượt sức chứa 1')

  const winner = fulfilled[0].value.enrollment.memberId
  const retry = await ensureEnrollment({ classId: trainingClass._id, memberId: winner })
  check(retry.created === false, 'gọi lại cùng hội viên là idempotent, không tạo bản ghi thứ hai')
  check(await ClassEnrollment.countDocuments({ classId: trainingClass._id, status: 'active' }) === 1, 'retry không làm thay đổi sức chứa')
  console.log('CLASS CAPACITY INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
