import MembershipCycle from '../models/MembershipCycle.js'
import AppError from '../utils/appError.js'

const MAX_PENDING_RENEWALS = 3

/**
 * BR-MEM-001: One active membership per member.
 * A member may have at most one membership in an active
 * or pending state. Pending includes both pending_initial_activation
 * and pending_renewal_activation.
 */
export const assertOneActiveMembership = async (memberId) => {
  const existing = await MembershipCycle.findOne({
    memberId,
    status: {
      $in: ['active', 'pending_renewal_activation'],
    },
  }).sort({ createdAt: -1 }).lean()

  if (!existing) return null

  if (existing.status === 'active') {
    throw new AppError(
      'Bạn đang có gói tập đang hoạt động. Vui lòng gia hạn thay vì đăng ký mới.',
      400,
    )
  }

  return existing
}

/**
 * BR-MEM-003: Max 3 pending renewals.
 * Counts pending_renewal_activation cycles that are waiting
 * for the active cycle to expire. Rejects if limit reached.
 */
export const assertMaxPendingRenewals = async (memberId) => {
  const count = await MembershipCycle.countDocuments({
    memberId,
    status: 'pending_renewal_activation',
  })

  if (count >= MAX_PENDING_RENEWALS) {
    throw new AppError(
      `Đã đạt giới hạn ${MAX_PENDING_RENEWALS} lần gia hạn đang chờ. Vui lòng đợi chu kỳ hiện tại hoàn tất.`,
      400,
    )
  }

  return count
}

/**
 * Convenience: run both BR-MEM-001 and BR-MEM-003 for a purchase flow.
 * For renew mode, skip BR-MEM-001 (member has active cycle by design).
 * For register mode, enforce both.
 */
export const assertPurchaseEligibility = async (memberId, mode) => {
  if (mode === 'renew') {
    await assertMaxPendingRenewals(memberId)
    return
  }

  await assertOneActiveMembership(memberId)
}
