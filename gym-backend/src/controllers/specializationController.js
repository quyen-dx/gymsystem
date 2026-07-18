import Specialization from '../models/Specialization.js'

export const getAll = async (req, res) => {
  try {
    const { isActive } = req.query
    const filter = {}
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }
    const specializations = await Specialization.find(filter).sort({ code: 1 })
    res.json({ data: specializations })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getById = async (req, res) => {
  try {
    const specialization = await Specialization.findById(req.params.id)
    if (!specialization) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên môn' })
    }
    res.json({ specialization })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const create = async (req, res) => {
  try {
    const { code, name, description, icon, color } = req.body
    const specialization = await Specialization.create({ code, name, description, icon, color })
    res.status(201).json({ message: 'Tạo chuyên môn thành công', specialization })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Mã chuyên môn đã tồn tại' })
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ message: messages.join(', ') })
    }
    res.status(500).json({ message: error.message })
  }
}

export const update = async (req, res) => {
  try {
    const { code, name, description, icon, color, isActive } = req.body
    const specialization = await Specialization.findById(req.params.id)
    if (!specialization) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên môn' })
    }
    if (code !== undefined) specialization.code = code
    if (name !== undefined) specialization.name = name
    if (description !== undefined) specialization.description = description
    if (icon !== undefined) specialization.icon = icon
    if (color !== undefined) specialization.color = color
    if (isActive !== undefined) specialization.isActive = isActive
    await specialization.save()
    res.json({ message: 'Cập nhật chuyên môn thành công', specialization })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Mã chuyên môn đã tồn tại' })
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({ message: messages.join(', ') })
    }
    res.status(500).json({ message: error.message })
  }
}

export const toggleActive = async (req, res) => {
  try {
    const specialization = await Specialization.findById(req.params.id)
    if (!specialization) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên môn' })
    }
    specialization.isActive = !specialization.isActive
    await specialization.save()
    res.json({
      message: `Chuyên môn đã được ${specialization.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`,
      specialization,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
