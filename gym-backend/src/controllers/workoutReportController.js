import mongoose from 'mongoose'
import WorkoutReport from '../models/WorkoutReport.js'
import Workout from '../models/Workout.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)
const isAdminRole = (role) => role === 'super_admin' || role === 'admin'

const REASON_LABELS = {
  wrong_expertise: 'Sai chuyên môn',
  incorrect_content: 'Nội dung không đúng kỹ thuật',
  missing_info: 'Thiếu thông tin',
  spam: 'Spam',
  duplicate: 'Trùng lặp',
  other: 'Khác',
}

export const reportWorkout = async (req, res) => {
  try {
    const { workoutTemplateId, reason, detail } = req.body
    const reporterId = req.user._id

    if (!workoutTemplateId || !reason) {
      return res.status(400).json({ message: 'Thieu thong tin: workoutTemplateId, reason' })
    }

    const template = await Workout.findById(workoutTemplateId)
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Khong tim thay giao an' })
    }

    if (String(template.ptId) === String(reporterId)) {
      return res.status(400).json({ message: 'Ban khong the bao cao giao an cua chinh minh' })
    }

    const report = await WorkoutReport.create({
      workoutTemplateId,
      reporterTrainerId: reporterId,
      reason,
      detail: detail || '',
      status: 'pending',
    })

    const reportCount = await WorkoutReport.countDocuments({
      workoutTemplateId,
      status: { $in: ['pending', 'reviewed'] },
    })

    if (template.templateStatus === 'published') {
      template.templateStatus = 'under_review'
      await template.save()
    }

    const adminUsers = await mongoose.model('User').find({
      role: { $in: ['super_admin', 'admin'] },
      isActive: true,
    })

    for (const admin of adminUsers) {
      await createNotification({
        receiverId: admin._id,
        receiverRole: admin.role,
        notificationType: NOTIFICATION_TYPES.WORKOUT_REPORTED_ADMIN,
        title: 'Báo cáo vi phạm giáo án mới',
        content: `Giáo án "${template.name}" bị báo cáo với lý do: ${REASON_LABELS[reason] || reason}. Tổng số báo cáo: ${reportCount}.`,
        relatedId: report._id,
        relatedType: 'WorkoutReport',
        createdBy: 'System',
        sendEmail: false,
      })
    }

    await createNotification({
      receiverId: template.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.WORKOUT_REPORTED,
      title: 'Giáo án của bạn đã nhận thêm báo cáo',
      content: `Giáo án "${template.name}" đã nhận thêm báo cáo. Số báo cáo: ${reportCount}. Lý do phổ biến: ${REASON_LABELS[reason] || reason}. Trạng thái: Đang chờ Admin xem xét.`,
      relatedId: report._id,
      relatedType: 'WorkoutReport',
      createdBy: 'System',
      sendEmail: false,
    })

    return res.status(201).json({ message: 'Da gui bao cao', report })
  } catch (error) {
    return res.status(400).json({ message: 'Gui bao cao that bai', error: error.message })
  }
}

export const getReports = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen xem bao cao' })
    }

    const { status, workoutTemplateId, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status) filter.status = status
    if (workoutTemplateId) filter.workoutTemplateId = workoutTemplateId

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const [reports, total] = await Promise.all([
      WorkoutReport.find(filter)
        .populate('workoutTemplateId', 'name goal specializationId ptId templateStatus version createdAt')
        .populate('reporterTrainerId', 'name fullName email avatar')
        .populate('resolvedBy', 'name fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      WorkoutReport.countDocuments(filter),
    ])

    return res.status(200).json({
      reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay danh sach bao cao', error: error.message })
  }
}

export const getReportSummary = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen xem bao cao' })
    }

    const summary = await WorkoutReport.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$workoutTemplateId',
          reportCount: { $sum: 1 },
          reasons: { $push: '$reason' },
          reporters: { $push: '$reporterTrainerId' },
          latestReport: { $max: '$createdAt' },
        },
      },
      { $sort: { reportCount: -1 } },
    ])

    const populated = await Workout.populate(summary, {
      path: '_id',
      select: 'name goal specializationId ptId templateStatus',
      populate: { path: 'ptId', select: 'name fullName' },
    })

    return res.status(200).json({ summary: populated })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay tong hop bao cao', error: error.message })
  }
}

export const resolveReport = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen xu ly bao cao' })
    }

    const { action, resolution } = req.body

    const report = await WorkoutReport.findById(req.params.id)
    if (!report) {
      return res.status(404).json({ message: 'Khong tim thay bao cao' })
    }

    if (report.status !== 'pending' && report.status !== 'reviewed') {
      return res.status(400).json({ message: 'Bao cao nay da duoc xu ly' })
    }

    report.status = 'resolved'
    report.resolvedBy = req.user._id
    report.resolution = resolution || ''
    report.resolvedAt = new Date()
    await report.save()

    return res.status(200).json({ message: 'Da xu ly bao cao', report })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the xu ly bao cao', error: error.message })
  }
}

export const rejectReport = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Chi admin moi co quyen xu ly bao cao' })
    }

    const report = await WorkoutReport.findById(req.params.id)
    if (!report) {
      return res.status(404).json({ message: 'Khong tim thay bao cao' })
    }

    report.status = 'rejected'
    report.resolvedBy = req.user._id
    report.resolution = req.body.resolution || 'Báo cáo không chính xác'
    report.resolvedAt = new Date()
    await report.save()

    const workout = await Workout.findById(report.workoutTemplateId)
    if (workout && workout.templateStatus === 'under_review') {
      const pendingReports = await WorkoutReport.countDocuments({
        workoutTemplateId: report.workoutTemplateId,
        status: 'pending',
      })
      if (pendingReports === 0) {
        workout.templateStatus = 'published'
        await workout.save()
      }
    }

    return res.status(200).json({ message: 'Da tu choi bao cao', report })
  } catch (error) {
    return res.status(500).json({ message: 'Khong the xu ly bao cao', error: error.message })
  }
}
