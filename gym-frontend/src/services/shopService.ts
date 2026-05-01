import api from './api'

export const getAdminShops = () => api.get('/shops/admin/all')
export const deleteShop = (id: string, reason: string) => api.delete(`/shops/${id}`, { data: { reason } })
