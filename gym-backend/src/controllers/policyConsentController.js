import Policy from '../models/Policy.js'
import PolicyConsent from '../models/PolicyConsent.js'

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || '127.0.0.1'
}

export const getConsentStatus = async (req, res, next) => {
  try {
    const { types, context } = req.query
    if (!types) {
      return res.status(400).json({ message: 'types query param is required (comma-separated)' })
    }
    const typeList = String(types).split(',').map((t) => t.trim()).filter(Boolean)

    const policies = await Policy.find({ type: { $in: typeList }, isPublished: true }).lean()

    const consentFilter = {
      userId: req.user._id,
      policyType: { $in: typeList },
    }
    if (context) {
      consentFilter.$or = [{ context }, { context: '' }]
    }
    const consents = await PolicyConsent.find(consentFilter).lean()

    const consentMap = {}
    for (const c of consents) {
      const key = c.policyType
      const existing = consentMap[key]
      if (!existing) {
        consentMap[key] = c
        continue
      }
      if (c.policyVersion > existing.policyVersion) {
        consentMap[key] = c
        continue
      }
      if (c.policyVersion === existing.policyVersion && context && c.context === context && existing.context !== context) {
        consentMap[key] = c
      }
    }

    const result = {}
    for (const type of typeList) {
      const policy = policies.find((p) => p.type === type)
      const currentVersion = policy ? policy.version : ''
      const consent = consentMap[type]
      const acceptedVersion = consent ? consent.policyVersion : null
      result[type] = {
        currentVersion,
        acceptedVersion,
        acceptedContext: consent ? (consent.context || '') : '',
        accepted: !!currentVersion && acceptedVersion === currentVersion,
      }
    }

    return res.json(result)
  } catch (error) {
    next(error)
  }
}

export const acceptConsent = async (req, res, next) => {
  try {
    const { policyType, policyVersion, policyId, context } = req.body

    if (!policyType || !policyVersion) {
      return res.status(400).json({ message: 'policyType and policyVersion are required' })
    }

    const validTypes = ['payment', 'refund', 'membership', 'wallet', 'terms']
    if (!validTypes.includes(policyType)) {
      return res.status(400).json({ message: `Invalid policyType. Must be one of: ${validTypes.join(', ')}` })
    }

    const existing = await PolicyConsent.findOne({
      userId: req.user._id,
      policyType,
      policyVersion,
      context: context || '',
    })

    if (existing) {
      return res.json({ message: 'Consent already recorded', consent: existing })
    }

    const consent = await PolicyConsent.create({
      userId: req.user._id,
      policyType,
      policyVersion,
      policyId: policyId || null,
      context: context || '',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      acceptedAt: new Date(),
    })

    return res.status(201).json({ message: 'Consent recorded successfully', consent })
  } catch (error) {
    next(error)
  }
}

export const acceptMultipleConsent = async (req, res, next) => {
  try {
    const { policies } = req.body
    if (!Array.isArray(policies) || policies.length === 0) {
      return res.status(400).json({ message: 'policies array is required' })
    }

    const validTypes = ['payment', 'refund', 'membership', 'wallet', 'terms']
    const results = []

    for (const item of policies) {
      const { policyType, policyVersion, policyId, context } = item
      if (!policyType || !policyVersion) continue
      if (!validTypes.includes(policyType)) continue

      const existing = await PolicyConsent.findOne({
        userId: req.user._id,
        policyType,
        policyVersion,
        context: context || '',
      })

      if (existing) {
        results.push({ policyType, policyVersion, status: 'already_exists', consent: existing })
        continue
      }

      const consent = await PolicyConsent.create({
        userId: req.user._id,
        policyType,
        policyVersion,
        policyId: policyId || null,
        context: context || '',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        acceptedAt: new Date(),
      })
      results.push({ policyType, policyVersion, status: 'created', consent })
    }

    return res.status(201).json({ message: 'Consents recorded', results })
  } catch (error) {
    next(error)
  }
}
