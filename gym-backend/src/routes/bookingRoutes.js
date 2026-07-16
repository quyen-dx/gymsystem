import express from 'express'

import {
  checkConflicts,
  createBooking,
  createRecurringBooking,
  scheduleWeeklyBooking,
  getMyBookings,
  getPTBookings,
  confirmBooking,
  rejectBooking,
  rejectAllPendingBookings,
  cancelBooking,
  completeBooking,
  joinWaitlist,
  reviewPT,
  payBooking,
} from '../controllers/bookingController.js'

import { protect, authorize } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/conflicts', protect, checkConflicts)

router.post('/', protect, authorize('member'), createBooking)

router.post('/recurring', protect, authorize('member'), createRecurringBooking)

router.post('/schedule-weekly', protect, authorize('member'), scheduleWeeklyBooking)

router.get('/my', protect, authorize('member'), getMyBookings)

router.get('/pt', protect, authorize('pt'), getPTBookings)

router.patch('/pt/reject-all', protect, authorize('pt'), rejectAllPendingBookings)

router.patch('/:id/confirm', protect, authorize('pt'), confirmBooking)

router.patch('/:id/reject', protect, authorize('pt'), rejectBooking)

router.patch('/:id/cancel', protect, authorize('member'), cancelBooking)

router.patch('/:id/complete', protect, authorize('pt'), completeBooking)

router.post('/:id/pay', protect, authorize('member'), payBooking)

router.post('/:slotId/waitlist', protect, authorize('member'), joinWaitlist)

router.post('/:id/review', protect, authorize('member'), reviewPT)

export default router
