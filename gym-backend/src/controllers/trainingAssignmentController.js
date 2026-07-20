// DEPRECATED: Training assignments are now handled via TrainingClass.members.
// Kept as a stub to prevent import errors.
import * as trainingAssignmentService from '../legacy/services/trainingAssignmentService.js'

export const getMyAssignment = async (req, res) => {
  try {
    const assignment = await trainingAssignmentService.findActiveAssignment({ memberId: req.user._id })
    res.json({ assignment: assignment || null })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyActiveClients = async (req, res) => {
  try {
    const assignments = await trainingAssignmentService.findTrainerActiveAssignments({ trainerId: req.user._id })
    res.json({ assignments })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMyHistory = async (req, res) => {
  try {
    const result = await trainingAssignmentService.findTrainerAssignmentHistory({ trainerId: req.user._id, page: req.query.page })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const createAssignment = async (req, res) => {
  try {
    const { memberId, trainerId, requestId, membershipId, classId } = req.body
    if (!memberId || !trainerId) {
      return res.status(400).json({ message: 'Thiếu memberId hoặc trainerId' })
    }
    const assignment = await trainingAssignmentService.createAssignment({
      memberId, trainerId, requestId, membershipId, classId, assignedBy: req.user._id,
    })
    res.status(201).json({ message: 'Đã tạo phân công', assignment })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
