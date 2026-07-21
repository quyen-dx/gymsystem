import { runArchiveRetention } from '../services/archiveRetentionService.js'

export const runArchiveJob = async () => {
    try {
        const result = await runArchiveRetention()
        if (result.transactions > 0 || result.ledgerEntries > 0) {
            console.log(`archiveJob: archived ${result.transactions} transactions, ${result.ledgerEntries} ledger entries`)
        }
        return result
    } catch (error) {
        console.error('archiveJob failed:', error.message)
    }
}
