/**
 * Periodic job: activate pending_renewal_activation cycles whose previous cycle has expired.
 *
 * Delegates to MembershipCycleService.activatePendingRenewalCycles().
 * No business logic duplication.
 */
import { activatePendingRenewalCycles } from '../services/membershipCycleService.js'

export async function runActivateRenewalCyclesJob() {
  console.log('[activateRenewalCyclesJob] Starting...')
  const activated = await activatePendingRenewalCycles()
  if (activated.length > 0) {
    console.log(
      `[activateRenewalCyclesJob] Activated ${activated.length} renewal cycles:`,
      activated.map((id) => id.toString()),
    )
  } else {
    console.log('[activateRenewalCyclesJob] No renewal cycles to activate.')
  }
  console.log('[activateRenewalCyclesJob] Done.')
}
