import mongoose from 'mongoose'
import User from '../models/User.js'
import PTAssignment from '../models/PTAssignment.js'
import Workout from '../models/Workout.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import * as ptAssignmentService from '../services/ptAssignmentService.js'
import { ensureEnrollment as ensureClassEnrollment, endEnrollments as endClassEnrollments, transferEnrollment, countActiveEnrollment } from '../services/classEnrollmentService.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import AppError from '../utils/appError.js'
import sendError from '../utils/sendError.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

export const getMyAssignment = async (req, res) => {
  try {
    const assignment = await ptAssignmentService.findActiveAssignment({
      memberId: req.user._id,
    })
    if (!assignment) {
      return res.json({ assignment: null })
    }
    res.json({ assignment })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyActiveClients = async (req, res) => {
  try {
    const assignments = await ptAssignmentService.findActiveAssignmentByPt({
      ptId: req.user._id,
    })
    res.json({ assignments })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, fromDate, toDate, search } = req.query
    const result = await ptAssignmentService.findHistoryByPt({
      ptId: req.user._id,
      page,
      limit,
      type,
      fromDate,
      toDate,
      search,
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getPendingApprovals = async (req, res) => {
  try {
    const items = await ptAssignmentService.findPendingApprovals({
      ptId: req.user._id,
    })
    res.json({ items })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getSuggestedSlots = async (req, res) => {
  try {
    const slots = await ptAssignmentService.getSuggestedSlots({ ptId: req.user._id })
    res.json({ slots })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberTrainingPreferences = async (req, res) => {
  try {
    const { memberId } = req.params
    const prefs = await ptAssignmentService.getMemberTrainingPreferences({ memberId })
    res.json(prefs)
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMatchedClasses = async (req, res) => {
  try {
    const { memberId } = req.params
    const result = await ptAssignmentService.getMatchedClassesForBooking({
      memberId,
      ptId: req.user._id,
    })
    res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export const assignWorkout = async (req, res) => {
  try {
    const { id } = req.params
    const { workoutId } = req.body
    const ptId = req.user._id

    const assignment = await PTAssignment.findById(id)
    if (!assignment) throw new AppError('Không tìm thấy phân công', 404)

    if (assignment.status === 'pending_end_approval') {
      return res.status(400).json({ message: 'Không thể gán giáo án khi đang chờ Admin phê duyệt kết thúc phụ trách' })
    }

    assignment.workoutId = workoutId || null
    await assignment.save()

    // Auto-create WorkoutSchedule if one does not exist yet
    if (workoutId) {
      const existing = await WorkoutSchedule.findOne({ memberId: assignment.memberId, templateId: workoutId, status: 'active' }).lean()
      if (!existing) {
        await ptAssignmentService.buildSchedulesFromTemplate({
          templateId: workoutId,
          memberId: assignment.memberId,
          ptId,
        })
      }
    }

    const updated = await PTAssignment.findById(id)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal')

    await createNotification({
      receiverId: assignment.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_WORKOUT_ASSIGNED,
      title: 'PT đã gán giáo án tập mới',
      content: `PT đã gán một giáo án tập mới cho bạn.`,
      relatedId: assignment._id,
      relatedType: 'PTAssignment',
      redirectUrl: '/my-workouts',
      createdBy: 'PT',
    }).catch(err => console.error('Notify assignWorkout failed:', err.message))

    res.json({ message: 'Đã gán giáo án thành công', assignment: updated })
  } catch (error) {
    return sendError(res, error)
  }
}

export const checkTimeConflict = async (req, res) => {
  try {
    const { date, time } = req.query
    const result = await ptAssignmentService.checkTimeConflict({ ptId: req.user._id, date, time })
    res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export const createScheduleAndAssignWorkout = async (req, res) => {
  const mongoSession = await mongoose.startSession()
  mongoSession.startTransaction()
  try {
    const { assignmentId } = req.params
    const { templateId, memberId, sessions, weekIndex, totalWeeks } = req.body
    const ptId = req.user._id

    if (!templateId || !memberId || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
      await mongoSession.abortTransaction()
      return res.status(400).json({ message: 'Thiếu thông tin: templateId, memberId, sessions' })
    }

    const template = await Workout.findById(templateId).session(mongoSession)
    if (!template || !template.isTemplate) {
      await mongoSession.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy giáo án mẫu' })
    }

    // Match EACH session to its training class by dayOfWeek + startTime + endTime + ptId
    const matchedClassMap = new Map()
    let firstMatchedClass = null

    for (const s of sessions) {
      if (!s.date || !s.time) continue
      const dayOfWeek = new Date(s.date).getDay()
      const matchQuery = {
        ptId,
        daysOfWeek: dayOfWeek,
        startTime: s.time,
      }
      if (s.endTime) matchQuery.endTime = s.endTime

      const match = await TrainingClass.findOne(matchQuery).session(mongoSession).lean()
      if (match) {
        matchedClassMap.set(s.dayOrder, match)
        if (!firstMatchedClass) {
          firstMatchedClass = match
        }
      } else {
        console.warn(
          `[createScheduleAndAssignWorkout] No exact class match for session dayOrder=${s.dayOrder} ` +
          `date=${s.date} time=${s.time} endTime=${s.endTime} ptId=${ptId}`
        )
      }
    }

    // Ensure member has an active ClassEnrollment for the matched class (capacity-permitting).
    // Idempotent: if member already enrolled active in this class, no new enrollment is created.
    if (firstMatchedClass) {
      try {
        await ensureClassEnrollment({
          classId: firstMatchedClass._id,
          memberId,
          session: mongoSession,
          sourceReason: 'assigned_by_pt',
          enforceCapacity: true,
        })
      } catch (e) {
        await mongoSession.abortTransaction()
        return res.status(e.statusCode || 409).json({ message: e.message })
      }
    }

    const schedule = await WorkoutSchedule.create([{
      memberId,
      templateId,
      assignedBy: ptId,
      startDate: new Date(),
      weekIndex: weekIndex || 1,
      totalWeeks: totalWeeks || 1,
      status: 'active',
      sessions: sessions.map(s => {
        const matched = matchedClassMap.get(s.dayOrder)
        return {
          dayOrder: s.dayOrder,
          date: new Date(s.date),
          time: s.time || '',
          endTime: s.endTime || '',
          className: matched?.name || '',
          classCode: matched?.code || '',
          title: s.title || '',
          muscleGroup: s.muscleGroup || '',
          exercises: (s.exercises || []).map(ex => ({
            name: ex.name,
            note: ex.note || '',
            completed: false,
          })),
          status: 'pending',
          feedback: '',
        }
      }),
    }], { session: mongoSession })

    const pa = await ptAssignmentService.createAssignment({ memberId, ptId, session: mongoSession })

    pa.workoutId = templateId
    await pa.save({ session: mongoSession })

    await mongoSession.commitTransaction()

    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_WORKOUT_ASSIGNED,
      title: 'PT đã tạo lịch tập và gán giáo án',
      content: `PT đã tạo lịch tập và gán giáo án mới cho bạn.`,
      relatedId: schedule[0]._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule+workout failed:', err.message))

    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Lịch tập mới đã được tạo',
      content: `Lịch tập mới của bạn đã được PT tạo.`,
      relatedId: schedule[0]._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule failed:', err.message))

    const populated = await WorkoutSchedule.findById(schedule[0]._id)
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')

    const updatedAssignment = await PTAssignment.findById(pa._id)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal')

    res.status(201).json({
      message: 'Đã tạo lịch tập và gán giáo án thành công',
      schedule: populated,
      assignment: updatedAssignment,
    })
  } catch (error) {
    await mongoSession.abortTransaction()
    return sendError(res, error)
  } finally {
    mongoSession.endSession()
  }
}

// ============ WORKOUT PROGRESS ============

export const getWorkoutProgress = async (req, res) => {
  try {
    const { id } = req.params
    const { scheduleId } = req.query
    const ptId = req.user._id

    const assignment = await PTAssignment.findOne({ _id: id, ptId, status: 'active' })
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal days totalSessions')

    if (!assignment) {
      return res.status(404).json({ message: 'Không tìm thấy phân công' })
    }

    // Neu co scheduleId, tim dung lich do
    let schedule = null
    if (scheduleId) {
      schedule = await WorkoutSchedule.findOne({ _id: scheduleId, memberId: assignment.memberId })
        .populate('templateId', 'name goal days')
    } else {
      // Fallback: lay lich moi nhat cua member (tuong thich nguoc)
      schedule = await WorkoutSchedule.findOne({
        memberId: assignment.memberId,
        templateId: assignment.workoutId?._id,
        status: 'active',
      })
        .populate('templateId', 'name goal days')
        .sort({ createdAt: -1 })
    }

    res.json({ assignment, schedule })
  } catch (error) {
    return sendError(res, error)
  }
}

export const endWorkout = async (req, res) => {
  try {
    const { id } = req.params
    const { scheduleId } = req.body
    const ptId = req.user._id

    // Neu co scheduleId, chi ket thuc 1 lich cu the, khong anh huong toi PTAssignment
    if (scheduleId) {
      const schedule = await WorkoutSchedule.findOne({ _id: scheduleId, status: 'active' })
      if (!schedule) {
        return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
      }

      schedule.status = 'completed'
      await schedule.save()

      // If no active schedules remain for this member, clear workoutId on PTAssignment
      const remainingActive = await WorkoutSchedule.findOne({ memberId: schedule.memberId, status: 'active' })
      if (!remainingActive) {
        await PTAssignment.updateMany(
          { memberId: schedule.memberId, status: 'active' },
          { $set: { workoutId: null } },
        )
      }

      const sessions = schedule.sessions || []
      const completedCount = sessions.filter((s) => s.status === 'completed').length

      await createNotification({
        receiverId: schedule.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
        title: 'Giáo án tuần đã hoàn thành',
        content: `PT đã kết thúc giáo án tuần ${schedule.weekIndex || '?'}/${schedule.totalWeeks || '?'} của bạn.`,
        relatedId: schedule._id,
        relatedType: 'WorkoutSchedule',
        redirectUrl: '/my-schedules',
        createdBy: 'PT',
      }).catch(err => console.error('Notify endWorkout failed:', err.message))

      const scheduleMember = await User.findById(schedule.memberId).select('name fullName').lean()
      const scheduleMemberName = scheduleMember?.fullName || scheduleMember?.name || 'Hội viên'
      await createNotification({
        receiverId: ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
        title: 'Đã kết thúc giáo án tuần',
        content: `Đã kết thúc giáo án tuần ${schedule.weekIndex || '?'}/${schedule.totalWeeks || '?'} của hội viên ${scheduleMemberName}.`,
        relatedId: schedule._id,
        relatedType: 'WorkoutSchedule',
        redirectUrl: '/pt/clients',
        createdBy: 'PT',
      }).catch(err => console.error('Notify PT endWorkout failed:', err.message))

      return res.json({
        message: 'Đã kết thúc giáo án tuần thành công',
        schedule,
        completedCount,
        totalSessions: sessions.length,
      })
    }

    // Neu co memberId (va endAll=true), ket thuc tat ca lich active cua member do, khong dong PTAssignment
    if (req.body.memberId && req.body.endAll) {
      // FIX: Verify PT is assigned to this member before allowing operation
      const ptAssignment = await PTAssignment.findOne({
        memberId: req.body.memberId,
        ptId: req.user._id,
        status: 'active',
      }).lean()
      if (!ptAssignment) {
        return res.status(403).json({ message: 'Bạn không phụ trách hội viên này' })
      }

      // GUARD: dry-check (default). Caller MUST pass confirm=true to actually perform the update.
      // Front-end first calls without confirm=true to preview how many sessions are incomplete,
      // then displays a modal warning; user must accept before second call with confirm=true.
      const confirmFlag = req.body.confirm === true || req.body.confirm === 'true'

      // Always load active schedules so we can both preview and execute on the same data
      const activeSchedules = await WorkoutSchedule.find({
        memberId: req.body.memberId,
        status: 'active',
      }).lean()

      // Build preview: per-schedule breakdown of completed vs incomplete sessions
      const preview = activeSchedules.map(s => {
        const sessions = s.sessions || []
        return {
          scheduleId: String(s._id),
          weekLabel: s.totalWeeks && s.totalWeeks > 1
            ? `Tuần ${s.weekIndex || '?'}/${s.totalWeeks}`
            : 'Giáo án',
          totalSessions: sessions.length,
          completedSessions: sessions.filter(x => x.status === 'completed').length,
          incompleteSessions: sessions.filter(x => x.status !== 'completed').length,
        }
      })
      const totalIncomplete = preview.reduce((sum, p) => sum + p.incompleteSessions, 0)
      const totalSessions = preview.reduce((sum, p) => sum + p.totalSessions, 0)
      const totalCompletedSessions = preview.reduce((sum, p) => sum + p.completedSessions, 0)
      const allComplete = totalIncomplete === 0

      // Dry-check: return preview, do NOT modify anything
      if (!confirmFlag) {
        return res.json({
          message: allComplete
            ? 'Tất cả buổi tập đã hoàn thành, sẵn sàng kết thúc.'
            : `Còn ${totalIncomplete} buổi chưa hoàn thành. Cần xác nhận để kết thúc.`,
          dryCheck: true,
          canEnd: true,
          allComplete,
          preview: {
            scheduleCount: preview.length,
            totalSessions,
            totalCompletedSessions,
            totalIncomplete,
            perSchedule: preview,
          },
        })
      }

      // Confirm=true: execute end-all
      if (activeSchedules.length === 0) {
        return res.status(400).json({ message: 'Không có lịch active nào để kết thúc' })
      }

      let endAllResult
      const endAllSession = await mongoose.startSession()
      try {
        endAllSession.startTransaction()

        endAllResult = await WorkoutSchedule.updateMany(
          { memberId: req.body.memberId, status: 'active' },
          { $set: { status: 'completed' } },
          { session: endAllSession },
        )

        // All schedules ended → clear workoutId on PTAssignment
        await PTAssignment.updateMany(
          { memberId: req.body.memberId, status: 'active' },
          { $set: { workoutId: null } },
          { session: endAllSession },
        )

        await endAllSession.commitTransaction()
      } catch (txErr) {
        await endAllSession.abortTransaction()
        throw txErr
      } finally {
        endAllSession.endSession()
      }

      await createNotification({
        receiverId: req.body.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
        title: 'Giáo án tập đã kết thúc',
        content: 'PT đã kết thúc toàn bộ giáo án tập của bạn.',
        relatedId: id,
        relatedType: 'PTAssignment',
        redirectUrl: '/my-schedules',
        createdBy: 'PT',
      }).catch(err => console.error('Notify endWorkout failed:', err.message))

      const endAllMember = await User.findById(req.body.memberId).select('name fullName').lean()
      const endAllMemberName = endAllMember?.fullName || endAllMember?.name || 'Hội viên'
      await createNotification({
        receiverId: ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
        title: 'Đã kết thúc toàn bộ giáo án',
        content: `Đã kết thúc toàn bộ giáo án của hội viên ${endAllMemberName}.`,
        relatedId: id,
        relatedType: 'PTAssignment',
        redirectUrl: '/pt/clients',
        createdBy: 'PT',
      }).catch(err => console.error('Notify PT endWorkout failed:', err.message))

      return res.json({
        message: 'Đã kết thúc toàn bộ giáo án thành công',
        modifiedCount: endAllResult.modifiedCount,
        endedAt: new Date().toISOString(),
        preview: {
          scheduleCount: preview.length,
          totalSessions,
          totalCompletedSessions,
          totalIncomplete,
          perSchedule: preview,
        },
      })
    }

    // Khong co scheduleId → giu nguyen hanh vi cu (ket thuc toan bo)
    const assignment = await PTAssignment.findOne({ _id: id, ptId, status: 'active' })
    if (!assignment) {
      return res.status(404).json({ message: 'Không tìm thấy phân công' })
    }

    if (assignment.status === 'pending_end_approval') {
      return res.status(400).json({ message: 'Không thể kết thúc giáo án khi đang chờ Admin phê duyệt kết thúc phụ trách' })
    }

    // Save snapshot of workout name before nullifying workoutId
    if (assignment.workoutId) {
      const workout = await Workout.findById(assignment.workoutId).select('name').lean()
      assignment.workoutNameSnapshot = workout?.name || ''
    }

    assignment.status = 'completed'
    assignment.endDate = new Date()
    assignment.workoutEndedAt = new Date()
    assignment.workoutEndedBy = ptId
    assignment.workoutId = null
    await assignment.save()

    const memberUser = await User.findById(assignment.memberId).select('name fullName').lean()
    const memberName = memberUser?.fullName || memberUser?.name || 'Hội viên'

    await createNotification({
      receiverId: assignment.memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
      title: 'Giáo án tập đã hoàn thành',
      content: `PT đã kết thúc giáo án tập của bạn.`,
      relatedId: assignment._id,
      relatedType: 'PTAssignment',
      redirectUrl: '/my-workouts',
      createdBy: 'PT',
    }).catch(err => console.error('Notify endWorkout failed:', err.message))

    await createNotification({
      receiverId: ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.PT_WORKOUT_COMPLETED,
      title: 'Đã kết thúc giáo án tập',
      content: `Giáo án "${assignment.workoutNameSnapshot}" của hội viên ${memberName} đã kết thúc.`,
      relatedId: assignment._id,
      relatedType: 'PTAssignment',
      redirectUrl: '/pt/clients',
      createdBy: 'PT',
    }).catch(err => console.error('Notify PT endWorkout failed:', err.message))

    await WorkoutSchedule.updateMany(
      { memberId: assignment.memberId, status: 'active' },
      { $set: { status: 'completed' } },
    )

    const updated = await PTAssignment.findById(id)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal')

    res.json({ message: 'Đã kết thúc giáo án thành công', assignment: updated })
  } catch (error) {
    return sendError(res, error)
  }
}

// ============================================================
// CLASS ENROLLMENT:Transfer / Leave class (tường minh)
// ============================================================

/**
 * Lấy thông tin enrollment hiện tại của 1 hội viên + preview sức chứa các lớp khả dụng
 * (dùng cho UI popup "Chuyển lớp" trước khi chọn lớp đích).
 *
 * Query: ?memberId=...
 * Response:
 *   - currentEnrollment: ClassEnrollment active hiện tại (nếu có) kèm class info
 *   - availableClasses: list các TrainingClass còn slot (đã exclude lớp hiện tại)
 */
export const getMemberEnrollmentPreview = async (req, res) => {
  try {
    const { memberId } = req.query
    if (!memberId) return res.status(400).json({ message: 'Thiếu memberId' })

    const currentEnrollment = await ClassEnrollment.findOne({ memberId, status: 'active' })
      .populate('classId', 'code name specialization daysOfWeek startTime endTime ptId floorId zoneId')
      .lean()

    const allClasses = await TrainingClass.find()
      .populate('ptId', 'name fullName')
      .populate('floorId', 'name')
      .populate('zoneId', 'name maxCapacity')
      .sort({ code: 1 })
      .lean()

    const availableClasses = []
    for (const c of allClasses) {
      const max = c.zoneId?.maxCapacity || 0
      const current = await countActiveEnrollment({ classId: c._id })
      const isCurrent = currentEnrollment && String(currentEnrollment.classId?._id) === String(c._id)
      availableClasses.push({
        _id: c._id,
        code: c.code,
        name: c.name,
        specialization: c.specialization,
        daysOfWeek: c.daysOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
        pt: c.ptId,
        floor: c.floorId,
        zone: c.zoneId,
        current,
        max,
        isFull: max > 0 && current >= max,
        isCurrent,
      })
    }

    res.json({
      currentEnrollment: currentEnrollment
        ? {
          enrollmentId: currentEnrollment._id,
          classId: currentEnrollment.classId?._id,
          code: currentEnrollment.classId?.code,
          name: currentEnrollment.classId?.name,
          joinedAt: currentEnrollment.joinedAt,
        }
        : null,
      availableClasses,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

/**
 * Chuyển hội viên sang lớp khác.
 * Body: { memberId, toClassId, reason?(optional) }
 *
 * Hành vi:
 *   - End enrollment active hiện tại (nếu có) với sourceReason='transfer_class'
 *   - Tạo enrollment active ở lớp mới (idempotent: nếu đã active ở lớp mới -> no-op)
 *   - Enforce capacity of new class (safety)
 */
export const transferMemberClass = async (req, res) => {
  const transferSession = await mongoose.startSession()
  try {
    transferSession.startTransaction()

    const { memberId, toClassId, reason } = req.body
    const actorId = req.user?._id

    if (!memberId || !toClassId) {
      await transferSession.abortTransaction()
      return res.status(400).json({ message: 'Thiếu memberId hoặc toClassId' })
    }

    // Get current enrollment (for log)
    const current = await ClassEnrollment.findOne({ memberId, status: 'active' })
      .populate('classId', 'code name')
      .session(transferSession)
      .lean()

    if (current && String(current.classId?._id) === String(toClassId)) {
      await transferSession.abortTransaction()
      return res.status(400).json({ message: 'Hội viên đang ở lớp này rồi, không cần chuyển' })
    }

    const targetClass = await TrainingClass.findById(toClassId).populate('zoneId', 'maxCapacity name').session(transferSession).lean()
    if (!targetClass) {
      await transferSession.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy lớp đích' })
    }

    let result
    try {
      result = await transferEnrollment({
        memberId,
        fromClassId: current?.classId?._id || null,
        toClassId,
        sourceReason: 'transfer_class',
        note: `Chuyển lớp bởi ${req.user?.role || 'system'}${reason ? ` — lý do: ${reason}` : ''}`,
        session: transferSession,
      })
    } catch (e) {
      await transferSession.abortTransaction()
      return res.status(e.statusCode || 409).json({ message: e.message })
    }

    await transferSession.commitTransaction()

    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Bạn đã được chuyển lớp',
      content: `Bạn đã được chuyển sang lớp "${targetClass.name}" (${targetClass.code})${current ? ` từ lớp "${current.classId?.name}" (${current.classId?.code})` : ''}.${reason ? `\n\nLý do: ${reason}` : ''}`,
      relatedId: toClassId,
      relatedType: 'TrainingClass',
      redirectUrl: '/my-schedules',
      createdBy: req.user?.role || 'System',
    }).catch(err => console.error('Notify transfer class failed:', err.message))

    // Notify PT who is assigned to this member
    const transferPtAssignment = await PTAssignment.findOne({ memberId, status: 'active' }).select('ptId').lean()
    if (transferPtAssignment?.ptId) {
      const transferMember = await User.findById(memberId).select('name fullName').lean()
      const transferMemberName = transferMember?.fullName || transferMember?.name || 'Hội viên'
      await createNotification({
        receiverId: transferPtAssignment.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
        title: 'Hội viên đã được chuyển lớp',
        content: `Hội viên ${transferMemberName} đã được chuyển sang lớp "${targetClass.name}" (${targetClass.code})${current ? ` từ lớp "${current.classId?.name}" (${current.classId?.code})` : ''}.${reason ? `\n\nLý do: ${reason}` : ''}`,
        relatedId: toClassId,
        relatedType: 'TrainingClass',
        redirectUrl: '/pt/clients',
        createdBy: req.user?.role || 'System',
      }).catch(err => console.error('Notify PT transfer class failed:', err.message))
    }

    res.json({
      message: `Đã chuyển hội viên sang lớp "${targetClass.name}" (${targetClass.code})`,
      transferredFrom: current?.classId?._id || null,
      transferredTo: toClassId,
      endedOld: result.endedOld,
      createdNew: result.createdNew,
    })
  } catch (error) {
    await transferSession.abortTransaction()
    return sendError(res, error)
  } finally {
    transferSession.endSession()
  }
}

/**
 * Rời khỏi lớp hiện tại (KHÔNG phải kết thúc phụ trách).
 * Body: { memberId, reason?(optional) }
 *
 * Hành vi:
 *   - End enrollment active hiện tại với sourceReason='member_request' (hoặc 'ended_by_pt' tuỳ actor)
 *   - KHÔNG đụng tới PTAssignment, WorkoutSchedule
 */
export const leaveMemberClass = async (req, res) => {
  const leaveSession = await mongoose.startSession()
  try {
    leaveSession.startTransaction()

    const { memberId, reason } = req.body
    const actorRole = req.user?.role

    if (!memberId) {
      await leaveSession.abortTransaction()
      return res.status(400).json({ message: 'Thiếu memberId' })
    }

    const current = await ClassEnrollment.findOne({ memberId, status: 'active' })
      .populate('classId', 'code name')
      .session(leaveSession)
      .lean()
    if (!current) {
      await leaveSession.abortTransaction()
      return res.status(404).json({ message: 'Hội viên không có lớp active nào để rời' })
    }

    const sourceReason = actorRole === 'member' ? 'member_request' : 'ended_by_pt'
    const note = `Rời lớp bởi ${actorRole || 'system'}${reason ? ` — lý do: ${reason}` : ''}`

    const { modifiedCount } = await endClassEnrollments({ memberId, sourceReason, note, session: leaveSession })

    await leaveSession.commitTransaction()

    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Bạn đã rời khỏi lớp',
      content: `Bạn đã rời khỏi lớp "${current.classId?.name}" (${current.classId?.code}).${reason ? `\n\nLý do: ${reason}` : ''}`,
      relatedId: current.classId?._id,
      relatedType: 'TrainingClass',
      redirectUrl: '/my-schedules',
      createdBy: actorRole || 'System',
    }).catch(err => console.error('Notify leave class failed:', err.message))

    // Notify PT who is assigned to this member
    const leavePtAssignment = await PTAssignment.findOne({ memberId, status: 'active' }).select('ptId').lean()
    if (leavePtAssignment?.ptId) {
      const leaveMember = await User.findById(memberId).select('name fullName').lean()
      const leaveMemberName = leaveMember?.fullName || leaveMember?.name || 'Hội viên'
      await createNotification({
        receiverId: leavePtAssignment.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
        title: 'Hội viên đã rời lớp',
        content: `Hội viên ${leaveMemberName} đã rời khỏi lớp "${current.classId?.name}" (${current.classId?.code}).${reason ? `\n\nLý do: ${reason}` : ''}`,
        relatedId: current.classId?._id,
        relatedType: 'TrainingClass',
        redirectUrl: '/pt/clients',
        createdBy: actorRole || 'System',
      }).catch(err => console.error('Notify PT leave class failed:', err.message))
    }

    res.json({
      message: `Đã rời khỏi lớp "${current.classId?.name}" (${current.classId?.code})`,
      leftClassId: current.classId?._id || null,
      modifiedCount,
    })
  } catch (error) {
    await leaveSession.abortTransaction()
    return sendError(res, error)
  } finally {
    leaveSession.endSession()
  }
}
