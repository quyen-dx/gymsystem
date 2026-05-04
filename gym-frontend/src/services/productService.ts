import api from './api'

export const getProducts = (params?: any) => api.get('/products', { params })
export const getProductCategories = (params?: any) => api.get('/products/categories', { params })
export const getShopProducts = (shopId: string, params?: any) =>
  api.get('/products', { params: { ...params, shopId } })
export const getAdminProducts = (params?: any) => api.get('/products/admin/all', { params })
export const getAdminShopProducts = (shopId: string, params?: any) =>
  api.get('/products/admin/all', { params: { ...params, shopId } })
export const getMyProducts = (params?: any) => api.get('/my-products', { params })
export const getProductById = (id: string) => api.get(`/products/${id}`)
export const createProduct = (data: any) => api.post('/products', data)
export const updateProduct = (id: string, data: any) => api.put(`/products/${id}`, data)
export const deleteProduct = (id: string) => api.delete(`/products/${id}`)
export const addReview = (id: string, data: { rating: number; comment: string }) =>
  api.post(`/products/${id}/reviews`, data)
