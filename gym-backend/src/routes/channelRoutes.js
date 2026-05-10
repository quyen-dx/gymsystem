import express from 'express'
import {
  getChannelProfile,
  getChannelVideos,
} from '../controllers/channelController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/:userId', protect, getChannelProfile)
router.get('/:userId/videos', protect, getChannelVideos)

export default router
