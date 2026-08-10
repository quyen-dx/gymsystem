import api from './api'

export interface PTPricingItem {
  _id: string
  name: string
  fullName?: string
  email?: string | null
  phone?: string | null
  avatar?: string
  isActive: boolean
  status: string
  oneToOnePrice: number | null
  groupPrice: number | null
  priceUpdatedAt: string | null
  priceUpdatedBy: { _id: string; name: string } | null
  hasOneToOne: boolean
  hasGroup: boolean
}

export interface PTPricingHistoryItem {
  _id: string
  ptId: string
  priceType: 'ONE_TO_ONE' | 'GROUP'
  oldPrice: number | null
  newPrice: number
  changedBy: { _id: string; name?: string; fullName?: string; email?: string }
  changedAt: string
}

export const ptPriceService = {
  getPTPrices: (params?: Record<string, unknown>) =>
    api.get<{ pts: PTPricingItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      '/pt-prices',
      { params },
    ),

  getPTPrice: (ptId: string) =>
    api.get<{ pt: PTPricingItem }>(`/pt-prices/${ptId}`),

  updatePTPrice: (ptId: string, data: { oneToOnePrice?: number | null; groupPrice?: number | null }) =>
    api.put<{ message: string; pt: PTPricingItem }>(`/pt-prices/${ptId}`, data),

  getPriceHistory: (ptId: string, priceType?: string) =>
    api.get<{ history: PTPricingHistoryItem[] }>(`/pt-prices/${ptId}/history`, { params: { priceType } }),
}
