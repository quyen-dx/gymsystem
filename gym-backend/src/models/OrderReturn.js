import mongoose from 'mongoose'

const orderReturnItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        variantWeight: {
            type: String,
            trim: true,
            default: '',
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        reason: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { _id: false },
)

const orderReturnSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
        },
        items: [orderReturnItemSchema],
        reason: {
            type: String,
            trim: true,
            default: '',
        },
        status: {
            type: String,
            enum: ['requested', 'approved', 'rejected'],
            default: 'requested',
        },
        refundAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { timestamps: true },
)

orderReturnSchema.index({ orderId: 1, userId: 1 })
orderReturnSchema.index({ shopId: 1, status: 1 })

export default mongoose.model('OrderReturn', orderReturnSchema)
