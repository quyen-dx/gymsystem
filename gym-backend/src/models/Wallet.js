import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        heldBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            default: 'VND',
        },
        status: {
            type: String,
            enum: ['active', 'frozen', 'closed'],
            default: 'active',
        },
    },
    { timestamps: true },
)

export default mongoose.model('Wallet', walletSchema)
