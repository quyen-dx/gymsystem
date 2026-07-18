import api from './api'

export interface PlanFeature {
  _id: string
  code: string
  name: string
  description: string
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const planFeatureService = {
  getAll: (params?: { isActive?: boolean }) =>
    api.get<{ success: boolean; data: PlanFeature[] }>('/plan-features', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: PlanFeature }>(`/plan-features/${id}`),
  create: (body: Partial<PlanFeature>) =>
    api.post('/plan-features', body),
  update: (id: string, body: Partial<PlanFeature>) =>
    api.put(`/plan-features/${id}`, body),
  toggleActive: (id: string) =>
    api.patch(`/plan-features/${id}/toggle`),
}

export interface Specialization {
  _id: string
  code: string
  name: string
  description: string
  icon: string
  color: string
  isActive: boolean
}

export const specializationService = {
  getAll: (params?: { isActive?: boolean }) =>
    api.get<{ success: boolean; data: Specialization[] }>('/specializations', { params }),
  create: (body: Partial<Specialization>) =>
    api.post('/specializations', body),
  update: (id: string, body: Partial<Specialization>) =>
    api.put(`/specializations/${id}`, body),
  toggleActive: (id: string) =>
    api.patch(`/specializations/${id}/toggle`),
}
