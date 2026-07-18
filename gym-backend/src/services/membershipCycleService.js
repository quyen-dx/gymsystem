import MembershipCycle from '../models/MembershipCycle.js'

/**
 * Get the active MembershipCycle for a member.
 */
export async function getActiveCycle(memberId) {
  return MembershipCycle.findOne({ memberId, status: 'active' })
    .sort({ createdAt: -1 })
    .lean()
}

/**
 * Check if the member's active cycle is still refund-eligible.
 */
export async function isRefundEligible(memberId) {
  const cycle = await getActiveCycle(memberId)
  return cycle?.refundEligible ?? false
}

/**
 * Mark the first benefit usage on the active cycle.
 * Only updates if refundEligible is currently true (first time).
 * Subsequent calls are no-ops.
 *
 * @param {ObjectId} memberId
 * @param {string} benefitType - one of: 'checkin', 'pt_group', 'pt_1on1', 'body_scan', 'other'
 * @param {Object} [opts] - optional mongoose session options { session }
 */
export async function markBenefitUsed(memberId, benefitType, opts = {}) {
  const session = opts.session || null
  const queryOpts = session ? { session } : {}

  const cycle = await MembershipCycle.findOne({ memberId, status: 'active', refundEligible: true })
    .sort({ createdAt: -1 })
    .session(session || null)

  if (!cycle) return // already marked or no active cycle

  cycle.refundEligible = false
  cycle.firstBenefitUsedAt = new Date()
  cycle.firstBenefitType = benefitType
  await cycle.save(queryOpts)
}

/**
 * Update the currentMembershipId and currentPlanId on the active cycle.
 */
export async function updateCurrentMembership(memberId, membershipId, planId, opts = {}) {
  const session = opts.session || null

  await MembershipCycle.updateOne(
    { memberId, status: 'active' },
    { $set: { currentMembershipId: membershipId, currentPlanId: planId } },
    { session: session || null },
  ).sort({ createdAt: -1 })
}
