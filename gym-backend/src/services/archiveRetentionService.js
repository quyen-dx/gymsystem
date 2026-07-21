import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Transaction from '../models/Transaction.js'
import LedgerEntry from '../models/LedgerEntry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RETENTION_YEARS = 5
const BATCH_SIZE = 1000

const getArchiveDir = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const archivePath = path.resolve(__dirname, '..', '..', 'storage', 'archive', `${yyyy}-${mm}`)
    if (!fs.existsSync(archivePath)) {
        fs.mkdirSync(archivePath, { recursive: true })
    }
    return archivePath
}

const isMonthArchived = (archiveDir, label) => {
    return fs.existsSync(path.join(archiveDir, `.archived-${label}`))
}

const markMonthArchived = (archiveDir, label) => {
    fs.writeFileSync(path.join(archiveDir, `.archived-${label}`), new Date().toISOString(), 'utf-8')
}

export const archiveTransactions = async () => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS)

    const archiveDir = getArchiveDir(cutoff)

    if (isMonthArchived(archiveDir, 'transactions')) {
        return { archived: 0, file: null, skipped: true }
    }

    const count = await Transaction.countDocuments({ createdAt: { $lt: cutoff } })
    if (count === 0) return { archived: 0, file: null }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.join(archiveDir, `transactions-${timestamp}.json`)

    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' })
    writeStream.write('[')

    let first = true
    let totalExported = 0

    const cursor = Transaction.find({ createdAt: { $lt: cutoff } }).lean().cursor()

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        if (!first) writeStream.write(',')
        writeStream.write(JSON.stringify(doc))
        first = false
        totalExported++
    }

    writeStream.write(']')
    writeStream.end()

    markMonthArchived(archiveDir, 'transactions')

    return { archived: totalExported, file: filePath }
}

export const archiveLedgerEntries = async () => {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS)

    const archiveDir = getArchiveDir(cutoff)

    if (isMonthArchived(archiveDir, 'ledger')) {
        return { archived: 0, file: null, skipped: true }
    }

    const count = await LedgerEntry.countDocuments({ createdAt: { $lt: cutoff } })
    if (count === 0) return { archived: 0, file: null }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = path.join(archiveDir, `ledger-entries-${timestamp}.json`)

    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' })
    writeStream.write('[')

    let first = true
    let totalExported = 0

    const cursor = LedgerEntry.find({ createdAt: { $lt: cutoff } }).lean().cursor()

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        if (!first) writeStream.write(',')
        writeStream.write(JSON.stringify(doc))
        first = false
        totalExported++
    }

    writeStream.write(']')
    writeStream.end()

    markMonthArchived(archiveDir, 'ledger')

    return { archived: totalExported, file: filePath }
}

export const runArchiveRetention = async () => {
    const txnResult = await archiveTransactions()
    const ledgerResult = await archiveLedgerEntries()
    return {
        transactions: txnResult.archived,
        ledgerEntries: ledgerResult.archived,
        files: [txnResult.file, ledgerResult.file].filter(Boolean),
    }
}
