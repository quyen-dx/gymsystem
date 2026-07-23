import api from './api'

export interface TrainingRequestMembershipInfo {
  planName: string
  remainingDays: number
  totalRemainingDays: number
  pendingRenewalsCount: number
  isPending?: boolean
  hasMembership: boolean
  planPrice: number
}

export interface TrainingRequest {
  _id: string
  type?: 'group' | 'pt1on1'
  memberId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string; memberCode?: string }
  specialization?: string
  goals: string[]
  desiredSessions: number
  timeSlots: string[]
  daysOfWeek: number[]
  healthNotes: string
  isNewToGym?: boolean
  note?: string
  contactPhone?: string
  contactEmail?: string
  preferredTrainerId?: string | null
  status: 'pending' | 'assigned' | 'cancelled'
  assignedClassId?: string | { _id: string; name?: string; schedule?: Array<{ dayOfWeek: number; time: string }> }
  assignedTrainerId?: string | { _id: string; name?: string; fullName?: string; avatar?: string; specialties?: string[] } | null
  assignedAt?: string
  assignedBy?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
  membershipInfo?: TrainingRequestMembershipInfo
}

export const trainingRequestService = {
  create: (data: Partial<TrainingRequest>) => api.post('/training-requests', data),
  getMyRequests: (params?: { type?: string; status?: string }) =>
    api.get<{ requests: TrainingRequest[] }>('/training-requests/my', { params }),
  cancelMyRequest: (id: string, reason?: string) => api.patch(`/training-requests/my/${id}/cancel`, { reason }),
  getAllRequests: (params?: { type?: string; status?: string; page?: number }) =>
    api.get<{ requests: TrainingRequest[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/training-requests', { params },
    ),
  assignToClass: (id: string, classId: string) =>
    api.patch(`/training-requests/${id}/assign`, { classId }),
  assignTrainer: (id: string, trainerId: string) =>
    api.patch(`/training-requests/${id}/assign-trainer`, { trainerId }),
  cancelByAdmin: (id: string, reason?: string) =>
    api.patch(`/training-requests/${id}/cancel`, { reason }),
  getById: (id: string) =>
    api.get<{ request: TrainingRequest }>(`/training-requests/${id}`),
}
