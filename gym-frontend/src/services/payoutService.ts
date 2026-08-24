import api from './api'

export const payoutService = {
  getSummary: () => api.get('/wallet/summary'),
  create: (data: { amount: number; bankCode: string; bankName: string; accountNumber: string; accountHolder: string; note?: string }) => api.post('/wallet/payout-requests', data),
  mine: () => api.get('/wallet/payout-requests/me'),
  getMine: (id: string) => api.get(`/wallet/payout-requests/${id}`),
  cancel: (id: string) => api.post(`/wallet/payout-requests/${id}/cancel`),
  confirm: (id: string) => api.post(`/wallet/payout-requests/${id}/confirm-received`),
  dispute: (id: string, reason: string) => api.post(`/wallet/payout-requests/${id}/dispute`, { reason }),
  adminList: (params?: Record<string, unknown>) => api.get('/admin/payout-requests', { params }),
  adminGet: (id: string) => api.get(`/admin/payout-requests/${id}`),
  approve: (id: string) => api.post(`/admin/payout-requests/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/admin/payout-requests/${id}/reject`, { reason }),
  markTransferred: (id: string, form: FormData) => api.post(`/admin/payout-requests/${id}/mark-transferred`, form),
  resolve: (id: string, form: FormData) => api.post(`/admin/payout-requests/${id}/resolve`, form),
}
