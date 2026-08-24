import AppError from '../utils/appError.js'

export const PAYOUT_TRANSITIONS = {
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['TRANSFERRED', 'REJECTED'],
  TRANSFERRED: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['TRANSFERRED', 'COMPLETED'],
  COMPLETED: [], REJECTED: [], CANCELLED: [],
}

export const assertPayoutTransition = (from, to) => {
  if (!PAYOUT_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(`Payout request cannot transition from ${from} to ${to}`, 409)
  }
}
