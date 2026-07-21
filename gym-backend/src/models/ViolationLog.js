import mongoose from 'mongoose'

const violationLogSchema = new mongoose.Schema(
    {
        memberId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
        },
        type: {
            type: String,
            enum: ['no_show'],
            required: true,
        },
    },
    { timestamps: true },
)

violationLogSchema.index({ memberId: 1, createdAt: -1 })

export default mongoose.model('ViolationLog', violationLogSchema)
