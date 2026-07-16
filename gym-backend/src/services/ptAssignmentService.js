import mongoose from 'mongoose'
import PTAssignment from '../models/PTAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingRequest from '../models/TrainingRequest.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'

export const findActiveAssignment = async ({ memberId, session }) => {
  const opts = session ? { session } : {}
  return PTAssignment.findOne({ memberId, status: 'active' })
    .populate('ptId', 'name fullName email phone avatar specialties')
    .sort({ createdAt: -1 })
    .session(session || null)
}

export const findActiveAssignmentByPt = async ({ ptId, session }) => {
  // 1. Direct PTAssignment records (one-on-one)
  const directAssignments = await PTAssignment.find({ ptId, status: 'active' })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
    .populate('workoutId', 'name goal')
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean()

  // 2. Classes taught by this PT
  const classes = await TrainingClass.find({ ptId }).select('_id').lean()
  const classIds = classes.map(c => c._id)

  if (classIds.length === 0) {
    // Still need schedule counts for direct assignments
    return attachScheduleCounts(directAssignments)
  }

  // 3. Members enrolled in those classes
  const classAssignments = await TrainingAssignment.find({ classId: { $in: classIds }, status: 'active' })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean()

  // 4. Merge and deduplicate by memberId
  const memberMap = new Map()
  for (const a of directAssignments) {
    const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
    memberMap.set(mid, a)
  }
  for (const a of classAssignments) {
    const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
    if (!memberMap.has(mid)) {
      memberMap.set(mid, {
        _id: a._id,
        memberId: a.memberId,
        ptId,
        status: 'active',
        startDate: a.startDate,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        _fromClass: true,
      })
    }
  }

  const results = Array.from(memberMap.values())

  // 5. Attach schedule counts for all members in results
  return attachScheduleCounts(results)
}

/**
 * Attach scheduleCount and workoutId for members.
 * 1. Populated workout from PTAssignment (best).
 * 2. Fallback: templateId from the latest active WorkoutSchedule (populated too).
 */
const attachScheduleCounts = async (assignments) => {
  if (!assignments.length) return assignments

  const memberIds = assignments
    .map(a => typeof a.memberId === 'object' ? a.memberId._id : a.memberId)
    .filter(Boolean)

  const [scheduleCounts, paDocs, latestSchedules] = await Promise.all([
    WorkoutSchedule.aggregate([
      { $match: { memberId: { $in: memberIds }, status: 'active' } },
      { $group: { _id: '$memberId', count: { $sum: 1 } } },
    ]),
    PTAssignment.find({ memberId: { $in: memberIds }, status: 'active' })
      .select('memberId workoutId')
      .populate('workoutId', 'name goal')
      .lean(),
    WorkoutSchedule.aggregate([
      { $match: { memberId: { $in: memberIds }, status: 'active' } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$memberId', templateId: { $first: '$templateId' } } },
    ]),
  ])

  const scheduleMap = new Map(scheduleCounts.map(c => [String(c._id), c.count]))

  // Best-effort workout from PTAssignment
  const paMap = new Map()
  for (const pa of paDocs) {
    const mid = String(pa.memberId)
    if (!paMap.has(mid) && pa.workoutId != null) {
      paMap.set(mid, pa.workoutId)
    }
  }

  // Raw templateIds from WorkoutSchedule for fallback
  const scheduleTemplateIds = new Map()
  for (const item of latestSchedules) {
    const mid = String(item._id)
    if (!scheduleTemplateIds.has(mid) && item.templateId) {
      scheduleTemplateIds.set(mid, item.templateId)
    }
  }

  // Batch-populate any templateIds we need (only those not already in paMap)
  const fetchList = []
  for (const a of assignments) {
    const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
    a.scheduleCount = scheduleMap.get(mid) || 0

    if (!a.workoutId) {
      const fromPa = paMap.get(mid)
      if (fromPa) {
        a.workoutId = fromPa
      } else {
        const tid = scheduleTemplateIds.get(mid)
        if (tid) fetchList.push(tid)
      }
    }
  }

  if (fetchList.length > 0) {
    const WorkoutModel = mongoose.model('Workout')
    const workouts = await WorkoutModel.find({ _id: { $in: fetchList } })
      .select('name goal')
      .lean()
    const workoutMap = new Map(workouts.map(w => [String(w._id), w]))

    for (const a of assignments) {
      if (!a.workoutId) {
        const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
        const tid = scheduleTemplateIds.get(mid)
        if (tid) {
          const w = workoutMap.get(String(tid))
          if (w) a.workoutId = { _id: tid, name: w.name, goal: w.goal }
        }
      }
    }
  }

  return assignments
}

export const findHistoryByPt = async ({ ptId, page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit)
  const filter = { ptId, status: { $in: ['cancelled', 'completed'] } }
  const [items, total] = await Promise.all([
    PTAssignment.find(filter)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
      .sort({ cancelledAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    PTAssignment.countDocuments(filter),
  ])
  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  }
}

export const createAssignment = async ({ memberId, ptId, membershipId, session }) => {
  const opts = session ? { session } : {}

  const existing = await PTAssignment.findOne({ memberId, status: 'active' }).session(session || null)
  if (existing) return existing

  const [assignment] = await PTAssignment.create([{
    memberId,
    ptId,
    membershipId,
    status: 'active',
    startDate: new Date(),
  }], opts)

  return assignment
}

/**
 * Check if a PT has a conflicting class at a given date + time.
 * @param {object} params
 * @param {string} params.ptId - PT user ID
 * @param {string} params.date - "YYYY-MM-DD"
 * @param {string} params.time - "HH:mm"
 * @returns {{ hasConflict: boolean, conflictingClass?: { name: string, startTime: string, endTime: string } }}
 */
export const checkTimeConflict = async ({ ptId, date, time }) => {
  if (!ptId || !date || !time) return { hasConflict: false }

  const dayOfWeek = new Date(date).getDay()

  const [h, m] = time.split(':').map(Number)
  const sessionMinutes = h * 60 + m

  const classes = await TrainingClass.find({ ptId, daysOfWeek: dayOfWeek }).select('name startTime endTime').lean()

  for (const cls of classes) {
    if (!cls.startTime || !cls.endTime) continue
    const [sh, sm] = cls.startTime.split(':').map(Number)
    const [eh, em] = cls.endTime.split(':').map(Number)
    const classStart = sh * 60 + sm
    const classEnd = eh * 60 + em

    if (sessionMinutes >= classStart && sessionMinutes < classEnd) {
      return {
        hasConflict: true,
        conflictingClass: { name: cls.name, startTime: cls.startTime, endTime: cls.endTime },
      }
    }
  }

  return { hasConflict: false }
}

/**
 * Suggest available time slots for a PT to schedule sessions with a member.
 * Returns slots derived from the PT's TrainingClass schedule.
 */
export const getSuggestedSlots = async ({ ptId }) => {
  const classes = await TrainingClass.find({ ptId })
    .populate('zoneId', 'maxCapacity')
    .select('name code specialization daysOfWeek startTime endTime zoneId')
    .lean()

  const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

  // Count active members per class
  const classIds = classes.map(c => c._id)
  const counts = await TrainingAssignment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [String(c._id), c.count]))

  const slots = []
  for (const c of classes) {
    const current = countMap.get(String(c._id)) || 0
    const maxCapacity = (c.zoneId && typeof c.zoneId === 'object' ? c.zoneId.maxCapacity : null) || 0
    const isFull = maxCapacity > 0 && current >= maxCapacity
    for (const day of c.daysOfWeek || []) {
      slots.push({
        classId: String(c._id),
        dayOfWeek: day,
        dayLabel: DAY_LABELS[day] || `Day ${day}`,
        startTime: c.startTime,
        endTime: c.endTime,
        time: `${c.startTime} - ${c.endTime}`,
        className: c.name,
        classCode: c.code,
        specialization: c.specialization || '',
        count: current,
        maxCapacity,
        isFull,
      })
    }
  }

  slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || (a.startTime || '').localeCompare(b.startTime || ''))
  return slots
}

