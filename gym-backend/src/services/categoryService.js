import Category from '../models/Category.js'
import Product from '../models/Product.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const generateUniqueSlug = async (name, excludeId) => {
  let slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100)

  let uniqueSlug = slug
  let counter = 1
  while (true) {
    const filter = { slug: uniqueSlug }
    if (excludeId && isValidObjectId(excludeId)) {
      filter._id = { $ne: excludeId }
    }
    const existing = await Category.findOne(filter).select('_id').lean()
    if (!existing) break
    uniqueSlug = `${slug}-${counter}`
    counter++
  }
  return uniqueSlug
}

export const createCategory = async (data) => {
  const slug = await generateUniqueSlug(data.name)
  const category = await Category.create({
    name: data.name,
    slug,
    description: data.description || '',
    parentId: data.parentId || null,
    image: data.image || '',
    sortOrder: data.sortOrder || 0,
  })
  return category
}

export const getCategories = async (filters = {}) => {
  const { page = 1, limit = 50, parentId } = filters

  const query = { isActive: true }
  if (parentId !== undefined) {
    query.parentId = parentId || null
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate('parentId', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Category.countDocuments(query),
  ])

  return {
    categories,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const getCategoryTree = async () => {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const map = {}
  const roots = []

  for (const cat of categories) {
    map[cat._id] = { ...cat, children: [] }
    const productCount = await Product.countDocuments({ categoryId: cat._id, isActive: true })
    map[cat._id].productCount = productCount
  }

  for (const cat of categories) {
    const node = map[cat._id]
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export const getCategoryById = async (id) => {
  if (!isValidObjectId(id)) return null
  const category = await Category.findById(id)
    .populate('parentId', 'name slug')
    .lean()
  return category
}

export const updateCategory = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const category = await Category.findById(id)
  if (!category) return null

  if (data.name && data.name !== category.name) {
    category.slug = await generateUniqueSlug(data.name, id)
    category.name = data.name
  }

  const fields = ['description', 'parentId', 'image', 'sortOrder', 'isActive']
  for (const field of fields) {
    if (data[field] !== undefined) {
      category[field] = data[field]
    }
  }

  await category.save()
  return category
}

export const deleteCategory = async (id) => {
  if (!isValidObjectId(id)) return null
  const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true })
  return category
}
