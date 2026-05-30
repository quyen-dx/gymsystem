import express from 'express'
import {
  createFaq,
  createFeedback,
  createPolicy,
  deleteFaq,
  deletePolicy,
  getAllFeedback,
  getFaqs,
  getLandingContent,
  getMyActivity,
  getMyFeedback,
  getPolicies,
  getPolicyBySlug,
  getSystemSettings,
  updateFaq,
  updateFeedbackStatus,
  updateLandingContent,
  updatePolicy,
  updateSystemSettings,
} from '../controllers/systemExperienceController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

const optionalAuth = (req, _res, next) => {
  if (!req.headers.authorization) return next()
  return protect(req, _res, next)
}

router.get('/settings', getSystemSettings)
router.put('/settings', protect, adminOnly, updateSystemSettings)

router.get('/landing', getLandingContent)
router.put('/landing', protect, adminOnly, updateLandingContent)

router.get('/faqs', optionalAuth, getFaqs)
router.post('/faqs', protect, adminOnly, createFaq)
router.put('/faqs/:id', protect, adminOnly, updateFaq)
router.delete('/faqs/:id', protect, adminOnly, deleteFaq)

router.get('/policies', optionalAuth, getPolicies)
router.get('/policies/:slug', optionalAuth, getPolicyBySlug)
router.post('/policies', protect, adminOnly, createPolicy)
router.put('/policies/:id', protect, adminOnly, updatePolicy)
router.delete('/policies/:id', protect, adminOnly, deletePolicy)

router.post('/feedback', protect, createFeedback)
router.get('/feedback/my', protect, getMyFeedback)
router.get('/feedback', protect, adminOnly, getAllFeedback)
router.patch('/feedback/:id', protect, adminOnly, updateFeedbackStatus)

router.get('/activity/my', protect, getMyActivity)

export default router
