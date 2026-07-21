import Food from '../models/Food.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createFood = async (data, userId) => {
  const food = await Food.create({
    name: data.name,
    description: data.description || '',
    category: data.category || '',
    servingSize: data.servingSize || '',
    calories: data.calories || 0,
    protein_g: data.protein_g || 0,
    carbs_g: data.carbs_g || 0,
    fat_g: data.fat_g || 0,
    fiber_g: data.fiber_g || 0,
    createdBy: userId || null,
  })
  return food
}

export const getFoodById = async (id) => {
  if (!isValidObjectId(id)) return null
  const food = await Food.findById(id).populate('createdBy', 'name fullName avatar').lean()
  return food
}

export const getFoods = async (filters = {}) => {
  const { page = 1, limit = 20, search, category } = filters

  const query = { isActive: true }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ]
  }

  if (category) {
    query.category = { $regex: category, $options: 'i' }
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [foods, total] = await Promise.all([
    Food.find(query)
      .populate('createdBy', 'name fullName avatar')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Food.countDocuments(query),
  ])

  return {
    foods,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updateFood = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const food = await Food.findById(id)
  if (!food) return null

  const fields = ['name', 'description', 'category', 'servingSize', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
  for (const field of fields) {
    if (data[field] !== undefined) {
      food[field] = data[field]
    }
  }

  await food.save()
  return food
}

export const deleteFood = async (id) => {
  if (!isValidObjectId(id)) return null
  const food = await Food.findByIdAndUpdate(id, { isActive: false }, { new: true })
  return food
}

export const getCategories = async () => {
  const categories = await Food.distinct('category', { isActive: true, category: { $ne: '' } })
  return categories.sort()
}
