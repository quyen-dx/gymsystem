import User from '../models/User.js'
import mongoose from 'mongoose'
import PTAssignmentEndRequest from '../models/PTAssignmentEndRequest.js'
import PTAssignment from '../models/PTAssignment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import { endEnrollments as endClassEnrollments } from '../services/classEnrollmentService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import sendError from '../utils/sendError.js'
import { createNotification } from '../services/notificationService.js'
import {
  emitPTEndRequestCountUpdate,
  emitPTEndRequestStatusChange,
} from '../services/socketService.js'

const REASON_LABELS = {
  MEMBER_COMPLETED: 'Hội viên hoàn thành khóa học',
  MEMBER_REQUEST_CHANGE_PT: 'Hội viên yêu cầu đổi PT',
  MEMBER_QUIT: 'Hội viên xin nghỉ tập',
  PT_NO_LONGER_TEACHES: 'PT không còn phụ trách lớp',
  OTHER: null,
}

const getMemberInfo = async (memberId) => {
  const u = await User.findById(memberId).select('name fullName memberCode').lean()
  return u?.fullName || u?.name || 'Hội viên'
}

const getReasonText = (reasonType, reasonDetail) => {
  if (reasonType === 'OTHER') return reasonDetail || 'Khác'
  return REASON_LABELS[reasonType] || reasonType
}

// PT gui yeu cau ket thuc phu trach
export const createEndRequest = async (req, res) => {
  try {
    const { memberId, reasonType, reasonDetail, assignmentId, classId } = req.body
    const ptId = req.user._id

    if (!memberId || !reasonType) {
      return res.status(400).json({ message: 'Thieu memberId hoac reasonType' })
    }

    if (reasonType === 'OTHER' && !reasonDetail?.trim()) {
      return res.status(400).json({ message: 'Vui long nhap ly do chi tiet' })
    }

    // Mỗi yêu cầu chỉ được kết thúc đúng một phạm vi: PT 1-1 hoặc lớp nhóm.
    if (Boolean(assignmentId) === Boolean(classId)) {
      return res.status(400).json({
        message: 'Yêu cầu phải chọn đúng một phạm vi: phân công PT 1-1 hoặc lớp nhóm',
      })
    }

    const isPrivate = Boolean(assignmentId)
    if (isPrivate) {
      const assignment = await PTAssignment.findOne({
        _id: assignmentId, memberId, ptId, status: 'active',
      }).lean()
      if (!assignment) {
        return res.status(403).json({ message: 'Bạn không có phân công PT 1-1 đang hoạt động với hội viên này' })
      }
    } else {
      const groupAssignment = await TrainingAssignment.findOne({
        memberId, trainerId: ptId, classId, status: 'active',
      }).lean()
      if (!groupAssignment) {
        return res.status(403).json({ message: 'Bạn không phụ trách lớp nhóm đang hoạt động này của hội viên' })
      }
    }

    // Chỉ chặn yêu cầu đang chờ trên chính phạm vi đã chọn.
    const pendingFilter = { ptId, memberId, status: 'pending' }
    if (isPrivate) pendingFilter.assignmentId = assignmentId
    else pendingFilter.classId = classId
    const existing = await PTAssignmentEndRequest.findOne(pendingFilter)
    if (existing) {
      return res.status(409).json({ message: 'Đã có yêu cầu kết thúc đang chờ xử lý cho đúng phạm vi này' })
    }

    const doc = await PTAssignmentEndRequest.create({
      ptId, memberId, reasonType, reasonDetail, assignmentId, classId,
    })

    // Chuyen trang thai PTAssignment sang pending_end_approval
    if (assignmentId) {
      await PTAssignment.updateOne(
        { _id: assignmentId, memberId, ptId, status: 'active' },
        { $set: { status: 'pending_end_approval' } },
      )
    }

    recordAuditLog({
      req,
      module: 'pt_assignment',
      action: 'create_end_request',
      entity: doc,
      entityName: `EndRequest ${doc._id}`,
      details: `PT ${req.user.fullName || req.user.name} yêu cầu kết thúc phụ trách member ${memberId} - ${reasonType}`,
    }).catch((err) => console.error('Audit createEndRequest failed:', err.message))

    // Thong bao cho Admin
    const ptName = req.user.fullName || req.user.name || 'PT'
    const memberName = await getMemberInfo(memberId)
    const reason = getReasonText(reasonType, reasonDetail)

    await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: 'PT_END_REQUEST_CREATED',
      title: 'Yêu cầu kết thúc phụ trách',
      content: `PT ${ptName} đã gửi yêu cầu kết thúc phụ trách hội viên ${memberName}.\n\nLý do:\n${reason}`,
      relatedId: doc._id,
      relatedType: 'PTAssignmentEndRequest',
      redirectUrl: '/admin/trainer-end-requests',
      createdBy: 'PT',
      sendEmail: false,
    })

    emitPTEndRequestCountUpdate()

    res.status(201).json({ message: 'Đã gửi yêu cầu', request: doc })
  } catch (error) {
    return sendError(res, error)
  }
}

