import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

let io = null

export const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true)
      },
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      if (!token) return next(new Error('Unauthorized'))

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.id || decoded._id).select('role')
      if (!user) return next(new Error('User not found'))

      socket.userId = user._id.toString()
      socket.userRole = user.role

      // Mỗi user join vào room riêng để nhận notification cá nhân
      socket.join(socket.userId)

      if (['staff', 'admin', 'super_admin'].includes(user.role)) {
        socket.join('staff')
      }

      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId} (${socket.userRole})`)

    // Admin/staff đang mở màn hình Phân công PT → join room để reload realtime,
    // backend sẽ không tạo thông báo trùng lặp khi họ đang nhìn màn hình này.
    socket.on('pt1on1:join-active-view', () => {
      if (['staff', 'admin', 'super_admin'].includes(socket.userRole)) {
        socket.join('pt1on1-active-view')
      }
    })
    socket.on('pt1on1:leave-active-view', () => {
      socket.leave('pt1on1-active-view')
    })

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`)
    })
  })

  return io
}

export const getIO = () => io

/**
 * Emit một sự kiện realtime của module Yêu cầu PT 1-1.
 * Payload: { request, memberName }.
 * Đối tượng nhận: room staff (admin/staff), room riêng của member, room riêng của PT (nếu có).
 */
export const emitPtRequestEvent = (event, { request, memberName = '' } = {}) => {
  if (!io || !request) return
  const payload = { request, memberName }
  io.to('staff').emit(event, payload)
  const memberId = typeof request.memberId === 'object' ? request.memberId?._id : request.memberId
  if (memberId) io.to(memberId.toString()).emit(event, payload)
  const trainerId = typeof request.assignedTrainerId === 'object' ? request.assignedTrainerId?._id : request.assignedTrainerId
  if (trainerId) io.to(trainerId.toString()).emit(event, payload)
}

export const emitRefundRequestUpdate = async () => {
  if (!io) return
  const { default: RefundRequest } = await import('../models/RefundRequest.js')
  const count = await RefundRequest.countDocuments({ status: 'PENDING' })
  io.to('staff').emit('refund_request_update', { count })
}

export const emitShiftChangeCountUpdate = async () => {
  if (!io) return
  const { default: ShiftChangeRequest } = await import('../models/ShiftChangeRequest.js')
  const count = await ShiftChangeRequest.countDocuments({
    status: { $in: ['pending', 'waiting_assignment'] },
  })
  io.to('staff').emit('shift_change:count_updated', { pendingCount: count })
}

export const emitShiftChangeNewRequest = (payload) => {
  if (!io) return
  io.to('staff').emit('shift_change:new_request', payload)
}

/**
 * Trạng thái yêu cầu thay ca thay đổi (gán PT / từ chối / hủy / PT phản hồi)
 * → admin đang mở trang danh sách refetch ngay.
 */
export const emitShiftChangeUpdated = ({ requestId, status } = {}) => {
  if (!io) return
  io.to('staff').emit('shift_change:updated', { requestId, status })
}

/**
 * Lịch thay ca của một PT (PT gốc hoặc PT thay) đã thay đổi
 * → PT đang mở trang Lịch làm việc refetch ngay.
 * data: { requestId, type: 'assigned'|'accepted'|'rejected'|'cancelled', itemId }
 */
export const emitShiftChangeMyUpdated = ({ userId, data } = {}) => {
  if (!io || !userId) return
  io.to(userId.toString()).emit('shift_change:my_updated', data)
}

export const emitPTEndRequestCountUpdate = async () => {
  if (!io) return
  const { default: PTAssignmentEndRequest } = await import('../models/PTAssignmentEndRequest.js')
  const count = await PTAssignmentEndRequest.countDocuments({ status: 'pending' })
  io.to('staff').emit('pt_end_request:count_updated', { pendingCount: count })
}

/**
 * Emit a notification to a specific user (PT, member, etc.)
 * userId: the user's _id as string
 * notification: the full Notification document to send
 */
export const emitNotificationToUser = ({ userId, notification }) => {
  if (!io || !userId || !notification) return
  io.to(userId.toString()).emit('notification:new', notification)
}

/**
 * Emit a notification to all staff/admin users
 */
export const emitNotificationToStaff = (notification) => {
  if (!io || !notification) return
  io.to('staff').emit('notification:new', notification)
}

/**
 * Emit notification cập nhật (action đã xử lý) tới user cụ thể,
 * để mọi tab đang mở notification đều đổi trạng thái ngay.
 */
export const emitNotificationUpdated = ({ userId, notification }) => {
  if (!io || !userId || !notification) return
  io.to(userId.toString()).emit('notification:updated', notification)
}

/**
 * Emit a status change event for PT end request to a specific user
 */
export const emitPTEndRequestStatusChange = ({ userId, data }) => {
  if (!io || !userId) return
  io.to(userId.toString()).emit('pt_end_request:status_changed', data)
}

/**
 * Emit sự kiện "danh sách học viên của PT đã thay đổi" tới PT,
 * để trang "Học viên của tôi" cập nhật realtime (không cần F5).
 * data: { action: 'added'|'removed'|'updated', memberId }
 */
export const emitPtClientsUpdated = ({ userId, data }) => {
  if (!io || !userId) return
  io.to(userId.toString()).emit('pt_clients:updated', data)
}

export const emitWorkoutReportCountUpdate = async () => {
  if (!io) return
  const { default: WorkoutReport } = await import('../models/WorkoutReport.js')
  const count = await WorkoutReport.countDocuments({ status: 'pending' })
  io.to('staff').emit('workout_report:count_updated', { pendingCount: count })
}
