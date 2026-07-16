import express from 'express'
import * as ctrl from '../controllers/trainerScheduleController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/my', ctrl.getMySchedule)
router.get('/available', ctrl.getAvailableTrainers)
router.get('/all', authorize('admin', 'super_admin', 'staff'), ctrl.getAllSchedules)
router.get('/:trainerId', ctrl.getTrainerSchedule)
router.put('/:trainerId', authorize('admin', 'super_admin'), ctrl.setSchedule)

export default router