// Admin lay danh sach yeu cau
export const getEndRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, fromDate, toDate, ptId, memberSearch } = req.query
    const filter = {}
    if (status) filter.status = status
    if (ptId) filter.ptId = ptId
    if (fromDate || toDate) {
      filter.createdAt = {}
      if (fromDate) filter.createdAt.$gte = new Date(fromDate)
      if (toDate) filter.createdAt.$lte = new Date(toDate)
    }

    // For text search, query memberId first
    if (memberSearch) {
      const members = await User.find({
        $or: [
          { fullName: { $regex: memberSearch, $options: 'i' } },
          { name: { $regex: memberSearch, $options: 'i' } },
          { memberCode: { $regex: memberSearch, $options: 'i' } },
        ],
      }).select('_id').lean()
      filter.memberId = { $in: members.map(m => m._id) }
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [items, total] = await Promise.all([
      PTAssignmentEndRequest.find(filter)
        .populate('ptId', 'name fullName email phone avatar')
        .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
        .populate('classId', 'name code')
        .populate({
          path: 'assignmentId',
          select: 'workoutId',
          populate: { path: 'workoutId', select: 'name goal' },
        })
        .populate('processedBy', 'name fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PTAssignmentEndRequest.countDocuments(filter),
    ])

    res.json({
      items,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

// PT xem yeu cau cua minh
export const getMyEndRequests = async (req, res) => {
  try {
    const { status } = req.query
    const filter = { ptId: req.user._id }
    if (status) filter.status = status

    const items = await PTAssignmentEndRequest.find(filter)
      .populate('memberId', 'name fullName email phone avatar memberCode memberNumber')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ items })
  } catch (error) {
    return sendError(res, error)
  }
}

// Admin chap nhan
export const approveEndRequest = async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.user._id

    const doc = await PTAssignmentEndRequest.findById(id)
    if (!doc) return res.status(404).json({ message: 'Khong tim thay yeu cau' })
    if (doc.status !== 'pending') return res.status(400).json({ message: 'Yeu cau da duoc xu ly truoc do' })

    const memberId = doc.memberId
    const ptId = doc.ptId

    const isPrivate = Boolean(doc.assignmentId) && !doc.classId
    const isGroup = Boolean(doc.classId) && !doc.assignmentId
    if (!isPrivate && !isGroup) {
      return res.status(409).json({
        message: 'Yêu cầu cũ không xác định được phạm vi PT 1-1/lớp nhóm nên không thể duyệt tự động. Hãy xử lý lại theo đúng phân công.',
      })
    }

    const mongoSession = await mongoose.startSession()
    try {
      await mongoSession.withTransaction(async () => {
        const now = new Date()
        const note = `PT end request approved (${doc.reasonType || ''}${doc.reasonDetail ? `: ${doc.reasonDetail}` : ''})`

        if (isPrivate) {
          // Chỉ kết thúc đúng assignment được chọn. Lịch cũ không có assignmentId
          // được giữ lại để Admin rà soát, không suy đoán theo memberId.
          const assignment = await PTAssignment.findOneAndUpdate(
            {
              _id: doc.assignmentId,
              memberId,
              ptId,
              status: { $in: ['active', 'pending_end_approval'] },
            },
            {
              $set: {
                status: 'ended',
                cancelledAt: now,
                cancelReason: `pt_end_request${doc.reasonType ? `_${doc.reasonType}` : ''}`,
                endDate: now,
              },
            },
            { new: true, session: mongoSession },
          )
          if (!assignment) {
            const error = new Error('Phân công PT 1-1 không còn hoạt động hoặc không thuộc yêu cầu này')
            error.statusCode = 409
            throw error
          }
          await WorkoutSchedule.updateMany(
            { memberId, assignmentId: doc.assignmentId, status: 'active' },
            { $set: { status: 'archived' } },
            { session: mongoSession },
          )
        } else {
          // Lớp nhóm: chỉ dừng đúng TrainingAssignment, enrollment và lịch của classId.
          const result = await TrainingAssignment.updateOne(
            { memberId, trainerId: ptId, classId: doc.classId, status: 'active' },
            {
              $set: {
                status: 'cancelled',
                cancelledAt: now,
                cancelReason: `pt_end_request${doc.reasonType ? `_${doc.reasonType}` : ''}`,
                endDate: now,
              },
            },
            { session: mongoSession },
          )
          if (result.modifiedCount !== 1) {
            const error = new Error('Phân công lớp nhóm không còn hoạt động hoặc không thuộc yêu cầu này')
            error.statusCode = 409
            throw error
          }
          await WorkoutSchedule.updateMany(
            { memberId, classId: doc.classId, status: 'active' },
            { $set: { status: 'archived' } },
            { session: mongoSession },
          )
          await endClassEnrollments({
            memberId,
            classId: doc.classId,
            sourceReason: 'ended_by_admin',
            note,
            session: mongoSession,
          })
        }

        doc.status = 'approved'
        doc.processedBy = adminId
        doc.processedAt = now
        await doc.save({ session: mongoSession, validateModifiedOnly: true })
      })
    } finally {
      await mongoSession.endSession()
    }

    recordAuditLog({
      req,
      module: 'pt_assignment',
      action: 'approve_end_request',
      entity: doc,
      entityName: `EndRequest ${doc._id}`,
      details: `Duyệt kết thúc phụ trách member ${memberId} bởi PT ${ptId} - ${doc.reasonType || ''}`,
    }).catch((err) => console.error('Audit approveEndRequest failed:', err.message))

    // Thong bao cho PT
    const memberName = await getMemberInfo(memberId)
    await createNotification({
      receiverId: ptId,
      receiverRole: 'pt',
      notificationType: 'PT_END_REQUEST_APPROVED',
      title: 'Yêu cầu kết thúc phụ trách đã được phê duyệt',
      content: `Yêu cầu kết thúc ${isPrivate ? 'phân công PT 1-1' : 'lớp nhóm'} của hội viên ${memberName} đã được Admin phê duyệt.\n\nChỉ phạm vi đã yêu cầu được kết thúc; các phân công khác vẫn được giữ nguyên.`,
      relatedId: doc._id,
      relatedType: 'PTAssignmentEndRequest',
      redirectUrl: '/pt/clients',
      createdBy: 'Admin',
      sendEmail: true,
    })

    // Thong bao cho member
    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: 'PT_END_APPROVED',
      title: 'Thay đổi PT phụ trách',
      content: `Yêu cầu kết thúc ${isPrivate ? 'PT 1-1' : 'lớp nhóm'} của bạn đã được chấp nhận.\n\nCác phân công/lớp khác (nếu có) không bị ảnh hưởng.`,
      relatedType: 'PTAssignmentEndRequest',
      redirectUrl: '/booking',
      createdBy: 'Admin',
      sendEmail: true,
    })

    // Bao hieu cho PT biet trang thai duoc duyet de cap nhat tab
    emitPTEndRequestStatusChange({
      userId: ptId,
      data: { type: 'approved', memberId: memberId.toString(), assignmentId: doc.assignmentId },
    })

    // Bao hieu cho member biet PT da ket thuc de cap nhat booking
    emitPTEndRequestStatusChange({
      userId: memberId,
      data: { type: 'assignment_ended' },
    })

    emitPTEndRequestCountUpdate()

    res.json({ message: 'Da chap nhan yeu cau', request: doc })
  } catch (error) {
    return sendError(res, error)
  }
}

