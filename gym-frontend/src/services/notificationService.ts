import api from './api'

export interface NotificationItem {
  _id: string
  receiverId?: string | null
  receiverRole?: string | null
  notificationType?: string
  category?: string
  title: string
  content: string
  userId?: string | null
  isRead: boolean
  readAt?: string | null
  relatedId?: string | null
  relatedType?: string | null
  requestId?: string
  redirectUrl?: string | null
  requiresAction?: boolean
  actions?: string[]
  actionStatus?: 'pending' | 'accepted' | 'rejected'
  actionAt?: string | null
  createdBy?: string
  createdAt: string
  updatedAt?: string
}

export type Notification = NotificationItem

export const notificationService = {
  getMyNotifications: () =>
    api.get<{ success: boolean; data: NotificationItem[] }>(
      '/notifications/my',
    ),

  getUnreadCount: () =>
    api.get<{ success: boolean; count: number }>(
      '/notifications/unread-count',
    ),

  markAsRead: (id: string) =>
    api.put(`/notifications/${id}/read`),

  markAsUnread: (id: string) =>
    api.put(`/notifications/${id}/unread`),

  markAllAsRead: () =>
    api.put('/notifications/read-all'),

  deleteNotification: (id: string) =>
    api.delete(`/notifications/${id}`),
}
