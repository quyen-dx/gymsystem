import express from 'express'
import {
  getCmsPage,
  getLandingContent,
  updateCmsPage,
  updateLandingContent,
} from '../controllers/systemExperienceController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/page/:pageId', getCmsPage)
router.post('/page/:pageId', protect, adminOnly, updateCmsPage)

router.get('/landing', getLandingContent)
router.post('/landing', protect, adminOnly, updateLandingContent)

export default router
