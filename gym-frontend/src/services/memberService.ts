import api from './api'
import type {
  MemberDetail,
  MemberFormData,
  MemberListItem,
  MemberStats,
  TimelineEvent,
} from '../types/admin/member'

export interface EnrollmentStatus {
  hasActiveEnrollment: boolean
  hasActiveSchedules: boolean
  hasPendingRequest: boolean
  pendingRequest: { _id: string; specialization?: string; timeSlots: string[]; daysOfWeek: number[] } | null
  pt: { ptId: string; name: string } | null
  class: { classId: string; name: string; code: string; specialization: string; daysOfWeek: number[]; time: string } | null
  workout: { name: string; goal?: string } | null
}

export const memberService = {
  getMembers: (params?: Record<string, unknown>) =>
    api.get<{ members: MemberListItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/members', { params }),

  getMemberById: (id: string) =>
    api.get<{ member: MemberDetail }>(`/members/${id}`),

  getMemberStats: () =>
    api.get<{ stats: MemberStats }>('/members/stats'),

  getExpiringMembers: () =>
    api.get<{ members: MemberListItem[] }>('/members/expiring'),

  getMemberTimeline: (id: string) =>
    api.get<{ timeline: TimelineEvent[] }>(`/members/${id}/timeline`),

  getMemberHealthScore: (id: string) =>
    api.get<{ healthScore: { overall: number; checkinScore: number; workoutCompletionScore: number; checkinCount: number; level: string; levelText: string } }>(`/members/${id}/health-score`),

  createMember: (data: MemberFormData) =>
    api.post('/members', data),

  updateMember: (id: string, data: FormData | Record<string, unknown>) =>
    api.patch(`/members/${id}`, data, data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined,
    ),

  toggleMemberStatus: (id: string) =>
    api.patch(`/members/${id}/toggle-status`),

  createOfflinePlanPayment: (id: string, data: { planId: string; method: 'CASH' | 'POS' | 'BANK_TRANSFER'; confirmed?: boolean; flow?: 'register' | 'renew' }) =>
    api.post(`/members/${id}/offline-plan-payment`, data),

  getOfflinePlanPayment: (paymentId: string) =>
    api.get(`/members/plan-payments/${paymentId}`),

  confirmOfflinePlanPayment: (paymentId: string) =>
    api.post(`/members/plan-payments/${paymentId}/confirm`),

  registerPlan: (id: string, planId: string, paymentId?: string) =>
    api.post(`/members/${id}/register-plan`, { planId, paymentId }),

  renewPlan: (id: string, planId: string, paymentIdOrRenewFrom?: string, renewFrom?: 'today' | 'endDate') => {
    const legacyRenewFrom = paymentIdOrRenewFrom === 'today' || paymentIdOrRenewFrom === 'endDate'
    return api.post(`/members/${id}/renew-plan`, {
      planId,
      paymentId: legacyRenewFrom ? undefined : paymentIdOrRenewFrom,
      renewFrom: legacyRenewFrom ? paymentIdOrRenewFrom : renewFrom,
    })
  },

  batchRenew: (memberIds: string[], planId: string, renewFrom?: 'today' | 'endDate') =>
    api.post('/members/batch-renew', { memberIds, planId, renewFrom }),

  createAndRegister: (data: {
    name: string; email?: string; phone?: string; dateOfBirth?: string; gender?: string; password?: string;
    planId: string; paymentMethod: string; amountPaid: number; memo?: string;
  }) => api.post('/members/create-and-register', data),

  offlineRegister: (data: {
    memberId: string; planId: string; paymentMethod: string; amountPaid: number; note?: string;
  }) => api.post('/members/offline-register', data),

  getMyEnrollmentStatus: () =>
    api.get<EnrollmentStatus>('/members/me/enrollment-status'),
}
