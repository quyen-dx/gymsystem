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

export interface TrainingRequestProposal {
  type?: 'group' | 'pt1on1'
  classId?: string
  className?: string
  trainerId?: string
  trainerName?: string
  specialization?: string
  goals?: string[]
  timeSlots?: string[]
  daysOfWeek?: number[]
  startTime?: string | null
  endTime?: string | null
  zoneId?: string | null
  zoneName?: string
  floorId?: string | null
  floorName?: string
  note?: string
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
  status: 'pending' | 'processing' | 'message_sent' | 'waiting_member' | 'waiting_assignment' | 'waiting_reassign' | 'declined_by_member' | 'assigned' | 'class_assigned' | 'active' | 'completed' | 'ended' | 'cancelled'
  lastMessage?: string
  messageSentAt?: string
  assignedClassId?: string | { _id: string; name?: string; schedule?: Array<{ dayOfWeek: number; time: string }> }
  assignedTrainerId?: string | { _id: string; name?: string; fullName?: string; avatar?: string; specialties?: string[] } | null
  rejectedPtIds?: Array<string | { _id: string }>
  assignedAt?: string
  assignedBy?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
  membershipInfo?: TrainingRequestMembershipInfo
  proposal?: TrainingRequestProposal | null
  currentProposal?: TrainingRequestProposal | null
  selectedProposal?: TrainingRequestProposal | null
  approvedProposal?: TrainingRequestProposal | null
  acceptedProposal?: TrainingRequestProposal | null
  proposalAccepted?: boolean
  proposalAcceptedAt?: string
}

export const ACTIVE_TRAINING_REQUEST_STATUSES = [
  'pending', 'processing', 'message_sent', 'waiting_member', 'waiting_assignment', 'waiting_reassign',
] as const

export const trainingRequestService = {
  create: (data: Partial<TrainingRequest>) => api.post('/training-requests', data),
  getMyRequests: (params?: { type?: string; status?: string; activeOnly?: boolean }) =>
    api.get<{ requests: TrainingRequest[] }>('/training-requests/my', { params }),
  cancelMyRequest: (id: string, reason?: string) => api.patch(`/training-requests/my/${id}/cancel`, { reason }),
  getAllRequests: (params?: { type?: string; status?: string; activeOnly?: boolean; page?: number; limit?: number }) =>
    api.get<{ requests: TrainingRequest[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/training-requests', { params },
    ),
  getPt1on1Counts: () =>
    api.get<{ counts: Record<string, number> }>('/training-requests/pt1on1/counts'),
  assignToClass: (id: string, classId: string) =>
    api.patch(`/training-requests/${id}/assign`, { classId }),
  assignTrainer: (id: string, trainerId: string) =>
    api.patch(`/training-requests/${id}/assign-trainer`, { trainerId }),
  sendMessage: (id: string, content: string, proposal?: TrainingRequestProposal | null) =>
    api.post(`/training-requests/${id}/send-message`, { content, proposal: proposal || null }),
  respond: (id: string, action: 'accept' | 'counter' | 'reject', suggestion?: string) =>
    api.post(`/training-requests/${id}/respond`, { action, suggestion }),
  respondPtAssignment: (id: string, action: 'accept' | 'reject', reason?: string) =>
    api.post(`/training-requests/${id}/pt-respond`, { action, reason }),
  getById: (id: string) =>
    api.get<{ request: TrainingRequest }>(`/training-requests/${id}`),
}
