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
