import api from './api'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

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
  cancelReason?: string
  isViolation?: boolean
}

export type CreateBookingPayload = {
  ptId: string
  date: string
  slot: string
  note?: string
}

export const bookingService = {
  checkConflicts(params: { ptId: string; date: string; slot: string }) {
    return api.get('/bookings/conflicts', { params })
  },

  createBooking(data: CreateBookingPayload) {
    return api.post('/bookings', data)
  },

  getMyBookings() {
    return api.get('/bookings/my')
  },

  cancelBooking(id: string, reason: string) {
    return api.patch(`/bookings/${id}/cancel`, { reason })
  },
}