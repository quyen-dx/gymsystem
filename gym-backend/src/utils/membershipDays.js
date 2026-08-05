import MembershipPeriod from '../models/MembershipPeriod.js'
import { calculateRemainingDays } from './dateUtils.js'

/**
 * Nguồn sự thật duy nhất cho ngày hết hạn hiện tại:
 * ưu tiên MembershipPeriod (ACTIVE).endDate,
 * fallback sang MembershipCycle.expiresAt khi chưa có period ACTIVE.
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string|null} params.membershipId - currentMembershipId của cycle
 * @param {Object|null} [params.cycle] - cycle đang active
 * @returns {Promise<Date|null>}
 */
export const getActivePeriodEndDate = async ({ membershipId, cycle }) => {
  if (!membershipId) return cycle?.expiresAt || null

  const activePeriod = await MembershipPeriod.findOne({
    membershipId,
    status: 'ACTIVE',
  }).sort({ startDate: 1 }).lean()

  return activePeriod?.endDate || cycle?.expiresAt || null
}

/**
 * Tính remainingDays theo nguồn sự thật duy nhất.
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string|null} params.membershipId
 * @param {Object|null} [params.cycle]
 * @returns {Promise<{ periodEndDate: Date|null, remainingDays: number }>}
 */
export const getMembershipRemainingDays = async ({ membershipId, cycle }) => {
  const periodEndDate = await getActivePeriodEndDate({ membershipId, cycle })
  return {
    periodEndDate,
    remainingDays: periodEndDate ? calculateRemainingDays(periodEndDate) : 0,
  }
}
