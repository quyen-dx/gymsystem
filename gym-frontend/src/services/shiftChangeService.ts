import api from './api'

export type ShiftChangeRequestStatus = 'pending' | 'waiting_assignment' | 'assigned' | 'accepted' | 'rejected' | 'completed' | 'expired' | 'cancelled'
export type ReplacementStatus = 'pending' | 'assigned' | 'accepted' | 'rejected'

export interface UserRef {
  _id: string
  name?: string
  fullName?: string
  email?: string
}

export interface RejectionRecord {
  trainerId: string
  trainer?: UserRef | null
  reason?: string
  at?: string
}

export interface ShiftChangeItem {
  _id: string
  requestId: string
  classId?: string
  className: string
  classCode: string
  startTime: string
  endTime?: string
  floorId?: string | null
  floorName: string
  zoneId?: string | null
  zoneName: string
  specialization: string
  status: ReplacementStatus
  replacementStatus: ReplacementStatus
  replacementTrainerId?: string | null
  replacementTrainer?: UserRef | null
  rejectedTrainerIds: string[]
  rejectedTrainers?: UserRef[]
  rejections?: RejectionRecord[]
  rejectReason?: string
  scheduleReplacementId?: string | null
}

export interface ShiftChangeRequest {
  _id: string
  requestingPtId: string | UserRef
  targetDate: string
  reason: string
  status: ShiftChangeRequestStatus
  displayStatus?: ShiftChangeRequestStatus
  handledBy?: string | null
  handledAt?: string
  approvedAt?: string
  rejectReason?: string
  cancelledBy?: string | null
  createdAt: string
  items?: ShiftChangeItem[]
  itemCount?: number
}

export interface ScheduleReplacement {
  _id: string
  classId?: string | { _id: string; code?: string; name?: string }
  date: string
  startTime: string
  endTime?: string
  originalTrainerId: string
  replacementTrainerId: string
  status: 'approved'
  className?: string
  classCode?: string
  classStartTime?: string
  classEndTime?: string
  specialization?: string
  floorName?: string
  zoneName?: string
  originalTrainerName?: string
  originalTrainerActive?: boolean
}

export interface AvailablePT {
  _id: string
  name: string
  email?: string
  availabilityStatus: string
}

export interface RejectedPT {
  _id: string
  name: string
  reason?: string
  at?: string | null
}

export const shiftChangeService = {
  // PT A
  create: (data: { targetDate: string; reason?: string; classIds: string[] }) =>
    api.post<{ request: ShiftChangeRequest }>('/shift-change-requests', data),

  getMyRequests: (status?: string) =>
    api.get<{ requests: ShiftChangeRequest[] }>('/shift-change-requests/my', { params: { status } }),

  cancel: (id: string) =>
    api.patch<{ message: string; request: ShiftChangeRequest }>(`/shift-change-requests/${id}/cancel`),

  // PT B
  getMyAssignments: (status?: string) =>
    api.get<{ assignments: ShiftChangeItem[] }>('/shift-change-requests/my-assignments', { params: { status } }),

  getMyReplacements: (weekStart: string) =>
    api.get<{ replacements: ScheduleReplacement[] }>('/shift-change-requests/my-replacements', { params: { weekStart } }),

  respond: (data: { itemId: string; action: 'accept' | 'reject'; reason?: string; notificationId?: string }) =>
    api.post<{ message: string }>('/shift-change-requests/respond', data),

  // Admin
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<{ docs: ShiftChangeRequest[]; total: number; page: number; limit: number; totalPages: number }>(
      '/shift-change-requests',
      { params },
    ),

  getDetail: (id: string) =>
    api.get<{ request: ShiftChangeRequest; items: ShiftChangeItem[] }>(`/shift-change-requests/${id}`),

  getAvailablePTs: (requestId: string, itemId: string) =>
    api.get<{ available: AvailablePT[]; rejected: RejectedPT[] }>(`/shift-change-requests/${requestId}/available-pts`, { params: { itemId } }),

  assign: (id: string, assignments: { itemId: string; ptId: string }[]) =>
    api.patch<{ message: string }>(`/shift-change-requests/${id}/assign`, { assignments }),

  reject: (id: string, reason?: string) =>
    api.patch<{ message: string }>(`/shift-change-requests/${id}/reject`, { reason }),
}
