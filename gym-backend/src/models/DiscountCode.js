import mongoose from 'mongoose'

const discountCodeSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
        type: {
            type: String,
            enum: ['order_discount', 'free_shipping', 'shipping_discount'],
            required: true,
        },
        amount: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
)

export default mongoose.model('DiscountCode', discountCodeSchema)
