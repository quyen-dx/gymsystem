import api from './api'

export interface PTAssignmentPT {
  _id: string
  name?: string
  fullName?: string
  email?: string | null
  phone?: string | null
  avatar?: string
  specialties?: string[]
}

export interface PTAssignmentMember {
  _id: string
  name?: string
  fullName?: string
  email?: string | null
  phone?: string | null
  avatar?: string
  memberCode?: string
  memberNumber?: string
  preferredTime?: string
}

export interface MatchedClass {
  classId: string
  code: string
  name: string
  specialization: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  time: string
  current: number
  maxCapacity: number
  isFull: boolean
}

export interface SuggestedSlot {
  classId: string
  dayOfWeek: number
  dayLabel: string
  startTime: string
  endTime: string
  time: string
  className: string
  classCode: string
  specialization: string
  count: number
  maxCapacity: number
  isFull: boolean
}

export interface PTAssignedWorkout {
  _id: string
  name: string
  goal?: string
}

export interface PTAssignment {
  _id: string
  memberId: string | PTAssignmentMember
  ptId: string | PTAssignmentPT
  membershipId?: string
  workoutId?: string | PTAssignedWorkout
  classId?: string | { _id: string; name?: string; code?: string; daysOfWeek?: number[]; startTime?: string; endTime?: string; specialization?: string }
  currentSchedule?: {
    timeSlots?: string[]
    daysOfWeek?: number[]
    startTime?: string
    endTime?: string
    classId?: string
    className?: string
    classCode?: string
    specialization?: string
  } | null
  schedule?: PTAssignment['currentSchedule']
  acceptedProposal?: {
    timeSlots?: string[]
    daysOfWeek?: number[]
    startTime?: string
    endTime?: string
    classId?: string
    className?: string
    classCode?: string
    specialization?: string
    goals?: string[]
  } | null
  matchedClass?: PTAssignment['classId']
  classEnrollment?: { _id: string; code: string; name: string } | null
  specialization?: string
  goals?: string[]
  status: 'active' | 'cancelled' | 'completed'
  startDate: string
  endDate?: string
  cancelledAt?: string
  cancelReason?: string
  scheduleCount?: number
  totalSessions?: number
  attendedSessions?: number
  _fromClass?: boolean
  type?: 'GROUP' | 'PT_1_1'
  membershipStatus?: 'active' | 'expired' | null
  membershipStartAt?: string | null
  membershipExpiresAt?: string | null
  requestNote?: string
  requestContactPhone?: string
  requestContactEmail?: string
  createdAt?: string
  updatedAt?: string
}

export interface HistoryEntry {
  _type: 'workout_end' | 'assignment_end'
  type?: 'GROUP' | 'PT_1_1'
  _id: string
  memberId: string | PTAssignmentMember
  ptId: string | PTAssignmentPT
  // Workout end
  workoutName?: string
  endedAt?: string
  endedBy?: string | { _id: string; name?: string; fullName?: string }
  // Assignment end
  classId?: string | { _id: string; name?: string; code?: string }
  reasonType?: string
  reasonDetail?: string
  requestedAt?: string
  approvedAt?: string
  approvedBy?: string | { _id: string; name?: string; fullName?: string }
  createdAt?: string
}

export interface PendingApproval {
  _id: string
  type?: 'GROUP' | 'PT_1_1'
  memberId: string | PTAssignmentMember
  ptId: string | PTAssignmentPT
  assignmentId?: string | { _id: string; workoutId?: string }
  classId?: string | { _id: string; name?: string; code?: string }
  reasonType: string
  reasonDetail?: string
  status: 'pending' | 'approved' | 'rejected'
  workoutData?: { name: string; goal?: string }
  createdAt: string
}

