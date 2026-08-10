import api from './api'

export type BookingStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export type BookingMember = {
  _id: string
  name?: string
  fullName?: string
  email?: string | null
  phone?: string
  avatar?: string
  memberCode?: string
}

export type Booking = {
  _id: string
  requestId?: string
  memberId: string | BookingMember
  ptId: {
    _id: string
    name?: string
    fullName?: string
    email?: string | null
    phone?: string
    avatar?: string
  }
  date: string
  slot: string
  note?: string
  status: BookingStatus
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
  trainingType: 'one_to_one' | 'group'
  priceAtBooking: number
  totalAmount: number
  paymentDeadline?: string | null
  cancelReason?: string
  isViolation?: boolean
  rescheduledFrom?: {
    date?: string | null
    slot?: string
  }
  rescheduledAt?: string | null
  rescheduleReason?: string
}

export type CreateBookingPayload = {
  ptId: string
  date: string
  slot: string
  note?: string
  trainingType: 'one_to_one' | 'group'
}

export type CreateRecurringBookingPayload = {
  ptId: string
  date: string
  slot: string
  note?: string
  weeks: number
  trainingType: 'one_to_one' | 'group'
}

export type ScheduleWeeklyPayload = {
  ptId: string
  daysOfWeek?: number[]
  time?: string
  // Mỗi ngày 1 khung giờ riêng (mới)
  daySlots?: Array<{ day: number; slot: string }>
  note?: string
  weeks?: number
}

export type RescheduleBookingPayload = {
  date: string
  slot: string
  reason?: string
}

export const bookingService = {
  checkConflicts(params: { ptId: string; date: string; slot: string }) {
    return api.get('/bookings/conflicts', { params })
  },

  createBooking(data: CreateBookingPayload) {
    return api.post('/bookings', data)
  },

  createRecurringBooking(data: CreateRecurringBookingPayload) {
    return api.post('/bookings/recurring', data)
  },

  scheduleWeekly(data: ScheduleWeeklyPayload) {
    return api.post('/bookings/schedule-weekly', data)
  },

  getMyBookings() {
    return api.get('/bookings/my')
  },

  getPTBookings(params?: Record<string, unknown>) {
    return api.get('/bookings/pt', { params })
  },

  confirmBooking(id: string) {
    return api.patch(`/bookings/${id}/confirm`)
  },

  payBooking(id: string, data?: Record<string, unknown>) {
    return api.post(`/bookings/${id}/pay`, data || {})
  },

  rejectAllPendingBookings() {
    return api.patch('/bookings/pt/reject-all')
  },

  rejectBooking(id: string, reason: string) {
    return api.patch(`/bookings/${id}/reject`, { reason })
  },

  cancelBooking(id: string, reason: string) {
    return api.patch(`/bookings/${id}/cancel`, { reason })
  },

  rescheduleBooking(id: string, data: RescheduleBookingPayload) {
    return api.patch(`/bookings/${id}/reschedule`, data)
  },

  completeBooking(id: string) {
    return api.patch(`/bookings/${id}/complete`)
  },

  joinWaitlist(slotId: string) {
    return api.post(`/bookings/${slotId}/waitlist`)
  },

  reviewPT(id: string, rating: number, comment?: string) {
    return api.post(`/bookings/${id}/review`, { rating, comment })
  },
}
