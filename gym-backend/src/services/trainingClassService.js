import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import { getActiveCountMap as getActiveEnrollmentCountMap } from './classEnrollmentService.js'
import { validateClassPTWorkingSchedule } from './ptScheduleValidationService.js'

const SPECIALIZATION_LABELS = {
  YOGA: 'Yoga',
  BOXING: 'Boxing',
  GYM: 'GYM',
  ZUMBA: 'Zumba',
  PILATES: 'Pilates',
  CARDIO: 'Cardio',
  AEROBICS: 'Aerobics',
  CROSSFIT: 'Crossfit',
  KICKBOXING: 'Kickboxing',
  DANCE: 'Dance',
  MUAYTHAI: 'Muay Thái',
  FUNCTIONAL: 'Functional Training',
  OTHER: 'Khác',
}

export { SPECIALIZATION_LABELS }

const SPECIALIZATION_OPTIONS = Object.entries(SPECIALIZATION_LABELS).map(([value, label]) => ({ value, label }))

export { SPECIALIZATION_OPTIONS }

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const DAY_LABELS_FULL = { 0: 'Chủ nhật', 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7' }

const POPULATE_FIELDS = [
  { path: 'ptId', select: 'name fullName email phone avatar' },
  { path: 'floorId', select: 'name order' },
  { path: 'zoneId', select: 'name maxCapacity' },
]

function toMinutes(time) {
  if (!time) return -1
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + (m || 0)
}

function timesOverlap(start1, end1, start2, end2) {
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1)
}

async function validateConflicts({ name, ptId, floorId, zoneId, daysOfWeek, startTime, endTime, excludeId }) {
  if (!daysOfWeek || daysOfWeek.length === 0 || !startTime || !endTime) return

  if (toMinutes(startTime) >= toMinutes(endTime)) {
    throw new Error('Giờ bắt đầu phải trước giờ kết thúc')
  }

  for (const day of daysOfWeek) {
    const dayName = DAY_LABELS_FULL[day] || `Thứ ${day + 1}`
    const matchFilter = { daysOfWeek: day }

    // 1. Check location conflict: same floor + zone + day + overlapping time
    if (floorId && zoneId) {
      const locationFilter = { ...matchFilter, floorId, zoneId, status: { $ne: 'closed' } }
      if (excludeId) locationFilter._id = { $ne: excludeId }
      const locationClasses = await TrainingClass.find(locationFilter).lean()
      for (const c of locationClasses) {
        if (timesOverlap(startTime, endTime, c.startTime, c.endTime)) {
          throw new Error(`Lỗi: ${dayName} đã có lớp "${c.name}" hoạt động tại khu vực này trong khung giờ ${c.startTime?.slice(0, 5)} - ${c.endTime?.slice(0, 5)}`)
        }
      }
    }

    // 2. Check PT conflict: same PT + day + overlapping time
    if (ptId) {
      const ptFilter = { ...matchFilter, ptId, status: { $ne: 'closed' } }
      if (excludeId) ptFilter._id = { $ne: excludeId }
      const ptClasses = await TrainingClass.find(ptFilter).lean()
      for (const c of ptClasses) {
        if (timesOverlap(startTime, endTime, c.startTime, c.endTime)) {
          throw new Error(`Lỗi: ${dayName} - PT này đã có lịch dạy lớp "${c.name}" trong khung giờ ${c.startTime?.slice(0, 5)} - ${c.endTime?.slice(0, 5)}`)
        }
      }
    }
  }
}

export const createClass = async ({ name, description, specialization, ptId, floorId, zoneId, daysOfWeek, startTime, endTime }) => {
  await validateConflicts({ name, ptId, floorId, zoneId, daysOfWeek, startTime, endTime })

  // PT chỉ được dạy lớp nằm trong ca làm việc đã thiết lập
  if (ptId && daysOfWeek?.length > 0 && startTime && endTime) {
    await validateClassPTWorkingSchedule({ trainerId: ptId, daysOfWeek, startTime, endTime })
  }

  const cls = await TrainingClass.create({
    name,
    description: description || '',
    specialization: specialization || '',
    ptId: ptId || null,
    floorId: floorId || null,
    zoneId: zoneId || null,
    daysOfWeek: daysOfWeek || [],
    startTime: startTime || null,
    endTime: endTime || null,
  })
  return serializeClass(cls)
}

