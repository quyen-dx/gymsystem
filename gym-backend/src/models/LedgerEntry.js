import mongoose from 'mongoose'

const ledgerEntrySchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    account: {
      type: String,
      required: true,
      trim: true,
    },
    counterpartyAccount: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
)

ledgerEntrySchema.index({ account: 1, createdAt: -1 })
ledgerEntrySchema.index({ transactionId: 1, direction: 1 })

ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Ledger entries are immutable and cannot be updated'))
  }
  next()
})

ledgerEntrySchema.pre('findOneAndUpdate', function () {
  throw new Error('Ledger entries are immutable and cannot be updated')
})

ledgerEntrySchema.pre('updateOne', function () {
  throw new Error('Ledger entries are immutable and cannot be updated')
})

ledgerEntrySchema.pre('deleteOne', function () {
  throw new Error('Ledger entries cannot be deleted')
})

ledgerEntrySchema.pre('deleteMany', function () {
  throw new Error('Ledger entries cannot be deleted')
})

ledgerEntrySchema.pre('findOneAndDelete', function () {
  throw new Error('Ledger entries cannot be deleted')
})

export default mongoose.model('LedgerEntry', ledgerEntrySchema)
