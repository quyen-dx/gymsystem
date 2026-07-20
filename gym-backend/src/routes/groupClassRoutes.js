import express from 'express'
import { protect } from '../middlewares/authMiddleware.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'

const router = express.Router()

router.post(
  '/',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Group class functionality has been deprecated', 410, 'FEATURE_DEPRECATED')
  }),
)

router.get(
  '/',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Group class functionality has been deprecated', 410, 'FEATURE_DEPRECATED')
  }),
)

router.post(
  '/:classId/enroll',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Group class enrollment has been deprecated', 410, 'FEATURE_DEPRECATED')
  }),
)

router.post(
  '/:classId/cancel',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Group class cancellation has been deprecated', 410, 'FEATURE_DEPRECATED')
  }),
)

export default router
