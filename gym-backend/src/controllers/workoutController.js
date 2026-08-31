import mongoose from 'mongoose'
import Workout from '../models/Workout.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import PTAssignment from '../models/PTAssignment.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import SessionFeedback from '../models/SessionFeedback.js'
import { isValidGoalForSpecialization } from '../config/specializationGoals.js'
import { buildSchedulesFromTemplate } from '../services/ptAssignmentService.js'

const isAdminRole = (role) => role === 'super_admin' || role === 'admin'
const isPtRole = (role) => role === 'pt'
const isMemberRole = (role) => role === 'member'
const sameId = (left, right) => String(left || '') === String(right || '')
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const parseIndex = (value) => {
  if (value === undefined || value === null || value === '') return NaN
  return Number(value)
}

const isValidIndex = (value) => Number.isInteger(value) && value >= 0

const getIndexes = (body) => ({
  weekIndex: parseIndex(body.weekIndex),
  sessionIndex: parseIndex(body.sessionIndex),
  exerciseIndex: parseIndex(body.exerciseIndex),
})

const canViewWorkout = (user, workout) =>
  isAdminRole(user.role) ||
  sameId(workout.ptId, user._id) ||
  sameId(workout.memberId, user._id)

const canViewTemplate = (user, workout) => {
  if (isAdminRole(user.role)) return true
  // Chế độ riêng tư: chỉ PT tạo được xem (giáo án cũ không có field này mặc định là công khai)
  if (workout.visibility === 'private' && !sameId(workout.ptId, user._id)) return false
  if (workout.templateStatus === 'published') return true
  if (workout.templateStatus === 'under_review') return true
  if (workout.templateStatus === 'hidden') {
    return isAdminRole(user.role) || sameId(workout.ptId, user._id)
  }
  if (workout.templateStatus === 'deleted') return isAdminRole(user.role)
  return isPtRole(user.role) || isAdminRole(user.role)
}

const canManageWorkout = (user, workout) =>
  isAdminRole(user.role) || (isPtRole(user.role) && sameId(workout.ptId, user._id))

const canUpdateSessionProgress = (user, workout) =>
  canManageWorkout(user, workout) || (isMemberRole(user.role) && sameId(workout.memberId, user._id))

const buildScopedWorkoutFilter = (user, memberId, isTemplate) => {
  const base = {}
  if (isTemplate !== undefined) {
    base.isTemplate = isTemplate === 'true'
    // Chi hien thi template published/under_review, dong nhat voi thu vien /pt/workouts
    base.templateStatus = { $in: ['published', 'under_review'] }
  }
  if (isAdminRole(user.role)) {
    if (memberId) base.memberId = memberId
    return base
  }
  if (isPtRole(user.role)) {
    // Template là thư viện dùng chung: PT thấy giáo án công khai + giáo án của chính mình
    if (isTemplate) {
      base.$and = [
        { $or: [{ visibility: { $ne: 'private' } }, { ptId: user._id }] },
      ]
    } else {
      base.ptId = user._id
    }
    if (memberId) base.memberId = memberId
    return base
  }
  base.memberId = user._id
  return base
}

const recalculateCompletionRate = (workout) => {
  let total = 0
  let completed = 0

  workout.weeks.forEach((week) => {
    week.sessions.forEach((session) => {
      session.exercises.forEach((exercise) => {
        total += 1
        if (exercise.completed) completed += 1
      })
    })
  })

  workout.completionRate = total === 0 ? 0 : Math.round((completed / total) * 100)
}

const buildProgressSummary = (workout) => ({
  workoutId: workout._id,
  name: workout.name,
  goal: workout.goal,
  startDate: workout.startDate,
  endDate: workout.endDate,
  description: workout.description,
  memberId: workout.memberId,
  ptId: workout.ptId,
  completionRate: workout.completionRate,
  weeks: workout.weeks.map((week, weekIndex) => {
    let weekTotal = 0
    let weekCompleted = 0

    const sessions = week.sessions.map((session, sessionIndex) => {
      const totalExercises = session.exercises.length
      const completedExercises = session.exercises.filter((exercise) => exercise.completed).length

      weekTotal += totalExercises
      weekCompleted += completedExercises

      return {
        weekIndex,
        sessionIndex,
        sessionName: session.sessionName,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        feedback: session.feedback,
        totalExercises,
        completedExercises,
        completionRate: totalExercises === 0 ? 0 : Math.round((completedExercises / totalExercises) * 100),
        exercises: session.exercises.map((exercise, exerciseIndex) => ({
          exerciseIndex,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restTime: exercise.restTime,
          techniqueNote: exercise.techniqueNote,
          completed: exercise.completed,
          completedAt: exercise.completedAt,
          actualCompletionTime: exercise.actualCompletionTime,
        })),
      }
    })

    return {
      weekIndex,
      weekNumber: week.weekNumber,
      completionRate: weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 100),
      sessions,
    }
  }),
})

