import { runDailyReconciliation } from '../services/reconciliationService.js'

export const runReconciliationJob = async () => {
    try {
        const result = await runDailyReconciliation()
        if (result.discrepancies > 0) {
            console.warn(`reconciliationJob: ${result.discrepancies} discrepancies found for ${result.date.toISOString().slice(0, 10)}`)
        }
        return result
    } catch (error) {
        console.error('reconciliationJob failed:', error.message)
    }
}
