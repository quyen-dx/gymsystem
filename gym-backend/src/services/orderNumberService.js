import mongoose from 'mongoose'

let counter = null

const CounterSchema = new mongoose.Schema({
  _id: { type: String, default: 'order_number' },
  seq: { type: Number, default: 0 },
})

const Counter = mongoose.models.OrderCounter || mongoose.model('OrderCounter', CounterSchema)

export const generateOrderNumber = async () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const prefix = `GYM-${yyyy}${mm}${dd}`

  const doc = await Counter.findOneAndUpdate(
    { _id: 'order_number' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  )

  const seq = String(doc.seq).padStart(4, '0')
  return `${prefix}-${seq}`
}
