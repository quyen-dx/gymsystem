import mongoose from 'mongoose'
import PTAssignment from '../models/PTAssignment.js'
import Workout from '../models/Workout.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import * as ptAssignmentService from '../services/ptAssignmentService.js'
import AppError from '../utils/appError.js'
import sendError from '../utils/sendError.js'

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
    const { page = 1, limit = 20 } = req.query
    const result = await ptAssignmentService.findHistoryByPt({
      ptId: req.user._id,
      page,
      limit,
    })
    res.json(result)
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

    const assignment = await PTAssignment.findById(id)
    if (!assignment) throw new AppError('Không tìm thấy phân công', 404)

    assignment.workoutId = workoutId || null
    await assignment.save()

    const updated = await PTAssignment.findById(id)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal')

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
    const { templateId, memberId, sessions } = req.body
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

    // Determine which class the sessions correspond to (first session with date + time)
    const firstSession = sessions.find(s => s.date && s.time)
    let matchedClass = null
    if (firstSession) {
      const dayOfWeek = new Date(firstSession.date).getDay()
      matchedClass = await TrainingClass.findOne({
        ptId,
        daysOfWeek: dayOfWeek,
        startTime: firstSession.time,
      }).session(mongoSession).lean()
    }

    // If member is not yet enrolled in this class, create enrollment (capacity-permitting)
    if (matchedClass) {
      const existingEnrollment = await TrainingAssignment.findOne({
        memberId,
        classId: matchedClass._id,
        status: 'active',
      }).session(mongoSession)

      if (!existingEnrollment) {
        const zone = matchedClass.zoneId
          ? await mongoose.model('Zone').findById(matchedClass.zoneId).session(mongoSession).lean()
          : null
        const maxCapacity = zone?.maxCapacity || 0
        if (maxCapacity > 0) {
          const currentCount = await TrainingAssignment.countDocuments({
            classId: matchedClass._id,
            status: 'active',
          }).session(mongoSession)
          if (currentCount >= maxCapacity) {
            await mongoSession.abortTransaction()
            return res.status(409).json({ message: `Lớp ${matchedClass.name} đã đầy (${currentCount}/${maxCapacity})` })
          }
        }

        await TrainingAssignment.create([{
          memberId,
          classId: matchedClass._id,
          status: 'active',
          startDate: new Date(),
        }], { session: mongoSession })
      }
    }

    const schedule = await WorkoutSchedule.create([{
      memberId,
      templateId,
      assignedBy: ptId,
      startDate: new Date(),
      status: 'active',
      sessions: sessions.map(s => ({
        dayOrder: s.dayOrder,
        date: new Date(s.date),
        time: s.time || '',
        endTime: s.endTime || '',
        className: s.className || '',
        classCode: s.classCode || '',
        title: s.title || '',
        muscleGroup: s.muscleGroup || '',
        exercises: (s.exercises || []).map(ex => ({
          name: ex.name,
          note: ex.note || '',
          completed: false,
        })),
        status: 'pending',
        feedback: '',
      })),
    }], { session: mongoSession })

    const pa = await ptAssignmentService.createAssignment({ memberId, ptId, session: mongoSession })

    pa.workoutId = templateId
    await pa.save({ session: mongoSession })

    await mongoSession.commitTransaction()

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
