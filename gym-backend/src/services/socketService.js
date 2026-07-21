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
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`)
    })
  })

  return io
}

export const getIO = () => io

export const emitRefundRequestUpdate = async () => {
  if (!io) return
  const { default: RefundRequest } = await import('../models/RefundRequest.js')
  const count = await RefundRequest.countDocuments({ status: 'PENDING' })
  io.to('staff').emit('refund_request_update', { count })
}

export const emitShiftSwapCountUpdate = async () => {
  if (!io) return
  const { default: ShiftSwapRequest } = await import('../models/ShiftSwapRequest.js')
  const count = await ShiftSwapRequest.countDocuments({ status: 'cho_duyet' })
  io.to('staff').emit('shift_swap:count_updated', { pendingCount: count })
}

export const emitShiftSwapNewRequest = (payload) => {
  if (!io) return
  io.to('staff').emit('shift_swap:new_request', payload)
}

export const emitTrainerReplacementNotification = ({ userId, notification }) => {
  if (!io) return
  io.to(userId.toString()).emit('notification:new', notification)
}

export const emitShiftSwapNotification = ({ userId, notification }) => {
  if (!io) return
  io.to(userId.toString()).emit('notification:new', notification)
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
 * Emit a status change event for PT end request to a specific user
 */
export const emitPTEndRequestStatusChange = ({ userId, data }) => {
  if (!io || !userId) return
  io.to(userId.toString()).emit('pt_end_request:status_changed', data)
}

export const emitWorkoutReportCountUpdate = async () => {
  if (!io) return
  const { default: WorkoutReport } = await import('../models/WorkoutReport.js')
  const count = await WorkoutReport.countDocuments({ status: 'pending' })
  io.to('staff').emit('workout_report:count_updated', { pendingCount: count })
}

export const emitPersonalTrainingCountUpdate = async () => {
  if (!io) return
  const { default: PersonalTrainingRequest } = await import('../models/PersonalTrainingRequest.js')
  const count = await PersonalTrainingRequest.countDocuments({ status: 'pending' })
  io.to('staff').emit('personal_training:count_updated', { pendingCount: count })
}

export const emitPersonalTrainingNewRequest = (request) => {
  if (!io) return
  io.to('staff').emit('personal_training:new_request', request)
}
