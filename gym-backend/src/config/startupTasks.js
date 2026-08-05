import Policy from '../models/Policy.js'
import Faq from '../models/Faq.js'
import PolicyConsent from '../models/PolicyConsent.js'

export const syncPolicyConsentIndexes = async () => {
  // migrate old unique index (userId,policyType,policyVersion) → (userId,policyType,policyVersion,context)
  await PolicyConsent.syncIndexes()
}

export const runPolicyMigration = async () => {
  await Policy.migrateLegacy()
}

export const runFaqMigration = async () => {
  await Faq.migrateLegacy()
}

export const runStartupTasks = async () => {
  try {
    await syncPolicyConsentIndexes()
  } catch (err) {
    console.error('Failed to sync PolicyConsent indexes:', err.message)
  }

  try {
    await runPolicyMigration()
  } catch (err) {
    console.error('Policy migration error:', err.message)
  }

  try {
    await runFaqMigration()
  } catch (err) {
    console.error('FAQ migration error:', err.message)
  }
}
