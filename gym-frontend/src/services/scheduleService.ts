import api from './api'
import type { WorkoutSchedule } from './workoutService'

export type CreateSchedulePayload = {
  templateId: string
  memberId: string
  sessions: {
    dayOrder: number
    date: string
    time: string
    title: string
    muscleGroup: string
    exercises: { name: string; note?: string }[]
  }[]
}

export const scheduleService = {
  getMySchedules() {
    return api.get<{ schedules: WorkoutSchedule[] }>('/schedules/my')
  },

  getMemberSchedules(memberId: string) {
    return api.get<{ schedules: WorkoutSchedule[] }>(`/schedules/member/${memberId}`)
  },

  createSchedule(data: CreateSchedulePayload) {
    return api.post<{ schedule: WorkoutSchedule }>('/schedules', data)
  },

  updateSessionStatus(
    scheduleId: string,
    dayOrder: number,
    data: { status?: string; feedback?: string; exercises?: { name: string; completed: boolean }[] },
  ) {
    return api.put(`/schedules/${scheduleId}/session/${dayOrder}`, data)
  },

  deleteSchedule(id: string) {
    return api.delete(`/schedules/${id}`)
  },
}
