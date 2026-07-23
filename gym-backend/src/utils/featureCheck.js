import MembershipCycle from '../models/MembershipCycle.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'

/**
 * Check if a member has a specific feature in their active plan
 * Returns { allowed: boolean, feature: object|null, plan: object|null, reason: string }
 */
export async function checkMemberFeature(memberId, featureCode) {
  let cycle = await MembershipCycle.findOne({
    memberId,
    status: 'active',
    expiresAt: { $gte: new Date() },
  }).populate('currentPlanId').lean()

  if (!cycle) {
    cycle = await MembershipCycle.findOne({
      memberId,
      status: 'pending_initial_activation',
    }).populate('currentPlanId').lean()
  }

  if (!cycle) {
    return { allowed: false, feature: null, plan: null, reason: 'Không tìm thấy gói tập đang hoạt động' }
  }

  const plan = cycle.currentPlanId
  if (!plan) {
    return { allowed: false, feature: null, plan: null, reason: 'Gói tập không có thông tin Plan' }
  }

  if (plan.featureIds && plan.featureIds.length > 0) {
    const featureIds = plan.featureIds.map(f => (typeof f === 'object' && f._id) ? f._id : f).map(id => id.toString())
    const feature = await PlanFeature.findOne({ code: featureCode }).lean()
    if (!feature) {
      return { allowed: false, feature: null, plan, reason: `Feature '${featureCode}' không tồn tại trong hệ thống` }
    }
    if (featureIds.includes(feature._id.toString())) {
      return { allowed: true, feature, plan, reason: '' }
    }
  }

  return { allowed: false, feature: null, plan, reason: `Gói '${plan.nameVi}' không hỗ trợ tính năng này` }
}

/**
 * Get all features for a member's active plan
 */
export async function getMemberFeatures(memberId) {
  let cycle = await MembershipCycle.findOne({
    memberId,
    status: 'active',
    expiresAt: { $gte: new Date() },
  }).populate({
    path: 'currentPlanId',
    populate: { path: 'featureIds', model: 'PlanFeature' }
  }).lean()

  if (!cycle) {
    cycle = await MembershipCycle.findOne({
      memberId,
      status: 'pending_initial_activation',
    }).populate({
      path: 'currentPlanId',
      populate: { path: 'featureIds', model: 'PlanFeature' }
    }).lean()
  }

  if (!cycle || !cycle.currentPlanId) return []

  return cycle.currentPlanId.featureIds || []
}