// Admin tu choi
export const rejectEndRequest = async (req, res) => {
  try {
    const { id } = req.params
    const { rejectReason } = req.body
    const adminId = req.user._id

    const doc = await PTAssignmentEndRequest.findById(id)
    if (!doc) return res.status(404).json({ message: 'Khong tim thay yeu cau' })
    if (doc.status !== 'pending') return res.status(400).json({ message: 'Yeu cau da duoc xu ly truoc do' })

    doc.status = 'rejected'
    doc.processedBy = adminId
    doc.processedAt = new Date()
    doc.rejectReason = rejectReason || ''
    await doc.save({ validateModifiedOnly: true })

    recordAuditLog({
      req,
      module: 'pt_assignment',
      action: 'reject_end_request',
      entity: doc,
      entityName: `EndRequest ${doc._id}`,
      details: `Từ chối kết thúc phụ trách${rejectReason ? ` - Lý do: ${rejectReason}` : ''}`,
    }).catch((err) => console.error('Audit rejectEndRequest failed:', err.message))

    // Tra lai trang thai active cho PTAssignment
    if (doc.assignmentId) {
      await PTAssignment.updateOne(
        {
          _id: doc.assignmentId,
          memberId: doc.memberId,
          ptId: doc.ptId,
          status: 'pending_end_approval',
        },
        { $set: { status: 'active' } },
      )
    }

    // Thong bao cho PT
    const memberName = await getMemberInfo(doc.memberId)
    await createNotification({
      receiverId: doc.ptId,
      receiverRole: 'pt',
      notificationType: 'PT_END_REQUEST_REJECTED',
      title: 'Yêu cầu kết thúc phụ trách bị từ chối',
      content: `Yêu cầu kết thúc phụ trách hội viên ${memberName} đã bị Admin từ chối.\n\nLý do từ chối:\n${rejectReason || 'Không có lý do.'}`,
      relatedId: doc._id,
      relatedType: 'PTAssignmentEndRequest',
      redirectUrl: '/pt/clients',
      createdBy: 'Admin',
      sendEmail: true,
    })

    // Thong bao cho member
    await createNotification({
      receiverId: doc.memberId,
      receiverRole: 'member',
      notificationType: 'PT_END_REJECTED',
      title: 'Yêu cầu thay đổi PT phụ trách',
      content: `Yêu cầu kết thúc PT phụ trách của bạn chưa được chấp nhận.\n\nLý do:\n${rejectReason || 'Không có lý do.'}`,
      redirectUrl: '/booking',
      createdBy: 'Admin',
      sendEmail: true,
    })

    // Bao hieu cho PT biet trang thai bi tu choi de cap nhat tab
    emitPTEndRequestStatusChange({
      userId: doc.ptId,
      data: { type: 'rejected', memberId: doc.memberId.toString(), assignmentId: doc.assignmentId },
    })

    emitPTEndRequestCountUpdate()

    res.json({ message: 'Đã từ chối yêu cầu', request: doc })
  } catch (error) {
    return sendError(res, error)
  }
}
