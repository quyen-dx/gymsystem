import mongoose from 'mongoose'
import connectDB from '../config/db.js'

// Backfill availabilityStatus cho các user đã tồn tại trước khi field này được thêm.
// Mongoose default ('ACTIVE') chỉ áp dụng khi tạo mới document, KHÔNG áp dụng cho dữ liệu cũ,
// nên PT cũ thiếu field sẽ bị bộ lọc "availabilityStatus: 'ACTIVE'" loại khỏi danh sách PT thay ca.
// Fix dữ liệu về đúng invariant: mọi user phải có availabilityStatus hợp lệ.
const VALID = ['ACTIVE', 'ON_LEAVE', 'SICK', 'SUSPENDED']

async function migrate() {
  await connectDB()

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))

  const docs = await User.find({
    $or: [
      { availabilityStatus: { $exists: false } },
      { availabilityStatus: null },
      { availabilityStatus: '' },
      { availabilityStatus: { $nin: VALID } },
    ],
  }).lean()

  let updated = 0
  for (const u of docs) {
    await User.updateOne({ _id: u._id }, { $set: { availabilityStatus: 'ACTIVE' } })
    updated++
  }
  console.log(`Users backfilled: ${updated} (${docs.length} matched)`)
  console.log('— Mọi user thiếu/chưa hợp lệ availabilityStatus đã được set = ACTIVE (mặc định của schema).')

  await mongoose.disconnect()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
