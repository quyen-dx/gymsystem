import * as nutritionService from '../services/nutritionService.js'
import * as foodService from '../services/foodService.js'
import * as mealLogService from '../services/mealLogService.js'
import PTAssignment from '../models/PTAssignment.js'

const isAdmin = (role) => role === 'super_admin' || role === 'admin'
const isPT = (role) => role === 'pt'
const sameId = (a, b) => String(a || '') === String(b || '')

const canManageResource = (user) => isPT(user.role) || isAdmin(user.role)

// ============ NUTRITION PLANS ============

export const createNutritionPlan = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc tao ke hoach dinh duong' })
    }

    const plan = await nutritionService.createPlan(req.body, req.user._id)
    return res.status(201).json({ message: 'Tao ke hoach dinh duong thanh cong', plan })
  } catch (error) {
    return res.status(400).json({ message: 'Tao ke hoach that bai', error: error.message })
  }
}

export const getNutritionPlans = async (req, res) => {
  try {
    const filters = { ...req.query }

    if (!isAdmin(req.user.role)) {
      if (isPT(req.user.role)) {
        const assignedMemberIds = await PTAssignment.find({
          ptId: req.user._id,
          status: 'active',
        }).distinct('memberId').lean()
        if (!filters.userId) {
          filters.userId = { $in: assignedMemberIds }
        } else if (!assignedMemberIds.some(id => String(id) === String(filters.userId))) {
          return res.status(403).json({ message: 'Ban khong co quyen xem ke hoach cua hoi vien nay' })
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await nutritionService.getPlans(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay ke hoach', error: error.message })
  }
}

export const getNutritionPlanById = async (req, res) => {
  try {
    const plan = await nutritionService.getPlanById(req.params.id)
    if (!plan) {
      return res.status(404).json({ message: 'Khong tim thay ke hoach' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(plan.userId?._id, req.user._id)
      || (isPT(req.user.role) && await isPTAssignedToMember(req.user._id, plan.userId?._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem ke hoach nay' })
    }

    return res.status(200).json(plan)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay ke hoach', error: error.message })
  }
}

export const updateNutritionPlan = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc sua ke hoach' })
    }

    const plan = await nutritionService.updatePlan(req.params.id, req.body)
    if (!plan) {
      return res.status(404).json({ message: 'Khong tim thay ke hoach' })
    }

    return res.status(200).json({ message: 'Cap nhat ke hoach thanh cong', plan })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat ke hoach that bai', error: error.message })
  }
}

export const deleteNutritionPlan = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc xoa ke hoach' })
    }

    const plan = await nutritionService.deletePlan(req.params.id)
    if (!plan) {
      return res.status(404).json({ message: 'Khong tim thay ke hoach' })
    }

    return res.status(200).json({ message: 'Da xoa ke hoach', plan })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa ke hoach that bai', error: error.message })
  }
}

// ============ FOOD LIBRARY ============

export const createFood = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc them thuc pham' })
    }

    const food = await foodService.createFood(req.body, req.user._id)
    return res.status(201).json({ message: 'Them thuc pham thanh cong', food })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Thuc pham da ton tai' })
    }
    return res.status(400).json({ message: 'Them thuc pham that bai', error: error.message })
  }
}

export const getFoods = async (req, res) => {
  try {
    const result = await foodService.getFoods(req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach thuc pham', error: error.message })
  }
}

export const getFoodById = async (req, res) => {
  try {
    const food = await foodService.getFoodById(req.params.id)
    if (!food) {
      return res.status(404).json({ message: 'Khong tim thay thuc pham' })
    }
    return res.status(200).json(food)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay thuc pham', error: error.message })
  }
}

export const updateFood = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc sua thuc pham' })
    }

    const food = await foodService.updateFood(req.params.id, req.body)
    if (!food) {
      return res.status(404).json({ message: 'Khong tim thay thuc pham' })
    }

    return res.status(200).json({ message: 'Cap nhat thuc pham thanh cong', food })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ten thuc pham da ton tai' })
    }
    return res.status(400).json({ message: 'Cap nhat thuc pham that bai', error: error.message })
  }
}

