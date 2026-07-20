import GroupClass from '../models/GroupClass.js'

export const createClass = async (req, res) => {
  try {
    const { className, coach, startTime, endTime, maxSlots, room } = req.body
    const newClass = new GroupClass({
      className,
      coach,
      startTime,
      endTime,
      maxSlots,
      room,
      enrolledMembers: [],
      waitlist: [],
    })
    await newClass.save()
    res.status(201).json({ success: true, data: newClass })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getAllClasses = async (req, res) => {
  try {
    const classes = await GroupClass.find().populate('coach', 'name')
    res.status(200).json({ success: true, data: classes })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const enrollInClass = async (req, res) => {
  try {
    const { classId } = req.params
    const userId = req.user.id

    const groupClass = await GroupClass.findById(classId)
    if (!groupClass) {
      return res.status(404).json({ message: 'Không tìm thấy lớp học' })
    }

    if (groupClass.enrolledMembers.includes(userId) || groupClass.waitlist.includes(userId)) {
      return res.status(400).json({ message: 'Bạn đã đăng ký hoặc đang trong danh sách chờ của lớp này' })
    }

    if (groupClass.enrolledMembers.length < groupClass.maxSlots) {
      groupClass.enrolledMembers.push(userId)
      await groupClass.save()
      return res.status(200).json({ success: true, message: 'Đăng ký lớp học thành công', data: groupClass })
    } else {
      groupClass.waitlist.push(userId)
      await groupClass.save()
      return res.status(200).json({ success: true, message: 'Lớp đã đầy, bạn đã được thêm vào danh sách chờ', data: groupClass })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const cancelEnrollment = async (req, res) => {
  try {
    const { classId } = req.params
    const userId = req.user.id

    const groupClass = await GroupClass.findById(classId)
    if (!groupClass) {
      return res.status(404).json({ message: 'Không tìm thấy lớp học' })
    }

    if (groupClass.enrolledMembers.includes(userId)) {
      groupClass.enrolledMembers = groupClass.enrolledMembers.filter((id) => id.toString() !== userId)

      if (groupClass.waitlist.length > 0) {
        const nextUser = groupClass.waitlist.shift()
        groupClass.enrolledMembers.push(nextUser)
      }

      await groupClass.save()
      return res.status(200).json({ success: true, message: 'Hủy đăng ký thành công' })
    } else if (groupClass.waitlist.includes(userId)) {
      groupClass.waitlist = groupClass.waitlist.filter((id) => id.toString() !== userId)
      await groupClass.save()
      return res.status(200).json({ success: true, message: 'Xóa khỏi danh sách chờ thành công' })
    }

    res.status(400).json({ message: 'Bạn chưa từng đăng ký lớp này' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}