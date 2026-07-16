import express from 'express'
import * as ctrl from '../controllers/floorZoneController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/floors', ctrl.getAllFloors)
router.post('/floors', authorize('admin', 'super_admin'), ctrl.createFloor)
router.patch('/floors/:id', authorize('admin', 'super_admin'), ctrl.updateFloor)
router.delete('/floors/:id', authorize('admin', 'super_admin'), ctrl.deleteFloor)

router.get('/zones', ctrl.getAllZones)
router.get('/zones/occupancy', ctrl.getAllZonesWithOccupancy)
router.get('/zones/floor/:floorId', ctrl.getZonesByFloor)
router.get('/zones/:id/occupancy', ctrl.getZoneOccupancy)
router.post('/zones', authorize('admin', 'super_admin'), ctrl.createZone)
router.patch('/zones/:id', authorize('admin', 'super_admin'), ctrl.updateZone)
router.delete('/zones/:id', authorize('admin', 'super_admin'), ctrl.deleteZone)

export default router
