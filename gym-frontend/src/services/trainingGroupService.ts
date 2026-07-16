import api from './api'

export interface TrainingClass {
  _id: string
  code?: string
  name: string
  description?: string
  specialization: string
  specializationLabel?: string
  ptId: string | { _id: string; name?: string; fullName?: string; email?: string; phone?: string; avatar?: string }
  floorId: string | { _id: string; name: string; order?: number }
  zoneId: string | { _id: string; name: string; maxCapacity?: number }
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  daysLabel?: string
  currentActiveCount?: number
  hasPT?: boolean
  createdAt: string
}

export const DAY_OPTIONS = [
  { label: 'Thứ 2', value: 1 },
  { label: 'Thứ 3', value: 2 },
  { label: 'Thứ 4', value: 3 },
  { label: 'Thứ 5', value: 4 },
  { label: 'Thứ 6', value: 5 },
  { label: 'Thứ 7', value: 6 },
  { label: 'Chủ nhật', value: 0 },
]

export const SPECIALIZATION_OPTIONS = [
  { value: 'YOGA', label: 'Yoga' },
  { value: 'BOXING', label: 'Boxing' },
  { value: 'GYM', label: 'GYM' },
  { value: 'ZUMBA', label: 'Zumba' },
  { value: 'PILATES', label: 'Pilates' },
  { value: 'CARDIO', label: 'Cardio' },
  { value: 'AEROBICS', label: 'Aerobics' },
  { value: 'CROSSFIT', label: 'Crossfit' },
  { value: 'KICKBOXING', label: 'Kickboxing' },
  { value: 'DANCE', label: 'Dance' },
  { value: 'MUAYTHAI', label: 'Muay Thái' },
  { value: 'FUNCTIONAL', label: 'Functional Training' },
  { value: 'OTHER', label: 'Khác' },
]

export const trainingClassService = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get<{ classes: TrainingClass[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/training-classes', { params },
    ),
  getById: (id: string) => api.get<{ class: TrainingClass }>(`/training-classes/${id}`),
  create: (data: {
    name: string
    description?: string
    specialization?: string
    ptId?: string
    floorId?: string
    zoneId?: string
    daysOfWeek?: number[]
    startTime?: string
    endTime?: string
  }) => api.post('/training-classes', data),
  update: (id: string, data: {
    name?: string
    description?: string
    specialization?: string
    ptId?: string
    floorId?: string
    zoneId?: string
    daysOfWeek?: number[]
    startTime?: string
    endTime?: string
  }) => api.patch(`/training-classes/${id}`, data),
  delete: (id: string) => api.delete(`/training-classes/${id}`),
}

export const trainingGroupService = trainingClassService
