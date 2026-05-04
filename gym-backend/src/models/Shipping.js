import mongoose from 'mongoose'

const shippingSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            unique: true,
            index: true,
        },
        shippingFee: {
            type: Number,
            required: true,
            min: 0,
        },
        estimatedDays: {
            type: Number,
            required: true,
        },
        estimatedDeliveryDate: {
            type: Date,
            required: true,
        },
        trackingStatus: {
            type: String,
            enum: ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG'],
            default: 'CHỜ XÁC NHẬN',
        },
        address: {
            recipientName: { type: String, required: true },
            phone: { type: String, required: true },
            street: { type: String, required: true },
            ward: { type: String },
            district: { type: String, required: true },
            province: { type: String, required: true },
            city: { type: String, required: true },
            note: { type: String },
        },
        carrier: {
            type: String,
            default: 'local_shipping',
        },
    },
    { timestamps: true },
)

export default mongoose.model('Shipping', shippingSchema)
