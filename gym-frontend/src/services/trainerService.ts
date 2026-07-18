import api from './api'
import type { PT, PTBooking, PTDaySchedule } from '../types/admin/trainer'
import type { TrainingClass } from './trainingGroupService'

export interface WeekAttendeeMember {
  _id: string
  name: string
  memberCode: string
  checkedIn?: boolean
  checkedInAt?: string | null
}

export interface WeekAttendee {
  dayOfWeek: number
  classId: string | null
  code: string
  count: number
  members: WeekAttendeeMember[]
}

export const trainerService = {
  getPTs: (params?: Record<string, unknown>) =>
    api.get<{ pts: PT[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/pts', { params }),
  
  getAvailablePTs: (params?: Record<string, unknown>) =>
    api.get<{ pts: PT[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/pts/available', { params }),

  getAvailablePTById: (id: string) =>
    api.get<{ pt: PT; bookings: PTBooking[] }>(`/pts/available/${id}`),

  getPTById: (id: string) =>
    api.get<{ pt: PT; bookings: PTBooking[] }>(`/pts/${id}`),

  getPTSchedule: (id: string) =>
    api.get<{ schedule: PTDaySchedule[]; availableSlots: unknown[] }>(`/pts/schedule/${id}`),

  getPTAvailability: (id: string, date: string) =>
    api.get<{ availability: Record<string, boolean> }>(`/pts/${id}/availability`, { params: { date } }),

  getPTMyClasses: () =>
    api.get<{ classes: TrainingClass[] }>('/pts/my-classes'),

  getPTMyWeekAttendees: (weekStart: string) =>
    api.get<{ attendees: WeekAttendee[] }>('/pts/my-week-attendees', { params: { weekStart } }),

  createPT: (data: FormData | Record<string, unknown>) =>
    api.post('/pts', data, data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined,
    ),

  updatePT: (id: string, data: FormData | Record<string, unknown>) =>
    api.patch(`/pts/${id}`, data, data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined,
    ),

  updatePTSchedule: (id: string, schedules: { dayOfWeek: number; shift: string }[]) =>
    api.patch(`/pts/${id}/schedule`, { schedules }),

  deletePT: (id: string) =>
    api.delete(`/pts/${id}`),
}
