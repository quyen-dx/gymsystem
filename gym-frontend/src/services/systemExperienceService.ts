import api from './api'

export const systemExperienceService = {
  getCmsPage: (pageId: 'home' | 'about') => api.get(`/cms/page/${pageId}`),
  saveCmsPage: (pageId: 'home' | 'about', payload: any) => api.post(`/cms/page/${pageId}`, payload),
  getCmsLanding: () => api.get('/cms/page/home'),
  saveCmsLanding: (payload: any) => api.post('/cms/page/home', payload),
  getFaqs: (params?: any) => api.get('/system-experience/faqs', { params }),
  createFaq: (payload: any) => api.post('/system-experience/faqs', payload),
  updateFaq: (id: string, payload: any) => api.put(`/system-experience/faqs/${id}`, payload),
  deleteFaq: (id: string) => api.delete(`/system-experience/faqs/${id}`),
  getPolicies: (params?: any) => api.get('/system-experience/policies', { params }),
  createPolicy: (payload: any) => api.post('/system-experience/policies', payload),
  updatePolicy: (id: string, payload: any) => api.put(`/system-experience/policies/${id}`, payload),
  deletePolicy: (id: string) => api.delete(`/system-experience/policies/${id}`),
  createFeedback: (payload: any) => api.post('/system-experience/feedback', payload),
  getMyFeedback: () => api.get('/system-experience/feedback/my'),
  getAllFeedback: (params?: any) => api.get('/system-experience/feedback', { params }),
  updateFeedback: (id: string, payload: any) => api.patch(`/system-experience/feedback/${id}`, payload),
  getMyActivity: () => api.get('/system-experience/activity/my'),
}
