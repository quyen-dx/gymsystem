import api from './api'

export interface ShiftSwapItem {
  _id: string
  swapRequestId: string
  workoutScheduleId: string
  sessionIndex: number
  memberId: string | { _id: string; name?: string; fullName?: string }
  classId?: string
  className: string
  classCode: string
  sessionTime: string
  sessionTitle: string
  specialization: string
  goals: string[]
  healthNotes: string
}

export interface ShiftSwapRequest {
  _id: string
  requestingPtId: string | { _id: string; name?: string; fullName?: string }
  targetDate: string
  reason: string
  status: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy'
  approvedBy?: string
  approvedAt?: string
  rejectReason?: string
  createdAt: string
}

export interface AvailableSubstitutePT {
  _id: string
  name: string
  email?: string
  specialties?: string[]
}

export interface SwapRequestDetail {
  request: ShiftSwapRequest
  items: ShiftSwapItem[]
  availablePTs: AvailableSubstitutePT[]
}

export const shiftSwapService = {
  create: (data: { targetDate: string; reason?: string; classIds: string[] }) =>
    api.post<{ request: ShiftSwapRequest }>('/shift-swaps', data),

  getMyRequests: (status?: string) =>
    api.get<{ requests: ShiftSwapRequest[] }>('/shift-swaps/my', { params: { status } }),

  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<{ docs: ShiftSwapRequest[]; total: number; page: number; limit: number; totalPages: number }>('/shift-swaps', { params }),

  getDetail: (id: string) =>
    api.get<SwapRequestDetail>(`/shift-swaps/${id}`),

  approve: (id: string, assignments: { swapItemId: string; ptId: string }[]) =>
    api.patch<{ message: string }>(`/shift-swaps/${id}/approve`, { assignments }),

  reject: (id: string, reason?: string) =>
    api.patch<{ message: string }>(`/shift-swaps/${id}/reject`, { reason }),
}
