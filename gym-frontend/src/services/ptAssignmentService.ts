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
  status: 'active' | 'cancelled' | 'completed'
  startDate: string
  endDate?: string
  cancelledAt?: string
  cancelReason?: string
  scheduleCount?: number
  createdAt?: string
  updatedAt?: string
}

export const ptAssignmentService = {
  getMyAssignment: () => api.get<{ assignment: PTAssignment | null }>('/pt-assignments/my'),

  getPTClients: () => api.get<{ assignments: PTAssignment[] }>('/pt-assignments/pt/clients'),

  getPTHistory: (params?: { page?: number; limit?: number }) =>
    api.get<{ items: PTAssignment[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
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
    sessions: { dayOrder: number; date: string; time: string; title: string; muscleGroup: string; exercises: { name: string; note?: string }[] }[]
  }) => api.post<{ message: string; schedule: import('./workoutService').WorkoutSchedule; assignment: PTAssignment }>(
    `/pt-assignments/${assignmentId}/create-schedule-and-assign`, data,
  ),
}