export const deleteFood = async (req, res) => {
  try {
    if (!canManageResource(req.user)) {
      return res.status(403).json({ message: 'Chi PT hoac admin moi duoc xoa thuc pham' })
    }

    const food = await foodService.deleteFood(req.params.id)
    if (!food) {
      return res.status(404).json({ message: 'Khong tim thay thuc pham' })
    }

    return res.status(200).json({ message: 'Da xoa thuc pham', food })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa thuc pham that bai', error: error.message })
  }
}

export const getFoodCategories = async (req, res) => {
  try {
    const categories = await foodService.getCategories()
    return res.status(200).json({ categories })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh muc', error: error.message })
  }
}

// ============ MEAL LOGS ============

async function isPTAssignedToMember(ptId, memberId) {
  if (!memberId) return false
  const assignment = await PTAssignment.findOne({
    ptId,
    memberId,
    status: 'active',
  }).lean()
  return !!assignment
}

export const createMealLog = async (req, res) => {
  try {
    const log = await mealLogService.createLog(req.body, req.user._id)
    return res.status(201).json({ message: 'Ghi nhat ky bua an thanh cong', log })
  } catch (error) {
    return res.status(400).json({ message: 'Ghi nhat ky that bai', error: error.message })
  }
}

export const getMealLogs = async (req, res) => {
  try {
    const filters = { ...req.query }

    if (!isAdmin(req.user.role)) {
      if (isPT(req.user.role)) {
        const assignedMemberIds = await PTAssignment.find({
          ptId: req.user._id,
          status: 'active',
        }).distinct('memberId').lean()
        if (filters.userId) {
          if (!assignedMemberIds.some(id => String(id) === String(filters.userId))) {
            return res.status(403).json({ message: 'Ban khong co quyen xem nhat ky cua hoi vien nay' })
          }
        } else {
          if (assignedMemberIds.length === 0) {
            return res.status(200).json({ logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
          }
          filters.userId = { $in: assignedMemberIds }
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await mealLogService.getLogs(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay nhat ky', error: error.message })
  }
}

export const getMealLogById = async (req, res) => {
  try {
    const log = await mealLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(log.userId?._id, req.user._id)
      || (isPT(req.user.role) && await isPTAssignedToMember(req.user._id, log.userId?._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem nhat ky nay' })
    }

    return res.status(200).json(log)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay nhat ky', error: error.message })
  }
}

export const updateMealLog = async (req, res) => {
  try {
    const log = await mealLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canUpdate = isAdmin(req.user.role) || sameId(log.userId?._id, req.user._id)
    if (!canUpdate) {
      return res.status(403).json({ message: 'Ban khong co quyen sua nhat ky nay' })
    }

    const updated = await mealLogService.updateLog(req.params.id, req.body)
    return res.status(200).json({ message: 'Cap nhat nhat ky thanh cong', log: updated })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat nhat ky that bai', error: error.message })
  }
}

export const deleteMealLog = async (req, res) => {
  try {
    const log = await mealLogService.getLogById(req.params.id)
    if (!log) {
      return res.status(404).json({ message: 'Khong tim thay nhat ky' })
    }

    const canDelete = isAdmin(req.user.role) || sameId(log.userId?._id, req.user._id)
    if (!canDelete) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa nhat ky nay' })
    }

    await mealLogService.deleteLog(req.params.id)
    return res.status(200).json({ message: 'Da xoa nhat ky' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa nhat ky that bai', error: error.message })
  }
}

export const getDailySummary = async (req, res) => {
  try {
    const userId = isAdmin(req.user.role) && req.query.userId
      ? req.query.userId
      : req.user._id

    const summary = await mealLogService.getDailySummary(userId, req.query.date)
    return res.status(200).json(summary)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay tong hop', error: error.message })
  }
}
