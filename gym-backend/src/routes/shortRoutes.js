import express from 'express'
import multer from 'multer'
import {
  addShortComment,
  addShortView,
  deleteShortVideo,
  getAdminShorts,
  getCommentReplies,
  getShortComments,
  getShortFeed,
  toggleCommentLike,
  toggleShortLike,
  uploadShortVideoByUrl,
  updateShortStatus,
  uploadShortVideo,
} from '../controllers/shortController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

const uploadShort = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('video/')) cb(null, true)
    else cb(new Error('File upload phải là video'))
  },
})

const uploadCommentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true)
    else cb(new Error('File comment phải là ảnh'))
  },
})

router.get('/feed', protect, getShortFeed)
router.get('/admin', protect, adminOnly, getAdminShorts)
router.post('/upload', protect, uploadShort.single('video'), uploadShortVideo)
router.post('/upload-by-url', protect, uploadShortVideoByUrl)
router.post('/:id/like', protect, toggleShortLike)
router.post('/:id/view', protect, addShortView)
router.post('/:id/comment', protect, uploadCommentImage.single('image'), addShortComment)
router.get('/:id/comments', protect, getShortComments)
router.get('/comments/:id/replies', protect, getCommentReplies)
router.post('/comments/:id/like', protect, toggleCommentLike)
router.patch('/:id/status', protect, adminOnly, updateShortStatus)
router.delete('/:id', protect, deleteShortVideo)

export default router
