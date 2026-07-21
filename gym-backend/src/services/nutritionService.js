import NutritionPlan from '../models/NutritionPlan.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createPlan = async (data, trainerId) => {
  const plan = await NutritionPlan.create({
    userId: data.userId,
    trainerId: trainerId || null,
    name: data.name,
    goal: data.goal || '',
    dailyCalorieTarget: data.dailyCalorieTarget || 0,
    proteinTarget_g: data.proteinTarget_g || 0,
    carbsTarget_g: data.carbsTarget_g || 0,
    fatTarget_g: data.fatTarget_g || 0,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    notes: data.notes || '',
  })
  return plan
}

export const getPlanById = async (id) => {
  if (!isValidObjectId(id)) return null
  const plan = await NutritionPlan.findById(id)
    .populate('userId', 'name fullName avatar memberCode')
    .populate('trainerId', 'name fullName avatar')
    .lean()
  return plan
}

export const getPlans = async (filters = {}) => {
  const { page = 1, limit = 20, userId, isActive, trainerId } = filters

  const query = {}
  if (userId) {
    if (typeof userId === 'object' && userId.$in) {
      query.userId = userId
    } else if (isValidObjectId(userId)) {
      query.userId = userId
    }
  }
  if (trainerId && isValidObjectId(trainerId)) query.trainerId = trainerId
  if (isActive !== undefined) query.isActive = isActive

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [plans, total] = await Promise.all([
    NutritionPlan.find(query)
      .populate('userId', 'name fullName avatar memberCode')
      .populate('trainerId', 'name fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    NutritionPlan.countDocuments(query),
  ])

  return {
    plans,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updatePlan = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const plan = await NutritionPlan.findById(id)
  if (!plan) return null

  const fields = ['name', 'goal', 'dailyCalorieTarget', 'proteinTarget_g', 'carbsTarget_g', 'fatTarget_g', 'isActive', 'startDate', 'endDate', 'notes']
  for (const field of fields) {
    if (data[field] !== undefined) {
      if (field === 'startDate' || field === 'endDate') {
        plan[field] = data[field] ? new Date(data[field]) : null
      } else {
        plan[field] = data[field]
      }
    }
  }

  await plan.save()
  return plan
}

export const deletePlan = async (id) => {
  if (!isValidObjectId(id)) return null
  const plan = await NutritionPlan.findByIdAndUpdate(id, { isActive: false }, { new: true })
  return plan
}
