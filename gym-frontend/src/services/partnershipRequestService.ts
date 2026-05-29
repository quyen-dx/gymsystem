import api from './api'

export type PartnershipRequestPayload = {
  brand_name: string
  category: string
  contact_name: string
  phone: string
  email: string
  website?: string
  description?: string
}

export const partnershipCategories = [
  'Thiết bị gym',
  'Thực phẩm thể thao',
  'Phụ kiện',
  'Trang phục',
  'Khác',
]

export const createPartnershipRequest = (data: PartnershipRequestPayload) =>
  api.post('/partnership-requests', data)

export const getAdminPartnershipRequests = () =>
  api.get('/partnership-requests/admin')

export const getPendingPartnershipRequestCount = () =>
  api.get('/partnership-requests/admin/pending-count')

export const approvePartnershipRequest = (id: string) =>
  api.patch(`/partnership-requests/${id}/approve`)

export const rejectPartnershipRequest = (id: string) =>
  api.patch(`/partnership-requests/${id}/reject`)

export const getDiscountCodes = () =>
  api.get('/partnership-requests/admin/discount-codes')

export const createDiscountCode = (data: { code: string; type: string; amount?: number }) =>
  api.post('/partnership-requests/admin/discount-codes', data)

export const toggleDiscountCode = (id: string) =>
  api.patch(`/partnership-requests/admin/discount-codes/${id}/toggle`)
