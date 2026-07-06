import api from './api'

export type BookingStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export type Booking = {
  _id: string
  memberId: string
  ptId: {
    _id: string
    name?: string
    email?: string | null
  }
  date: string
  slot: string
  note?: string
  status: BookingStatus
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
  trainingType: 'one_to_one' | 'group'
  priceAtBooking: number
  totalAmount: number
  cancelReason?: string
  isViolation?: boolean
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

  getMyBookings() {
    return api.get('/bookings/my')
  },

  getPTBookings(params?: Record<string, unknown>) {
    return api.get('/bookings/pt', { params })
  },

  confirmBooking(id: string) {
    return api.patch(`/bookings/${id}/confirm`)
  },

  payBooking(id: string) {
    return api.post(`/bookings/${id}/pay`)
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