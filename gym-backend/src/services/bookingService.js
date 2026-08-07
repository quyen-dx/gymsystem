import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import User from '../models/User.js'
import { validatePTAssignment } from './ptScheduleValidationService.js'

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const normalizeDateOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Ngày đặt lịch không hợp lệ')
    error.statusCode = 400
    throw error
  }
  date.setHours(0, 0, 0, 0)
  return date
}

export const getUpcomingBookings = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const bookings = await Booking.find({
    memberId,
    date: { $gte: today },
    status: { $ne: 'cancelled' },
  })
    .sort({ date: 1, slot: 1 })
    .populate('ptId', 'name fullName avatar specialties rating')
    .lean()

  return {
    count: bookings.length,
    bookings: bookings.map((booking) => ({
      id: booking._id,
      ptId: booking.ptId?._id,
      ptName: booking.ptId?.name || 'PT',
      specialties: booking.ptId?.specialties || [],
      date: booking.date,
      slot: booking.slot,
      note: booking.note,
      status: booking.status,
    })),
  }
}

export const createBookingRequest = async ({ userId, ptId, date, slot, note = '' }) => {
  const memberId = toObjectId(userId, 'userId')
  const trainerId = toObjectId(ptId, 'ptId')
  const bookingDate = normalizeDateOnly(date)
  const normalizedSlot = String(slot || '').trim()

  if (!normalizedSlot) {
    const error = new Error('Slot đặt lịch không được để trống')
    error.statusCode = 400
    throw error
  }

  const pt = await User.findOne({ _id: trainerId, role: 'pt', isActive: true }).select('name specialties').lean()
  if (!pt) {
    const error = new Error('Không tìm thấy PT phù hợp')
    error.statusCode = 404
    throw error
  }

  const existing = await Booking.findOne({
    ptId: trainerId,
    date: bookingDate,
    slot: normalizedSlot,
    status: { $ne: 'cancelled' },
  }).lean()

  if (existing) {
    return {
      created: false,
      reason: 'slot_unavailable',
      message: 'Slot này đã có người đặt. Bạn hãy chọn khung giờ khác.',
    }
  }

  // Kiểm tra lịch làm việc của PT: ngày làm việc, ca phù hợp, nghỉ phép, cover thay ca, trùng lớp nhóm
  const scheduleCheck = await validatePTAssignment({ trainerId, date: bookingDate, slot: normalizedSlot })
  if (!scheduleCheck.ok) {
    return {
      created: false,
      reason: 'pt_schedule_conflict',
      message: scheduleCheck.message,
    }
  }

  const booking = await Booking.create({
    memberId,
    ptId: trainerId,
    date: bookingDate,
    slot: normalizedSlot,
    note: String(note || '').slice(0, 500),
  })

  return {
    created: true,
    booking: {
      id: booking._id,
      ptId: trainerId,
      ptName: pt.name,
      date: booking.date,
      slot: booking.slot,
      note: booking.note,
      status: booking.status,
    },
  }
}
