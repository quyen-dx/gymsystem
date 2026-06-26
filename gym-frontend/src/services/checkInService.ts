import api from './api'
import type {
  CheckinStats,
  HeatmapResponse,
  MemberStreakResponse,
  QRTokenResponse,
  StaffCheckinHistoryResponse,
  StaffVerifyCheckinResponse,
  TodayCheckinsResponse,
} from '../types/admin/checkin'

export const checkInService = {
  generateQR: () =>
    api.get<QRTokenResponse>('/checkin/qr'),

  verifyStaffCheckin: (data: { token?: string; memberId?: string }) =>
    api.post<StaffVerifyCheckinResponse>('/staff/checkin/verify', data),

  getStreak: (memberId: string) =>
    api.get<MemberStreakResponse>(`/checkin/streak/${memberId}`),

  getTodayCheckins: () =>
    api.get<TodayCheckinsResponse>('/checkin/today'),

  getStaffHistory: (params?: {
    mode?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all' | 'custom'
    date?: string
    startTime?: string
    endTime?: string
    keyword?: string
    page?: number
    limit?: number
  }) => api.get<StaffCheckinHistoryResponse>('/staff/checkin/history', { params }),

  getStats: (period?: 'day' | 'week' | 'month') =>
    api.get<{ stats: CheckinStats }>('/checkin/stats', {
      params: { period },
    }),

  getHeatmap: () =>
    api.get<HeatmapResponse>('/checkin/heatmap'),
}
