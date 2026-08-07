import TrainerSchedule from '../models/TrainerSchedule.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import Booking from '../models/Booking.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'

const SHIFT_RANGES = {
  morning: { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '22:00' },
}

const ACTIVE_BOOKING_STATUSES = ['pending', 'awaiting_payment', 'confirmed']
const ACTIVE_ASSIGNMENT_STATUSES = ['active', 'waiting_pt']
const ACTIVE_WORKOUT_STATUSES = ['active']
const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function toMinutes(time) {
  if (!time) return 0
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + (m || 0)
}

function normalizeDateStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN')
}

function getUserName(user, fallback = 'Hội viên') {
  return String(user?.fullName || user?.name || user?.displayName || user?.memberCode || fallback).trim()
}

function parseSlot(slot) {
  const [start, end] = String(slot || '').split('-').map((part) => part.trim())
  return { start, end }
}

function normalizeSchedules(schedules = []) {
  const map = new Map()
  for (const item of Array.isArray(schedules) ? schedules : []) {
    const dayOfWeek = Number(item.dayOfWeek)
    const shift = String(item.shift || '')
    const range = SHIFT_RANGES[shift]
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !range) continue
    const startTime = item.startTime || range.start
    const endTime = item.endTime || range.end
    if (toMinutes(startTime) >= toMinutes(endTime)) continue
    map.set(`${dayOfWeek}-${shift}`, {
      dayOfWeek,
      shift,
      startTime,
      endTime,
      status: 'active',
    })
  }
  return Array.from(map.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime))
}

function isCoveredBySchedule({ dayOfWeek, startTime, endTime }, schedules) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  return schedules.some((schedule) => (
    schedule.dayOfWeek === dayOfWeek
    && toMinutes(schedule.startTime) <= start
    && toMinutes(schedule.endTime) >= end
  ))
}

function buildScheduleError(affectedSchedules) {
  const error = new Error('Không thể thay đổi ca làm việc vì PT đang có lịch tập trong khoảng thời gian này.')
  error.code = 'TRAINER_SCHEDULE_HAS_AFFECTED_SESSIONS'
  error.statusCode = 409
  error.affectedSchedules = affectedSchedules
  return error
}

async function findAffectedBookings(trainerId, schedules) {
  const bookings = await Booking.find({
    ptId: trainerId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    date: { $gte: normalizeDateStart() },
  })
    .populate('memberId', 'name fullName displayName memberCode email phone')
    .sort({ date: 1, slot: 1 })
    .lean()

  return bookings
    .map((booking) => {
      const { start, end } = parseSlot(booking.slot)
      const date = new Date(booking.date)
      if (!start || !end) return null
      const covered = isCoveredBySchedule({
        dayOfWeek: date.getDay(),
        startTime: start,
        endTime: end,
      }, schedules)
      if (covered) return null
      return {
        source: 'booking',
        date: formatDate(date),
        dayOfWeek: date.getDay(),
        time: `${start} - ${end}`,
        member: getUserName(booking.memberId),
        type: booking.trainingType === 'group' ? 'PT nhóm' : 'PT 1-1',
        status: booking.status,
        referenceId: booking._id,
      }
    })
    .filter(Boolean)
}

async function findAffectedClasses(trainerId, schedules) {
  const assignments = await TrainingAssignment.find({
    trainerId,
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
    classId: { $ne: null },
  })
    .populate('classId', 'name code daysOfWeek startTime endTime status')
    .populate('memberId', 'name fullName displayName memberCode')
    .lean()

  const classMap = new Map()
  for (const assignment of assignments) {
    const cls = assignment.classId
    if (!cls || !cls.startTime || !cls.endTime) continue
    const key = String(cls._id)
    if (!classMap.has(key)) {
      classMap.set(key, {
        classInfo: cls,
        members: [],
      })
    }
    classMap.get(key).members.push(assignment.memberId)
  }

  const affected = []
  for (const { classInfo, members } of classMap.values()) {
    for (const dayOfWeek of classInfo.daysOfWeek || []) {
      const covered = isCoveredBySchedule({
        dayOfWeek,
        startTime: classInfo.startTime,
        endTime: classInfo.endTime,
      }, schedules)
      if (covered) continue
      affected.push({
        source: 'class',
        date: `Hằng tuần - ${DAY_LABELS[dayOfWeek] || `Thứ ${dayOfWeek + 1}`}`,
        dayOfWeek,
        time: `${classInfo.startTime} - ${classInfo.endTime}`,
        member: members.length > 0 ? `${members.length} hội viên` : 'Lớp nhóm',
        type: 'PT nhóm',
        className: classInfo.name,
        status: classInfo.status,
        referenceId: classInfo._id,
      })
    }
  }
  return affected
}

