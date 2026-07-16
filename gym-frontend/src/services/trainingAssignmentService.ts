// DEPRECATED: Training assignments are now handled via TrainingClass.members
// Kept as a stub to prevent import errors.
import api from './api'

export interface TrainingAssignment {
  _id: string
  memberId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string; memberCode?: string }
  trainerId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string; specialties?: string[] }
  classId?: string | { _id: string; name: string }
  requestId?: string
  membershipId?: string
  status: 'active' | 'cancelled' | 'completed'
  startDate: string
  endDate?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
}

export const trainingAssignmentService = {
  getMyAssignment: () => api.get<{ assignment: TrainingAssignment | null }>('/training-assignments/my'),
  getPTClients: () => api.get<{ assignments: TrainingAssignment[] }>('/training-assignments/pt/clients'),
  getPTHistory: (params?: { page?: number }) =>
    api.get<{ items: TrainingAssignment[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/training-assignments/pt/history', { params },
    ),
  createAssignment: (data: { memberId: string; trainerId: string; requestId?: string; classId?: string }) =>
    api.post('/training-assignments', data),
}