const getWorkoutOr404 = async (id, res, opts = {}) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: 'ID workout không hợp lệ' })
    return null
  }

  let query = Workout.findById(id)
  if (opts.populatePt) query = query.populate('ptId', 'name fullName email phone avatar')
  if (opts.populateMember) query = query.populate('memberId', 'name fullName email phone memberCode avatar')

  const workout = await query
  if (!workout) {
    res.status(404).json({ message: 'Không tìm thấy workout' })
    return null
  }

  return workout
}

const getSessionOr400 = (workout, weekIndex, sessionIndex, res) => {
  if (!isValidIndex(weekIndex) || !isValidIndex(sessionIndex)) {
    res.status(400).json({ message: 'Tuần hoặc buổi tập không hợp lệ' })
    return null
  }

  const session = workout.weeks[weekIndex]?.sessions[sessionIndex]
  if (!session) {
    res.status(400).json({ message: 'Tuần hoặc buổi tập không hợp lệ' })
    return null
  }

  return session
}

const REASON_LABELS = {
  wrong_expertise: 'Sai chuyên môn',
  incorrect_content: 'Nội dung không đúng kỹ thuật',
  missing_info: 'Thiếu thông tin',
  spam: 'Spam',
  duplicate: 'Trùng lặp',
  other: 'Khác',
}

// ============ SHARED LIBRARY ============

