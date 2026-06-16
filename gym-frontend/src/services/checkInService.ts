import api from './api'
import type {
  CheckinStats,
  ConfirmCheckinResponse,
  HeatmapResponse,
  MemberStreakResponse,
  QRTokenResponse,
  TodayCheckinsResponse,
  VerifyQRResponse,
} from '../types/admin/checkin'

export const checkInService = {
  generateQR: () =>
    api.get<QRTokenResponse>('/checkin/qr'),

  verifyQR: (token: string) =>
    api.post<VerifyQRResponse>('/checkin/verify', { token }),

  confirmCheckin: (token: string) =>
    api.post<ConfirmCheckinResponse>('/checkin/confirm', { token }),

  uploadSelfie: (checkinId: string, file: File) => {
    const formData = new FormData()
    formData.append('selfie', file)
    formData.append('checkinId', checkinId)
    return api.post('/checkin/selfie', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getStreak: (memberId: string) =>
    api.get<MemberStreakResponse>(`/checkin/streak/${memberId}`),

  getTodayCheckins: () =>
    api.get<TodayCheckinsResponse>('/checkin/today'),

  getStats: (period?: 'day' | 'week' | 'month') =>
    api.get<{ stats: CheckinStats }>('/checkin/stats', {
      params: { period },
    }),

  getHeatmap: () =>
    api.get<HeatmapResponse>('/checkin/heatmap'),
}
