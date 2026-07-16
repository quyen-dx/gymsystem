import Floor from '../models/Floor.js'
import Zone from '../models/Zone.js'

function sortFloorsNaturally(floors) {
  return floors.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
}

export const createFloor = async ({ name, status }) => {
  const count = await Floor.countDocuments()
  return Floor.create({ name, order: count + 1, status: status || 'active' })
}

export const getAllFloors = async () => {
  const floors = await Floor.find().lean()
  return sortFloorsNaturally(floors)
}

export const updateFloor = async ({ floorId, data }) => {
  return Floor.findByIdAndUpdate(floorId, data, { new: true })
}

export const deleteFloor = async (floorId) => {
  await Zone.deleteMany({ floorId })
  return Floor.findByIdAndDelete(floorId)
}

export const createZone = async ({ name, floorId, maxCapacity, status }) => {
  return Zone.create({ name, floorId, maxCapacity: maxCapacity || 0, status: status || 'active' })
}

export const getZonesByFloor = async (floorId) => {
  return Zone.find({ floorId }).sort({ name: 1 })
}

export const getAllZones = async () => {
  return Zone.find().populate('floorId', 'name order status').sort({ name: 1 }).lean()
}

export const updateZone = async ({ zoneId, data }) => {
  return Zone.findByIdAndUpdate(zoneId, data, { new: true })
}

export const deleteZone = async (zoneId) => {
  return Zone.findByIdAndDelete(zoneId)
}

export const getZoneOccupancy = async (zoneId) => {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw new Error('Không tìm thấy khu vực')

  return {
    zoneId: zone._id,
    zoneName: zone.name,
    maxCapacity: zone.maxCapacity,
  }
}

export const getAllZonesWithOccupancy = async () => {
  const zones = await Zone.find().populate('floorId', 'name order status').sort({ name: 1 }).lean()

  return zones.map(z => ({
    ...z,
    available: z.maxCapacity === 0 ? true : false,
    currentSessions: 0,
  }))
}