export const getSharedTemplates = async (req, res) => {
  try {
    if (!isPtRole(req.user.role) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Ban khong co quyen truy cap thu vien giao an' })
    }

    const {
      search,
      specializationId,
      goal,
      createdBy,
      trainerId,
      mine,
      totalSessions,
      status: templateStatus,
      sortBy,
      page = 1,
      limit = 20,
    } = req.query

    const filter = { isTemplate: true }

    if (isAdminRole(req.user.role)) {
      if (templateStatus) {
        filter.templateStatus = templateStatus
      } else {
        filter.templateStatus = { $ne: 'deleted' }
      }
    } else {
      filter.templateStatus = { $in: ['published', 'under_review'] }
      // Trang "Giáo án của tôi" (mine=true): toàn bộ giáo án của chính PT, kể cả chế độ riêng tư.
      // Thư viện chung: chỉ giáo án công khai (public / giáo án cũ không có field).
      if (mine === 'true' || mine === '1') {
        filter.ptId = req.user._id
      } else {
        filter.visibility = { $ne: 'private' }
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { goal: { $regex: search, $options: 'i' } },
        { specializationId: { $regex: search, $options: 'i' } },
      ]
    }

    if (specializationId) {
      filter.specializationId = specializationId
    }

    if (goal) {
      filter.goal = { $regex: goal, $options: 'i' }
    }

    if (mine === 'true' || mine === '1') {
      filter.ptId = req.user._id
    } else if (trainerId && isValidObjectId(trainerId)) {
      filter.ptId = trainerId
    } else if (createdBy) {
      if (isValidObjectId(createdBy)) {
        filter.ptId = createdBy
      } else {
        filter.ptId = { $regex: createdBy, $options: 'i' }
      }
    }

    if (totalSessions) {
      const count = Number(totalSessions)
      if (!isNaN(count)) {
        filter.totalSessions = count
      }
    }

    let sort = { createdAt: -1 }
    if (sortBy === 'most_used') {
      sort = { assignmentCount: -1, createdAt: -1 }
    } else if (sortBy === 'newest') {
      sort = { createdAt: -1 }
    }

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const [workouts, total] = await Promise.all([
      Workout.find(filter)
        .populate('ptId', 'name fullName email phone avatar')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Workout.countDocuments(filter),
    ])

    return res.status(200).json({
      workouts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach giao an', error: error.message })
  }
}

export const getDistinctSpecializations = async (req, res) => {
  try {
    const filter = {
      isTemplate: true,
      templateStatus: { $in: ['published', 'under_review'] },
      specializationId: { $ne: '' },
    }
    if (!isAdminRole(req.user.role)) {
      filter.$or = [{ visibility: { $ne: 'private' } }, { ptId: req.user._id }]
    }
    const specializations = await Workout.distinct('specializationId', filter)
    return res.status(200).json({ specializations })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach chuyen mon', error: error.message })
  }
}

export const getDistinctGoals = async (req, res) => {
  try {
    const filter = {
      isTemplate: true,
      templateStatus: { $in: ['published', 'under_review'] },
      goal: { $ne: '' },
    }
    if (!isAdminRole(req.user.role)) {
      filter.$or = [{ visibility: { $ne: 'private' } }, { ptId: req.user._id }]
    }
    const goals = await Workout.distinct('goal', filter)
    return res.status(200).json({ goals })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách mục tiêu', error: error.message })
  }
}

export const getDistinctGoalsBySpecialization = async (req, res) => {
  try {
    const { specializationId } = req.query
    const filter = {
      isTemplate: true,
      templateStatus: { $in: ['published', 'under_review'] },
      goal: { $ne: '' },
    }
    if (!isAdminRole(req.user.role)) {
      filter.$or = [{ visibility: { $ne: 'private' } }, { ptId: req.user._id }]
    }
    if (specializationId) {
      filter.specializationId = specializationId
    }
    const goals = await Workout.distinct('goal', filter)
    return res.status(200).json({ goals })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách mục tiêu', error: error.message })
  }
}

export const getDistinctTrainersWithWorkouts = async (req, res) => {
  try {
    const match = { isTemplate: true, templateStatus: { $in: ['published', 'under_review'] } }
    if (!isAdminRole(req.user.role)) {
      match.$or = [{ visibility: { $ne: 'private' } }, { ptId: req.user._id }]
    }
    const trainers = await Workout.aggregate([
      { $match: match },
      { $group: { _id: '$ptId' } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          fullName: '$user.fullName',
          email: '$user.email',
          avatar: '$user.avatar',
        },
      },
    ])
    return res.status(200).json({ trainers })
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách PT', error: error.message })
  }
}

// ============ GENERAL ============

export const getAllWorkouts = async (req, res) => {
  try {
    const { memberId, isTemplate } = req.query
    const workouts = await Workout.find(buildScopedWorkoutFilter(req.user, memberId, isTemplate))
      .populate('memberId', 'name fullName email phone memberCode avatar')
      .populate('ptId', 'name fullName email phone avatar')
      .sort({ createdAt: -1 })

    return res.status(200).json(workouts)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach workout', error: error.message })
  }
}

export const getWorkoutById = async (req, res) => {
  try {
    const workout = await getWorkoutOr404(req.params.id, res, { populatePt: true, populateMember: true })
    if (!workout) return

    if (workout.isTemplate) {
      if (!canViewTemplate(req.user, workout)) {
        return res.status(403).json({ message: 'Ban khong co quyen xem giao an nay' })
      }
    } else {
      if (!canViewWorkout(req.user, workout)) {
        return res.status(403).json({ message: 'Ban khong co quyen xem workout nay' })
      }
    }

    return res.status(200).json(workout)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay workout', error: error.message })
  }
}

export const createWorkout = async (req, res) => {
  try {
    if (!isPtRole(req.user.role) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi PT moi duoc tao workout' })
    }

    const isTemplate = req.body.isTemplate === true || req.body.isTemplate === 'true'
    const payload = {
      name: req.body.name || req.body.workoutName,
      goal: req.body.goal,
      duration: req.body.duration || req.body.durationWeeks,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      description: req.body.description,
      memberId: req.body.memberId || req.body.member,
      ptId: isPtRole(req.user.role) ? req.user._id : (req.body.ptId || req.body.personalTrainer),
      weeks: req.body.weeks || [],
      days: req.body.days || [],
      estimatedCalories: req.body.estimatedCalories || 0,
      isTemplate,
      status: isTemplate ? undefined : (req.body.status || 'active'),
      specializationId: req.body.specializationId || '',
      templateStatus: isTemplate ? 'published' : undefined,
      // Chế độ hiển thị: 'public' = mọi PT xem được, mặc định 'private' (chỉ mình PT tạo)
      visibility: isTemplate ? (req.body.visibility === 'public' ? 'public' : 'private') : undefined,
      version: 1,
    }

    if (isTemplate && payload.specializationId && payload.goal) {
      if (!isValidGoalForSpecialization(payload.specializationId, payload.goal)) {
        return res.status(400).json({ message: `Muc tieu "${payload.goal}" khong thuoc chuyen mon "${payload.specializationId}"` })
      }
    }

    if (!isTemplate && (!payload.memberId || !isValidObjectId(payload.memberId))) {
      return res.status(400).json({ message: 'memberId khong hop le' })
    }

    if (!payload.ptId || !isValidObjectId(payload.ptId)) {
      return res.status(400).json({ message: 'ptId khong hop le' })
    }

    const workout = await Workout.create(payload)

    return res.status(201).json({ message: 'Tao workout thanh cong', workout })
  } catch (error) {
    console.error('createWorkout error:', error)
    return res.status(400).json({ message: 'Tao workout that bai', error: error.message })
  }
}

export const updateWorkout = async (req, res) => {
  try {
    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    if (!canManageWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen sua giao an nay' })
    }

    const specId = req.body.specializationId !== undefined ? req.body.specializationId : workout.specializationId
    const goalVal = req.body.goal !== undefined ? req.body.goal : workout.goal
    if (workout.isTemplate && specId && goalVal) {
      if (!isValidGoalForSpecialization(specId, goalVal)) {
        return res.status(400).json({ message: `Muc tieu "${goalVal}" khong thuoc chuyen mon "${specId}"` })
      }
    }

    const mapping = {
      workoutName: 'name',
      durationWeeks: 'duration',
      member: 'memberId',
      personalTrainer: 'ptId',
    }

    const allowedFields = [
      'name', 'goal', 'duration', 'startDate', 'endDate', 'description',
      'memberId', 'ptId', 'weeks', 'days', 'estimatedCalories',
      'isTemplate', 'status', 'specializationId', 'visibility',
    ]
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) workout[field] = req.body[field]
    })

    for (const [frontend, backend] of Object.entries(mapping)) {
      if (req.body[frontend] !== undefined) workout[backend] = req.body[frontend]
    }

    if (workout.isModified('name') || workout.isModified('goal') || workout.isModified('days') || workout.isModified('weeks')) {
      workout.version = (workout.version || 1) + 1
    }

    recalculateCompletionRate(workout)
    await workout.save()

    return res.status(200).json({ message: 'Cap nhat workout thanh cong', workout })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat workout that bai', error: error.message })
  }
}

