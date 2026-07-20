import express from 'express'
import infraRoutes from './infraRoutes.js'

const router = express.Router()

router.use('/v1', infraRoutes)

export default router
