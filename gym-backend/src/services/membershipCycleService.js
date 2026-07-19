import mongoose from 'mongoose'
import MembershipCycle from '../models/MembershipCycle.js'

function computeExpiresAt(durationDays) {
  const days = Math.max(durationDays || 30, 1)
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Get the active MembershipCycle for a member.
 */
export async function getActiveCycle(memberId) {
  return MembershipCycle.findOne({ memberId, status: 'active' })
    .sort({ createdAt: -1 })
    .lean()
}

/**
 * Get the latest pending cycle for a member.
 * Returns pending_initial_activation first, then pending_renewal_activation.
 */
export async function getPendingCycle(memberId) {
  return MembershipCycle.findOne({
    memberId,
    status: { $in: ['pending_initial_activation', 'pending_renewal_activation'] },
  })
    .sort({ createdAt: -1 })
    .lean()
}

/**
 * Get all cycles for a member (active + pending queue).
 */
export async function getAllCycles(memberId) {
  return MembershipCycle.find({
    memberId,
    status: { $in: ['active', 'pending_initial_activation', 'pending_renewal_activation'] },
  })
    .sort({ createdAt: 1 })
    .lean()
}

/**
 * Check if the member's pending cycle is still refund-eligible.
 */
export async function isRefundEligible(memberId) {
  const cycle = await getPendingCycle(memberId)
  return cycle?.refundEligible ?? false
}

/**
 * Activate a pending_initial_activation cycle on first check-in.
 *
 * Per state machine (pending_initial_activation → active):
 *   activatedAt = now
 *   startDate = now
 *   expiresAt = now + durationDays
 *   refundEligible = false
 *   status = 'active'
 *
 * Atomic: findOneAndUpdate with status guard prevents double-activation.
 */
export async function activateCycle(memberId, opts = {}) {
  const now = new Date()

  const activated = await MembershipCycle.findOneAndUpdate(
    {
      memberId,
      status: 'pending_initial_activation',
    },
    [
      {
        $set: {
          status: 'active',
          activatedAt: now,
          startDate: now,
          expiresAt: {
            $add: [now, { $multiply: [{ $ifNull: ['$durationDays', 30] }, 86400000] }],
          },
          refundEligible: false,
          firstBenefitUsedAt: now,
          firstBenefitType: opts.benefitType || 'checkin',
        },
      },
    ],
    {
      new: true,
      sort: { createdAt: -1 },
      session: opts.session || null,
    }
  )

  return activated
}

/**
 * Activate all pending_renewal_activation cycles whose previous cycle has expired.
 *
 * Per sequence diagram F:
 *   Tìm status='pending_renewal_activation' với previousCycleId.expiresAt < now
 *   Set activatedAt=now, startDate=now, expiresAt=now+durationDays
 *   Set refundEligible=false, status='active'
 *   Set previousCycle.status='completed'
 *
 * Idempotent: mỗi cycle chỉ được activate một lần (status guard).
 */
export async function activatePendingRenewalCycles() {
  const now = new Date()

  const pendingCycles = await MembershipCycle.find({
    status: 'pending_renewal_activation',
    previousCycleId: { $ne: null },
  })
    .populate('previousCycleId')
    .lean()

  const toActivate = pendingCycles.filter(
    c => c.previousCycleId && new Date(c.previousCycleId.expiresAt) < now
  )

  const activated = []
  for (const cycle of toActivate) {
    const session = await mongoose.startSession()
    try {
      session.startTransaction()

      const expiresAt = computeExpiresAt(cycle.durationDays)

      const result = await MembershipCycle.findOneAndUpdate(
        { _id: cycle._id, status: 'pending_renewal_activation' },
        {
          $set: {
            status: 'active',
            activatedAt: now,
            startDate: now,
            expiresAt,
            refundEligible: false,
          },
        },
        { new: true, session }
      )

      if (!result) {
        await session.abortTransaction()
        continue
      }

      await MembershipCycle.updateOne(
        { _id: cycle.previousCycleId._id, status: { $ne: 'completed' } },
        { $set: { status: 'completed' } },
        { session }
      )

      await session.commitTransaction()
      activated.push(cycle._id)
    } catch (txErr) {
      await session.abortTransaction()
      console.error(`[activatePendingRenewalCycles] Failed to activate cycle ${cycle._id}:`, txErr.message)
    } finally {
      session.endSession()
    }
  }

  return activated
}

/**
 * Mark the first benefit usage on a pending or active cycle.
 * Used for non-check-in benefits (PT, body scan, etc.)
 *
 * Atomic: findOneAndUpdate prevents double-activation race condition
 * between concurrent requests (e.g., POST /booking + POST /checkin).
 */
export async function markBenefitUsed(memberId, benefitType, opts = {}) {
  const now = new Date()

  const activated = await MembershipCycle.findOneAndUpdate(
    {
      memberId,
      status: 'pending_initial_activation',
      refundEligible: true,
    },
    [
      {
        $set: {
          status: 'active',
          refundEligible: false,
          firstBenefitUsedAt: now,
          firstBenefitType: benefitType,
          activatedAt: now,
          startDate: now,
          expiresAt: {
            $add: [now, { $multiply: [{ $ifNull: ['$durationDays', 30] }, 86400000] }],
          },
        },
      },
    ],
    {
      new: true,
      sort: { createdAt: -1 },
      session: opts.session || null,
    }
  )

  if (activated) return activated

  const marked = await MembershipCycle.findOneAndUpdate(
    {
      memberId,
      status: 'active',
      refundEligible: true,
    },
    {
      $set: {
        refundEligible: false,
        firstBenefitUsedAt: now,
        firstBenefitType: benefitType,
      },
    },
    {
      new: true,
      sort: { createdAt: -1 },
      session: opts.session || null,
    }
  )

  return marked
}

/**
 * Update the currentMembershipId and currentPlanId on the active cycle.
 */
export async function updateCurrentMembership(memberId, membershipId, planId, opts = {}) {
  await MembershipCycle.updateOne(
    { memberId, status: 'active' },
    { $set: { currentMembershipId: membershipId, currentPlanId: planId } },
    { session: opts.session || null }
  )
}
