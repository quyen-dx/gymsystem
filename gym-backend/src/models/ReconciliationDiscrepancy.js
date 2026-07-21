import mongoose from 'mongoose'

const reconciliationDiscrepancySchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            required: true,
            index: true,
        },
        gateway: {
            type: String,
            enum: ['vnpay', 'stripe'],
            required: true,
        },
        type: {
            type: String,
            enum: ['missing_internal', 'missing_gateway', 'amount_mismatch', 'status_mismatch'],
            required: true,
        },
        gatewayTransactionId: {
            type: String,
            trim: true,
            default: '',
        },
        internalTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null,
        },
        internalAmount: {
            type: Number,
            default: null,
        },
        gatewayAmount: {
            type: Number,
            default: null,
        },
        internalStatus: {
            type: String,
            trim: true,
            default: '',
        },
        gatewayStatus: {
            type: String,
            trim: true,
            default: '',
        },
        details: {
            type: String,
            trim: true,
            default: '',
        },
        resolved: {
            type: Boolean,
            default: false,
            index: true,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
)

reconciliationDiscrepancySchema.index({ date: 1, gateway: 1 })
reconciliationDiscrepancySchema.index({ resolved: 1, createdAt: -1 })

export default mongoose.model('ReconciliationDiscrepancy', reconciliationDiscrepancySchema)
