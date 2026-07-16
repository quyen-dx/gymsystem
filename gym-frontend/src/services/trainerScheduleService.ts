import api from './api'
import type { TrainingClass } from './trainingGroupService'

export interface TrainerSchedule {
  _id: string
  trainerId: string | { _id: string; name?: string; fullName?: string; email?: string }
  dayOfWeek: number
  shift: 'morning' | 'afternoon' | 'evening'
  startTime?: string
  endTime?: string
  status: 'active' | 'cancelled'
}

export interface TrainerScheduleResponse {
  schedules: TrainerSchedule[]
  classSchedules: TrainingClass[]
}

export const trainerScheduleService = {
  getMySchedule: () => api.get<TrainerScheduleResponse>('/trainer-schedules/my'),
  getTrainerSchedule: (trainerId: string) => api.get<TrainerScheduleResponse>(`/trainer-schedules/${trainerId}`),
  getAll: (params?: { trainerId?: string; page?: number }) =>
    api.get<{ schedules: TrainerSchedule[]; pagination: any }>('/trainer-schedules/all', { params }),
  setSchedule: (trainerId: string, schedules: Array<{ dayOfWeek: number; shift: string; startTime?: string; endTime?: string }>) =>
    api.put(`/trainer-schedules/${trainerId}`, { schedules }),
  getAvailableTrainers: (params?: { dayOfWeek?: number; shift?: string }) =>
    api.get<{ trainers: Array<{ _id: string; name?: string; fullName?: string; email?: string }> }>('/trainer-schedules/available', { params }),
}