export const ptAssignmentService = {
  getMyAssignment: () => api.get<{ assignment: PTAssignment | null }>('/pt-assignments/my'),

  getPTClients: () => api.get<{ assignments: PTAssignment[] }>('/pt-assignments/pt/clients'),

  getPTPendingApprovals: () =>
    api.get<{ items: PendingApproval[] }>('/pt-assignments/pt/pending-approvals'),

  getPTHistory: (params?: { page?: number; limit?: number; type?: string; fromDate?: string; toDate?: string; search?: string }) =>
    api.get<{ items: HistoryEntry[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/pt-assignments/pt/history',
      { params },
    ),

  assignWorkout: (assignmentId: string, workoutId: string) =>
    api.put<{ message: string; assignment: PTAssignment }>(`/pt-assignments/${assignmentId}/assign-workout`, { workoutId }),

  getSuggestedSlots: () =>
    api.get<{ slots: SuggestedSlot[] }>('/pt-assignments/suggest-slots'),

  getMemberPreferences: (memberId: string) =>
    api.get<{ timeSlots: string[]; daysOfWeek: number[]; specialization: string; goals: string[]; desiredSessions: number; healthNotes: string; isNewToGym: boolean; note: string }>(`/pt-assignments/member-preferences/${memberId}`),

  getMatchedClasses: (memberId: string) =>
    api.get<{ matched: MatchedClass[]; preferences: { timeSlots: string[]; daysOfWeek: number[]; specialization: string } }>(`/pt-assignments/matched-classes/${memberId}`),

  checkTimeConflict: (date: string, time: string) =>
    api.get<{ hasConflict: boolean; conflictingClass?: { name: string; startTime: string; endTime: string } }>(
      '/pt-assignments/check-time-conflict', { params: { date, time } },
    ),

  createScheduleAndAssignWorkout: (assignmentId: string, data: {
    templateId: string
    memberId: string
    weekIndex?: number
    totalWeeks?: number
    sessions: { dayOrder: number; date: string; time: string; title: string; muscleGroup: string; exercises: { name: string; note?: string }[] }[]
  }) => api.post<{ message: string; schedule: import('./workoutService').WorkoutSchedule; assignment: PTAssignment }>(
    `/pt-assignments/${assignmentId}/create-schedule-and-assign`, data,
  ),

  getWorkoutProgress: (assignmentId: string, scheduleId?: string) =>
    api.get<{ assignment: PTAssignment; schedule: import('./workoutService').WorkoutSchedule | null }>(
      `/pt-assignments/${assignmentId}/progress`, { params: scheduleId ? { scheduleId } : {} }),

  endWorkout: (assignmentId: string, scheduleId?: string, memberId?: string, confirm?: boolean) =>
    api.post<{
      message: string
      assignment?: PTAssignment
      schedule?: import('./workoutService').WorkoutSchedule
      // For endAll dry-check / confirm responses:
      dryCheck?: boolean
      canEnd?: boolean
      allComplete?: boolean
      modifiedCount?: number
      endedAt?: string
      preview?: {
        scheduleCount: number
        totalSessions: number
        totalCompletedSessions: number
        totalIncomplete: number
        perSchedule: Array<{
          scheduleId: string
          weekLabel: string
          totalSessions: number
          completedSessions: number
          incompleteSessions: number
        }>
      }
    }>(
      `/pt-assignments/${assignmentId}/end-workout`,
      memberId
        ? { memberId, endAll: true, confirm: confirm === true }
        : scheduleId
          ? { scheduleId }
          : {}),
}

// ============================================================
// Class enrollment: Transfer / Leave class (tường minh)
// ============================================================

export interface EnrollmentPreviewClass {
  _id: string
  code: string
  name: string
  specialization: string
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  pt?: { _id: string; name?: string; fullName?: string } | null
  floor?: { _id: string; name?: string } | null
  zone?: { _id: string; name?: string; maxCapacity?: number } | null
  current: number
  max: number
  isFull: boolean
  isCurrent: boolean
}

export interface EnrollmentPreviewResponse {
  currentEnrollment: {
    enrollmentId: string
    classId: string
    code?: string
    name?: string
    joinedAt?: string
  } | null
  availableClasses: EnrollmentPreviewClass[]
}

export interface TransferClassResponse {
  message: string
  transferredFrom: string | null
  transferredTo: string
  endedOld: number
  createdNew: boolean
}

export interface LeaveClassResponse {
  message: string
  leftClassId: string | null
  modifiedCount: number
}

export interface LeaveCurrentTrainingResponse {
  message: string
  result: Record<string, number>
}

const enrollmentService = {
  getPreview: (memberId: string) =>
    api.get<EnrollmentPreviewResponse>('/pt-assignments/enrollment/preview', { params: { memberId } }),

  transferClass: (data: { memberId: string; toClassId: string; reason?: string }) =>
    api.post<TransferClassResponse>('/pt-assignments/enrollment/transfer', data),

  leaveClass: (data: { memberId: string; reason?: string }) =>
    api.post<LeaveClassResponse>('/pt-assignments/enrollment/leave', data),
  leaveCurrentTraining: (data?: { reason?: string }) =>
    api.post<LeaveCurrentTrainingResponse>('/pt-assignments/enrollment/leave-current-training', data || {}),
}

// ============================================================
// PT Class Assignment Request / Accept / Decline / Release
// ============================================================

export const ptClassService = {
  requestClass: (classId: string, trainerId: string) =>
    api.post<{ message: string; class: { _id: string; name: string; code: string } }>(
      '/pt-assignments/request-class', { classId, trainerId },
    ),

  acceptClass: (classId: string) =>
    api.post<{ message: string }>('/pt-assignments/accept-class', { classId }),

  declineClass: (classId: string) =>
    api.post<{ message: string }>('/pt-assignments/decline-class', { classId }),

  bulkReleasePt: (trainerId: string) =>
    api.post<{ message: string; result: { releasedClassCount: number } }>(
      '/pt-assignments/bulk-release', { trainerId },
    ),
}

export { enrollmentService }
