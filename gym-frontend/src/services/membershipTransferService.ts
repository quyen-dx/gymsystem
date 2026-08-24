import api from './api'

export const membershipTransferService = {
  mine: () => api.get('/membership-transfers/my'),
  searchRecipients: (search: string) => api.get('/membership-transfers/recipients', { params: { search } }),
  create: (recipient: string, note?: string) => api.post('/membership-transfers', { recipient, note }),
  respond: (id: string, accept: boolean) => api.post(`/membership-transfers/${id}/respond`, { accept }),
  cancel: (id: string) => api.post(`/membership-transfers/${id}/cancel`),
  staffList: (status?: string) => api.get('/membership-transfers/staff', { params: { status } }),
  approve: (id: string) => api.post(`/membership-transfers/staff/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/membership-transfers/staff/${id}/reject`, { reason }),
}
