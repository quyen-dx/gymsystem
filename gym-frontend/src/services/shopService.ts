import api from './api'

export const getAdminShops = () => api.get('/shops/admin/all')
export const getShop = (id: string) => api.get(`/shops/${id}`)
export const addShopReview = (id: string, data: { rating: number; comment: string }) =>
  api.post(`/shops/${id}/reviews`, data)
export const getMyShop = () => api.get('/shops/me')
export const updateMyShop = (data: any) => api.put('/shops/me', data)
export const deleteShop = (id: string, reason: string) => api.delete(`/shops/${id}`, { data: { reason } })
