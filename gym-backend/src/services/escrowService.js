import mongoose from 'mongoose'
import { applyWalletTransaction, getOrCreateWallet } from './walletService.js'
import AppError from '../utils/appError.js'

export const holdEscrow = async ({ sellerId, orderId, amount, session }) => {
  if (amount <= 0) return null

  const wallet = await getOrCreateWallet(sellerId, session)

  if (wallet.balance < amount) {
    throw new AppError('Số dư ví của người bán không đủ để giữ ký quỹ', 400)
  }

  return applyWalletTransaction({
    userId: sellerId,
    amount: -amount,
    type: 'payout',
    provider: 'marketplace',
    referenceId: `escrow_hold_${orderId}`,
    status: 'completed',
    metadata: { orderId, action: 'hold_escrow' },
    idempotencyKey: `escrow_hold_${orderId}_${Date.now()}`,
    session,
  })
}

export const releaseEscrow = async ({ sellerId, orderId, amount, session }) => {
  if (amount <= 0) return null

  return applyWalletTransaction({
    userId: sellerId,
    amount,
    type: 'payout',
    provider: 'marketplace',
    referenceId: `escrow_release_${orderId}`,
    status: 'completed',
    metadata: { orderId, action: 'release_escrow' },
    idempotencyKey: `escrow_release_${orderId}_${Date.now()}`,
    session,
  })
}

export const recaptureEscrow = async ({ sellerId, orderId, amount, session }) => {
  if (amount <= 0) return null

  return applyWalletTransaction({
    userId: sellerId,
    amount: -amount,
    type: 'payout',
    provider: 'marketplace',
    referenceId: `escrow_recapture_${orderId}`,
    status: 'completed',
    metadata: { orderId, action: 'recapture_escrow' },
    idempotencyKey: `escrow_recapture_${orderId}_${Date.now()}`,
    session,
  })
}

export const settleStaleEscrow = async (order) => {
  if (!order || order.escrowReleased || order.sellerEscrowAmount <= 0) return null

  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const shop = await mongoose.model('Shop').findById(order.shopId).session(session).lean()
    const sellerId = shop?.user_id
    if (!sellerId) {
      await session.abortTransaction()
      return null
    }

    await getOrCreateWallet(sellerId, session)
    await applyWalletTransaction({
      userId: sellerId,
      amount: order.sellerEscrowAmount,
      type: 'payout',
      provider: 'marketplace',
      referenceId: `escrow_settle_${order._id}`,
      status: 'completed',
      metadata: { orderId: order._id, action: 'settle_stale_escrow' },
      idempotencyKey: `escrow_settle_${order._id}_${Date.now()}`,
      session,
    })

    await mongoose.model('Order').updateOne(
      { _id: order._id },
      { $set: { escrowReleased: true } },
      { session },
    )

    await session.commitTransaction()
    return { settled: true }
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}
