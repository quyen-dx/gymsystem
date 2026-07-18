import mongoose from 'mongoose'
import WorkoutImprovementRequest from '../models/WorkoutImprovementRequest.js'
import Workout from '../models/Workout.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const submitImprovement = async (req, res) => {
  try {
    const { workoutTemplateId, title, content } = req.body
    const senderId = req.user._id

    if (!workoutTemplateId || !title || !content) {
      return res.status(400).json({ message: 'Thieu thong tin: workoutTemplateId, title, content' })
    }

    const template = await Workout.findById(workoutTemplateId)
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Khong tim thay giao an' })
    }

    if (String(template.ptId) === String(senderId)) {
      return res.status(400).json({ message: 'Ban khong the de xuat cai tien cho giao an cua chinh minh' })
    }

    const improvement = await WorkoutImprovementRequest.create({
      workoutTemplateId,
      senderTrainerId: senderId,
      receiverTrainerId: template.ptId,
      title,
      content,
      status: 'pending',
    })

    await createNotification({
      receiverId: template.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.WORKOUT_IMPROVEMENT_SUGGESTION,
      title: 'Đề xuất cải tiến mới',
      content: `PT ${req.user.name || req.user.fullName} đã gửi đề xuất cải tiến cho giáo án "${template.name}" với tiêu đề: ${title}`,
      createdBy: 'PT',
      sendEmail: false,
    })

    return res.status(201).json({ message: 'Da gui de xuat cai tien', improvement })
  } catch (error) {
    return res.status(400).json({ message: 'Gui de xuat that bai', error: error.message })
  }
}

export const getReceivedImprovements = async (req, res) => {
  try {
    const { status } = req.query
    const filter = { receiverTrainerId: req.user._id }
    if (status) filter.status = status

    const improvements = await WorkoutImprovementRequest.find(filter)
      .populate('workoutTemplateId', 'name goal specializationId')
      .populate('senderTrainerId', 'name fullName email avatar')
      .sort({ createdAt: -1 })

    return res.status(200).json({ improvements })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach de xuat', error: error.message })
  }
}

export const getSentImprovements = async (req, res) => {
  try {
    const { status } = req.query
    const filter = { senderTrainerId: req.user._id }
    if (status) filter.status = status

    const improvements = await WorkoutImprovementRequest.find(filter)
      .populate('workoutTemplateId', 'name goal specializationId')
      .populate('receiverTrainerId', 'name fullName email avatar')
      .sort({ createdAt: -1 })

    return res.status(200).json({ improvements })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach de xuat', error: error.message })
  }
}

export const acceptImprovement = async (req, res) => {
  try {
    const improvement = await WorkoutImprovementRequest.findById(req.params.id)
    if (!improvement) {
      return res.status(404).json({ message: 'Khong tim thay de xuat' })
    }

    if (String(improvement.receiverTrainerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Ban khong co quyen xu ly de xuat nay' })
    }

    if (improvement.status !== 'pending') {
      return res.status(400).json({ message: 'De xuat nay da duoc xu ly' })
    }

    improvement.status = 'accepted'
    await improvement.save()

    await createNotification({
      receiverId: improvement.senderTrainerId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.WORKOUT_IMPROVEMENT_ACCEPTED,
      title: 'Đề xuất cải tiến đã được chấp nhận',
      content: `PT ${req.user.name || req.user.fullName} đã chấp nhận đề xuất cải tiến "${improvement.title}" của bạn.`,
      createdBy: 'PT',
      sendEmail: false,
    })

    return res.status(200).json({ message: 'Da chap nhan de xuat', improvement })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the xu ly de xuat', error: error.message })
  }
}

export const rejectImprovement = async (req, res) => {
  try {
    const improvement = await WorkoutImprovementRequest.findById(req.params.id)
    if (!improvement) {
      return res.status(404).json({ message: 'Khong tim thay de xuat' })
    }

    if (String(improvement.receiverTrainerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Ban khong co quyen xu ly de xuat nay' })
    }

    if (improvement.status !== 'pending') {
      return res.status(400).json({ message: 'De xuat nay da duoc xu ly' })
    }

    improvement.status = 'rejected'
    await improvement.save()

    await createNotification({
      receiverId: improvement.senderTrainerId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.WORKOUT_IMPROVEMENT_REJECTED,
      title: 'Đề xuất cải tiến bị từ chối',
      content: `PT ${req.user.name || req.user.fullName} đã từ chối đề xuất cải tiến "${improvement.title}" của bạn.`,
      createdBy: 'PT',
      sendEmail: false,
    })

    return res.status(200).json({ message: 'Da tu choi de xuat', improvement })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the xu ly de xuat', error: error.message })
  }
}