export const updateClass = async ({ classId, data }) => {
  const existing = await TrainingClass.findById(classId)
  if (!existing) throw new Error('Không tìm thấy lớp tập')

  const ptId = data.ptId !== undefined ? data.ptId : existing.ptId
  const floorId = data.floorId !== undefined ? data.floorId : existing.floorId
  const zoneId = data.zoneId !== undefined ? data.zoneId : existing.zoneId
  const daysOfWeek = data.daysOfWeek !== undefined ? data.daysOfWeek : existing.daysOfWeek
  const startTime = data.startTime || existing.startTime
  const endTime = data.endTime || existing.endTime
  const name = data.name || existing.name

  await validateConflicts({ name, ptId, floorId, zoneId, daysOfWeek, startTime, endTime, excludeId: classId })

  // PT chỉ được dạy lớp nằm trong ca làm việc đã thiết lập
  if (ptId && daysOfWeek?.length > 0 && startTime && endTime) {
    await validateClassPTWorkingSchedule({ trainerId: ptId, daysOfWeek, startTime, endTime })
  }

  Object.assign(existing, data)
  const cls = await existing.save()
  return serializeClass(cls)
}

export const getAllClasses = async ({ page = 1, limit = 50, includeClosed = false }) => {
  const skip = (Number(page) - 1) * Number(limit)

  const filter = includeClosed ? {} : { status: { $ne: 'closed' } }

  const [items, total] = await Promise.all([
    TrainingClass.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainingClass.countDocuments(filter),
  ])

  const countMap = await getActiveEnrollmentCountMap(items.map(c => c._id))

  return {
    classes: items.map((cls) => serializeClass(cls, countMap[String(cls._id)] || 0)),
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

/**
 * Get real-time occupancy for a single class.
 * Shared function used by both PT modal and admin pages.
 *
 * Source of truth: ClassEnrollment.status='active' for this class.
 */
export const getClassOccupancy = async (classId) => {
  const cls = await TrainingClass.findById(classId).populate('zoneId', 'maxCapacity').lean()
  if (!cls) return null
  const max = cls.zoneId?.maxCapacity || 0

  const count = await ClassEnrollment.countDocuments({ classId, status: 'active' })

  return {
    classId: cls._id,
    code: cls.code,
    name: cls.name,
    specialization: cls.specialization,
    daysOfWeek: cls.daysOfWeek,
    startTime: cls.startTime,
    endTime: cls.endTime,
    time: `${cls.startTime} - ${cls.endTime}`,
    current: count,
    max,
    isFull: max > 0 && count >= max,
  }
}

export const deleteClass = async (classId) => {
  const cls = await TrainingClass.findById(classId)
  if (!cls) return null

  // Soft delete: đóng lớp, kết thúc assignment + enrollment
  cls.status = 'closed'
  await cls.save()

  await TrainingAssignment.updateMany(
    { classId, status: { $in: ['waiting_pt', 'active'] } },
    { $set: { status: 'finished', endDate: new Date() } },
  )

  await ClassEnrollment.updateMany(
    { classId, status: 'active' },
    { $set: { status: 'ended', leftAt: new Date() } },
  )

  return cls
}

export const getClassById = async (classId) => {
  const cls = await TrainingClass.findById(classId).populate(POPULATE_FIELDS)
  return serializeClass(cls)
}

function serializeClass(cls, currentActiveCount = 0) {
  if (!cls) return null
  const obj = cls.toObject ? cls.toObject() : cls
  return {
    ...obj,
    specializationLabel: SPECIALIZATION_LABELS[obj.specialization] || obj.specialization || '',
    daysLabel: (obj.daysOfWeek || []).map(d => DAY_LABELS[d]).filter(Boolean).join(', '),
    currentActiveCount,
    hasPT: !!(obj.ptId),
  }
}
