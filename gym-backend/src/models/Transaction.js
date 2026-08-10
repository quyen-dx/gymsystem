import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            required: true,
            index: true,
        },
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment',
            default: null,
            index: true,
        },
        currency: {
            type: String,
            trim: true,
            default: 'VND',
        },
        exchangeRate: {
            type: Number,
            default: null,
        },
        paymentMethod: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
        },
        type: {
            type: String,
            enum: ['deposit', 'payment', 'transfer', 'refund', 'payout', 'compensation', 'REFUND_TO_WALLET'],
            required: true,
        },
        provider: {
            type: String,
            trim: true,
        },
        source: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        balanceBefore: {
            type: Number,
            required: true,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
        referenceId: {
            type: String,
            trim: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'cancelled'],
            default: 'pending',
        },
        expiredAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        idempotencyKey: {
            type: String,
            trim: true,
            index: true,
        },
    },
    { timestamps: true },
)

// Chống double-credit khi 2 request/process cùng finalize 1 giao dịch (vd. webhook Stripe + confirm endpoint)
// Chỉ index các doc có idempotencyKey là string (bỏ qua null/undefined) để không đụng các txn không có key.
transactionSchema.index(
    { userId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
)

export default mongoose.model('Transaction', transactionSchema)
