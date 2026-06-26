import { systemExperienceService } from '../services/systemExperienceService'

export type PolicyConsentType = 'deposit' | 'membership' | 'refund'

const viewedKey = (type: PolicyConsentType) => `${type}PolicyViewed`
const viewedAtKey = (type: PolicyConsentType) => `${type}PolicyViewedAt`

export const hasViewedPolicy = (type: PolicyConsentType) => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(viewedKey(type)) === 'true'
}

export const markPolicyViewed = (type: PolicyConsentType) => {
  if (typeof window === 'undefined') return
  const now = String(Date.now())
  window.localStorage.setItem(viewedKey(type), 'true')
  window.localStorage.setItem(viewedAtKey(type), now)
  window.sessionStorage.setItem(viewedKey(type), 'true')
  window.sessionStorage.setItem(viewedAtKey(type), now)
}

export async function checkConsentStatus(types: string[]): Promise<Record<string, { currentVersion: string; acceptedVersion: string | null; accepted: boolean }>> {
  try {
    const res = await systemExperienceService.getConsentStatus(types.join(','))
    return res.data
  } catch {
    return {}
  }
}

export async function acceptPolicyConsent(policyType: string, policyVersion: string, policyId?: string) {
  const res = await systemExperienceService.acceptConsent({ policyType, policyVersion, policyId })
  return res.data
}

export async function acceptMultiplePolicyConsent(policies: Array<{ policyType: string; policyVersion: string; policyId?: string; context?: string }>) {
  const res = await systemExperienceService.acceptMultipleConsent({ policies })
  return res.data
}
