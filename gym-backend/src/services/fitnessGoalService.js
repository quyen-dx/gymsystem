import FitnessGoal from '../models/FitnessGoal.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createGoal = async (data, userId) => {
  const goal = await FitnessGoal.create({
    userId,
    type: data.type,
    targetWeight: data.targetWeight ?? null,
    targetBodyFatPercent: data.targetBodyFatPercent ?? null,
    targetDate: data.targetDate ? new Date(data.targetDate) : null,
    currentValue: data.currentValue ?? null,
    startValue: data.startValue ?? null,
    progressPercent: data.progressPercent || 0,
    notes: data.notes || '',
  })
  return goal
}

export const getGoalById = async (id) => {
  if (!isValidObjectId(id)) return null
  const goal = await FitnessGoal.findById(id)
    .populate('userId', 'name fullName avatar memberCode')
    .lean()
  return goal
}

export const getGoals = async (filters = {}) => {
  const { page = 1, limit = 20, userId, type, isActive } = filters

  const query = {}

  if (userId) {
    if (typeof userId === 'object' && userId.$in) {
      query.userId = userId
    } else if (isValidObjectId(userId)) {
      query.userId = userId
    }
  }

  if (type) {
    query.type = type
  }

  if (isActive !== undefined) {
    query.isActive = isActive
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [goals, total] = await Promise.all([
    FitnessGoal.find(query)
      .populate('userId', 'name fullName avatar memberCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    FitnessGoal.countDocuments(query),
  ])

  return {
    goals,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updateGoal = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const goal = await FitnessGoal.findById(id)
  if (!goal) return null

  const fields = [
    'type', 'targetWeight', 'targetBodyFatPercent', 'targetDate',
    'currentValue', 'startValue', 'progressPercent', 'isActive', 'notes',
  ]
  for (const field of fields) {
    if (data[field] !== undefined) {
      if (field === 'targetDate') {
        goal[field] = data[field] ? new Date(data[field]) : null
      } else {
        goal[field] = data[field]
      }
    }
  }

  await goal.save()
  return goal
}

export const deleteGoal = async (id) => {
  if (!isValidObjectId(id)) return null
  const goal = await FitnessGoal.findByIdAndUpdate(id, { isActive: false }, { new: true })
  return goal
}
