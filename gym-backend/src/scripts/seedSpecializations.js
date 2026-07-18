import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Specialization from '../models/Specialization.js'

dotenv.config()

const SPECIALIZATIONS = [
  { code: 'GYM', name: 'GYM', description: 'Tập gym cơ bản với máy móc và tạ', icon: 'ExperimentOutlined', color: '#3B82F6' },
  { code: 'YOGA', name: 'Yoga', description: 'Yoga thư giãn và dẻo dai', icon: 'SmileOutlined', color: '#8B5CF6' },
  { code: 'BOXING', name: 'Boxing', description: 'Boxing và võ thuật', icon: 'ThunderboltOutlined', color: '#EF4444' },
  { code: 'CROSSFIT', name: 'CrossFit', description: 'CrossFit cường độ cao', icon: 'FireOutlined', color: '#F97316' },
  { code: 'PILATES', name: 'Pilates', description: 'Pilates cải thiện tư thế và core', icon: 'CompassOutlined', color: '#EC4899' },
  { code: 'ZUMBA', name: 'Zumba', description: 'Zumba dance fitness', icon: 'CustomerServiceOutlined', color: '#F59E0B' },
  { code: 'PERSONAL_TRAINING', name: 'Personal Training', description: 'Tập cá nhân 1-1 với PT', icon: 'UserOutlined', color: '#6366F1' },
  { code: 'CARDIO', name: 'Cardio', description: 'Cardio và bài tập tim mạch', icon: 'HeartOutlined', color: '#DC2626' },
  { code: 'WEIGHT_LOSS', name: 'Giảm cân', description: 'Chương trình giảm cân chuyên sâu', icon: 'LineChartOutlined', color: '#10B981' },
  { code: 'MUSCLE_GAIN', name: 'Tăng cơ', description: 'Chương trình tăng cơ chuyên sâu', icon: 'RiseOutlined', color: '#1E293B' },
]

async function seedSpecializations() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  await mongoose.connect(uri)
  console.log(`Connected to: ${mongoose.connection.host}`)

  const operations = SPECIALIZATIONS.map((spec) => ({
    updateOne: {
      filter: { code: spec.code },
      update: { $set: spec },
      upsert: true,
    },
  }))

  const result = await Specialization.bulkWrite(operations)
  console.log(`Matched: ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`)
  console.log(`Seeded ${SPECIALIZATIONS.length} specializations.`)

  await mongoose.disconnect()
  console.log('Done.')
}

seedSpecializations().catch((err) => {
  console.error(err)
  process.exit(1)
})
