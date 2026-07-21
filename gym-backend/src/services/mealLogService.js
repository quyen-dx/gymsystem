import MealLog from '../models/MealLog.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createLog = async (data, userId) => {
  const log = await MealLog.create({
    userId,
    date: new Date(data.date),
    mealType: data.mealType || 'snack',
    foodId: data.foodId || null,
    foodName: data.foodName,
    quantity: data.quantity || 1,
    unit: data.unit || 'serving',
    calories: data.calories || 0,
    protein_g: data.protein_g || 0,
    carbs_g: data.carbs_g || 0,
    fat_g: data.fat_g || 0,
    fiber_g: data.fiber_g || 0,
    notes: data.notes || '',
  })
  return log
}

export const getLogById = async (id) => {
  if (!isValidObjectId(id)) return null
  const log = await MealLog.findById(id)
    .populate('userId', 'name fullName avatar')
    .populate('foodId', 'name category servingSize')
    .lean()
  return log
}

export const getLogs = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    userId,
    dateFrom,
    dateTo,
    mealType,
  } = filters

  const query = {}

  if (userId) {
    if (typeof userId === 'object' && userId.$in) {
      query.userId = userId
    } else if (isValidObjectId(userId)) {
      query.userId = userId
    }
  }

  if (dateFrom || dateTo) {
    query.date = {}
    if (dateFrom) query.date.$gte = new Date(dateFrom)
    if (dateTo) query.date.$lte = new Date(dateTo)
  }

  if (mealType) {
    query.mealType = mealType
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [logs, total] = await Promise.all([
    MealLog.find(query)
      .populate('userId', 'name fullName avatar')
      .populate('foodId', 'name category servingSize')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    MealLog.countDocuments(query),
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
  const log = await MealLog.findById(id)
  if (!log) return null

  const fields = ['date', 'mealType', 'foodName', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'notes']
  for (const field of fields) {
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
  const log = await MealLog.findByIdAndDelete(id)
  return log
}

export const getDailySummary = async (userId, date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const nextDay = new Date(d)
  nextDay.setDate(nextDay.getDate() + 1)

  const logs = await MealLog.find({
    userId,
    date: { $gte: d, $lt: nextDay },
  }).lean()

  const meals = logs.map(l => ({
    _id: l._id,
    mealType: l.mealType,
    foodName: l.foodName,
    quantity: l.quantity,
    unit: l.unit,
    calories: l.calories,
    protein_g: l.protein_g,
    carbs_g: l.carbs_g,
    fat_g: l.fat_g,
    fiber_g: l.fiber_g,
    notes: l.notes,
    createdAt: l.createdAt,
  }))

  const totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
  }

  for (const log of logs) {
    totals.calories += log.calories || 0
    totals.protein_g += log.protein_g || 0
    totals.carbs_g += log.carbs_g || 0
    totals.fat_g += log.fat_g || 0
    totals.fiber_g += log.fiber_g || 0
  }

  return {
    date: d,
    totalEntries: logs.length,
    totals,
    meals,
  }
}