export const deleteWorkout = async (req, res) => {
  try {
    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    if (!canManageWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa giao an nay' })
    }

    if (workout.isTemplate) {
      workout.templateStatus = 'deleted'
      await workout.save()
      return res.status(200).json({ message: 'Da xoa giao an khoi thu vien' })
    }

    await workout.deleteOne()
    return res.status(200).json({ message: 'Xoa workout thanh cong' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa workout that bai', error: error.message })
  }
}

// ============ ADMIN: HIDE / RESTORE ============

export const hideWorkout = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen an giao an' })
    }

    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    workout.templateStatus = 'hidden'
    await workout.save()

    if (workout.ptId) {
      await createNotification({
        receiverId: workout.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.WORKOUT_HIDDEN,
        title: 'Giáo án của bạn đã bị Ẩn',
        content: `Giáo án "${workout.name}" đã bị ẩn khỏi thư viện. Lý do: ${req.body.reason || 'Vi phạm nội dung'}. Vui lòng chỉnh sửa trước khi gửi duyệt lại.`,
        createdBy: 'Admin',
        sendEmail: false,
      })
    }

    return res.status(200).json({ message: 'Da an giao an', workout })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the an giao an', error: error.message })
  }
}

export const restoreWorkout = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen khoi phuc giao an' })
    }

    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    workout.templateStatus = 'published'
    await workout.save()

    if (workout.ptId) {
      await createNotification({
        receiverId: workout.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.WORKOUT_RESTORED,
        title: 'Giáo án của bạn đã được khôi phục',
        content: `Giáo án "${workout.name}" đã được khôi phục và hiển thị lại trong thư viện.`,
        createdBy: 'Admin',
        sendEmail: false,
      })
    }

    return res.status(200).json({ message: 'Da khoi phuc giao an', workout })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the khoi phuc giao an', error: error.message })
  }
}

// ============ ASSIGN WORKOUT TO MEMBER ============

