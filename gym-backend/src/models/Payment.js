import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        provider: {
            type: String,
            enum: ['momo', 'vnpay', 'zalopay', 'sandbox'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        qrCodeUrl: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'paid', 'expired', 'failed', 'cancelled'],
            default: 'pending',
        },
        referenceId: {
            type: String,
            trim: true,
            required: true,
            unique: true,
            index: true,
        },
        paymentId: {
            type: String,
            trim: true,
            index: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            index: true,
        },
        expiresAt: {
            type: Date,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true },
)

export default mongoose.model('Payment', paymentSchema)
