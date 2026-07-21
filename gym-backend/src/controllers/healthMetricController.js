import * as healthMetricService from '../services/healthMetricService.js'
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

// ============ HEALTH METRICS ============

export const createHealthMetric = async (req, res) => {
  try {
    const metric = await healthMetricService.createMetric(req.body, req.user._id)
    return res.status(201).json({ message: 'Da luu chi so suc khoe', metric })
  } catch (error) {
    return res.status(400).json({ message: 'Luu chi so that bai', error: error.message })
  }
}

export const getHealthMetrics = async (req, res) => {
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
            return res.status(403).json({ message: 'Ban khong co quyen xem chi so cua hoi vien nay' })
          }
        } else {
          if (assignedMemberIds.length === 0) {
            return res.status(200).json({ metrics: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
          }
          filters.userId = { $in: assignedMemberIds }
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await healthMetricService.getMetrics(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay chi so', error: error.message })
  }
}

export const getHealthMetricById = async (req, res) => {
  try {
    const metric = await healthMetricService.getMetricById(req.params.id)
    if (!metric) {
      return res.status(404).json({ message: 'Khong tim thay chi so' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(metric.userId?._id, req.user._id)
      || (isPT(req.user.role) && await isPTAssignedToMember(req.user._id, metric.userId?._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem chi so nay' })
    }

    return res.status(200).json(metric)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay chi so', error: error.message })
  }
}

export const updateHealthMetric = async (req, res) => {
  try {
    const metric = await healthMetricService.getMetricById(req.params.id)
    if (!metric) {
      return res.status(404).json({ message: 'Khong tim thay chi so' })
    }

    const canUpdate = isAdmin(req.user.role) || sameId(metric.userId?._id, req.user._id)
    if (!canUpdate) {
      return res.status(403).json({ message: 'Ban khong co quyen sua chi so nay' })
    }

    const updated = await healthMetricService.updateMetric(req.params.id, req.body)
    return res.status(200).json({ message: 'Cap nhat chi so thanh cong', metric: updated })
  } catch (error) {
    return res.status(400).json({ message: 'Cap nhat chi so that bai', error: error.message })
  }
}

export const deleteHealthMetric = async (req, res) => {
  try {
    const metric = await healthMetricService.getMetricById(req.params.id)
    if (!metric) {
      return res.status(404).json({ message: 'Khong tim thay chi so' })
    }

    const canDelete = isAdmin(req.user.role) || sameId(metric.userId?._id, req.user._id)
    if (!canDelete) {
      return res.status(403).json({ message: 'Ban khong co quyen xoa chi so nay' })
    }

    await healthMetricService.deleteMetric(req.params.id)
    return res.status(200).json({ message: 'Da xoa chi so' })
  } catch (error) {
    return res.status(500).json({ message: 'Xoa chi so that bai', error: error.message })
  }
}

export const getHealthTrends = async (req, res) => {
  try {
    const userId = isAdmin(req.user.role) && req.query.userId
      ? req.query.userId
      : (isPT(req.user.role) && req.query.userId
        ? req.query.userId
        : req.user._id)

    if (isPT(req.user.role) && req.query.userId) {
      const isAssigned = await isPTAssignedToMember(req.user._id, req.query.userId)
      if (!isAssigned) {
        return res.status(403).json({ message: 'Ban khong co quyen xem xu huong cua hoi vien nay' })
      }
    }

    const trends = await healthMetricService.getTrends(userId, req.query)
    return res.status(200).json({ userId, metric: req.query.metric || 'weight', trends })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay xu huong', error: error.message })
  }
}

// ============ BODY COMPOSITION ============

export const createBodyComposition = async (req, res) => {
  try {
    const doc = await healthMetricService.createBodyComposition(req.body, req.user._id)
    return res.status(201).json({ message: 'Da luu ket qua InBody', composition: doc })
  } catch (error) {
    return res.status(400).json({ message: 'Luu InBody that bai', error: error.message })
  }
}

export const getBodyCompositions = async (req, res) => {
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
            return res.status(403).json({ message: 'Ban khong co quyen xem InBody cua hoi vien nay' })
          }
        } else {
          if (assignedMemberIds.length === 0) {
            return res.status(200).json({ compositions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
          }
          filters.userId = { $in: assignedMemberIds }
        }
      } else {
        filters.userId = req.user._id
      }
    }

    const result = await healthMetricService.getBodyCompositions(filters)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay InBody', error: error.message })
  }
}

export const getBodyCompositionById = async (req, res) => {
  try {
    const doc = await healthMetricService.getBodyCompositionById(req.params.id)
    if (!doc) {
      return res.status(404).json({ message: 'Khong tim thay ket qua InBody' })
    }

    const canView = isAdmin(req.user.role)
      || sameId(doc.userId?._id, req.user._id)
      || (isPT(req.user.role) && await isPTAssignedToMember(req.user._id, doc.userId?._id))

    if (!canView) {
      return res.status(403).json({ message: 'Ban khong co quyen xem InBody nay' })
    }

    return res.status(200).json(doc)
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay InBody', error: error.message })
  }
}