/**
 * Get training preferences (timeSlots, daysOfWeek, goals, health notes, etc.)
 * for a member from their most recent TrainingRequest (assigned or pending).
 */
export const getMemberTrainingPreferences = async ({ memberId }) => {
  const request = await TrainingRequest.findOne(
    { memberId, status: { $in: ['assigned', 'pending'] } },
  ).sort({ createdAt: -1 }).select('timeSlots daysOfWeek specialization goals desiredSessions healthNotes isNewToGym note').lean()

  return {
    timeSlots: request?.timeSlots || [],
    daysOfWeek: request?.daysOfWeek || [],
    specialization: request?.specialization || '',
    goals: request?.goals || [],
    desiredSessions: request?.desiredSessions ?? 0,
    healthNotes: request?.healthNotes || '',
    isNewToGym: request?.isNewToGym || false,
    note: request?.note || '',
  }
}

/**
 * Find classes taught by a PT that match a member's booking preferences.
 * Matching criteria: same specialization + time range overlap + at least 1 shared day of week.
 */
export const getMatchedClassesForBooking = async ({ memberId, ptId }) => {
  const prefs = await getMemberTrainingPreferences({ memberId })
  const { timeSlots, daysOfWeek, specialization } = prefs

  const classes = await TrainingClass.find({ ptId })
    .populate('zoneId', 'maxCapacity')
    .lean()

  const classIds = classes.map(c => c._id)
  const counts = await TrainingAssignment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [String(c._id), c.count]))

  const normalize = (str) => String(str || '').replace(/\s+/g, '').toLowerCase()

  const matched = []
  for (const c of classes) {
    const current = countMap.get(String(c._id)) || 0
    const maxCap = (c.zoneId && typeof c.zoneId === 'object' ? c.zoneId.maxCapacity : null) || 0
    const isFull = maxCap > 0 && current >= maxCap

    // Specialization match
    const specMatch = !specialization || normalize(c.specialization) === normalize(specialization)

    // Time match: class time overlaps any of member's preferred time slots
    const classTimeRange = `${c.startTime} - ${c.endTime}`
    const normClassTime = normalize(classTimeRange)
    const timeMatch = timeSlots.length === 0 || timeSlots.some(t => normClassTime === normalize(t))

    // Day match: at least one shared dayOfWeek
    const dayMatch = daysOfWeek.length === 0 || (c.daysOfWeek || []).some(d => daysOfWeek.includes(d))

    if (specMatch && timeMatch && dayMatch) {
      matched.push({
        classId: c._id,
        code: c.code,
        name: c.name,
        specialization: c.specialization,
        daysOfWeek: c.daysOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        time: classTimeRange,
        current,
        maxCapacity: maxCap,
        isFull,
      })
    }
  }

  return { matched, preferences: prefs }
}

export const cancelAssignment = async ({ memberId, session, reason = 'Gói tập đã kết thúc' }) => {
  const opts = session ? { session } : {}

  await PTAssignment.updateMany(
    { memberId, status: 'active' },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    },
    opts,
  )
}
