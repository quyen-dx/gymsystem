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
  rescheduleBooking,
  requestRescheduleBooking,
  approveRescheduleBooking,
  rejectRescheduleBooking,
  cancelRescheduleRequest,
  completeBooking,
  markBookingMemberNoShow,
  markBookingPtNoShow,
  markPtAttendance,
  joinWaitlist,
  reviewPT,
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

router.patch('/:id/reschedule', protect, authorize('staff', 'admin', 'super_admin'), rescheduleBooking)

// P10: member đổi lịch phải qua PT duyệt
router.post('/:id/reschedule-request', protect, authorize('member'), requestRescheduleBooking)
router.patch('/:id/reschedule-approve', protect, authorize('pt', 'staff', 'admin', 'super_admin'), approveRescheduleBooking)
router.patch('/:id/reschedule-reject', protect, authorize('pt', 'staff', 'admin', 'super_admin'), rejectRescheduleBooking)
router.patch('/:id/reschedule-cancel', protect, authorize('member'), cancelRescheduleRequest)

router.patch('/:id/complete', protect, authorize('pt'), completeBooking)

router.patch('/:id/no-show', protect, authorize('pt', 'staff', 'admin', 'super_admin'), markBookingMemberNoShow)

router.patch('/:id/pt-no-show', protect, authorize('pt', 'staff', 'admin', 'super_admin'), markBookingPtNoShow)

router.patch('/:id/pt-attendance', protect, authorize('pt', 'staff', 'admin', 'super_admin'), markPtAttendance)

router.post('/:slotId/waitlist', protect, authorize('member'), joinWaitlist)

router.post('/:id/review', protect, authorize('member'), reviewPT)

export default router
