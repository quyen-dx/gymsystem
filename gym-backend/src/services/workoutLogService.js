import WorkoutLog from '../models/WorkoutLog.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createLog = async (data, userId) => {
  const log = await WorkoutLog.create({
    userId,
    workoutId: data.workoutId || null,
    exerciseId: data.exerciseId || null,
    exerciseName: data.exerciseName,
    date: new Date(data.date),
    actualSets: data.actualSets || 0,
    actualReps: data.actualReps || 0,
    weight: data.weight || 0,
    durationMinutes: data.durationMinutes || 0,
    rpe: data.rpe ?? null,
    notes: data.notes || '',
  })
  return log
}

export const getLogById = async (id) => {
  if (!isValidObjectId(id)) return null
  const log = await WorkoutLog.findById(id)
    .populate('userId', 'name fullName avatar')
    .populate('workoutId', 'name goal ptId')
    .populate('exerciseId', 'name muscleGroup equipment')
    .lean()
  return log
}

export const getLogs = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    userId,
    workoutId,
    workoutIds,
    exerciseId,
    dateFrom,
    dateTo,
  } = filters

  const query = {}

  if (userId && isValidObjectId(userId)) {
    query.userId = userId
  }

  if (workoutId && isValidObjectId(workoutId)) {
    query.workoutId = workoutId
  }

  if (Array.isArray(workoutIds) && workoutIds.length > 0) {
    query.workoutId = { $in: workoutIds.filter(id => isValidObjectId(id)) }
  }

  if (exerciseId && isValidObjectId(exerciseId)) {
    query.exerciseId = exerciseId
  }

  if (dateFrom || dateTo) {
    query.date = {}
    if (dateFrom) query.date.$gte = new Date(dateFrom)
    if (dateTo) query.date.$lte = new Date(dateTo)
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [logs, total] = await Promise.all([
    WorkoutLog.find(query)
      .populate('userId', 'name fullName avatar')
    .populate('workoutId', 'name goal ptId')
      .populate('exerciseId', 'name muscleGroup equipment')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    WorkoutLog.countDocuments(query),
  ])

  return {
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updateLog = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const log = await WorkoutLog.findById(id)
  if (!log) return null

  const updatableFields = ['exerciseName', 'date', 'actualSets', 'actualReps', 'weight', 'durationMinutes', 'rpe', 'notes']
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      if (field === 'date') {
        log[field] = new Date(data[field])
      } else {
        log[field] = data[field]
      }
    }
  }

  await log.save()
  return log
}

export const deleteLog = async (id) => {
  if (!isValidObjectId(id)) return null
  const log = await WorkoutLog.findByIdAndDelete(id)
  return log
}
