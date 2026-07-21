import * as exerciseService from '../services/exerciseService.js'
import * as workoutLogService from '../services/workoutLogService.js'
import Workout from '../models/Workout.js'
import PTAssignment from '../models/PTAssignment.js'

const isAdmin = (role) => role === 'super_admin' || role === 'admin'
const isPT = (role) => role === 'pt'
const sameId = (a, b) => String(a || '') === String(b || '')

const canManageExercise = (user) => isPT(user.role) || isAdmin(user.role)

const normalizeDate = (value) => {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

// ============ EXERCISE LIBRARY ============

export const createExercise = async (req, res) => {
  try {
    if (!canManageExercise(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc tao bai tap' })
    }

    const exercise = await exerciseService.createExercise(req.body, req.user._id)
    return res.status(201).json({ message: 'Tao bai tap thanh cong', exercise })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Bai tap da ton tai trong thu vien' })
    }
    return res.status(400).json({ message: 'Tao bai tap that bai', error: error.message })
  }
}

export const getExercises = async (req, res) => {
  try {
    const result = await exerciseService.getExercises(req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach bai tap', error: error.message })
  }
}

export const getExerciseById = async (req, res) => {
  try {
    const exercise = await exerciseService.getExerciseById(req.params.id)
    if (!exercise) {
      return res.status(404).json({ message: 'Khong tim thay bai tap' })
    }
    return res.status(200).json(exercise)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay bai tap', error: error.message })
  }
}

export const updateExercise = async (req, res) => {
  try {
    if (!canManageExercise(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc sua bai tap' })
    }

    const exercise = await exerciseService.updateExercise(req.params.id, req.body, req.user._id)
    if (!exercise) {
      return res.status(404).json({ message: 'Khong tim thay bai tap' })
    }

    return res.status(200).json({ message: 'Cap nhat bai tap thanh cong', exercise })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ten bai tap da ton tai' })
    }
    return res.status(400).json({ message: 'Cap nhat bai tap that bai', error: error.message })
  }
}

export const deleteExercise = async (req, res) => {
  try {
    if (!canManageExercise(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc xoa bai tap' })
    }

    const exercise = await exerciseService.deleteExercise(req.params.id)
    if (!exercise) {
      return res.status(404).json({ message: 'Khong tim thay bai tap' })
    }

    return res.status(200).json({ message: 'Da xoa bai tap', exercise })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa bai tap that bai', error: error.message })
  }
}

export const getMuscleGroups = async (req, res) => {
  try {
    const groups = await exerciseService.getDistinctMuscleGroups()
    return res.status(200).json({ muscleGroups: groups })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay nhom co', error: error.message })
  }
}

export const getEquipments = async (req, res) => {
  try {
    const equipments = await exerciseService.getDistinctEquipments()
    return res.status(200).json({ equipments })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay dung cu', error: error.message })
  }
}

// ============ WORKOUT LOGS ============

export const createWorkoutLog = async (req, res) => {
  try {
    const workout = await Workout.findById(req.body.workoutId).lean()
    if (!workout) {
      return res.status(404).json({ message: 'Khong tim thay workout' })
    }

    const canLog = isAdmin(req.user.role)
      || sameId(workout.memberId, req.user._id)
      || sameId(workout.ptId, req.user._id)

    if (!canLog) {
      return res.status(403).json({ message: 'Ban khong co quyen ghi nhat ky cho workout nay' })
    }

    const log = await workoutLogService.createLog(req.body, req.user._id)
    return res.status(201).json({ message: 'Ghi nhat ky thanh cong', log })
  } catch (error) {
    return res.status(400).json({ message: 'Ghi nhat ky that bai', error: error.message })
  }
}

export const getWorkoutLogs = async (req, res) => {
  try {
    const filters = { ...req.query }

    if (!isAdmin(req.user.role)) {
      if (isPT(req.user.role)) {
        const assignedMemberIds = await PTAssignment.find({
          ptId: req.user._id,
          status: 'active',
        }).distinct('memberId').lean()

        const memberWorkoutIds = await Workout.find({
          memberId: { $in: assignedMemberIds },
        }).distinct('_id').lean()

        const myPlanIds = await Workout.find({ ptId: req.user._id }).distinct('_id').lean()
        const allVisibleWorkouts = [...memberWorkoutIds.map(String), ...myPlanIds.map(String)]

        if (filters.userId) {
          if (!assignedMemberIds.some(id => String(id) === String(filters.userId))) {
            return res.status(403).json({ message: 'Ban khong co quyen xem nhat ky cua hoi vien nay' })
          }
          filters.workoutIds = allVisibleWorkouts
        } else if (filters.workoutId) {
          if (!allVisibleWorkouts.includes(String(filters.workoutId))) {
            return res.status(403).json({ message: 'Ban khong co quyen xem nhat ky cua workout nay' })
          }
        } else {
          filters.workoutIds = allVisibleWorkouts
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await workoutLogService.getLogs(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay nhat ky', error: error.message })
  }
}

export const getWorkoutLogById = async (req, res) => {
  try {
    const log = await workoutLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(log.userId?._id, req.user._id)
      || (isPT(req.user.role) && log.workoutId && sameId(log.workoutId.ptId, req.user._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem nhat ky nay' })
    }

    return res.status(200).json(log)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay nhat ky', error: error.message })
  }
}

export const updateWorkoutLog = async (req, res) => {
  try {
    const log = await workoutLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canUpdate = isAdmin(req.user.role) || sameId(log.userId?._id, req.user._id)
    if (!canUpdate) {
      return res.status(403).json({ message: 'Ban khong co quyen sua nhat ky nay' })
    }

    const updated = await workoutLogService.updateLog(req.params.id, req.body)
    return res.status(200).json({ message: 'Cap nhat nhat ky thanh cong', log: updated })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat nhat ky that bai', error: error.message })
  }
}

export const deleteWorkoutLog = async (req, res) => {
  try {
    const log = await workoutLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canDelete = isAdmin(req.user.role) || sameId(log.userId?._id, req.user._id)
    if (!canDelete) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa nhat ky nay' })
    }

    await workoutLogService.deleteLog(req.params.id)
    return res.status(200).json({ message: 'Da xoa nhat ky' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa nhat ky that bai', error: error.message })
  }
}
