import Booking from '../models/Booking.js'
import ViolationLog from '../models/ViolationLog.js'

export const runNoShowDetectionJob = async () => {
    try {
        const now = new Date()
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        const midnightToday = new Date(now)
        midnightToday.setHours(0, 0, 0, 0)
        const ninetyDaysAgo = new Date(midnightToday.getTime() - 90 * 24 * 60 * 60 * 1000)

        const missedBookings = await Booking.find({
            status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
            date: { $gte: ninetyDaysAgo, $lt: midnightToday },
        }).lean()

        const noShows = missedBookings.filter((b) => {
            const sessionStart = new Date(b.date)
            const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000)
            return sessionEnd < twoHoursAgo
        })

        let violationsCreated = 0
        for (const booking of noShows) {
            const existing = await ViolationLog.findOne({ bookingId: booking._id })
            if (existing) continue

            await ViolationLog.create({
                memberId: booking.memberId,
                bookingId: booking._id,
                type: 'no_show',
            })
            violationsCreated++

            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            const count = await ViolationLog.countDocuments({
                memberId: booking.memberId,
                type: 'no_show',
                createdAt: { $gte: ninetyDaysAgo },
            })

            if (count >= 3) {
                await Booking.updateMany(
                    {
                        memberId: booking.memberId,
                        status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
                        date: { $gte: now },
                    },
                    {
                        $set: {
                            status: 'cancelled',
                            cancelReason: 'Tự động hủy do vi phạm không điểm danh 3 lần',
                        },
                    },
                )
            }
        }

        if (violationsCreated > 0) {
            console.log(`noShowDetectionJob: logged ${violationsCreated} no-show violations`)
        }
        return { violationsCreated }
    } catch (error) {
        console.error('noShowDetectionJob failed:', error.message)
    }
}
