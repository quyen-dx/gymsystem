import api from './api'

export interface Notification {
  _id: string
  title: string
  content: string
  userId: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export const notificationService = {
  getMyNotifications: () =>
    api.get<{ success: boolean; data: Notification[] }>('/notifications/my'),

  markAsRead: (id: string) =>
    api.put<{ success: boolean; message: string }>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<{ success: boolean; message: string }>('/notifications/read-all'),
}
