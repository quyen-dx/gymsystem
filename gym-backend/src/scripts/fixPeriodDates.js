/**
 * Fix corrupted period dates and rebuild membership timelines.
 * Chạy: npx babel-node src/scripts/fixPeriodDates.js
 * Hoặc: node --require @babel/register src/scripts/fixPeriodDates.js
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gym'

async function fixPeriodDates() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB:', MONGODB_URI)

  const { rebuildMembershipTimeline } = await import('../services/membershipService.js')
  const MembershipPeriod = mongoose.model('MembershipPeriod')
  const Membership = mongoose.model('Membership')

  // 1. Tìm tất cả periods có startDate >= endDate (duration <= 0)
  const badPeriods = await MembershipPeriod.find({
    $expr: { $gte: ['$startDate', '$endDate'] },
  }).sort({ createdAt: 1 }).lean()

  console.log(`Found ${badPeriods.length} periods with startDate >= endDate`)

  if (badPeriods.length === 0) {
    console.log('No corrupted periods found.')
    await mongoose.disconnect()
    return
  }

  // 2. Gom theo membershipId
  const membershipIds = [...new Set(badPeriods.map(p => String(p.membershipId)))]
  console.log(`Affected memberships: ${membershipIds.length}`)
  console.log('Membership IDs:', membershipIds)

  // 3. Chạy rebuildMembershipTimeline cho từng membership
  for (const membershipId of membershipIds) {
    try {
      console.log(`\nRebuilding timeline for membership ${membershipId}...`)
      await rebuildMembershipTimeline({ membershipId })
      console.log(`  ✓ Done`)
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`)
    }
  }

  // 4. Verify
  console.log('\n--- Verification ---')
  for (const membershipId of membershipIds) {
    const periods = await MembershipPeriod.find({ membershipId }).sort({ startDate: 1 }).lean()
    console.log(`\nMembership ${membershipId}:`)
    for (const p of periods) {
      const start = new Date(p.startDate)
      const end = new Date(p.endDate)
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`  Period ${p._id}: ${start.toISOString()} → ${end.toISOString()} (${days} days, status: ${p.status})`)
    }
  }

  await mongoose.disconnect()
  console.log('\nDone.')
}

fixPeriodDates().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
