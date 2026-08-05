import api from './api'
import type { ReportDashboard, ReportRangeState, ReportSummary, TransactionsResult } from '../types/report'

const toParams = (state: ReportRangeState) => ({
  range: state.value,
  from: state.from,
  to: state.to,
})

type LooseParams = Record<string, any>

export const reportService = {
  getSummary: (state: ReportRangeState) =>
    api.get<ReportSummary>('/admin/reports/summary', { params: toParams(state) }),

  getDashboard: (module: string, state: ReportRangeState) =>
    api.get<ReportDashboard>('/admin/reports/charts', { params: { module, ...toParams(state) } }),

  getTransactions: (params: LooseParams) =>
    api.get<TransactionsResult>('/admin/reports/transactions', { params: { ...toParams(params as ReportRangeState), ...params } }),

  getMemberActivity: (params: LooseParams) =>
    api.get<{ rows: any[]; total: number; page: number; pageSize: number; types: Array<{ key: string; label: string }> }>('/admin/reports/member-activity', { params: { ...toParams(params as ReportRangeState), ...params } }),

  getBookings: (params: LooseParams) =>
    api.get<{ rows: any[]; total: number; page: number; pageSize: number; types: Array<{ key: string; label: string }> }>('/admin/reports/bookings', { params: { ...toParams(params as ReportRangeState), ...params } }),

  getOrders: (params: LooseParams) =>
    api.get<{ rows: any[]; total: number; page: number; pageSize: number; types: Array<{ key: string; label: string }> }>('/admin/reports/orders', { params: { ...toParams(params as ReportRangeState), ...params } }),

  getSystemUsers: (params: LooseParams) =>
    api.get<{ rows: any[]; total: number; page: number; pageSize: number; roles: Array<{ key: string; label: string }> }>('/admin/reports/users', { params: { ...toParams(params as ReportRangeState), ...params } }),

  exportReport: (module: string, state: ReportRangeState, format: 'xlsx' | 'pdf') =>
    api.get(`/admin/reports/export`, {
      params: { module, ...toParams(state), format },
      responseType: 'blob',
    }),

  getRevenueReport: (period: 'month' | 'quarter' | 'year') =>
    api.get(`/admin/reports/revenue?period=${period}`),
}

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
