import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        productName: {
            type: String,
            default: '',
        },
        productImage: {
            type: String,
            default: '',
        },
        variant: {
            weight: { type: String, default: '' },
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        weight: {
            type: Number,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { _id: false },
)

const orderSchema = new mongoose.Schema(
    {
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
            index: true,
        },
        items: [orderItemSchema],
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        totalPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        shippingFee: {
            type: Number,
            default: 0,
            min: 0,
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
        status: {
            type: String,
            enum: ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG'],
            default: 'CHỜ XÁC NHẬN',
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'paid', 'failed'],
            default: 'unpaid',
        },
        shippingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shipping',
        },
        paymentReference: {
            type: String,
            trim: true,
        },
        inventoryDeducted: {
            type: Boolean,
            default: false,
            index: true,
        },
        hiddenForUser: {
            type: Boolean,
            default: false,
            index: true,
        },
        hiddenForUserAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
)

export default mongoose.model('Order', orderSchema)
