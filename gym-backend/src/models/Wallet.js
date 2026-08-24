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
        // Funds reserved for an in-progress manual bank payout. They are no
        // longer spendable, but have not left the ledger until completion.
        lockedBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Only money that is permitted to leave the platform. Legacy wallets
        // intentionally default to zero until they are reconciled from source
        // transactions, so promotional credit can never be withdrawn by
        // accident.
        withdrawableBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            default: 'VND',
        },
    },
    { timestamps: true },
)

export default mongoose.model('Wallet', walletSchema)
