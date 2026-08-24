import {
  autoCancelStalePayoutRequests,
  autoConfirmDuePayouts,
  sendStalePayoutAdminReminders,
} from '../services/payoutRequestService.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
export const runPayoutAutoConfirmation = async () => {
  const [reminded, cancelled, completed] = await Promise.all([
    sendStalePayoutAdminReminders(),
    autoCancelStalePayoutRequests(),
    autoConfirmDuePayouts(),
  ])
  return { reminded, cancelled, completed }
}
export const startPayoutAutoConfirmationJob = () => {
  runPayoutAutoConfirmation().catch((error) => console.error('[payoutAutoConfirmation] Startup error:', error.message))
  return setInterval(() => runPayoutAutoConfirmation().catch((error) => console.error('[payoutAutoConfirmation] Error:', error.message)), CHECK_INTERVAL_MS)
}
