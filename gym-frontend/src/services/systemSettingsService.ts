import api from './api'

export const systemSettingsService = {
  get: async () => {
    const response = await api.get('/system-settings', { timeout: 10000 })
    console.debug('[system-settings] GET /api/system-settings response:', response.status, response.data)
    return response
  },
  update: async (settings: any) => {
    const payload = { settings }
    console.debug('[system-settings] PUT /api/system-settings payload:', payload)
    try {
      const response = await api.put('/system-settings', payload)
      console.debug('[system-settings] PUT /api/system-settings response:', response.status, response.data)
      return response
    } catch (error: any) {
      console.error('[system-settings] PUT /api/system-settings error:', error.response?.status, error.response?.data || error.message)
      throw error
    }
  },
  resetDefault: async () => {
    try {
      const response = await api.post('/system-settings/reset-default')
      console.debug('[system-settings] POST /api/system-settings/reset-default response:', response.status, response.data)
      return response
    } catch (error: any) {
      console.error('[system-settings] POST /api/system-settings/reset-default error:', error.response?.status, error.response?.data || error.message)
      throw error
    }
  },
}
