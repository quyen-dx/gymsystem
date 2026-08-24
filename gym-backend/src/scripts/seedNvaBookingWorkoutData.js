import mongoose from 'mongoose'
import dotenv from 'dotenv'

import User from '../models/User.js'
import PT from '../models/PT.js'
import Booking from '../models/Booking.js'
import Workout from '../models/Workout.js'
import Membership from '../models/Membership.js'
import PTAssignment from '../models/PTAssignment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'

dotenv.config()

const PT_NAME = 'PT NVA'
const MEMBER_EMAIL = 'member01@gmail.com'
const BOOKING_MARKER = '[SEED_NVA_BOOKING]'
const WORKOUT_PREFIX = '[SEED_NVA_WORKOUT]'

const localDate = (dateText) => new Date(`${dateText}T00:00:00+07:00`)

const bookingData = [
  { date: '2026-08-19', slot: '07:00-08:00' },
  { date: '2026-08-19', slot: '14:00-15:00' },
  { date: '2026-08-20', slot: '07:00-08:00' },
  { date: '2026-08-20', slot: '18:00-19:00' },
]

const workoutData = [
  {
    name: `${WORKOUT_PREFIX} Tăng cơ toàn thân`,
    goal: 'Tăng cơ và xây dựng nền tảng sức mạnh',
    specializationId: 'GYM',
    description: 'Giáo án kiểm thử do PT NVA tạo cho nhóm mục tiêu tăng cơ.',
    days: [
      { dayOfWeek: 1, muscleGroup: 'Ngực - Vai - Tay sau', description: 'Buổi đẩy', exercises: [{ name: 'Barbell Bench Press', note: '4 hiệp x 8-10 lần' }, { name: 'Shoulder Press', note: '3 hiệp x 10 lần' }] },
      { dayOfWeek: 3, muscleGroup: 'Lưng - Tay trước', description: 'Buổi kéo', exercises: [{ name: 'Lat Pulldown', note: '4 hiệp x 10-12 lần' }, { name: 'Seated Row', note: '3 hiệp x 10 lần' }] },
      { dayOfWeek: 5, muscleGroup: 'Chân - Core', description: 'Buổi chân', exercises: [{ name: 'Goblet Squat', note: '4 hiệp x 10 lần' }, { name: 'Plank', note: '3 hiệp x 45 giây' }] },
    ],
  },
  {
    name: `${WORKOUT_PREFIX} Giảm mỡ 4 tuần`,
    goal: 'Giảm mỡ và cải thiện sức bền',
    specializationId: 'CROSSFIT',
    description: 'Giáo án kiểm thử do PT NVA tạo cho mục tiêu giảm mỡ.',
    days: [
      { dayOfWeek: 2, muscleGroup: 'Cardio', description: 'Cardio cường độ vừa', exercises: [{ name: 'Treadmill Intervals', note: '20 phút' }, { name: 'Mountain Climbers', note: '4 hiệp x 30 giây' }] },
      { dayOfWeek: 4, muscleGroup: 'Toàn thân', description: 'Circuit toàn thân', exercises: [{ name: 'Kettlebell Swing', note: '4 hiệp x 15 lần' }, { name: 'Burpees', note: '4 hiệp x 10 lần' }] },
    ],
  },
  {
    name: `${WORKOUT_PREFIX} Boxing cơ bản`,
    goal: 'Cải thiện kỹ thuật boxing và phản xạ',
    specializationId: 'BOXING',
    description: 'Giáo án kiểm thử boxing cơ bản do PT NVA tạo.',
    days: [
      { dayOfWeek: 1, muscleGroup: 'Kỹ thuật', description: 'Tư thế và di chuyển', exercises: [{ name: 'Boxing Footwork', note: '15 phút' }, { name: 'Jab-Cross Drill', note: '5 hiệp x 2 phút' }] },
      { dayOfWeek: 4, muscleGroup: 'Đấm bao', description: 'Kết hợp đòn', exercises: [{ name: 'Heavy Bag Combination', note: '6 hiệp x 2 phút' }, { name: 'Jump Rope', note: '10 phút' }] },
    ],
  },
  {
    name: `${WORKOUT_PREFIX} Phục hồi và linh hoạt`,
    goal: 'Tăng độ linh hoạt và phục hồi vận động',
    specializationId: 'GYM',
    description: 'Giáo án kiểm thử phục hồi do PT NVA tạo.',
    days: [
      { dayOfWeek: 2, muscleGroup: 'Mobility', description: 'Mở khớp toàn thân', exercises: [{ name: 'Hip Mobility Flow', note: '3 vòng' }, { name: 'Thoracic Rotation', note: '3 hiệp x 10 lần' }] },
      { dayOfWeek: 6, muscleGroup: 'Core', description: 'Core nhẹ', exercises: [{ name: 'Dead Bug', note: '3 hiệp x 12 lần' }, { name: 'Bird Dog', note: '3 hiệp x 10 lần mỗi bên' }] },
    ],
  },
]

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })

  const pt = await User.findOne({ role: 'pt', name: PT_NAME }).lean()
  const member = await User.findOne({ email: MEMBER_EMAIL }).lean()
  if (!pt) throw new Error(`Không tìm thấy ${PT_NAME}`)
  if (!member) throw new Error(`Không tìm thấy hội viên ${MEMBER_EMAIL}`)

  const ptProfile = await PT.findOne({ userId: pt._id }).lean()
  if (!ptProfile) throw new Error(`PT ${PT_NAME} chưa có hồ sơ PT`)

  const existingBookings = await Booking.find({
    ptId: pt._id,
    memberId: member._id,
    note: BOOKING_MARKER,
  }).lean()
  const existingBookingKeys = new Set(existingBookings.map((item) => `${item.date.toISOString().slice(0, 10)}|${item.slot}`))

  const bookingsToCreate = bookingData
    .filter((item) => !existingBookingKeys.has(`${localDate(item.date).toISOString().slice(0, 10)}|${item.slot}`))
    .map((item) => ({
      memberId: member._id,
      ptId: pt._id,
      date: localDate(item.date),
      slot: item.slot,
      note: BOOKING_MARKER,
      trainingType: 'one_to_one',
      priceAtBooking: ptProfile.oneToOnePrice || 0,
      totalAmount: ptProfile.oneToOnePrice || 0,
      paymentStatus: 'unpaid',
      paymentMethod: 'wallet',
      status: 'pending',
    }))

  const createdBookings = bookingsToCreate.length ? await Booking.insertMany(bookingsToCreate) : []

  const existingWorkouts = await Workout.find({ ptId: pt._id, name: { $in: workoutData.map((item) => item.name) } }).select('name').lean()
  const existingWorkoutNames = new Set(existingWorkouts.map((item) => item.name))
  const workoutStart = localDate('2026-08-19')
  const workoutEnd = localDate('2026-09-16')
  const workoutsToCreate = workoutData
    .filter((item) => !existingWorkoutNames.has(item.name))
    .map((item) => ({
      ...item,
      ptId: pt._id,
      duration: 4,
      startDate: workoutStart,
      endDate: workoutEnd,
      isTemplate: true,
      status: 'active',
      templateStatus: 'published',
      visibility: 'private',
      version: 1,
      completionRate: 0,
    }))

  const createdWorkouts = workoutsToCreate.length ? await Workout.create(workoutsToCreate) : []

  const assignedWorkout = createdWorkouts[0]
    || await Workout.findOne({ ptId: pt._id, name: workoutData[0].name })
  const activeMembership = await Membership.findOne({ memberId: member._id, status: 'active' })
    .sort({ createdAt: -1 })
    .lean()
  let assignment = await PTAssignment.findOne({ memberId: member._id, ptId: pt._id, status: 'active' })

  if (!assignment) {
    assignment = await PTAssignment.create({
      memberId: member._id,
      ptId: pt._id,
      membershipId: activeMembership?._id || null,
      status: 'active',
      workoutId: assignedWorkout?._id || null,
      startDate: new Date(),
      workoutNameSnapshot: assignedWorkout?.name || '',
    })
  } else if (assignedWorkout && String(assignment.workoutId || '') !== String(assignedWorkout._id)) {
    assignment.workoutId = assignedWorkout._id
    assignment.workoutNameSnapshot = assignedWorkout.name
    await assignment.save()
  }

  let workoutSchedule = assignedWorkout
    ? await WorkoutSchedule.findOne({
      memberId: member._id,
      templateId: assignedWorkout._id,
      status: 'active',
      deletedAt: null,
    })
    : null

  if (!workoutSchedule && assignedWorkout) {
    workoutSchedule = await WorkoutSchedule.create({
      memberId: member._id,
      templateId: assignedWorkout._id,
      assignedBy: pt._id,
      trainerId: pt._id,
      startDate: localDate('2026-08-19'),
      weekIndex: 1,
      totalWeeks: 1,
      status: 'active',
      sessions: [
        { dayOrder: 1, templateSessionIndex: 1, date: localDate('2026-08-19'), time: '07:00', endTime: '08:00', location: 'Phòng GYM 1', status: 'pending', title: 'Buổi tăng cơ toàn thân 1', muscleGroup: 'Ngực - Vai - Tay sau' },
        { dayOrder: 2, templateSessionIndex: 2, date: localDate('2026-08-19'), time: '14:00', endTime: '15:00', location: 'Phòng GYM 1', status: 'pending', title: 'Buổi tăng cơ toàn thân 2', muscleGroup: 'Lưng - Tay trước' },
        { dayOrder: 3, templateSessionIndex: 3, date: localDate('2026-08-20'), time: '07:00', endTime: '08:00', location: 'Phòng GYM 1', status: 'pending', title: 'Buổi tăng cơ toàn thân 3', muscleGroup: 'Chân - Core' },
        { dayOrder: 4, templateSessionIndex: 1, date: localDate('2026-08-20'), time: '18:00', endTime: '19:00', location: 'Phòng GYM 1', status: 'pending', title: 'Buổi tăng cơ toàn thân 4', muscleGroup: 'Toàn thân' },
      ],
    })
  }

  console.log(JSON.stringify({
    pt: { id: pt._id, name: pt.name },
    member: { id: member._id, email: member.email },
    createdBookings: createdBookings.map((item) => ({ id: item._id, date: item.date, slot: item.slot, status: item.status })),
    createdWorkouts: createdWorkouts.map((item) => ({ id: item._id, name: item.name, totalSessions: item.totalSessions })),
    activeAssignment: assignment ? { id: assignment._id, memberId: assignment.memberId, ptId: assignment.ptId, workoutId: assignment.workoutId, status: assignment.status } : null,
    activeWorkoutSchedule: workoutSchedule ? { id: workoutSchedule._id, templateId: workoutSchedule.templateId, status: workoutSchedule.status, sessionCount: workoutSchedule.sessions.length } : null,
    skippedExistingBookings: existingBookings.length,
    skippedExistingWorkouts: existingWorkouts.length,
  }, null, 2))

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
