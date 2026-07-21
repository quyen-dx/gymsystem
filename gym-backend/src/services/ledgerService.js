import LedgerEntry from '../models/LedgerEntry.js'

export const createLedgerPair = async ({ transactionId, amount, debitAccount, creditAccount, description, session }) => {
  const entries = [
    {
      transactionId,
      direction: 'debit',
      amount,
      account: debitAccount,
      counterpartyAccount: creditAccount,
      description,
    },
    {
      transactionId,
      direction: 'credit',
      amount,
      account: creditAccount,
      counterpartyAccount: debitAccount,
      description,
    },
  ]

  const opts = session ? { session } : {}
  await LedgerEntry.create(entries, opts)

  return entries
}

export const createLedgerEntry = async ({ transactionId, direction, amount, account, counterpartyAccount, description, session }) => {
  const opts = session ? { session } : {}
  return LedgerEntry.create([{ transactionId, direction, amount, account, counterpartyAccount, description }], opts)
}

export const getLedgerEntries = async (filter = {}) => {
  return LedgerEntry.find(filter).sort({ createdAt: -1 })
}
