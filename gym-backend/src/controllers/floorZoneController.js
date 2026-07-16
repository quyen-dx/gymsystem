import * as floorZoneService from '../services/floorZoneService.js'

export const createFloor = async (req, res) => {
  try {
    const floor = await floorZoneService.createFloor(req.body)
    res.status(201).json({ message: 'Đã tạo tầng', floor })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllFloors = async (req, res) => {
  try {
    const floors = await floorZoneService.getAllFloors()
    res.json({ floors })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateFloor = async (req, res) => {
  try {
    const floor = await floorZoneService.updateFloor({ floorId: req.params.id, data: req.body })
    if (!floor) return res.status(404).json({ message: 'Không tìm thấy tầng' })
    res.json({ message: 'Đã cập nhật tầng', floor })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteFloor = async (req, res) => {
  try {
    await floorZoneService.deleteFloor(req.params.id)
    res.json({ message: 'Đã xóa tầng và các khu vực liên quan' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const createZone = async (req, res) => {
  try {
    const zone = await floorZoneService.createZone(req.body)
    res.status(201).json({ message: 'Đã tạo khu vực', zone })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getZoneOccupancy = async (req, res) => {
  try {
    const data = await floorZoneService.getZoneOccupancy(req.params.id)
    res.json(data)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllZonesWithOccupancy = async (req, res) => {
  try {
    const zones = await floorZoneService.getAllZonesWithOccupancy()
    res.json({ zones })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getZonesByFloor = async (req, res) => {
  try {
    const zones = await floorZoneService.getZonesByFloor(req.params.floorId)
    res.json({ zones })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllZones = async (req, res) => {
  try {
    const zones = await floorZoneService.getAllZones()
    res.json({ zones })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateZone = async (req, res) => {
  try {
    const zone = await floorZoneService.updateZone({ zoneId: req.params.id, data: req.body })
    if (!zone) return res.status(404).json({ message: 'Không tìm thấy khu vực' })
    res.json({ message: 'Đã cập nhật khu vực', zone })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const deleteZone = async (req, res) => {
  try {
    await floorZoneService.deleteZone(req.params.id)
    res.json({ message: 'Đã xóa khu vực' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
