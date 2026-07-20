/**
 * Migration: Cập nhật dữ liệu cũ sang kiến trúc TrainingAssignment mới.
 *
 * 1. TrainingClass:
 *    - Có ptId → status = 'active'
 *    - Không ptId → status = 'waiting_pt'
 *
 * 2. TrainingAssignment:
 *    - Có trainerId + status = 'active' → giữ nguyên
 *    - Không trainerId + status = 'active' → set status = 'waiting_pt'
 *    - Có classId + trainerId = null → đồng bộ trainerId từ TrainingClass.ptId
 *
 * Chạy: node --env-file=.env src/scripts/migrateClassPtRelations.js
 */
import mongoose from 'mongoose'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/gympro'

async function migrate() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  // === 1. TrainingClass ===
  console.log('\n--- TrainingClass ---')
  const withPt = await TrainingClass.updateMany(
    { ptId: { $ne: null }, status: { $exists: false } },
    { $set: { status: 'active' } },
  )
  console.log(`  Set status='active' for ${withPt.modifiedCount} classes (have ptId)`)

  const withoutPt = await TrainingClass.updateMany(
    { $or: [{ ptId: null }, { ptId: { $exists: false } }], status: { $exists: false } },
    { $set: { status: 'waiting_pt' } },
  )
  console.log(`  Set status='waiting_pt' for ${withoutPt.modifiedCount} classes (no ptId)`)

  // === 2. TrainingAssignment ===
  console.log('\n--- TrainingAssignment ---')

  // 2a. Đồng bộ trainerId từ TrainingClass.ptId
  const classes = await TrainingClass.find({ ptId: { $ne: null } }).lean()
  let syncCount = 0
  for (const c of classes) {
    const result = await TrainingAssignment.updateMany(
      { classId: c._id, trainerId: null },
      { $set: { trainerId: c.ptId, status: 'active', acceptedAt: c.updatedAt || c.createdAt } },
    )
    syncCount += result.modifiedCount
  }
  console.log(`  Synced trainerId from TrainingClass.ptId for ${syncCount} assignments`)

  // 2b. Set status='waiting_pt' for active assignments without trainerId
  const orphaned = await TrainingAssignment.updateMany(
    { status: 'active', trainerId: null },
    { $set: { status: 'waiting_pt' } },
  )
  console.log(`  Set status='waiting_pt' for ${orphaned.modifiedCount} orphaned assignments`)

  // 2c. Fix old 'completed' status → 'finished'
  const completed = await TrainingAssignment.updateMany(
    { status: 'completed' },
    { $set: { status: 'finished' } },
  )
  if (completed.modifiedCount > 0) {
    console.log(`  Migrated ${completed.modifiedCount} 'completed' → 'finished'`)
  }

  console.log('\nMigration completed successfully')
  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
