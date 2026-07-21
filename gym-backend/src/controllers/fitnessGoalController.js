import * as fitnessGoalService from '../services/fitnessGoalService.js'
import PTAssignment from '../models/PTAssignment.js'

const isAdmin = (role) => role === 'super_admin' || role === 'admin'
const isPT = (role) => role === 'pt'
const sameId = (a, b) => String(a || '') === String(b || '')

async function isPTAssignedToMember(ptId, memberId) {
  if (!memberId) return false
  const assignment = await PTAssignment.findOne({
    ptId,
    memberId,
    status: 'active',
  }).lean()
  return !!assignment
}

export const createFitnessGoal = async (req, res) => {
  try {
    const goal = await fitnessGoalService.createGoal(req.body, req.user._id)
    return res.status(201).json({ message: 'Da tao muc tieu', goal })
  } catch (error) {
    return res.status(400).json({ message: 'Tao muc tieu that bai', error: error.message })
  }
}

export const getFitnessGoals = async (req, res) => {
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
            return res.status(403).json({ message: 'Ban khong co quyen xem muc tieu cua hoi vien nay' })
          }
        } else {
          if (assignedMemberIds.length === 0) {
            return res.status(200).json({ goals: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
          }
          filters.userId = { $in: assignedMemberIds }
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await fitnessGoalService.getGoals(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay muc tieu', error: error.message })
  }
}

export const getFitnessGoalById = async (req, res) => {
  try {
    const goal = await fitnessGoalService.getGoalById(req.params.id)
    if (!goal) {
      return res.status(404).json({ message: 'Khong tim thay muc tieu' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(goal.userId?._id, req.user._id)
      || (isPT(req.user.role) && await isPTAssignedToMember(req.user._id, goal.userId?._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem muc tieu nay' })
    }

    return res.status(200).json(goal)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay muc tieu', error: error.message })
  }
}

export const updateFitnessGoal = async (req, res) => {
  try {
    const goal = await fitnessGoalService.getGoalById(req.params.id)
    if (!goal) {
      return res.status(404).json({ message: 'Khong tim thay muc tieu' })
    }

    const canUpdate = isAdmin(req.user.role) || sameId(goal.userId?._id, req.user._id)
    if (!canUpdate) {
      return res.status(403).json({ message: 'Ban khong co quyen sua muc tieu nay' })
    }

    const updated = await fitnessGoalService.updateGoal(req.params.id, req.body)
    return res.status(200).json({ message: 'Cap nhat muc tieu thanh cong', goal: updated })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat muc tieu that bai', error: error.message })
  }
}

export const deleteFitnessGoal = async (req, res) => {
  try {
    const goal = await fitnessGoalService.getGoalById(req.params.id)
    if (!goal) {
      return res.status(404).json({ message: 'Khong tim thay muc tieu' })
    }

    const canDelete = isAdmin(req.user.role) || sameId(goal.userId?._id, req.user._id)
    if (!canDelete) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa muc tieu nay' })
    }

    const deleted = await fitnessGoalService.deleteGoal(req.params.id)
    return res.status(200).json({ message: 'Da xoa muc tieu', goal: deleted })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa muc tieu that bai', error: error.message })
  }
}
