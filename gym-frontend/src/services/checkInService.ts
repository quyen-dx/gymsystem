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

  // Daily QR (new check-in flow)
  generateDailyQR: () =>
    api.post<{ message: string; qrCode: { token: string; date: string; expiresAt: string; createdAt: string } }>('/checkin/daily-qr/generate'),

  getActiveDailyQR: () =>
    api.get<{ qrCode: { token: string; date: string; expiresAt: string; createdAt: string } | null }>('/checkin/daily-qr/active'),

  verifyDailyQR: (token: string) =>
    api.post<{
      valid: boolean
      message: string
      memberId: string
      qrToken: string
      enrollment: { classId: string; classCode: string; className: string } | null
      sessionDate: string
      sessions: Array<{
        scheduleId: string
        sessionIndex: number
        date: string
        time: string | null
        endTime: string | null
        title: string | null
        className: string | null
        classCode: string | null
        muscleGroup: string | null
        location: string | null
        alreadyCheckedIn: boolean
        checkedInAt: string | null
      }>
      freeWorkoutCheckedIn: { checkedInAt: string } | null
    }>('/checkin/daily-qr/verify', { token }),

  submitDailyQRCheckin: (data: { token: string; scheduleId?: string; sessionIndex?: number }) =>
    api.post<{ message: string; checkin: any }>('/checkin/daily-qr/checkin', data),

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
