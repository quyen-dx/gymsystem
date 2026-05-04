import express from 'express'
import {
    createMyAddress,
    deleteMyAddress,
    getMyAddresses,
    getMyDefaultAddress,
    setDefaultMyAddress,
    updateMyAddress,
} from '../controllers/addressController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()
router.use(protect)
router.get('/', getMyAddresses)
router.get('/default', getMyDefaultAddress)
router.post('/', createMyAddress)
router.put('/:id', updateMyAddress)
router.delete('/:id', deleteMyAddress)
router.patch('/:id/default', setDefaultMyAddress)

export default router
