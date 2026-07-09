import {
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
