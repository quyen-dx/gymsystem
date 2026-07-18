/**
 * Backfill MembershipCycle + PlanChangeHistory from existing data.
 *
 * Membership Cycle = continuous period of plan usage.
 * Determined SOLELY by time gap between consecutive Membership documents:
 *   gap <= 1 day → same cycle (handles overlap, timezone, immediate renewal)
 *   gap > 1 day  → new cycle (genuine break in usage)
 *
 * Usage:
 *   node scripts/backfillMembershipCycles.js          # DRY-RUN (no writes)
 *   node scripts/backfillMembershipCycles.js --commit  # write to DB
 */
import mongoose from 'mongoose'
import Booking from '../src/models/Booking.js'
import CheckIn from '../src/models/CheckIn.js'
import Plan from '../src/models/Plan.js'
import Membership from '../src/models/Membership.js'
import MembershipCycle from '../src/models/MembershipCycle.js'
import PlanChangeHistory from '../src/models/PlanChangeHistory.js'
import User from '../src/models/User.js'

const GRACE_DAYS = 1
const isCommit = process.argv.includes('--commit')

function detectBenefitType(checkin, booking) {
  if (booking) return booking.trainingType === 'one_to_one' ? 'pt_1on1' : 'pt_group'
  return 'checkin'
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log(`Connected to MongoDB (DRY-RUN=${!isCommit})`)
  if (isCommit) console.log('⚠  --commit mode')

  const memberIds = await Membership.distinct('memberId')
  console.log(`\nTotal members with memberships: ${memberIds.length}`)

  let totalCycles = 0
  let totalChanges = 0
  const summaries = []

  for (const memberId of memberIds) {
    const member = await User.findById(memberId).select('name fullName memberCode').lean()
    const mName = member?.fullName || member?.name || memberId
    const mCode = member?.memberCode || ''

    const memberships = await Membership.find({ memberId })
      .populate('planId', 'nameVi price durationDays')
      .sort({ startDate: 1 })
      .lean()

    if (memberships.length === 0) continue
    const changeHistory = await PlanChangeHistory.find({ memberId }).sort({ createdAt: 1 }).lean()
    const changesByMembership = {}
    for (const ch of changeHistory) {
      const memId = String(ch.membershipId)
      if (!changesByMembership[memId]) changesByMembership[memId] = []
      changesByMembership[memId].push(ch)
    }

    // === GROUP by time gap only ===
    const cycles = []

    for (let i = 0; i < memberships.length; i++) {
      const mem = memberships[i]
      if (i === 0) { cycles.push([mem]); continue }

      const prev = memberships[i - 1]
      const prevEnd = new Date(prev.endDate); prevEnd.setUTCHours(0, 0, 0, 0)
      const currStart = new Date(mem.startDate); currStart.setUTCHours(0, 0, 0, 0)
      const gapDays = (currStart - prevEnd) / (1000 * 60 * 60 * 24)

      if (gapDays <= GRACE_DAYS) {
        cycles[cycles.length - 1].push(mem)
      } else {
        cycles.push([mem])
      }
    }

    // === BACKFILL each cycle ===
    console.log(`\n--- ${mName} (${mCode || memberId}) --- ${memberships.length} docs → ${cycles.length} cycles`)

    for (let ci = 0; ci < cycles.length; ci++) {
      const cycleMems = cycles[ci]
      const first = cycleMems[0]
      const last = cycleMems[cycleMems.length - 1]
      const cycleStart = new Date(first.startDate)
      const cycleEnd = last.endDate ? new Date(last.endDate) : new Date()
      const uniquePlans = [...new Set(cycleMems.map(m => m.planId?.nameVi || '?'))].join(', ')

      let cycleStatus = last.status === 'expired' ? 'completed'
        : (['cancelled', 'refunded'].includes(last.status)) ? 'cancelled'
          : 'active'

      const [checkins, bookings] = await Promise.all([
        CheckIn.find({ memberId, status: 'success', checkinTime: { $gte: cycleStart, $lte: cycleEnd } })
          .sort({ checkinTime: 1 }).limit(1).lean(),
        Booking.find({ memberId, status: { $in: ['completed', 'confirmed'] }, date: { $gte: cycleStart, $lte: cycleEnd } })
          .sort({ date: 1 }).limit(1).lean(),
      ])

      let refundEligible = true
      let firstBenefitUsedAt = null
      let firstBenefitUsedType = null
      if (checkins.length > 0 || bookings.length > 0) {
        refundEligible = false
        const fc = checkins[0]; const fb = bookings[0]
        if (fb && (!fc || new Date(fb.date) < new Date(fc.checkinTime))) {
          firstBenefitUsedAt = fb.date; firstBenefitUsedType = detectBenefitType(null, fb)
        } else if (fc) {
          firstBenefitUsedAt = fc.checkinTime; firstBenefitUsedType = detectBenefitType('checkin', null)
        }
      }

      console.log(
        `  Cycle ${ci + 1}: ${cycleStart.toISOString().slice(0, 10)} → ${cycleEnd.toISOString().slice(0, 10)}` +
        ` | ${cycleStatus} | count=${cycleMems.length} | plans=${uniquePlans}` +
        ` | refundEligible=${refundEligible}` +
        (firstBenefitUsedAt ? ` | firstUsed=${firstBenefitUsedType}@${new Date(firstBenefitUsedAt).toISOString().slice(0, 10)}` : '')
      )

      if (!isCommit) continue

      const cycle = await MembershipCycle.create({
        memberId,
        currentMembershipId: last._id,
        currentPlanId: last.planId?._id || last.planId,
        startDate: cycleStart,
        endDate: last.endDate || null,
        status: cycleStatus,
        refundEligible,
        firstBenefitUsedAt,
        firstBenefitType: firstBenefitUsedType,
      })
      await PlanChangeHistory.create({
        cycleId: cycle._id, memberId, membershipId: first._id, fromPlanId: null,
        toPlanId: first.planId?._id || first.planId, changedAt: first.startDate,
        changeType: 'purchase', type: 'purchase', amount: first.planId?.price || 0,
        priceDifference: 0, proratedValue: 0, proratedCredit: 0, walletCredit: 0,
        note: 'Backfilled: initial purchase',
      })
      totalChanges++
      for (const mem of cycleMems) {
        const memChanges = changesByMembership[String(mem._id)] || []
        for (const ch of memChanges) {
          await PlanChangeHistory.updateOne({ _id: ch._id }, { $set: { cycleId: cycle._id } })
        }
      }
      totalCycles++
    }

    summaries.push({ mCode: mCode || memberId, mName, docs: memberships.length, cycles: cycles.length })
  }

  console.log(`\n========================================`)
  console.log(`SUMMARY`)
  for (const s of summaries) {
    console.log(`  ${s.mName} (${s.mCode}): ${s.docs} docs → ${s.cycles} cycles`)
  }
  console.log(`\nTotal members: ${summaries.length}`)
  console.log(`Total cycles: ${totalCycles || '(dry-run)'}`)
  console.log(`Total new PlanChangeHistory: ${totalChanges || '(dry-run)'}`)
  if (!isCommit) console.log(`\nDRY-RUN finished. Run with --commit to write.`)
  await mongoose.disconnect()
}
main().catch(e => { console.error(e); process.exit(1); })