import * as trainingClassService from '../services/trainingClassService.js'

export const createClass = async (req, res) => {
  try {
    const cls = await trainingClassService.createClass(req.body)
    res.status(201).json({ message: 'Đã tạo lớp tập', class: cls })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllClasses = async (req, res) => {
  try {
    const result = await trainingClassService.getAllClasses({ page: req.query.page })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getClassById = async (req, res) => {
  try {
    const cls = await trainingClassService.getClassById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp tập' })
    res.json({ class: cls })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteClass = async (req, res) => {
  try {
    await trainingClassService.deleteClass(req.params.id)
    res.json({ message: 'Đã xóa lớp tập' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateClass = async (req, res) => {
  try {
    const cls = await trainingClassService.updateClass({ classId: req.params.id, data: req.body })
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp tập' })
    res.json({ message: 'Đã cập nhật lớp tập', class: cls })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}


