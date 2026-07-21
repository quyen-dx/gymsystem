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
        discountCode: {
            type: String,
            trim: true,
            default: '',
        },
        discountAmount: {
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
        orderNumber: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG', 'ĐÃ HỦY', 'ĐANG HOÀN TRẢ', 'ĐÃ HOÀN TRẢ', 'ĐÃ HOÀN TIỀN'],
            default: 'CHỜ XÁC NHẬN',
        },
        trackingCode: {
            type: String,
            index: true,
            sparse: true,
        },
        paymentStatus: {
            type: String,
            enum: ['unpaid', 'paid', 'failed', 'refunded'],
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
        sellerEscrowAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        escrowReleased: {
            type: Boolean,
            default: false,
        },
        confirmedByBuyer: {
            type: Boolean,
            default: false,
        },
        confirmedAt: {
            type: Date,
            default: null,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        returnedAt: {
            type: Date,
            default: null,
        },
        cancellationReason: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { timestamps: true },
)

export default mongoose.model('Order', orderSchema)