async function findAffectedWorkoutSchedules(trainerId, schedules) {
  const workoutSchedules = await WorkoutSchedule.find({
    status: { $in: ACTIVE_WORKOUT_STATUSES },
    $or: [{ trainerId }, { assignedBy: trainerId }],
  })
    .populate('memberId', 'name fullName displayName memberCode')
    .populate('classId', 'name code')
    .lean()

  const affected = []
  const today = normalizeDateStart()
  for (const schedule of workoutSchedules) {
    for (const session of schedule.sessions || []) {
      if (!session.date || !session.time || !session.endTime || session.status === 'completed') continue
      const sessionDate = new Date(session.date)
      if (sessionDate < today) continue
      const covered = isCoveredBySchedule({
        dayOfWeek: sessionDate.getDay(),
        startTime: session.time,
        endTime: session.endTime,
      }, schedules)
      if (covered) continue
      affected.push({
        source: 'workout_schedule',
        date: formatDate(sessionDate),
        dayOfWeek: sessionDate.getDay(),
        time: `${session.time} - ${session.endTime}`,
        member: getUserName(schedule.memberId),
        type: schedule.classId ? 'PT nhóm' : 'PT 1-1',
        className: schedule.classId?.name || session.className || '',
        status: session.status || schedule.status,
        referenceId: schedule._id,
      })
    }
  }
  return affected
}

async function validateNoAffectedAssignedSessions(trainerId, schedules) {
  const [bookings, classes, workoutSchedules] = await Promise.all([
    findAffectedBookings(trainerId, schedules),
    findAffectedClasses(trainerId, schedules),
    findAffectedWorkoutSchedules(trainerId, schedules),
  ])
  const affectedSchedules = [...bookings, ...classes, ...workoutSchedules]
  if (affectedSchedules.length > 0) {
    throw buildScheduleError(affectedSchedules)
  }
}

export const setSchedule = async ({ trainerId, schedules }) => {
  const normalizedSchedules = normalizeSchedules(schedules)
  await validateNoAffectedAssignedSessions(trainerId, normalizedSchedules)

  await TrainerSchedule.deleteMany({ trainerId })
  if (normalizedSchedules.length > 0) {
    return TrainerSchedule.insertMany(
      normalizedSchedules.map((s) => ({
        trainerId,
        dayOfWeek: s.dayOfWeek,
        shift: s.shift,
        startTime: s.startTime,
        endTime: s.endTime,
        status: 'active',
      })),
    )
  }
  return []
}

export const getTrainerSchedule = async (trainerId) => {
  const schedules = await TrainerSchedule.find({ trainerId, status: 'active' })
    .sort({ dayOfWeek: 1 })

  const assignments = await TrainingAssignment.find({ trainerId, status: 'active' })
    .populate({
      path: 'classId',
      populate: [
        { path: 'floorId', select: 'name' },
        { path: 'zoneId', select: 'name maxCapacity' },
      ],
      select: 'name code daysOfWeek startTime endTime floorId zoneId',
    })
    .lean()

  const classMap = new Map()
  for (const a of assignments) {
    if (!a.classId) continue
    const cid = String(a.classId._id)
    if (!classMap.has(cid)) {
      classMap.set(cid, { class: a.classId, count: 0 })
    }
    classMap.get(cid).count += 1
  }

  const classSchedules = Array.from(classMap.values()).map(({ class: cl, count }) => ({
    ...cl,
    currentActiveCount: count,
    zoneMaxCapacity: cl.zoneId?.maxCapacity || 0,
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
