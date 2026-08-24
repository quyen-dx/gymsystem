import api from './api'
import type { PlanFeature } from './planFeatureService'

export interface MembershipPlan {
  _id: string
  id?: string
  nameVi: string
  price: number
  durationDays: number
  descriptionVi?: string
  featureIds?: PlanFeature[]
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
  renewalRefunds: Array<{
    periodId: string
    price: number
    refundAmount: number
  }>
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
  refundStatus?: 'refunded' | 'none'
  refundAmount?: number
  refundAt?: string
  refundMethod?: 'WALLET' | null
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
  displayStatus: 'active' | 'expiring_soon' | 'expires_today' | 'expired' | 'cancelled' | 'refunded'
  createdAt?: string
  cancelledAt?: string
}

export interface MyMembershipCycle {
  purchasedAt: string | null
  activatedAt: string | null
  expiresAt: string | null
  refundEligible: boolean | null
  refundExpiredAt: string | null
  status: 'active'
  startDate: string | null
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

export interface CancelRenewalItem {
  index: number
  days: number
  price: number
  startDate: string
  endDate: string
  status: string
  displayStatus: string
  refundEligible: boolean
  refundAmount: number
}

export interface RefundInfo {
  eligible: boolean
  hasUsedBenefit: boolean
  within7Days: boolean
  registeredAt: string | null
  refundDeadline: string | null
  remainingDays: number
  reason: string
}

export interface CancelMainPackage {
  planName: string
  price: number
  status: string
  activatedAt: string | null
  purchasedAt: string | null
  registeredAt: string | null
  refundEligible: boolean
  refundAmount: number
  reason: string
  hasUsedBenefit: boolean
  within7Days: boolean
  refundDeadline: string | null
  remainingDays: number
}

export interface CancelInfo {
  membership: MyMembership
  mainPackage: CancelMainPackage
  renewals: CancelRenewalItem[]
  totalRefund: number
  period: {
    startDate: string | null
    endDate: string | null
    totalDays: number
    price: number
    activatedAt: string | null
  } | null
  refundInfo: {
    eligibleForRefund: boolean
    estimatedRefundAmount: number
    reason: string
    purchasedAt: string | null
    registeredAt: string | null
    activatedAt: string | null
    hasUsedBenefit: boolean
    within7Days: boolean
    refundDeadline: string | null
    remainingDays: number
  }
  pendingPeriods: Array<{
    _id: string
    startDate: string
    endDate: string
    totalDays: number
    price: number
  }>
  periodsDetail: any[]
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

  // Cancellation-specific fields (from MembershipCancellationRequest)
  __source?: 'cancellation'
  cancellationRequestId?: string
  cycle?: {
    _id: string
    activatedAt: string | null
    refundEligible: boolean | null
    firstBenefitType?: string | null
    firstBenefitUsedAt?: string | null
    purchasedAt: string | null
    startDate: string | null
    expiresAt: string | null
    durationDays: number | null
  } | null
  activationStatus?: 'pending' | 'activated'
  remainingRefundDays?: number
}

export const membershipService = {
  getPlans: (params?: Record<string, any>) => api.get<{ plans: MembershipPlan[] }>('/plans', { params: { limit: 100, ...params } }),
  registerPlan: (planId: string) => api.post('/memberships', { planId }),
  subscribePlan: (planId: string) => api.post('/memberships/subscribe', { planId }),
  checkoutPlan: (planId: string) =>
    api.post<{
      status: 'PAID' | 'PARTIAL' | 'NO_BALANCE'
      totalAmount?: number
      walletBalance?: number
      walletUsed?: number
      remainingAmount?: number
      paymentId?: string
      txnRef?: string
      paymentUrl?: string
      planName?: string
      message?: string
      paymentMethod?: string
    }>('/memberships/checkout', { planId }),
  checkoutRenew: (planId: string, durationMultiplier: number) =>
    api.post<{
      status: 'PAID' | 'PARTIAL' | 'NO_BALANCE'
      totalAmount?: number
      walletBalance?: number
      walletUsed?: number
      remainingAmount?: number
      paymentId?: string
      txnRef?: string
      paymentUrl?: string
      planName?: string
      message?: string
      paymentMethod?: string
    }>('/memberships/checkout-renew', { planId, mode: 'renew', durationMultiplier }),
  changePlanCheckout: (newPlanId: string, cancelRenewals = false) =>
    api.post<{
      status: 'PAID' | 'PARTIAL' | 'NO_BALANCE'
      totalAmount?: number
      walletBalance?: number
      walletUsed?: number
      remainingAmount?: number
      paymentId?: string
      txnRef?: string
      paymentUrl?: string
      changeType?: string
      oldPlanName?: string
      newPlanName?: string
      message?: string
      amountToPay?: number
    }>('/memberships/change-plan/checkout', { newPlanId, cancelRenewals }),
  getMyMembership: () => api.get<{ membership: MyMembership | null; canRenew: boolean; renewalThresholdDays: number; pendingCancelRequest: PendingCancelRequest | null; cycle: MyMembershipCycle | null; refundInfo: RefundInfo | null }>('/memberships/my'),
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
  autoCancelPeriod: (periodId: string) =>
    api.post<{ message: string; refundAmount: number }>(`/memberships/my/periods/${periodId}/auto-cancel`),
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
