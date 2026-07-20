import express from 'express'
import { protect } from '../middlewares/authMiddleware.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'

const router = express.Router()

router.get(
  '/overview',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Report overview is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

router.get(
  '/charts',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Chart data is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

router.get(
  '/heatmap',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Heatmap is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

router.get(
  '/forecast',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Forecast is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

router.get(
  '/export',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Export is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

router.get(
  '/revenue',
  protect,
  catchAsync(async (req, res) => {
    throw new AppError('Revenue report is not yet implemented', 501, 'FEATURE_NOT_IMPLEMENTED')
  }),
)

export default router
