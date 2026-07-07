import api from './api' 
export const reportService = {
  getRevenueReport: (period: 'month' | 'quarter' | 'year') => {
    return api.get(`/admin/reports/revenue?period=${period}`)
  },
}