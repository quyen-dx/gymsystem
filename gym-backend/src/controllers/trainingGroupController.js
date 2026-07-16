import * as trainingGroupService from '../services/trainingGroupService.js'

export const createGroup = async (req, res) => {
  try {
    const group = await trainingGroupService.createGroup(req.body)
    res.status(201).json({ message: 'Đã tạo nhóm tập', group })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllGroups = async (req, res) => {
  try {
    const result = await trainingGroupService.getAllGroups({ status: req.query.status, page: req.query.page })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getGroupById = async (req, res) => {
  try {
    const group = await trainingGroupService.getGroupById(req.params.id)
    if (!group) return res.status(404).json({ message: 'Không tìm thấy nhóm' })
    res.json({ group })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateGroup = async (req, res) => {
  try {
    const group = await trainingGroupService.updateGroup({ groupId: req.params.id, data: req.body })
    if (!group) return res.status(404).json({ message: 'Không tìm thấy nhóm' })
    res.json({ message: 'Đã cập nhật nhóm', group })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const addMember = async (req, res) => {
  try {
    const group = await trainingGroupService.addMember({ groupId: req.params.id, memberId: req.body.memberId })
    res.json({ message: 'Đã thêm thành viên', group })
  } catch (error) {
    res.status(error.message.includes('đủ sĩ số') ? 400 : 500).json({ message: error.message })
  }
}

export const removeMember = async (req, res) => {
  try {
    const group = await trainingGroupService.removeMember({ groupId: req.params.id, memberId: req.params.memberId })
    res.json({ message: 'Đã xóa thành viên', group })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const archiveGroup = async (req, res) => {
  try {
    const group = await trainingGroupService.archiveGroup(req.params.id)
    res.json({ message: 'Đã lưu trữ nhóm', group })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
