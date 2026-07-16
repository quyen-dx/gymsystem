import api from './api'

export interface Floor {
  _id: string
  name: string
  status: 'active' | 'maintenance'
}

export interface Zone {
  _id: string
  name: string
  floorId: string | { _id: string; name: string; order?: number; status?: string }
  maxCapacity: number
  status: 'active' | 'maintenance'
  currentSessions?: number
  available?: boolean
}

export const floorZoneService = {
  getFloors: () => api.get<{ floors: Floor[] }>('/floors-zones/floors'),
  createFloor: (data: { name: string; status?: string }) => api.post('/floors-zones/floors', data),
  updateFloor: (id: string, data: { name?: string; status?: string }) => api.patch(`/floors-zones/floors/${id}`, data),
  deleteFloor: (id: string) => api.delete(`/floors-zones/floors/${id}`),

  getZones: () => api.get<{ zones: Zone[] }>('/floors-zones/zones'),
  getZonesByFloor: (floorId: string) => api.get<{ zones: Zone[] }>(`/floors-zones/zones/floor/${floorId}`),
  getZonesWithOccupancy: () => api.get<{ zones: Zone[] }>('/floors-zones/zones/occupancy'),
  getZoneOccupancy: (id: string) => api.get<{ zoneId: string; zoneName: string; maxCapacity: number; currentSessions: number; available: boolean }>(`/floors-zones/zones/${id}/occupancy`),
  createZone: (data: { name: string; floorId: string; maxCapacity?: number; status?: string }) => api.post('/floors-zones/zones', data),
  updateZone: (id: string, data: { name?: string; maxCapacity?: number; status?: string }) => api.patch(`/floors-zones/zones/${id}`, data),
  deleteZone: (id: string) => api.delete(`/floors-zones/zones/${id}`),
}
