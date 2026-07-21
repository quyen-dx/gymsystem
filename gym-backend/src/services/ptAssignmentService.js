import mongoose from 'mongoose'
import PTAssignment from '../models/PTAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingRequest from '../models/TrainingRequest.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import Workout from '../models/Workout.js'
import PTAssignmentEndRequest from '../models/PTAssignmentEndRequest.js'
import PersonalTrainingRequest from '../models/PersonalTrainingRequest.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import MembershipCycle from '../models/MembershipCycle.js'

const nearestFutureDay = (startDate, targetDayOfWeek) => {
  const d = new Date(startDate)
  const currentDay = d.getDay()
  let diff = targetDayOfWeek - currentDay
  if (diff <= 0) diff += 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Helper: khoi tao WorkoutSchedule tu template days.
 * Tao 1 WorkoutSchedule voi sessions duoc xay dung tu template.days.
 */
export const buildSchedulesFromTemplate = async ({ templateId, memberId, ptId }) => {
  const template = await Workout.findById(templateId).lean()
  if (!template || !template.isTemplate) return null

  const startDate = new Date()
  const days = template.days || []
  const sessions = days
    .filter((d) => d.exercises && d.exercises.length > 0)
    .map((d, i) => ({
      dayOrder: i + 1,
      date: nearestFutureDay(startDate, d.dayOfWeek ?? 0),
      time: '',
      endTime: '',
      className: '',
      classCode: '',
      title: d.muscleGroup || `Buổi ${i + 1}`,
      muscleGroup: d.muscleGroup || '',
      exercises: (d.exercises || []).map((ex) => ({
        name: ex.name,
        note: ex.note || '',
        completed: false,
      })),
      status: 'pending',
      feedback: '',
    }))

  const schedule = await WorkoutSchedule.create({
    memberId,
    templateId,
    assignedBy: ptId,
    startDate,
    status: 'active',
    sessions,
  })

  return schedule
}

export const findActiveAssignment = async ({ memberId, session }) => {
  const opts = session ? { session } : {}
  return PTAssignment.findOne({ memberId, status: 'active' })
    .populate('ptId', 'name fullName email phone avatar specialties')
    .sort({ createdAt: -1 })
    .session(session || null)
}

export const findActiveAssignmentByPt = async ({ ptId, session }) => {
  // Members with pending end requests to exclude
  const pendingEndMemberIds = await PTAssignmentEndRequest
    .find({ ptId, status: 'pending' })
    .select('memberId')
    .lean()
  const excludeMemberIds = pendingEndMemberIds.map(r => String(r.memberId))

  // 1. TrainingAssignment — PT nhóm (nguồn chính)
  const groupAssignments = await TrainingAssignment.find({ trainerId: ptId, status: 'active' })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
    .populate({
      path: 'classId',
      select: 'name code daysOfWeek startTime endTime specialization',
    })
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean()

  // 2. PTAssignment — PT cá nhân (1-1)
  const privateAssignments = await PTAssignment.find({ ptId, status: 'active' })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
    .populate('workoutId', 'name goal')
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean()

  // 3. PersonalTrainingRequest — PT riêng 1-1 (luồng mới)
  const ptOneOnOneRequests = await PersonalTrainingRequest.find({
    assignedTrainerId: ptId,
    status: 'assigned',
  })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber preferredTime')
    .sort({ createdAt: -1 })
    .session(session || null)
    .lean()

  // 3. Merge + dedup + exclude pending end requests
  const memberMap = new Map()
  for (const a of groupAssignments) {
    const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
    if (!excludeMemberIds.includes(mid)) {
      a._fromClass = true
      memberMap.set(mid, a)
    }
  }
  for (const a of privateAssignments) {
    const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
    if (!memberMap.has(mid) && !excludeMemberIds.includes(mid)) {
      memberMap.set(mid, a)
    }
  }
  for (const r of ptOneOnOneRequests) {
    const mid = typeof r.memberId === 'object' ? String(r.memberId._id) : String(r.memberId)
    if (!memberMap.has(mid) && !excludeMemberIds.includes(mid)) {
      r._isPersonalTraining = true
      memberMap.set(mid, r)
    }
  }

  const results = Array.from(memberMap.values())

  // 4. Attach schedule counts
  const withCounts = await attachScheduleCounts(results)

  // 5. Attach ClassEnrollment + membershipStatus + training request data
  const allMemberIds = withCounts.map(a =>
    typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
  ).filter(Boolean)

  if (allMemberIds.length > 0) {
    const [enrollments, cycles, trainingRequests] = await Promise.all([
      ClassEnrollment.find({ memberId: { $in: allMemberIds }, status: 'active' })
        .populate('classId', 'code name')
        .select('memberId classId')
        .lean(),
      MembershipCycle.find({
        memberId: { $in: allMemberIds },
        status: { $in: ['active', 'pending_initial_activation'] },
      }).select('memberId status').sort({ createdAt: -1 }).lean(),
      TrainingRequest.aggregate([
        { $match: { memberId: { $in: allMemberIds.map(id => new mongoose.Types.ObjectId(id)) }, status: 'assigned' } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$memberId', specialization: { $first: '$specialization' }, goals: { $first: '$goals' } } },
      ]),
    ])

    const enrollmentMap = new Map()
    for (const e of enrollments) {
      const mid = String(e.memberId)
      if (!enrollmentMap.has(mid)) {
        enrollmentMap.set(mid, e.classId)
      }
    }

    const cycleMap = new Map()
    for (const c of cycles) {
      const mid = String(c.memberId)
      if (!cycleMap.has(mid)) {
        cycleMap.set(mid, c.status)
      }
    }

    const trainingRequestMap = new Map()
    for (const tr of trainingRequests) {
      trainingRequestMap.set(String(tr._id), { specialization: tr.specialization, goals: tr.goals })
    }

    for (const a of withCounts) {
      const mid = typeof a.memberId === 'object' ? String(a.memberId._id) : String(a.memberId)
      a.classEnrollment = enrollmentMap.get(mid) || null
      a.membershipStatus = cycleMap.get(mid) || null
      const tr = trainingRequestMap.get(mid)
      a.specialization = a.specialization || tr?.specialization || ''
      a.goals = a.goals?.length ? a.goals : (tr?.goals || [])
    }
  }

  return withCounts
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

    // If no active schedules, no current workout — skip fill
    if (a.scheduleCount === 0) {
      a.workoutId = null
      continue
    }

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

export const findPendingApprovals = async ({ ptId }) => {
  const items = await PTAssignmentEndRequest.find({ ptId, status: 'pending' })
    .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
    .populate('assignmentId', 'workoutId')
    .populate('classId', 'name code')
    .sort({ createdAt: -1 })
    .lean()

  // Populate workout data for assignmentId references
  const results = []
  for (const item of items) {
    const entry = { ...item }
    if (entry.assignmentId && entry.assignmentId.workoutId) {
      const w = await Workout.findById(entry.assignmentId.workoutId).select('name goal').lean()
      if (w) entry.workoutData = { name: w.name, goal: w.goal }
    }
    results.push(entry)
  }

  return results
}

export const findHistoryByPt = async ({ ptId, page = 1, limit = 20, type, fromDate, toDate, search }) => {
  const skip = (Number(page) - 1) * Number(limit)
  const ptObjectId = new mongoose.Types.ObjectId(ptId)

  // Query 1: Workout end history (PTAssignment where status = completed and workoutEndedAt exists)
  const workoutEndFilter = { ptId, status: 'completed', workoutEndedAt: { $ne: null } }

  // Query 2: Assignment end history (PTAssignmentEndRequest where status = approved)
  const assignmentEndFilter = { ptId: ptObjectId, status: 'approved' }

  // Apply type filter
  if (type === 'workout_end') {
    assignmentEndFilter._id = { $exists: false }
  } else if (type === 'assignment_end') {
    workoutEndFilter._id = { $exists: false }
  }

  // Apply date filters
  if (fromDate || toDate) {
    const buildRange = () => {
      const range = {}
      if (fromDate) range.$gte = new Date(fromDate)
      if (toDate) range.$lte = new Date(toDate)
      return range
    }

    if (!type || type === 'workout_end') {
      workoutEndFilter.workoutEndedAt = buildRange()
    }
    if (!type || type === 'assignment_end') {
      assignmentEndFilter.processedAt = buildRange()
    }
  }

  // Apply search filter (will be done in-memory if needed)
  const fetchAndFilter = async () => {
    const [workoutEnds, assignmentEnds] = await Promise.all([
      type !== 'assignment_end'
        ? PTAssignment.find(workoutEndFilter)
            .populate('memberId', 'name fullName memberCode memberNumber')
            .populate('workoutEndedBy', 'name fullName')
            .sort({ workoutEndedAt: -1 })
            .lean()
        : [],
      type !== 'workout_end'
        ? PTAssignmentEndRequest.find(assignmentEndFilter)
            .populate('memberId', 'name fullName memberCode memberNumber')
            .populate('ptId', 'name fullName')
            .populate('classId', 'name code')
            .populate('processedBy', 'name fullName')
            .sort({ processedAt: -1 })
            .lean()
        : [],
    ])

    const workoutEndItems = workoutEnds.map(a => ({
      _type: 'workout_end',
      _id: a._id,
      memberId: a.memberId,
      ptId: a.ptId,
      workoutName: a.workoutNameSnapshot || a.workoutId?.name || '',
      endedAt: a.workoutEndedAt,
      endedBy: a.workoutEndedBy,
      createdAt: a.createdAt,
    }))

    const assignmentEndItems = assignmentEnds.map(r => ({
      _type: 'assignment_end',
      _id: r._id,
      memberId: r.memberId,
      ptId: r.ptId,
      classId: r.classId,
      reasonType: r.reasonType,
      reasonDetail: r.reasonDetail,
      requestedAt: r.createdAt,
      approvedAt: r.processedAt,
      approvedBy: r.processedBy,
      createdAt: r.createdAt,
    }))

    let combined = [...workoutEndItems, ...assignmentEndItems]

    // Apply search filter in-memory
    if (search) {
      const q = search.toLowerCase()
      combined = combined.filter(item => {
        const member = typeof item.memberId === 'object' ? item.memberId : null
        const memberName = member?.fullName || member?.name || ''
        const memberCode = member?.memberCode || ''
        if (memberName.toLowerCase().includes(q) || memberCode.toLowerCase().includes(q)) return true

        if (item._type === 'workout_end') {
          if (item.workoutName?.toLowerCase().includes(q)) return true
        } else {
          const cls = typeof item.classId === 'object' ? item.classId : null
          const className = cls?.name || ''
          const classCode = cls?.code || ''
          if (className.toLowerCase().includes(q) || classCode.toLowerCase().includes(q)) return true
        }
        return false
      })
    }

    // Sort by date descending (newest first)
    combined.sort((a, b) => {
      const dateA = a._type === 'workout_end' ? a.endedAt : a.approvedAt
      const dateB = b._type === 'workout_end' ? b.endedAt : b.approvedAt
      const dA = dateA ? new Date(dateA).getTime() : 0
      const dB = dateB ? new Date(dateB).getTime() : 0
      return dB - dA
    })

    return combined
  }

  const allItems = await fetchAndFilter()
  const total = allItems.length
  const items = allItems.slice(skip, skip + Number(limit))

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

  // BUSINESS RULE: 1 (memberId, ptId) pair can have AT MOST 1 active PTAssignment at a time.
  //  - If an active assignment exists for the SAME pair (memberId, ptId): reuse it (idempotent).
  //  - If an active assignment exists for the SAME memberId but a DIFFERENT ptId: leave it
  //    alone (member can have multiple PTs, e.g. PT for different specialization).
  //  - Note: any stale duplicate actives for the same (memberId, ptId) pair are cancelled
  //    here defensively to recover from legacy dup data.
  const existingSamePair = await PTAssignment.findOne({
    memberId, ptId, status: 'active',
  }).session(session || null).lean()

  if (existingSamePair) {
    // Defensive: cancel any OTHER active assignment for same (memberId, ptId) pair (legacy dups)
    await PTAssignment.updateMany(
      { memberId, ptId, status: 'active', _id: { $ne: existingSamePair._id } },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'cleanup_duplicate_pt_assignment',
        },
      },
      opts,
    )
    return existingSamePair
  }

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

  // Query từ TrainingAssignment thay vì TrainingClass.ptId
  const assignments = await TrainingAssignment.find({ trainerId: ptId, status: 'active' })
    .populate('classId', 'name startTime endTime daysOfWeek')
    .lean()

  for (const a of assignments) {
    if (!a.classId) continue
    const cls = a.classId
    if (!cls.daysOfWeek?.includes(dayOfWeek)) continue
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
  // Query từ TrainingAssignment thay vì TrainingClass.ptId
  const assignments = await TrainingAssignment.find({ trainerId: ptId, status: 'active' })
    .populate({
      path: 'classId',
      populate: { path: 'zoneId', select: 'maxCapacity' },
      select: 'name code specialization daysOfWeek startTime endTime zoneId',
    })
    .lean()

  const classes = assignments.map(a => a.classId).filter(Boolean)
  const uniqueClasses = Array.from(new Map(classes.map(c => [String(c._id), c])).values())

  const DAY_LABELS = ['Ch? nh?t', 'Th? hai', 'Th? ba', 'Th? tu', 'Th? nam', 'Th? s�u', 'Th? b?y']

  // Count active members per class
  const classIds = uniqueClasses.map(c => c._id)
  const counts = await TrainingAssignment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [String(c._id), c.count]))

  const slots = []
  for (const c of uniqueClasses) {
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

  const assignments = await TrainingAssignment.find({ trainerId: ptId, status: 'active' })
    .populate({
      path: 'classId',
      populate: { path: 'zoneId', select: 'maxCapacity' },
      select: 'name code specialization daysOfWeek startTime endTime zoneId',
    })
    .lean()

  const classes = assignments.map(a => a.classId).filter(Boolean)
  const uniqueClasses = Array.from(new Map(classes.map(c => [String(c._id), c])).values())

  const classIds = uniqueClasses.map(c => c._id)
  const counts = await TrainingAssignment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [String(c._id), c.count]))

  const normalize = (str) => String(str || '').replace(/\s+/g, '').toLowerCase()

  const matched = []
  for (const c of uniqueClasses) {
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

// === NEW: Request/Accept/Decline/BulkRelease ===

export const requestClassAssignment = async ({ classId, trainerId, assignedBy }) => {
  // Atomic: chỉ cập nhật nếu class đang waiting_pt
  const result = await TrainingClass.findOneAndUpdate(
    { _id: classId, status: 'waiting_pt' },
    { status: 'waiting_accept', pendingTrainerId: trainerId },
    { new: true },
  )

  if (!result) {
    const err = new Error('Lớp đã được xử lý bởi người khác.')
    err.statusCode = 409
    throw err
  }

  return result
}

export const acceptClassAssignment = async ({ classId, trainerId }) => {
  const trainingClass = await TrainingClass.findById(classId)
  if (!trainingClass) {
    const err = new Error('Không tìm thấy lớp tập')
    err.statusCode = 404
    throw err
  }

  if (trainingClass.status !== 'waiting_accept') {
    const err = new Error('Lớp không trong trạng thái chờ nhận')
    err.statusCode = 400
    throw err
  }

  if (String(trainingClass.pendingTrainerId) !== String(trainerId)) {
    const err = new Error('Bạn không phải người được mời nhận lớp này')
    err.statusCode = 403
    throw err
  }

  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const now = new Date()

    // Update TrainingAssignment
    await TrainingAssignment.updateMany(
      { classId, status: 'waiting_pt' },
      { trainerId, status: 'active', acceptedAt: now },
    ).session(session)

    // Update TrainingClass
    trainingClass.ptId = trainerId
    trainingClass.pendingTrainerId = null
    trainingClass.status = 'active'
    await trainingClass.save({ session })

    // Update TrainingRequest
    const enrollments = await ClassEnrollment.find({ classId, status: 'active' }).session(session).lean()
    const memberIds = enrollments.map(e => e.memberId)
    if (memberIds.length > 0) {
      await TrainingRequest.updateMany(
        { memberId: { $in: memberIds }, status: 'assigned' },
        { assignedTrainerId: trainerId },
      ).session(session)
    }

    await session.commitTransaction()

    return { trainingClass, memberIds }
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

export const declineClassAssignment = async ({ classId, trainerId }) => {
  const trainingClass = await TrainingClass.findById(classId)
  if (!trainingClass) {
    const err = new Error('Không tìm thấy lớp tập')
    err.statusCode = 404
    throw err
  }

  if (String(trainingClass.pendingTrainerId) !== String(trainerId)) {
    const err = new Error('Bạn không phải người được mời nhận lớp này')
    err.statusCode = 403
    throw err
  }

  trainingClass.pendingTrainerId = null
  trainingClass.status = 'waiting_pt'
  await trainingClass.save()

  return trainingClass
}

export const releasePtClasses = async ({ trainerId }) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    await TrainingAssignment.updateMany(
      { trainerId, status: 'active' },
      { status: 'finished', endDate: new Date() },
    ).session(session)

    const classes = await TrainingClass.find({ ptId: trainerId, status: 'active' }).session(session).lean()
    const classIds = classes.map(c => c._id)
    if (classIds.length > 0) {
      await TrainingClass.updateMany(
        { _id: { $in: classIds } },
        { ptId: null, status: 'waiting_pt' },
      ).session(session)
    }

    await session.commitTransaction()
    return { releasedClassCount: classes.length }
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}
