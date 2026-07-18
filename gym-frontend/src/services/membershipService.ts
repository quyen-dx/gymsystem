import api from './api'

export interface MembershipPlan {
  _id: string
  id?: string
  nameVi: string
  price: number
  durationDays: number
  descriptionVi?: string
  featuresVi?: string[]
  featureIds?: string[]
  features?: Array<{ _id: string; code: string; name: string; icon: string; color: string; category: string }>
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
  daysSincePurchase?: number
  refundDeadline?: string
  isPastRefundDeadline?: boolean
  checkInCount?: number
  bookingCount?: number
  hasUsedBenefits?: boolean
  currentRefundEligible?: boolean
  ineligibilityReason?: string | null
  activePT?: { ptName: string; assignmentId: string } | null
  activeClass?: { className: string; enrollmentId: string } | null
}

export interface MembershipPeriod {
  _id: string
  membershipId: string
  planId: any
  memberId: string
  startDate: string
  endDate: string
  totalDays: number
  price: number
  paymentId?: string
  activatedAt?: string
  completedAt?: string
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'CANCEL_REQUESTED' | 'REJECTED'
  displayStatus?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'CANCEL_REQUESTED' | 'REJECTED'
  canCancel?: boolean
  isFirst?: boolean
  hasPendingRequest?: boolean
  rejectionReason?: string
  createdAt?: string
  cancelledAt?: string
  plan?: MembershipPlan
}

export interface MembershipRenewal {
  _id: string
  membershipId: string
  planId: any
  memberId: string
  days: number
  price: number
  oldEndDate: string
  newEndDate: string
  renewedAt: string
  status: 'ACTIVE' | 'CANCELLED'
  paymentId?: string
  durationMultiplier: number
  plan?: MembershipPlan
}

export interface MyMembership {
  _id: string
  id: string
  planId?: string
  plan?: MembershipPlan
  planNameVi?: string
  price?: number
  durationDays?: number
  startDate: string
  endDate: string
  remainingDays: number
  status: 'active' | 'pending_cancel' | 'expired' | 'cancelled' | 'refunded' | 'cancel_requested'
  displayStatus: 'active' | 'expiring_soon' | 'expired' | 'cancel_requested'
  createdAt?: string
  cancelledAt?: string
}

export interface CancelPeriodDetail {
  _id: string
  index: number
  status: 'ACTIVE' | 'PENDING'
  startDate: string
  endDate: string
  totalDays: number
  price: number
  activatedAt?: string
  refundEligible: boolean
  refundReason: string | null
}

export interface CancelInfo {
  membership: MyMembership
  period: {
    _id: string
    startDate: string
    endDate: string
    totalDays: number
    price: number
    activatedAt?: string
  }
  refundInfo: {
    eligibleForRefund: boolean
    isWithinWindow: boolean
    hasUsedBenefits: boolean
    refundDeadline: string
    estimatedRefundAmount: number
    reason: string
  }
  pendingPeriods: Array<{
    _id: string
    startDate: string
    endDate: string
    totalDays: number
    price: number
  }>
  periodsDetail: CancelPeriodDetail[]
  totalEstimatedRefund: number
}

export interface PendingCancelRequest {
  id: string
  reason: string
  refundAmount: number
  status: string
  requestedAt: string
  createdAt: string
}

export interface RefundRequest {
  _id: string
  memberId: any
  membershipId: any
  membershipPeriodId: any
  planId: any
  reason: string
  refundAmount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED'
  requestedAt: string
  reviewedBy: any
  reviewedAt: string | null
  staffNote: string
  createdAt: string

  // Snapshot fields
  daysUsedAtRequest: number
  eligibleWithin7Days: boolean
  usedCheckIn: boolean
  usedGym: boolean
  usedPT: boolean
  usedBenefits: boolean
  checkInCountAtRequest: number
  gymUsageCountAtRequest: number
  ptBookingCountAtRequest: number
  refundPolicyResult: string
  policyVersion: string
  pendingPeriodsTotal?: number
  pendingPeriodsCount?: number
}

export const membershipService = {
  getPlans: (params?: Record<string, any>) => api.get<{ plans: MembershipPlan[] }>('/plans', { params: { limit: 100, ...params } }),
  registerPlan: (planId: string) => api.post('/memberships', { planId }),
  subscribePlan: (planId: string) => api.post('/memberships/subscribe', { planId }),
  getMyMembership: () => api.get<{ membership: MyMembership | null; canRenew: boolean; renewalThresholdDays: number; pendingCancelRequest: PendingCancelRequest | null }>('/memberships/my'),
  getMyRenewals: () => api.get<{ renewals: MembershipRenewal[] }>('/memberships/my/renewals'),
  getMyPeriods: () => api.get<{ periods: MembershipPeriod[] }>('/memberships/my/periods'),
  cancelRenewal: (renewalId: string) =>
    api.post<{ message: string; membership: MyMembership; renewal: MembershipRenewal }>(
      `/memberships/my/cancel-renewal/${renewalId}`,
    ),
  renewMyMembership: () => api.post('/memberships/my/renew'),
  renewPlanWithWallet: () => api.post('/memberships/my/renew-wallet'),
  renewPlanWithDuration: (durationMultiplier: number) =>
    api.post<{ message: string; walletBalance: number; membership: MyMembership; payment: any; newEndDate?: string }>(
      '/memberships/my/renew-plan', { durationMultiplier },
    ),
  getRegistrations: (params?: Record<string, unknown>) => api.get('/memberships/registrations', { params }),
  confirmRegistration: (id: string) => api.patch(`/memberships/registrations/${id}/confirm`),
  cancelRegistration: (id: string, reason: string) => api.patch(`/memberships/registrations/${id}/cancel`, { reason }),
  getPayments: (params?: Record<string, unknown>) => api.get('/memberships/payments', { params }),
  searchMembers: (q: string) => api.get<{ members: any[] }>('/members/search', { params: { q } }),
  offlineRegister: (data: { memberId: string; planId: string; paymentMethod: string; amountPaid: number; note?: string }) =>
    api.post('/members/offline-register', data),

  createRefundRequest: (data: { periodId: string; reason?: string }) =>
    api.post<{ message: string; refundRequest: RefundRequest }>('/memberships/my/refund-request', data),
  getMyHistory: () =>
    api.get<{ history: Array<{ membership: MyMembership; periods: MembershipPeriod[] }> }>('/memberships/history'),
  getMembershipDetail: (membershipId: string) =>
    api.get<{ membership: MyMembership; periods: MembershipPeriod[]; refundRequest: RefundRequest | null }>(`/memberships/${membershipId}`),
  getCancelInfo: () =>
    api.get<CancelInfo>('/memberships/my/cancel-info'),
  getPendingRefundRequestCount: () =>
    api.get<{ count: number }>('/memberships/staff/refund-requests/count'),
  getStaffRefundRequests: (params?: Record<string, unknown>) =>
    api.get<{ refundRequests: RefundRequest[]; pagination: any }>('/memberships/staff/refund-requests', { params }),
  approveRefundRequest: (id: string, data: { staffNote?: string }) =>
    api.post<{ message: string; refundRequest: RefundRequest }>(`/memberships/staff/refund-requests/${id}/approve`, data),
  rejectRefundRequest: (id: string, data: { reason: string }) =>
    api.post<{ message: string; refundRequest: RefundRequest }>(`/memberships/staff/refund-requests/${id}/reject`, data),

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
