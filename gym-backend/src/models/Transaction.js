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
        type: {
            type: String,
            enum: ['deposit', 'payment', 'transfer', 'refund', 'payout'],
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
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
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

export default mongoose.model('Transaction', transactionSchema)
