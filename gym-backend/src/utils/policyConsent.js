import Policy from '../models/Policy.js'
import PolicyConsent from '../models/PolicyConsent.js'

export async function validatePolicyConsent(userId, policyTypes) {
  const typeList = Array.isArray(policyTypes) ? policyTypes : [policyTypes]

  const policies = await Policy.find({ type: { $in: typeList }, isPublished: true }).lean()
  const consents = await PolicyConsent.find({
    userId,
    policyType: { $in: typeList },
  }).lean()

  const newestConsentByType = {}
  for (const c of consents) {
    const key = c.policyType
    if (!newestConsentByType[key] || c.policyVersion > newestConsentByType[key].policyVersion) {
      newestConsentByType[key] = c
    }
  }

  for (const type of typeList) {
    const policy = policies.find((p) => p.type === type)
    if (!policy) continue
    const currentVersion = policy.version
    const consent = newestConsentByType[type]
    const acceptedVersion = consent ? consent.policyVersion : null
    if (acceptedVersion !== currentVersion) {
      return false
    }
  }

  return true
}

export async function assertPolicyConsent(userId, policyTypes) {
  const ok = await validatePolicyConsent(userId, policyTypes)
  if (!ok) {
    const error = new Error('Bạn cần đọc và đồng ý phiên bản mới nhất của chính sách trước khi tiếp tục.')
    error.statusCode = 403
    throw error
  }
}
