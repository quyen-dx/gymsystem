import api from './api'

export interface PTAssignmentEndRequest {
  _id: string
  ptId: string | { _id: string; name?: string; fullName?: string; email?: string }
  memberId: string | { _id: string; name?: string; fullName?: string; email?: string; memberCode?: string }
  assignmentId?: string | { _id: string; workoutId?: { _id: string; name?: string; goal?: string } }
  classId?: string | { _id: string; name?: string; code?: string }
  reasonType: string
  reasonDetail?: string
  status: 'pending' | 'approved' | 'rejected'
  processedBy?: string | { _id: string; name?: string; fullName?: string }
  processedAt?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
}

export const ptAssignmentEndService = {
  create(data: { memberId: string; reasonType: string; reasonDetail?: string; assignmentId?: string; classId?: string }) {
    return api.post<{ message: string; request: PTAssignmentEndRequest }>('/pt-assignment-end-requests', data)
  },

  getMyRequests(params?: { status?: string }) {
    return api.get<{ items: PTAssignmentEndRequest[] }>('/pt-assignment-end-requests/my', { params })
  },

  getAllRequests(params?: { status?: string; page?: number; limit?: number; fromDate?: string; toDate?: string; ptId?: string; memberSearch?: string }) {
    return api.get<{ items: PTAssignmentEndRequest[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/pt-assignment-end-requests', { params },
    )
  },

  approve(id: string) {
    return api.put<{ message: string; request: PTAssignmentEndRequest }>(`/pt-assignment-end-requests/${id}/approve`)
  },

  reject(id: string, rejectReason?: string) {
    return api.put<{ message: string; request: PTAssignmentEndRequest }>(`/pt-assignment-end-requests/${id}/reject`, { rejectReason })
  },
}
