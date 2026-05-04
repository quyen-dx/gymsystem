import api from './api'

export const getAddresses = () => api.get('/addresses')
export const getDefaultAddress = () => api.get('/addresses/default')
export const createAddress = (data: any) => api.post('/addresses', data)
export const updateAddress = (id: string, data: any) => api.put(`/addresses/${id}`, data)
export const deleteAddress = (id: string) => api.delete(`/addresses/${id}`)
export const setDefaultAddress = (id: string) => api.patch(`/addresses/${id}/default`)
