import api from './api'

export interface PersonalTrainingRequest {
  _id: string
  memberId: string | { _id: string; name?: string; fullName?: string; phone?: string; email?: string; avatar?: string; memberCode?: string }
  specialization: string
  goals: string[]
  phone: string
  email: string
  hasPTPreference: boolean
  preferredPTId?: string | { _id: string; name?: string; fullName?: string } | null
  notes: string
  status: 'pending' | 'assigned' | 'cancelled'
  assignedTrainerId?: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string } | null
  assignedAt?: string
  assignedBy?: string | { _id: string; name?: string; fullName?: string }
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
}

export interface CreatePersonalTrainingRequestData {
  specialization: string
  goals: string[]
  phone: string
  email: string
  hasPTPreference: boolean
  preferredPTId?: string | null
  notes: string
}

export const personalTrainingRequestService = {
  create: (data: CreatePersonalTrainingRequestData) =>
    api.post('/personal-training-requests', data),

  getMyRequests: (status?: string) =>
    api.get('/personal-training-requests/my', { params: { status } }),

  cancelMyRequest: (id: string, reason?: string) =>
    api.patch(`/personal-training-requests/my/${id}/cancel`, { reason }),

  getAllRequests: (params?: { status?: string; page?: number }) =>
    api.get('/personal-training-requests', { params }),

  getById: (id: string) =>
    api.get(`/personal-training-requests/${id}`),

  assignPT: (id: string, trainerId: string) =>
    api.patch(`/personal-training-requests/${id}/assign`, { trainerId }),
}
