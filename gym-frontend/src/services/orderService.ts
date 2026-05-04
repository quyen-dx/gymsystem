import api from './api'

export const createOrder = (data: any) => api.post('/orders/checkout', data)
export const calculateShipping = (data: any) => api.post('/orders/calculate-shipping', data)
export const getMyOrders = () => api.get('/orders/my')
export const deleteMyOrderHistory = (id: string) => api.delete(`/orders/my/${id}`)
export const getOrder = (id: string) => api.get(`/orders/${id}`)
export const trackOrder = (id: string) => api.get(`/orders/track/${id}`)
export const getSellerOrders = () => api.get('/seller/orders')
export const getSellerOrder = (id: string) => api.get(`/seller/orders/${id}`)
export const updateSellerOrderStatus = (id: string, status: string) =>
  api.patch(`/seller/orders/${id}/status`, { status })
