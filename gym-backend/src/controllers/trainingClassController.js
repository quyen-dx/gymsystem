import * as trainingClassService from '../services/trainingClassService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

export const createClass = async (req, res) => {
  try {
    const cls = await trainingClassService.createClass(req.body)
    createNotification({
      receiverId: cls.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.CLASS_ASSIGNED,
      title: 'Bạn được phân công lớp tập mới',
      content: `Admin đã phân công bạn vào lớp "${cls.name}".`,
      relatedId: cls._id,
      relatedType: 'TrainingClass',
      redirectUrl: '/pt/classes',
      createdBy: 'Admin',
    }).catch(err => console.error('Notify class assigned failed:', err.message))
    res.status(201).json({ message: 'Đã tạo lớp tập', class: cls })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllClasses = async (req, res) => {
  try {
    const result = await trainingClassService.getAllClasses({
      page: req.query.page,
      includeClosed: req.query.includeClosed === 'true',
    })
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
    const classDoc = await trainingClassService.deleteClass(req.params.id)
    if (!classDoc) return res.status(404).json({ message: 'Không tìm thấy lớp tập' })

    if (classDoc.ptId) {
      createNotification({
        receiverId: classDoc.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
        title: 'Lớp tập đã bị xóa',
        content: `Lớp "${classDoc.name}" đã bị Admin xóa.`,
        relatedId: null,
        relatedType: 'TrainingClass',
        redirectUrl: '/pt/classes',
        createdBy: 'Admin',
      }).catch(err => console.error('Notify class deleted failed:', err.message))
    }

    res.json({ message: 'Đã xóa lớp tập' })
  } catch (error) {
    console.error('[deleteClass]', error)
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


