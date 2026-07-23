import mongoose from 'mongoose'
import { getWalletByUser } from '../../services/walletService.js'
import { getMembershipInfo, getMyMembership } from '../../services/membershipService.js'
import { getUpcomingBookings } from '../../services/bookingService.js'
import { countUnread } from '../../services/notificationService.js'

export const SUPPORTED_INTENTS = [
  'wallet_balance',
  'membership_status',
  'membership_expiry',
  'upcoming_booking',
  'unread_notifications',
]

export const DATABASE_QUERY_DECLARATION = {
  name: 'databaseQuery',
  description: 'Truy vấn dữ liệu CÁ NHÂN từ database GymPro. CHỈ gọi khi câu hỏi có "của tôi" hoặc "của em" (vd: gói của tôi, ví của tôi, lịch PT của tôi). KHÔNG gọi cho câu hỏi chung chung.',
  parameters: {
    type: 'OBJECT',
    properties: {
      intent: {
        type: 'STRING',
        description: 'Tên intent cần truy vấn: wallet_balance, membership_status, membership_expiry, upcoming_booking, unread_notifications',
        enum: SUPPORTED_INTENTS,
      },
    },
    required: ['intent'],
  },
}

function determineStatus(membershipInfo, myMembership) {
  const cycle = myMembership?.cycle
  const cycleStatus = cycle?.status

  if (!cycleStatus) {
    if (membershipInfo.cancelRequests?.length > 0) return 'CANCELLED'
    if (membershipInfo.completedMemberships?.length > 0) return 'EXPIRED'
    return 'NONE'
  }

  if (cycleStatus === 'active') {
    const hasPendingRenewals =
      membershipInfo.pendingRenewals?.length > 0 ||
      myMembership.pendingCycles?.length > 0
    if (hasPendingRenewals) return 'RENEWING'
    return 'ACTIVE'
  }

  if (cycleStatus === 'pending_initial_activation') return 'PENDING'
  if (cycleStatus === 'pending_renewal_activation') return 'PENDING'

  return 'NONE'
}

export async function databaseQuery(intent, user) {
  if (mongoose.connection.readyState !== 1) {
    return { error: 'INTERNAL_ERROR' }
  }

  try {
    switch (intent) {
      case 'wallet_balance': {
        const wallet = await getWalletByUser(user._id)
        if (!wallet) return { error: 'NO_DATA' }
        return { balance: wallet.balance }
      }
      case 'membership_status': {
        const [info, myMembership] = await Promise.all([
          getMembershipInfo({ userId: user._id }),
          getMyMembership({ userId: user._id }),
        ])
        const statusType = determineStatus(info, myMembership)
        return {
          statusType,
          currentMembership: info.currentMembership,
          pendingRenewals: info.pendingRenewals,
        }
      }
      case 'membership_expiry': {
        const [info, myMembership] = await Promise.all([
          getMembershipInfo({ userId: user._id }),
          getMyMembership({ userId: user._id }),
        ])
        const statusType = determineStatus(info, myMembership)
        if (statusType === 'ACTIVE' || statusType === 'RENEWING') {
          return {
            statusType,
            endDate: info.currentMembership.endDate,
            remainingDays: info.currentMembership.remainingDays,
            planName: info.currentMembership.planName,
          }
        }
        return { statusType, error: 'NO_ACTIVE_MEMBERSHIP' }
      }
      case 'upcoming_booking': {
        const result = await getUpcomingBookings({ userId: user._id })
        return {
          count: result.count,
          bookings: result.bookings.map((b) => ({
            id: b.id,
            ptName: b.ptName,
            date: b.date,
            slot: b.slot,
            status: b.status,
          })),
        }
      }
      case 'unread_notifications': {
        const count = await countUnread(user._id, user.role)
        return { count }
      }
      default:
        return { error: 'UNSUPPORTED_INTENT' }
    }
  } catch (err) {
    console.error(`[AI][databaseQuery] ${intent} error:`, err.message)
    return { error: 'INTERNAL_ERROR' }
  }
}
