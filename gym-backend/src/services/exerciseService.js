import Exercise from '../models/Exercise.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createExercise = async (data, userId) => {
  const exercise = await Exercise.create({
    name: data.name,
    muscleGroup: data.muscleGroup || [],
    equipment: data.equipment || [],
    difficulty: data.difficulty || 'intermediate',
    description: data.description || '',
    mediaUrls: data.mediaUrls || [],
    category: data.category || '',
    createdBy: userId || null,
  })
  return exercise
}

export const getExerciseById = async (id) => {
  if (!isValidObjectId(id)) return null
  const exercise = await Exercise.findById(id).populate('createdBy', 'name fullName avatar').lean()
  return exercise
}

export const getExercises = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    search,
    muscleGroup,
    equipment,
    difficulty,
    category,
    createdBy,
  } = filters

  const query = { isActive: true }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ]
  }

  if (muscleGroup) {
    query.muscleGroup = { $in: [muscleGroup] }
  }

  if (equipment) {
    query.equipment = { $in: [equipment] }
  }

  if (difficulty) {
    query.difficulty = difficulty
  }

  if (category) {
    query.category = { $regex: category, $options: 'i' }
  }

  if (createdBy && isValidObjectId(createdBy)) {
    query.createdBy = createdBy
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [exercises, total] = await Promise.all([
    Exercise.find(query)
      .populate('createdBy', 'name fullName avatar')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Exercise.countDocuments(query),
  ])

  return {
    exercises,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updateExercise = async (id, data, userId) => {
  if (!isValidObjectId(id)) return null
  const exercise = await Exercise.findById(id)
  if (!exercise) return null

  const updatableFields = ['name', 'muscleGroup', 'equipment', 'difficulty', 'description', 'mediaUrls', 'category']
  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      exercise[field] = data[field]
    }
  }

  await exercise.save()
  return exercise
}

export const deleteExercise = async (id) => {
  if (!isValidObjectId(id)) return null
  const exercise = await Exercise.findByIdAndUpdate(id, { isActive: false }, { new: true })
  return exercise
}

export const getDistinctMuscleGroups = async () => {
  const groups = await Exercise.distinct('muscleGroup', { isActive: true })
  const flat = [...new Set(groups.flat())].filter(Boolean).sort()
  return flat
}

export const getDistinctEquipments = async () => {
  const equipments = await Exercise.distinct('equipment', { isActive: true })
  const flat = [...new Set(equipments.flat())].filter(Boolean).sort()
  return flat
}