export const assignWorkoutToMember = async (req, res) => {
  try {
    if (!isPtRole(req.user.role) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi PT moi duoc gan giao an cho hoi vien' })
    }

    const { workoutTemplateId, memberId } = req.body

    if (!workoutTemplateId || !memberId) {
      return res.status(400).json({ message: 'Thieu workoutTemplateId hoac memberId' })
    }

    const template = await Workout.findById(workoutTemplateId)
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Khong tim thay giao an mau' })
    }

    if (template.templateStatus !== 'published' && !isAdminRole(req.user.role)) {
      if (template.templateStatus === 'hidden' && !sameId(template.ptId, req.user._id)) {
        return res.status(403).json({ message: 'Giao an nay dang bi an, khong the gan moi' })
      }
    }

    let assignment = await PTAssignment.findOne({
      memberId,
      ptId: req.user._id,
      status: 'active',
    })

    if (!assignment) {
      return res.status(404).json({ message: 'Khong tim thay phan cong PT cho hoi vien nay. Hay phan cong PT truoc.' })
    }

    assignment.workoutId = workoutTemplateId
    await assignment.save()

    template.assignmentCount = (template.assignmentCount || 0) + 1
    await template.save()

    // Auto-create WorkoutSchedule if one does not exist yet
    const existing = await WorkoutSchedule.findOne({ memberId, templateId: workoutTemplateId, status: 'active' }).lean()
    if (!existing) {
      await buildSchedulesFromTemplate({
        templateId: workoutTemplateId,
        memberId,
        ptId: req.user._id,
        assignmentId: assignment._id,
      })
    }

    const populated = await PTAssignment.findById(assignment._id)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .populate('workoutId', 'name goal')
      .populate('ptId', 'name fullName')

    return res.status(200).json({ message: 'Da gan giao an thanh cong', assignment: populated })
  } catch (error) {
    return res.status(500).json({ message: 'Loi gan giao an', error: error.message })
  }
}

export const getWorkoutAssignments = async (req, res) => {
  try {
    const { id } = req.params

    const assignments = await PTAssignment.find({ workoutId: id })
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .populate('ptId', 'name fullName email')
      .sort({ createdAt: -1 })

    const schedules = await WorkoutSchedule.find({ templateId: id })
      .populate('memberId', 'name fullName email phone avatar memberCode')
      .populate('assignedBy', 'name fullName email')
      .sort({ createdAt: -1 })

    return res.status(200).json({ assignments, schedules })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach su dung', error: error.message })
  }
}

// ============ SESSION / EXERCISE (giữ nguyên) ============

