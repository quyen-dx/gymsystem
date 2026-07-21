import Booking from '../models/Booking.js'

export const runAutoConfirmJob = async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        const result = await Booking.updateMany(
            {
                status: 'pending',
                createdAt: { $lt: oneHourAgo },
            },
            {
                $set: { status: 'confirmed' },
            },
        )

        if (result.modifiedCount > 0) {
            console.log(`autoConfirmJob: auto-confirmed ${result.modifiedCount} bookings`)
        }
        return result
    } catch (error) {
        console.error('autoConfirmJob failed:', error.message)
    }
}
