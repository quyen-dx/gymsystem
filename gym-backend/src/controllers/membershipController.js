import {
  autoCancelPendingPeriod,
  cancelPeriod,
  cancelRegistration,
  cancelRenewal,
  confirmRegistration,
  createMembership as createMembershipService,
  createRenewalCheckoutSession,
  getMyMembership as getMyMembershipService,
  getCancelInfo,
  getMyHistory,
  getMyPeriods,
  getMyRenewals,
  getMembershipDetail,
  getMembershipPeriods,
  handleMembershipStripeWebhook,
  listPayments,
  listRegistrations,
  renewMembershipWithDuration,
  renewMembershipWithWallet,
  subscribeWithWallet,
} from '../services/membershipService.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'
import MembershipCycle from '../models/MembershipCycle.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import PTAssignment from '../models/PTAssignment.js'

const sendServiceError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message })
  }
  return next(error)
}

export const createMembership = async (req, res, next) => {
  try {
    const { planId } = req.body
    if (!planId) {
      return res.status(400).json({ message: 'planId là bắt buộc' })
    }

    const payload = await createMembershipService({ userId: req.user._id, planId })
    const message = payload.mode === 'stripe'
      ? 'Đã tạo phiên thanh toán Stripe'
      : payload.message || 'Đã tạo yêu cầu đăng ký gói tập'
    return res.status(201).json({ message, data: payload })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const subscribeMembership = async (req, res, next) => {
  try {
    const { planId } = req.body
    if (!planId) {
      return res.status(400).json({ message: 'planId là bắt buộc' })
    }

    const payload = await subscribeWithWallet({ userId: req.user._id, planId })
    return res.status(201).json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMyMembership = async (req, res, next) => {
  try {
    const payload = await getMyMembershipService({ userId: req.user._id })
    return res.json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const renewMyMembership = async (req, res, next) => {
  try {
    const payload = await createRenewalCheckoutSession({ userId: req.user._id })
    return res.status(201).json({ message: 'Đã tạo phiên thanh toán gia hạn', data: payload })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const renewMembershipByWallet = async (req, res, next) => {
  try {
    const payload = await renewMembershipWithWallet({ userId: req.user._id })
    return res.status(201).json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const renewMembershipByWalletWithDuration = async (req, res, next) => {
  try {
    const payload = await renewMembershipWithDuration({
      userId: req.user._id,
      durationMultiplier: req.body.durationMultiplier || 1,
    })
    return res.status(201).json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMembershipRegistrations = async (req, res, next) => {
  try {
    const payload = await listRegistrations(req.query)
    return res.json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const confirmMembershipRegistration = async (req, res, next) => {
  try {
    const payload = await confirmRegistration({
      registrationId: req.params.id,
      staffId: req.user._id,
    })
    return res.json({ message: 'Đã xác nhận đăng ký gói tập', ...payload })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const cancelMembershipRegistration = async (req, res, next) => {
  try {
    const registration = await cancelRegistration({
      registrationId: req.params.id,
      staffId: req.user._id,
      reason: req.body?.reason,
    })
    return res.json({ message: 'Đã hủy yêu cầu đăng ký', registration })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMembershipPayments = async (req, res, next) => {
  try {
    const payload = await listPayments(req.query)
    return res.json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMyRenewalsHandler = async (req, res, next) => {
  try {
    const renewals = await getMyRenewals({ userId: req.user._id })
    return res.json({ renewals })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMyPeriodsHandler = async (req, res, next) => {
  try {
    const periods = await getMyPeriods({ userId: req.user._id })
    return res.json({ periods })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getCancelInfoHandler = async (req, res, next) => {
  try {
    const payload = await getCancelInfo({ userId: req.user._id })
    return res.json(payload)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMembershipHistory = async (req, res, next) => {
  try {
    const history = await getMyHistory({ userId: req.user._id })
    return res.json({ history })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMembershipDetailHandler = async (req, res, next) => {
  try {
    const result = await getMembershipDetail({
      userId: req.user._id,
      membershipId: req.params.membershipId,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const getMembershipPeriodsHandler = async (req, res, next) => {
  try {
    const periods = await getMembershipPeriods({
      userId: req.user._id,
      membershipId: req.params.membershipId,
    })
    return res.json({ periods })
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const cancelMyPeriod = async (req, res, next) => {
  try {
    const result = await cancelPeriod({
      userId: req.user._id,
      periodId: req.params.periodId,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const autoCancelMyPeriod = async (req, res, next) => {
  try {
    const result = await autoCancelPendingPeriod({
      userId: req.user._id,
      periodId: req.params.periodId,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const cancelMyRenewal = async (req, res, next) => {
  try {
    const result = await cancelRenewal({
      userId: req.user._id,
      renewalId: req.params.renewalId,
    })
    return res.json(result)
  } catch (error) {
    return sendServiceError(res, error, next)
  }
}

export const stripeMembershipWebhook = async (req, res, next) => {
  try {
    await handleMembershipStripeWebhook({
      rawBody: req.body,
      signature: req.headers['stripe-signature'],
    })
    return res.json({ received: true })
  } catch (error) {
    if (error.type === 'StripeSignatureVerificationError') {
      return res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` })
    }
    return next(error)
  }
}

/**
 * Admin: lấy danh sách hội viên đang chờ xếp lớp PT hoặc PT 1-1
 * (sau khi case 3 hoặc 4 xảy ra: đổi gói nhưng chưa được xếp lớp/PT mới).
 */
export const getPendingPTPlacements = async (req, res) => {
  try {
    const features = await PlanFeature.find({
      code: { $in: ['BOOK_PT_GROUP', 'BOOK_PT_PRIVATE'] },
    }).lean()
    const featureIds = features.map(f => f._id.toString())
    const featureCodeMap = {}
    for (const f of features) featureCodeMap[f._id.toString()] = f.code

    const plans = await Plan.find({ featureIds: { $in: features.map(f => f._id) } }).lean()
    const planIds = plans.map(p => p._id)

    const cycles = await MembershipCycle.find({
      currentPlanId: { $in: planIds },
      status: 'active',
    })
      .populate('memberId', 'name fullName memberCode email phone')
      .populate('currentPlanId')
      .lean()

    const pending = []
    for (const c of cycles) {
      const memberId = c.memberId?._id || c.memberId
      const plan = c.currentPlanId
      if (!plan || !memberId) continue

      const planFeatureObjectIds = (plan.featureIds || []).map(id =>
        typeof id === 'object' ? id._id || id : id
      ).map(id => id.toString())

      const planCodes = planFeatureObjectIds
        .map(id => featureCodeMap[id])
        .filter(Boolean)

      const hasGroup = planCodes.includes('BOOK_PT_GROUP')
      const hasPrivate = planCodes.includes('BOOK_PT_PRIVATE')

      if (hasGroup) {
        const enrollment = await ClassEnrollment.findOne({ memberId, status: 'active' }).lean()
        if (!enrollment) {
          pending.push({
            memberId: m.memberId,
            planName: plan.nameVi,
            missingType: 'group_class',
            label: 'Chờ xếp lớp PT nhóm',
          })
        }
      }

      if (hasPrivate) {
        const assignment = await PTAssignment.findOne({ memberId, status: 'active' }).lean()
        if (!assignment) {
          pending.push({
            memberId: m.memberId,
            planName: plan.nameVi,
            missingType: 'private_pt',
            label: 'Chờ xếp PT 1-1',
          })
        }
      }
    }

    res.json({ items: pending, total: pending.length })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}
