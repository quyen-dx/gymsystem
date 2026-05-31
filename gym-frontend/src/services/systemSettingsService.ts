import api from './api'

export const systemSettingsService = {
  get: () => api.get('/system-settings'),
  update: (settings: any) => api.put('/system-settings', { settings }),
  resetDefault: () => api.post('/system-settings/reset-default'),
}

