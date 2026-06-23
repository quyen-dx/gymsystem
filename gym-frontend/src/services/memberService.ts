import api from './api'
import type {
  MemberDetail,
  MemberFormData,
  MemberListItem,
  MemberStats,
  TimelineEvent,
} from '../types/admin/member'

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

  registerPlan: (id: string, planId: string) =>
    api.post(`/members/${id}/register-plan`, { planId }),

  renewPlan: (id: string, planId: string, renewFrom?: 'today' | 'endDate') =>
    api.post(`/members/${id}/renew-plan`, { planId, renewFrom }),

  batchRenew: (memberIds: string[], planId: string, renewFrom?: 'today' | 'endDate') =>
    api.post('/members/batch-renew', { memberIds, planId, renewFrom }),
}
