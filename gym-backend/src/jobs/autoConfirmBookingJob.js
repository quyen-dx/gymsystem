import Booking from '../models/Booking.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { emitBookingAutoConfirmed } from '../services/socketService.js'

export const runAutoConfirmJob = async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        const pendingBookings = await Booking.find({
            status: 'pending',
            createdAt: { $lt: oneHourAgo },
        }).lean()

        if (pendingBookings.length === 0) return { confirmedCount: 0 }

        const ids = pendingBookings.map(b => b._id)
        await Booking.updateMany(
            { _id: { $in: ids } },
            { $set: { status: 'confirmed' } },
        )

        for (const booking of pendingBookings) {
            const bookingDate = new Date(booking.date).toLocaleDateString('vi-VN')
            createNotification({
                receiverId: booking.memberId,
                receiverRole: 'member',
                notificationType: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
                title: 'Lịch tập đã được tự động xác nhận',
                content: `Lịch tập ngày ${bookingDate}, slot ${booking.slot} đã được tự động xác nhận do PT không phản hồi trong 1 giờ.`,
                relatedId: booking._id,
                relatedType: 'Booking',
                redirectUrl: '/my-bookings',
                createdBy: 'System',
            }).catch(err => console.error('Auto-confirm notification failed:', err.message))

            emitBookingAutoConfirmed({ memberId: booking.memberId, booking })
        }

        console.log(`autoConfirmJob: auto-confirmed ${pendingBookings.length} bookings`)
        return { confirmedCount: pendingBookings.length }
    } catch (error) {
        console.error('autoConfirmJob failed:', error.message)
    }
}
