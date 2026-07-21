import express from 'express'
import { exportUserData, anonymizeUserData } from '../controllers/gdprExportController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/export', protect, (req, res, next) => {
    req.params.userId = req.user._id.toString()
    exportUserData(req, res, next)
})

router.post('/anonymize', protect, (req, res, next) => {
    req.params.userId = req.user._id.toString()
    anonymizeUserData(req, res, next)
})

export default router
