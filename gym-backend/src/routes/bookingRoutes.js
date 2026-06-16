import express from 'express'

import {
  checkConflicts,
  createBooking,
  createRecurringBooking,
  getMyBookings,
  getPTBookings,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  completeBooking,
  joinWaitlist,
  reviewPT,
} from '../controllers/bookingController.js'

import { protect, authorize } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/conflicts', protect, checkConflicts)

router.post('/', protect, authorize('member'), createBooking)

router.post('/recurring', protect, authorize('member'), createRecurringBooking)

router.get('/my', protect, authorize('member'), getMyBookings)

router.get('/pt', protect, authorize('pt'), getPTBookings)

router.patch('/:id/confirm', protect, authorize('pt'), confirmBooking)

router.patch('/:id/reject', protect, authorize('pt'), rejectBooking)

router.patch('/:id/cancel', protect, authorize('member'), cancelBooking)

router.patch('/:id/complete', protect, authorize('pt'), completeBooking)

router.post('/:slotId/waitlist', protect, authorize('member'), joinWaitlist)

router.post('/:id/review', protect, authorize('member'), reviewPT)

export default router
