/**
 * Migrate Membership & MembershipCycle statuses to the new immediate-activation model.
 *
 * Trước (đã bỏ hoàn toàn): membership chờ kích hoạt bằng lần check-in đầu tiên.
 * Sau: gói được kích hoạt NGAY khi thanh toán thành công (status='active').
 *
 * MembershipCycle:
 *   'pending_initial_activation'  → 'active'
 *       (activatedAt/startDate = purchasedAt, expiresAt = purchasedAt + durationDays nếu thiếu)
 *   'pending_renewal_activation'  → gộp vào cycle active trước đó (extend durationDays + expiresAt)
 *       Nếu không có cycle trước → kích hoạt luôn như cycle mới
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
const DAY_MS = 24 * 60 * 60 * 1000

function computeExpiresAt(baseDate, durationDays) {
  const days = Math.max(Number(durationDays) || 30, 1)
  const d = new Date(baseDate)
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log(`Connected to MongoDB (DRY-RUN=${!isCommit})`)
  if (isCommit) console.log('⚠  --commit mode')

  // 1. Migrate MembershipCycle
  console.log('\n=== MembershipCycle ===')

  const initialPending = await MembershipCycle.find({ status: 'pending_initial_activation' }).lean()
  console.log(`  'pending_initial_activation' → 'active': ${initialPending.length} cycles`)

  const renewalPending = await MembershipCycle.find({ status: 'pending_renewal_activation' }).lean()
  console.log(`  'pending_renewal_activation' → merge/active: ${renewalPending.length} cycles`)

  if (isCommit) {
    // 1a. pending_initial_activation → active (kích hoạt ngay, thời hạn tính từ thời điểm mua)
    let c1 = 0
    for (const cycle of initialPending) {
      const base = cycle.purchasedAt || cycle.createdAt || new Date()
      const activatedAt = cycle.activatedAt || base
      const startDate = cycle.startDate || activatedAt
      const expiresAt = cycle.expiresAt || computeExpiresAt(startDate, cycle.durationDays)
      await MembershipCycle.updateOne(
        { _id: cycle._id, status: 'pending_initial_activation' },
        {
          $set: {
            status: 'active',
            activatedAt,
            startDate,
            endDate: expiresAt,
            expiresAt,
            refundEligible: false,
          },
        }
      )
      c1++
    }
    console.log(`  ✓ Updated ${c1} cycles: pending_initial_activation → active`)

    // 1b. pending_renewal_activation → gộp vào cycle active trước đó (hoặc kích hoạt luôn)
    let c2 = 0
    for (const cycle of renewalPending) {
      const prevCycle = cycle.previousCycleId
        ? await MembershipCycle.findById(cycle.previousCycleId).lean()
        : null

      if (prevCycle && prevCycle.status === 'active') {
        const currentExpiry = prevCycle.expiresAt || prevCycle.endDate || new Date()
        const addedDays = Math.max(Number(cycle.durationDays) || 0, 0)
        const newExpiry = new Date(currentExpiry)
        newExpiry.setDate(newExpiry.getDate() + addedDays)
        await MembershipCycle.updateOne(
          { _id: prevCycle._id },
          {
            $inc: { durationDays: addedDays },
            $set: {
              currentMembershipId: cycle.currentMembershipId || prevCycle.currentMembershipId,
              currentPlanId: cycle.currentPlanId || prevCycle.currentPlanId,
              endDate: newExpiry,
              expiresAt: newExpiry,
            },
          }
        )
        await MembershipCycle.updateOne(
          { _id: cycle._id },
          { $set: { status: 'completed', refundEligible: false } }
        )
      } else {
        // Không có cycle active trước → kích hoạt cycle này ngay
        const base = cycle.purchasedAt || cycle.createdAt || new Date()
        const activatedAt = cycle.activatedAt || base
        const startDate = cycle.startDate || activatedAt
        const expiresAt = cycle.expiresAt || computeExpiresAt(startDate, cycle.durationDays)
        await MembershipCycle.updateOne(
          { _id: cycle._id, status: 'pending_renewal_activation' },
          {
            $set: {
              status: 'active',
              activatedAt,
              startDate,
              endDate: expiresAt,
              expiresAt,
              refundEligible: false,
            },
          }
        )
      }
      c2++
    }
    console.log(`  ✓ Updated ${c2} cycles: pending_renewal_activation → merged/active`)
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
