import api from './api'

export interface MembershipPlan {
  _id: string
  id?: string
  nameVi: string
  nameEn: string
  price: number
  durationDays: number
  descriptionVi?: string
  descriptionEn?: string
  featuresVi?: string[]
  featuresEn?: string[]
  color?: string
  isActive?: boolean
  memberCount?: number
}

export interface CancellationRequest {
  _id: string
  memberId: any
  membershipId: any
  planId: any
  reason: string
  usedDays: number
  remainingDays: number
  totalDays: number
  usedPercent: number
  policyCode: 'REFUND_100' | 'REFUND_50' | 'NO_REFUND'
  policyLabel: string
  refundRate: number
  registeredAt: string
  requestedAt: string
  policyAccepted: boolean
  policyAcceptedAt: string | null
  refundEligible: boolean
  estimatedRefundAmount: number
  finalRefundAmount: number
  status: 'pending' | 'approved' | 'rejected'
  rejectReason: string
  refundMethod: 'WALLET' | 'NONE'
  refundStatus: 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE'
  refundCompletedAt: string | null
  staffNote: string
  handledBy: any
  handledAt: string | null
  createdAt: string
}

export interface MyMembership {
  _id: string
  id: string
  planId?: string
  plan?: MembershipPlan
  planNameVi?: string
  planNameEn?: string
  price?: number
  durationDays?: number
  startDate: string
  endDate: string
  remainingDays: number
  status: 'active' | 'pending_cancel' | 'expired' | 'cancelled'
  displayStatus: 'active' | 'expiring_soon' | 'expired'
  autoRenew?: boolean
}

export const membershipService = {
  getPlans: () => api.get<{ plans: MembershipPlan[] }>('/plans', { params: { limit: 100 } }),
  registerPlan: (planId: string) => api.post('/memberships', { planId }),
  subscribePlan: (planId: string) => api.post('/memberships/subscribe', { planId }),
  getMyMembership: () => api.get<{ membership: MyMembership | null; canRenew: boolean; autoRenew?: boolean; autoRenewResult?: any; cancellationRequests?: CancellationRequest[] }>('/memberships/my'),
  toggleAutoRenew: () => api.post<{ autoRenew: boolean; message: string }>('/memberships/my/auto-renew'),
  renewMyMembership: () => api.post('/memberships/my/renew'),
  renewPlanWithWallet: () => api.post('/memberships/my/renew-wallet'),
  renewPlanWithDuration: (durationMultiplier: number) =>
    api.post<{ message: string; walletBalance: number; membership: MyMembership; payment: any }>(
      '/memberships/my/renew-plan', { durationMultiplier },
    ),
  getRegistrations: (params?: Record<string, unknown>) => api.get('/memberships/registrations', { params }),
  confirmRegistration: (id: string) => api.patch(`/memberships/registrations/${id}/confirm`),
  cancelRegistration: (id: string, reason: string) => api.patch(`/memberships/registrations/${id}/cancel`, { reason }),
  getPayments: (params?: Record<string, unknown>) => api.get('/memberships/payments', { params }),
  searchMembers: (q: string) => api.get<{ members: any[] }>('/members/search', { params: { q } }),
  offlineRegister: (data: { memberId: string; planId: string; paymentMethod: string; amountPaid: number; note?: string }) =>
    api.post('/members/offline-register', data),

  createCancelRequest: (data: { reason: string; policyAccepted?: boolean; refundMethod?: 'WALLET' | 'NONE' }) =>
    api.post<{ message: string; cancellationRequest: CancellationRequest }>('/memberships/cancel-request', data),
  getMyCancelRequests: () =>
    api.get<{ cancellationRequests: CancellationRequest[] }>('/memberships/my-cancel-request'),
  getStaffCancellations: (params?: Record<string, unknown>) =>
    api.get<{ cancellations: CancellationRequest[]; pagination: any }>('/memberships/staff/cancellations', { params }),
  approveCancellation: (id: string, data: { finalRefundAmount?: number; staffNote?: string }) =>
    api.post<{ message: string; cancellationRequest: CancellationRequest }>(`/memberships/staff/cancellations/${id}/approve`, data),
  rejectCancellation: (id: string, data: { reason: string }) =>
    api.post<{ message: string; cancellationRequest: CancellationRequest }>(`/memberships/staff/cancellations/${id}/reject`, data),
}
