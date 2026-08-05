import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL } from '../config/env'
import { getAuthToken, refreshAccessToken } from './api'

let socket: Socket | null = null
let listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []

const connect = () => {
  if (socket?.connected) return socket

  const token = getAuthToken()
  if (!token) return null

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected')
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', async (err) => {
    if (err.message === 'Unauthorized') {
      try {
        const newToken = await refreshAccessToken()
        if (newToken) {
          socket!.auth = { token: newToken }
          socket!.connect()
          return
        }
      } catch {
        // refresh token expired too
      }
    }
    console.error('[Socket] Connection error:', err.message)
  })

  for (const { event, handler } of listeners) {
    socket.off(event, handler)
    socket.on(event, handler)
  }

  return socket
}

const disconnect = () => {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

export const socketService = {
  connect,
  disconnect,

  on: (event: string, handler: (...args: any[]) => void) => {
    listeners.push({ event, handler })
    if (socket) {
      socket.on(event, handler)
    }
  },

  off: (event: string, handler: (...args: any[]) => void) => {
    listeners = listeners.filter((l) => l.event !== event || l.handler !== handler)
    if (socket) {
      socket.off(event, handler)
    }
  },

  emit: (event: string, ...args: any[]) => {
    if (socket?.connected) {
      socket.emit(event, ...args)
    }
  },
}

export const useRefundRequestSocket = (onUpdate: (count: number) => void) => {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = socketService.connect()
    if (s) {
      setConnected(true)
    }

    const handler = (data: { count: number }) => {
      onUpdate(data.count)
    }

    socketService.on('refund_request_update', handler)

    return () => {
      socketService.off('refund_request_update', handler)
    }
  }, [onUpdate])

  return { connected }
}

export default socketService
