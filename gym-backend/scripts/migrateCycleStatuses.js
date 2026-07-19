/**
 * Migrate Membership & MembershipCycle statuses to new enum values.
 *
 * MembershipCycle:
 *   'pending'      → 'pending_renewal_activation'
 *   'active' (activatedAt=null) → 'pending_initial_activation'
 *   'active' (activatedAt!=null) → keep 'active'
 *
 * Membership:
 *   'pending_cancel'    → 'active'
 *   'cancel_requested'  → 'active'
 *   'refunded'          → 'cancelled'
 *
 * Usage:
 *   node scripts/migrateCycleStatuses.js           # DRY-RUN (no writes)
 *   node scripts/migrateCycleStatuses.js --commit  # write to DB
 */
import mongoose from 'mongoose'
import Membership from '../src/models/Membership.js'
import MembershipCycle from '../src/models/MembershipCycle.js'

const isCommit = process.argv.includes('--commit')

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log(`Connected to MongoDB (DRY-RUN=${!isCommit})`)
  if (isCommit) console.log('⚠  --commit mode')

  // 1. Migrate MembershipCycle
  console.log('\n=== MembershipCycle ===')

  const pendingCycles = await MembershipCycle.find({ status: 'pending' }).lean()
  console.log(`  'pending' → 'pending_renewal_activation': ${pendingCycles.length} cycles`)

  const activeNoActivation = await MembershipCycle.find({ status: 'active', activatedAt: null }).lean()
  console.log(`  'active' + activatedAt=null → 'pending_initial_activation': ${activeNoActivation.length} cycles`)

  const activeWithActivation = await MembershipCycle.countDocuments({ status: 'active', activatedAt: { $ne: null } })
  console.log(`  'active' + activatedAt!=null → keep 'active': ${activeWithActivation} cycles (no change)`)

  if (isCommit) {
    const r1 = await MembershipCycle.updateMany(
      { status: 'pending' },
      { $set: { status: 'pending_renewal_activation' } }
    )
    console.log(`  ✓ Updated ${r1.modifiedCount} cycles: pending → pending_renewal_activation`)

    const r2 = await MembershipCycle.updateMany(
      { status: 'active', activatedAt: null },
      { $set: { status: 'pending_initial_activation' } }
    )
    console.log(`  ✓ Updated ${r2.modifiedCount} cycles: active(null) → pending_initial_activation`)
  }

  // 2. Migrate Membership
  console.log('\n=== Membership ===')

  const pendingCancelMems = await Membership.countDocuments({ status: 'pending_cancel' })
  console.log(`  'pending_cancel' → 'active': ${pendingCancelMems} memberships`)

  const cancelRequestedMems = await Membership.countDocuments({ status: 'cancel_requested' })
  console.log(`  'cancel_requested' → 'active': ${cancelRequestedMems} memberships`)

  const refundedMems = await Membership.countDocuments({ status: 'refunded' })
  console.log(`  'refunded' → 'cancelled': ${refundedMems} memberships`)

  if (isCommit) {
    const r3 = await Membership.updateMany(
      { status: 'pending_cancel' },
      { $set: { status: 'active' }, $unset: { cancelledAt: '', cancelReason: '', cancelHandledBy: '', cancelHandledAt: '' } }
    )
    console.log(`  ✓ Updated ${r3.modifiedCount} memberships: pending_cancel → active`)

    const r4 = await Membership.updateMany(
      { status: 'cancel_requested' },
      { $set: { status: 'active' }, $unset: { cancelledAt: '', cancelReason: '', cancelHandledBy: '', cancelHandledAt: '' } }
    )
    console.log(`  ✓ Updated ${r4.modifiedCount} memberships: cancel_requested → active`)

    const r5 = await Membership.updateMany(
      { status: 'refunded' },
      { $set: { status: 'cancelled' }, $unset: { cancelledAt: '', cancelReason: '', cancelHandledBy: '', cancelHandledAt: '' } }
    )
    console.log(`  ✓ Updated ${r5.modifiedCount} memberships: refunded → cancelled`)
  }

  // 3. Summary
  const totalCycles = await MembershipCycle.countDocuments()
  const statusDist = await MembershipCycle.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  console.log('\n=== Cycle Status Distribution ===')
  for (const s of statusDist) {
    console.log(`  ${s._id}: ${s.count}`)
  }

  const totalMems = await Membership.countDocuments()
  const memStatusDist = await Membership.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  console.log('\n=== Membership Status Distribution ===')
  for (const s of memStatusDist) {
    console.log(`  ${s._id}: ${s.count}`)
  }

  console.log(`\nTotal cycles: ${totalCycles}`)
  console.log(`Total memberships: ${totalMems}`)

  if (!isCommit) {
    console.log('\nDRY-RUN finished. Run with --commit to write.')
    console.log('  node scripts/migrateCycleStatuses.js --commit')
  } else {
    console.log('\nMigration completed.')
  }

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
