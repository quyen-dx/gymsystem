import api from './api'

export interface TrainerReplacementRequest {
  _id: string
  scheduleId: string | { _id: string; memberId: string; date: string }
  originalTrainerId: string | { _id: string; name?: string; fullName?: string; email?: string }
  replacementTrainerId?: string | { _id: string; name?: string; fullName?: string; email?: string }
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  date: string
  handledBy?: string
  handledAt?: string
  rejectReason?: string
  createdAt: string
}

export const trainerReplacementService = {
  create: (data: { scheduleId: string; date: string; reason: string }) => api.post('/trainer-replacements', data),
  getMyRequests: (status?: string) => api.get<{ requests: TrainerReplacementRequest[] }>('/trainer-replacements/my', { params: { status } }),
  getAllPending: (params?: { page?: number }) => api.get<{ requests: TrainerReplacementRequest[]; pagination: any }>('/trainer-replacements/pending', { params }),
  approve: (id: string, replacementTrainerId: string) => api.patch(`/trainer-replacements/${id}/approve`, { replacementTrainerId }),
  reject: (id: string, reason?: string) => api.patch(`/trainer-replacements/${id}/reject`, { reason }),
}
