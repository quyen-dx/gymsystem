import Membership from '../models/Membership.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'

/**
 * Check if a member has a specific feature in their active plan
 * Returns { allowed: boolean, feature: object|null, plan: object|null, reason: string }
 */
export async function checkMemberFeature(memberId, featureCode) {
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel'] },
    endDate: { $gte: new Date() },
  }).populate('planId').lean()

  if (!membership) {
    return { allowed: false, feature: null, plan: null, reason: 'Không tìm thấy gói tập đang hoạt động' }
  }

  const plan = membership.planId
  if (!plan) {
    return { allowed: false, feature: null, plan: null, reason: 'Gói tập không có thông tin Plan' }
  }

  // Check via featureIds first (new)
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

  // Fallback: match by featuresVi strings against PlanFeature names
  const allFeatures = await PlanFeature.find({}).lean()
  const featuresVi = plan.featuresVi || []
  for (const f of allFeatures) {
    if (f.code === featureCode && featuresVi.some(v => v.toLowerCase().includes(f.name.toLowerCase()))) {
      return { allowed: true, feature: f, plan, reason: '' }
    }
  }

  return { allowed: false, feature: null, plan, reason: `Gói '${plan.nameVi}' không hỗ trợ tính năng này` }
}

/**
 * Get all features for a member's active plan
 */
export async function getMemberFeatures(memberId) {
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel'] },
    endDate: { $gte: new Date() },
  }).populate({
    path: 'planId',
    populate: { path: 'featureIds', model: 'PlanFeature' }
  }).lean()

  if (!membership || !membership.planId) return []

  const plan = membership.planId
  if (plan.featureIds && plan.featureIds.length > 0) {
    return plan.featureIds
  }

  // Fallback legacy
  return plan.featuresVi || []
}
