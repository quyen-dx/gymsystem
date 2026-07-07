import mongoose from 'mongoose'
import Workout from '../models/Workout.js'

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

const canManageWorkout = (user, workout) =>
  isAdminRole(user.role) || (isPtRole(user.role) && sameId(workout.ptId, user._id))

const canUpdateSessionProgress = (user, workout) =>
  canManageWorkout(user, workout) || (isMemberRole(user.role) && sameId(workout.memberId, user._id))

const buildScopedWorkoutFilter = (user) => {
  if (isAdminRole(user.role)) return {}
  if (isPtRole(user.role)) return { ptId: user._id }
  return { memberId: user._id }
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

const getWorkoutOr404 = async (id, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: 'ID workout khong hop le' })
    return null
  }

  const workout = await Workout.findById(id)
  if (!workout) {
    res.status(404).json({ message: 'Khong tim thay workout' })
    return null
  }

  return workout
}

const getSessionOr400 = (workout, weekIndex, sessionIndex, res) => {
  if (!isValidIndex(weekIndex) || !isValidIndex(sessionIndex)) {
    res.status(400).json({ message: 'Tuan hoac buoi tap khong hop le' })
    return null
  }

  const session = workout.weeks[weekIndex]?.sessions[sessionIndex]
  if (!session) {
    res.status(400).json({ message: 'Tuan hoac buoi tap khong hop le' })
    return null
  }

  return session
}

export const getAllWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find(buildScopedWorkoutFilter(req.user))
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
    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    if (!canViewWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen xem workout nay' })
    }

    await workout.populate('memberId', 'name fullName email phone memberCode avatar')
    await workout.populate('ptId', 'name fullName email phone avatar')

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

    const payload = {
      ...req.body,
      ptId: isPtRole(req.user.role) ? req.user._id : req.body.ptId,
    }

    if (!payload.memberId || !isValidObjectId(payload.memberId)) {
      return res.status(400).json({ message: 'memberId khong hop le' })
    }

    if (!payload.ptId || !isValidObjectId(payload.ptId)) {
      return res.status(400).json({ message: 'ptId khong hop le' })
    }

    const workout = await Workout.create(payload)

    return res.status(201).json({ message: 'Tao workout thanh cong', workout })
  } catch (error) {
    return res.status(400).json({ message: 'Tao workout that bai', error: error.message })
  }
}

export const updateWorkout = async (req, res) => {
  try {
    const workout = await getWorkoutOr404(req.params.id, res)
    if (!workout) return

    if (!canManageWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Ban khong co quyen sua workout nay' })
    }

    const allowedFields = ['name', 'goal', 'duration', 'memberId', 'weeks', 'estimatedCalories']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) workout[field] = req.body[field]
    })

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
      return res.status(403).json({ message: 'Ban khong co quyen xoa workout nay' })
    }

    await workout.deleteOne()

    return res.status(200).json({ message: 'Xoa workout thanh cong' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa workout that bai', error: error.message })
  }
}

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
    const { workoutId, feedback = '' } = req.body
    const { weekIndex, sessionIndex } = getIndexes(req.body)
    const workout = await getWorkoutOr404(workoutId, res)
    if (!workout) return

    if (!canManageWorkout(req.user, workout)) {
      return res.status(403).json({ message: 'Chi PT phu trach moi duoc ghi feedback' })
    }

    const session = getSessionOr400(workout, weekIndex, sessionIndex, res)
    if (!session) return

    session.feedback = String(feedback).trim()
    await workout.save()

    return res.json({ message: 'Da luu feedback session', workout })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the luu feedback', error: error.message })
  }
}