export const startWorkoutSession = async (req, res) => {
  try {
    const { workoutId } = req.body
    const { weekIndex, sessionIndex } = getIndexes(req.body)
    const workout = await getWorkoutOr404(workoutId, res)
    if (!workout) return

    if (!canUpdateSessionProgress(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen cap nhat session nay' })
    }

    const session = getSessionOr400(workout, weekIndex, sessionIndex, res)
    if (!session) return

    session.startedAt = new Date()
    await workout.save()

    return res.status(200).json({ message: 'Da bat dau buoi tap', workout })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the bat dau buoi tap', error: error.message })
  }
}

export const completeExercise = async (req, res) => {
  try {
    const { workoutId, actualCompletionTime } = req.body
    const { weekIndex, sessionIndex, exerciseIndex } = getIndexes(req.body)
    const workout = await getWorkoutOr404(workoutId, res)
    if (!workout) return

    if (!canUpdateSessionProgress(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen cap nhat bai tap nay' })
    }

    const session = getSessionOr400(workout, weekIndex, sessionIndex, res)
    if (!session) return

    if (!isValidIndex(exerciseIndex) || !session.exercises[exerciseIndex]) {
      return res.status(400).json({ message: 'Bai tap khong hop le' })
    }

    const exercise = session.exercises[exerciseIndex]
    exercise.completed = true
    exercise.completedAt = new Date()
    if (actualCompletionTime !== undefined && actualCompletionTime !== '') {
      exercise.actualCompletionTime = Number(actualCompletionTime)
    }

    recalculateCompletionRate(workout)
    await workout.save()

    return res.status(200).json({
      message: 'Da hoan thanh bai tap',
      completionRate: workout.completionRate,
      workout,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the cap nhat bai tap', error: error.message })
  }
}

export const getPTProgress = async (req, res) => {
  try {
    if (!isPtRole(req.user.role) && !isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi PT moi duoc xem progress member' })
    }

    const filter = isPtRole(req.user.role) ? { ptId: req.user._id } : {}
    const workouts = await Workout.find(filter)
      .populate('memberId', 'name fullName email phone memberCode avatar')
      .sort({ createdAt: -1 })

    return res.json({
      progress: workouts.map((workout) => ({
        workoutId: workout._id,
        name: workout.name,
        goal: workout.goal,
        member: workout.memberId,
        completionRate: workout.completionRate,
        weeks: workout.weeks.length,
        sessions: workout.weeks.reduce((total, week) => total + week.sessions.length, 0),
        updatedAt: workout.updatedAt,
      })),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay progress', error: error.message })
  }
}

export const getWorkoutProgressById = async (req, res) => {
  try {
    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    if (!canViewWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen xem progress nay' })
    }

    return res.json({ progress: buildProgressSummary(workout) })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay workout progress', error: error.message })
  }
}

export const saveSessionFeedback = async (req, res) => {
  try {
    const { workoutId, weekIndex, sessionIndex, feedback = '' } = req.body
    const workout = await getWorkoutOr404(workoutId, res)
    if (!workout) return

    if (!canManageWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Chi PT phu trach moi duoc ghi feedback' })
    }

    const session = getSessionOr400(workout, parseIndex(weekIndex), parseIndex(sessionIndex), res)
    if (!session) return

    session.feedback = String(feedback).trim()
    await workout.save()

    return res.json({ message: 'Da luu feedback session', workout })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the luu feedback', error: error.message })
  }
}

export const getSessionFeedbacks = async (req, res) => {
  try {
    const { memberId, workoutId } = req.query
    const filter = {}

    if (workoutId) filter.workoutId = workoutId
    if (memberId) filter.memberId = memberId

    if (isMemberRole(req.user.role)) {
      filter.memberId = req.user._id
    } else if (isPtRole(req.user.role)) {
      filter.ptId = req.user._id
      if (memberId) filter.memberId = memberId
    }

    const feedbacks = await SessionFeedback.find(filter)
      .populate('memberId', 'name fullName email phone avatar')
      .populate('ptId', 'name fullName email phone avatar')
      .populate('workoutId', 'name')
      .sort({ date: -1 })

    return res.status(200).json({ feedbacks })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach feedback', error: error.message })
  }
}

export const createSessionFeedback = async (req, res) => {
  try {
    const { workoutId, memberId, date, note, performance, recommendation } = req.body

    if (!workoutId || !memberId || !date) {
      return res.status(400).json({ message: 'workoutId, memberId va date la bat buoc' })
    }

    const workout = await Workout.findById(workoutId)
    if (!workout) {
      return res.status(404).json({ message: 'Khong tim thay workout' })
    }

    if (!isAdminRole(req.user.role) && !sameId(workout.ptId, req.user._id)) {
      return res.status(403).json({ message: 'Ban khong co quyen tao feedback cho workout nay' })
    }

    const feedback = await SessionFeedback.create({
      workoutId,
      memberId,
      ptId: req.user._id,
      date: new Date(date),
      note: note || '',
      performance: performance || 'good',
      recommendation: recommendation || '',
    })

    return res.status(201).json({ message: 'Tao feedback thanh cong', feedback })
  } catch (error) {
    return res.status(400).json({ message: 'Tao feedback that bai', error: error.message })
  }
}

export const updateSessionFeedback = async (req, res) => {
  try {
    const feedback = await SessionFeedback.findById(req.params.id)
    if (!feedback) {
      return res.status(404).json({ message: 'Khong tim thay feedback' })
    }

    if (!isAdminRole(req.user.role) && !sameId(feedback.ptId, req.user._id)) {
      return res.status(403).json({ message: 'Ban khong co quyen sua feedback nay' })
    }

    const allowedFields = ['note', 'performance', 'recommendation', 'date']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) feedback[field] = req.body[field]
    })

    await feedback.save()
    return res.status(200).json({ message: 'Cap nhat feedback thanh cong', feedback })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat feedback that bai', error: error.message })
  }
}

export const deleteSessionFeedback = async (req, res) => {
  try {
    const feedback = await SessionFeedback.findById(req.params.id)
    if (!feedback) {
      return res.status(404).json({ message: 'Khong tim thay feedback' })
    }

    if (!isAdminRole(req.user.role) && !sameId(feedback.ptId, req.user._id)) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa feedback nay' })
    }

    await feedback.deleteOne()
    return res.status(200).json({ message: 'Xoa feedback thanh cong' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa feedback that bai', error: error.message })
  }
}
