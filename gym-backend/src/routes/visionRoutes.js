import express from 'express'
import multer from 'multer'
import { postVision } from '../controllers/visionController.js'
import { protect } from '../middlewares/authMiddleware.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Unsupported file type'))
    }
  },
})

const router = express.Router()

router.post('/vision', protect, upload.single('image'), postVision)

export default router
