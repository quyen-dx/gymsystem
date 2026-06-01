import express from 'express'
import { getAuditLogs } from '../controllers/auditLogController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.get('/', protect, adminOnly, requireFeature('reports.auditLogEnabled'), getAuditLogs)

export default router
