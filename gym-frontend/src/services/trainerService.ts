import api from './api'
import type { PT, PTBooking, PTDaySchedule } from '../types/admin/trainer'

export const trainerService = {
  getPTs: (params?: Record<string, unknown>) =>
    api.get<{ pts: PT[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/pts', { params }),

  getPTById: (id: string) =>
    api.get<{ pt: PT; bookings: PTBooking[] }>(`/pts/${id}`),

  getPTSchedule: (id: string) =>
    api.get<{ schedule: PTDaySchedule[]; availableSlots: unknown[] }>(`/pts/schedule/${id}`),

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
