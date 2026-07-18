import mongoose from 'mongoose'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import Workout from '../models/Workout.js'
import { applyOverridesToSchedules } from '../services/shiftSwapService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

/**
 * For sessions missing endTime / className / location / classCode,
 * match against the PT's TrainingClass to fill them in OR correct wrong values.
 */
const enrichSessions = async (schedules) => {
  if (!schedules.length) return schedules

  const ptIds = [...new Set(schedules.map(s => {
    const p = s.assignedBy
    return String((p && typeof p === 'object' ? p._id : p) || '')
  }).filter(Boolean))]

  if (!ptIds.length) return schedules

  const classes = await TrainingClass.find({ ptId: { $in: ptIds } })
    .populate('zoneId', 'name maxCapacity')
    .populate('floorId', 'name')
    .lean()

  for (const schedule of schedules) {
    const ptId = String(schedule.assignedBy && typeof schedule.assignedBy === 'object' ? schedule.assignedBy._id : schedule.assignedBy)
    const ptClasses = classes.filter(c => String(c.ptId) === ptId)

    for (const session of schedule.sessions || []) {
      if (!session.date || !session.time) continue

      const dayOfWeek = new Date(session.date).getDay()
      const sessionTime = session.time

      const matched = ptClasses.find(c =>
        (c.daysOfWeek || []).includes(dayOfWeek) && c.startTime === sessionTime
      )

      if (matched) {
        if (!session.endTime || session.endTime === '') session.endTime = matched.endTime || ''
        session.className = matched.name || ''
        session.classCode = matched.code || ''

        const parts = []
        if (matched.floorId && typeof matched.floorId === 'object' && matched.floorId.name) parts.push(matched.floorId.name)
        if (matched.zoneId && typeof matched.zoneId === 'object' && matched.zoneId.name) parts.push(matched.zoneId.name)
        session.location = parts.join(' - ') || matched.name || ''
      }
    }
  }
  return schedules
}

export const createSchedule = async (req, res) => {
  try {
    const { templateId, memberId, sessions, weekIndex, totalWeeks } = req.body
    const ptId = req.user._id

    if (!templateId || !memberId || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({ message: 'Thiếu thông tin: templateId, memberId, sessions' })
    }

    const template = await Workout.findById(templateId)
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Không tìm thấy giáo án mẫu' })
    }

    // Match each session to its training class
    const matchedClassMap = new Map()
    for (const s of sessions) {
      if (!s.date || !s.time) continue
      const dayOfWeek = new Date(s.date).getDay()
      const matchQuery = { ptId, daysOfWeek: dayOfWeek, startTime: s.time }
      if (s.endTime) matchQuery.endTime = s.endTime
      const match = await TrainingClass.findOne(matchQuery).lean()
      if (match) {
        matchedClassMap.set(s.dayOrder, match)
      } else {
        console.warn(
          `[createSchedule] No exact class match for session dayOrder=${s.dayOrder} ` +
          `date=${s.date} time=${s.time} endTime=${s.endTime} ptId=${ptId}`
        )
      }
    }

    const schedule = await WorkoutSchedule.create({
      memberId,
      templateId,
      assignedBy: ptId,
      startDate: new Date(),
      weekIndex: weekIndex || 1,
      totalWeeks: totalWeeks || 1,
      status: 'active',
      sessions: sessions.map((s) => {
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
          exercises: (s.exercises || []).map((ex) => ({
            name: ex.name,
            note: ex.note || '',
            completed: false,
          })),
          status: 'pending',
          feedback: '',
        }
      }),
    })

    const { createAssignment } = await import('../services/ptAssignmentService.js')
    const pa = await createAssignment({ memberId, ptId })
    pa.workoutId = templateId
    await pa.save()

    const populated = await WorkoutSchedule.findById(schedule._id)
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Lịch tập mới đã được tạo',
      content: `Lịch tập mới của bạn đã được PT tạo.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule created failed:', err.message))

    res.status(201).json({ schedule: populated })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMySchedules = async (req, res) => {
  try {
    const memberId = req.user._id

    let schedules = await WorkoutSchedule.find({ memberId, status: 'active' })
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')
      .sort({ createdAt: -1 })

    schedules = await enrichSessions(schedules)
    schedules = await applyOverridesToSchedules(schedules)
    for (const s of schedules) {
      if (s.sessions?.length) {
        s.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    res.json({ schedules })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMemberSchedules = async (req, res) => {
  try {
    const { memberId } = req.params

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'ID hội viên không hợp lệ' })
    }

    let schedules = await WorkoutSchedule.find({ memberId, status: 'active' })
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')
      .sort({ createdAt: -1 })

    schedules = await enrichSessions(schedules)
    schedules = await applyOverridesToSchedules(schedules)

    for (const s of schedules) {
      if (s.sessions?.length) {
        s.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    res.json({ schedules })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateSessionStatus = async (req, res) => {
  try {
    const { scheduleId, dayOrder } = req.params
    const { status, feedback, exercises } = req.body

    const schedule = await WorkoutSchedule.findById(scheduleId)
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    const session = schedule.sessions.find((s) => s.dayOrder === Number(dayOrder))
    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy buổi tập' })
    }

    if (status) session.status = status
    if (feedback !== undefined) session.feedback = feedback
    if (exercises && Array.isArray(exercises)) {
      exercises.forEach((ex) => {
        const match = session.exercises.find((e) => e.name === ex.name)
        if (match && ex.completed !== undefined) match.completed = ex.completed
      })
    }

    await schedule.save()

    if (status === 'completed') {
      createNotification({
        receiverId: schedule.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_SESSION_COMPLETED,
        title: 'Buổi tập đã hoàn thành',
        content: `Buổi tập trong lịch của bạn đã được đánh dấu hoàn thành.`,
        relatedId: schedule._id,
        relatedType: 'WorkoutSchedule',
        redirectUrl: '/my-schedules',
        createdBy: 'PT',
      }).catch(err => console.error('Notify session completed failed:', err.message))
    }

    res.json({ schedule })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params
    const schedule = await WorkoutSchedule.findById(id)
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    const memberId = schedule.memberId
    const templateId = schedule.templateId

    await WorkoutSchedule.findByIdAndDelete(id)

    // Neu khong con WorkoutSchedule active nao cho member nay, xoa workoutId khoi PTAssignment
    const remaining = await WorkoutSchedule.countDocuments({ memberId, status: 'active' })
    if (remaining === 0) {
      await PTAssignment.updateMany(
        { memberId, status: 'active', workoutId: templateId },
        { $set: { workoutId: null } },
      )
    }

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Lịch tập đã bị xóa',
      content: `Lịch tập của bạn đã bị xóa.`,
      relatedId: null,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule deleted failed:', err.message))

    res.json({ message: 'Đã xóa lịch tập' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
