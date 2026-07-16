import TrainerSchedule from '../models/TrainerSchedule.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'

const SHIFT_RANGES = {
  morning: { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '22:00' },
}

function toMinutes(time) {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function timesOverlap(start1, end1, start2, end2) {
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1)
}

async function validateNoClassConflict(trainerId, schedules) {
  const classes = await TrainingClass.find({ ptId: trainerId })

  for (const sched of schedules) {
    const startTime = sched.startTime || SHIFT_RANGES[sched.shift]?.start
    const endTime = sched.endTime || SHIFT_RANGES[sched.shift]?.end
    if (!startTime || !endTime) continue

    for (const cls of classes) {
      if (!cls.daysOfWeek.includes(sched.dayOfWeek)) continue
      if (!cls.startTime || !cls.endTime) continue
      if (timesOverlap(startTime, endTime, cls.startTime, cls.endTime)) {
        throw new Error(`PT đã có lịch dạy lớp tập "${cls.name}" trong khung giờ này, không thể đăng ký ca rảnh!`)
      }
    }
  }
}

export const setSchedule = async ({ trainerId, schedules }) => {
  await validateNoClassConflict(trainerId, schedules)

  await TrainerSchedule.deleteMany({ trainerId })
  if (Array.isArray(schedules) && schedules.length > 0) {
    return TrainerSchedule.insertMany(
      schedules.map((s) => ({
        trainerId,
        dayOfWeek: s.dayOfWeek,
        shift: s.shift,
        startTime: s.startTime || '',
        endTime: s.endTime || '',
        status: 'active',
      })),
    )
  }
  return []
}

export const getTrainerSchedule = async (trainerId) => {
  const schedules = await TrainerSchedule.find({ trainerId, status: 'active' })
    .sort({ dayOfWeek: 1 })

  const classes = await TrainingClass.find({ ptId: trainerId })
    .populate('floorId', 'name')
    .populate('zoneId', 'name maxCapacity')
    .sort({ startTime: 1 })
    .lean()

  const classIds = classes.map(c => c._id)
  const assignmentCounts = await TrainingAssignment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const countMap = {}
  for (const a of assignmentCounts) {
    countMap[String(a._id)] = a.count
  }

  const classSchedules = classes.map(c => ({
    ...c,
    currentActiveCount: countMap[String(c._id)] || 0,
    zoneMaxCapacity: c.zoneId?.maxCapacity || 0,
  }))

  return { schedules, classSchedules }
}

export const getAllSchedules = async ({ trainerId, page = 1, limit = 50 }) => {
  const filter = {}
  if (trainerId) filter.trainerId = trainerId
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    TrainerSchedule.find(filter)
      .populate('trainerId', 'name fullName email')
      .sort({ trainerId: 1, dayOfWeek: 1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainerSchedule.countDocuments(filter),
  ])
  return {
    schedules: items,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

export const getAvailableTrainers = async ({ dayOfWeek, shift }) => {
  const filter = { status: 'active' }
  if (dayOfWeek !== undefined) filter.dayOfWeek = dayOfWeek
  if (shift) filter.shift = shift
  return TrainerSchedule.find(filter).populate('trainerId', 'name fullName email avatar specialties').distinct('trainerId')
}
