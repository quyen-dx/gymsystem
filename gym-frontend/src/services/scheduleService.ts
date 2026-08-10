import api from './api'
import type { WorkoutSchedule } from './workoutService'

export type CreateSchedulePayload = {
  templateId: string
  memberId: string
  weekIndex?: number
  totalWeeks?: number
  sessions: {
    dayOrder: number
    date: string
    time: string
    title: string
    muscleGroup: string
    exercises: { name: string; note?: string }[]
  }[]
}

export type BulkCreatePayload = {
  templateId: string
  memberId: string
  assignmentId?: string
  weeks: {
    weekIndex: number
    sessions: CreateSchedulePayload['sessions']
  }[]
}

export type PlanSummary = {
  totalPlanDays: number
  assignedDays: number
  remainingDays: number
  remaining: { index: number; title: string; muscleGroup: string }[]
  completedSessions: number
  pendingSessions: number
}

export const scheduleService = {
  getMySchedules() {
    return api.get<{ schedules: WorkoutSchedule[] }>('/schedules/my')
  },

  getMyTeachingSchedules() {
    return api.get<{ schedules: WorkoutSchedule[] }>('/schedules/pt/my')
  },

  getScheduleById(scheduleId: string) {
    return api.get<{ schedule: WorkoutSchedule; planSummary: PlanSummary | null }>(`/schedules/${scheduleId}`)
  },

  getMemberSchedules(memberId: string) {
    return api.get<{ schedules: WorkoutSchedule[] }>(`/schedules/member/${memberId}`)
  },

  createSchedule(data: CreateSchedulePayload) {
    return api.post<{ schedule: WorkoutSchedule }>('/schedules', data)
  },

  bulkCreateSchedules(data: BulkCreatePayload) {
    return api.post<{ message: string; schedules: WorkoutSchedule[]; planSummary: PlanSummary }>('/schedules/bulk-create', data)
  },

  addScheduleSession(
    scheduleId: string,
    data: { date: string; time: string; endTime?: string; title?: string },
  ) {
    return api.post<{ message: string; schedule: WorkoutSchedule; planSummary: PlanSummary | null }>(
      `/schedules/${scheduleId}/sessions`,
      data,
    )
  },

  updateSessionPlan(
    scheduleId: string,
    dayOrder: number,
    data: {
      title?: string
      muscleGroup?: string
      exercises: { name: string; note?: string }[]
    },
  ) {
    return api.put<{ schedule: WorkoutSchedule }>(`/schedules/${scheduleId}/session/${dayOrder}/plan`, data)
  },

  updateSessionStatus(
    scheduleId: string,
    dayOrder: number,
    data: {
      status?: string
      feedback?: string
      performance?: string
      exercises?: {
        name: string
        completed?: boolean
        note?: string
        setsDone?: number
        repsDone?: number
        weightUsed?: number
        durationMin?: number
      }[]
    },
  ) {
    return api.put<{ schedule: WorkoutSchedule }>(`/schedules/${scheduleId}/session/${dayOrder}`, data)
  },

  rescheduleSession(
    scheduleId: string,
    dayOrder: number,
    data: { date: string; time: string; endTime?: string; reason?: string },
  ) {
    return api.patch(`/schedules/${scheduleId}/session/${dayOrder}/reschedule`, data)
  },

  cancelSession(scheduleId: string, dayOrder: number, data: { reason?: string }) {
    return api.patch(`/schedules/${scheduleId}/session/${dayOrder}/cancel`, data)
  },

  deleteSchedule(id: string) {
    return api.delete(`/schedules/${id}`)
  },

  getClassSchedules(classId: string) {
    return api.get<{
      trainingClass: {
        _id: string
        code: string
        name: string
        daysOfWeek: number[]
        startTime: string
        endTime: string
        status: string
      }
      members: { _id: string; name: string; fullName?: string; memberCode?: string; avatar?: string }[]
      assigned: {
        memberId: string
        memberName: string
        memberCode?: string
        scheduleId: string
        templateName: string
        sessionsCount: number
      }[]
      assignedCount: number
      totalMembers: number
    }>(`/schedules/class/${classId}`)
  },

  groupAssign(classId: string, templateId: string) {
    return api.post<{
      message: string
      created: { memberId: string; memberName: string; memberCode?: string; scheduleId: string }[]
      skipped: { memberId: string; memberName: string; reason: string }[]
      sessions: {
        dayOrder: number
        date: string
        time: string
        endTime: string
        title: string
        muscleGroup: string
        exercisesCount: number
      }[]
      classId: string
      templateId: string
    }>('/schedules/group-assign', { classId, templateId })
  },
}
