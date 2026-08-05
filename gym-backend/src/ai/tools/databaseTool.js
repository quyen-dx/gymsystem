import mongoose from 'mongoose'
import { getWalletByUser } from '../../services/walletService.js'
import { getMembershipInfo, getMyMembership } from '../../services/membershipService.js'
import { getUpcomingBookings } from '../../services/bookingService.js'
import { countUnread } from '../../services/notificationService.js'
import Plan from '../../models/Plan.js'
import PTAssignment from '../../models/PTAssignment.js'
import MembershipCycle from '../../models/MembershipCycle.js'

export const SUPPORTED_INTENTS = [
  'wallet_balance',
  'membership_status',
  'membership_expiry',
  'membership_summary',
  'upcoming_booking',
  'unread_notifications',
  'list_plans',
  'plan_detail',
  'my_pt',
]

export const DATABASE_QUERY_DECLARATION = {
  name: 'databaseQuery',
  description: 'Truy vấn dữ liệu từ database GymPro. Dùng cho: (1) Dữ liệu CÁ NHÂN có "của tôi"/"của em", (2) Danh sách gói tập GymPro, (3) Chi tiết một gói tập, (4) PT CỦA TÔI, (5) Tổng quan membership.',
  parameters: {
    type: 'OBJECT',
    properties: {
      intent: {
        type: 'STRING',
        description: 'Tên intent: wallet_balance | membership_status | membership_expiry | membership_summary | upcoming_booking | unread_notifications | list_plans | plan_detail | my_pt',
        enum: SUPPORTED_INTENTS,
      },
      planId: {
        type: 'STRING',
        description: 'ObjectId của gói tập. CHỈ dùng với intent plan_detail. Có thể lấy từ kết quả list_plans trước đó.',
      },
      planName: {
        type: 'STRING',
        description: 'Tên gói tập (nameVi). Dùng thay cho planId nếu biết tên gói. CHỈ dùng với intent plan_detail.',
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

  if (cycleStatus === 'active') return 'ACTIVE'

  return 'NONE'
}

function calculateRemainingDays(endDate) {
  if (!endDate) return 0
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000))
}

export async function databaseQuery(intent, user, args = {}) {
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
        if (statusType === 'ACTIVE') {
          return {
            statusType,
            endDate: info.currentMembership.endDate,
            remainingDays: info.currentMembership.remainingDays,
            planName: info.currentMembership.planName,
          }
        }
        return { statusType, error: 'NO_ACTIVE_MEMBERSHIP' }
      }
      case 'membership_summary': {
        const [info, myMembership] = await Promise.all([
          getMembershipInfo({ userId: user._id }),
          getMyMembership({ userId: user._id }),
        ])
        const statusType = determineStatus(info, myMembership)
        const cycle = myMembership?.cycle
        const membership = myMembership?.membership

        // Current plan details with features
        let planFeatures = []
        let planPrice = 0
        let planDurationDays = 0
        if (cycle?.currentPlanId) {
          const plan = await Plan.findById(cycle.currentPlanId)
            .populate('featureIds', 'code name description')
            .lean()
          if (plan) {
            planPrice = plan.price
            planDurationDays = plan.durationDays
            planFeatures = (plan.featureIds || []).map(f => ({
              code: f.code,
              name: f.name,
              description: f.description || '',
            }))
          }
        }

        const remainingDays = info.currentMembership?.remainingDays || 0
        const totalDays = cycle?.durationDays || planDurationDays || 0
        const usedDays = Math.max(0, totalDays - remainingDays)
        const usedPercent = totalDays > 0
          ? Math.min(100, Math.round((usedDays / totalDays) * 100))
          : 0

        // Past cycles history
        const allPastCycles = await MembershipCycle.find({
          memberId: user._id,
          status: { $ne: 'active' },
        })
          .populate('currentPlanId', 'nameVi nameEn price durationDays')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()

        const history = allPastCycles.map(c => ({
          planName: c.currentPlanId?.nameVi || c.currentPlanId?.nameEn || '',
          status: c.status,
          startDate: c.startDate,
          endDate: c.expiresAt,
          price: c.currentPlanId?.price || 0,
          refunded: c.status === 'refunded',
        }))

        // Refund eligibility
        const refund = myMembership?.refundInfo
          ? {
              eligible: myMembership.refundInfo.eligible || false,
              deadline: myMembership.refundInfo.deadline || null,
              reason: myMembership.refundInfo.reason || null,
              refundAmount: myMembership.refundInfo.amount || 0,
            }
          : null

        // PT assignment
        const ptAssignment = await PTAssignment.findOne({
          memberId: user._id,
          status: 'active',
        })
          .populate('ptId', 'name fullName')
          .lean()

        return {
          statusType,
          currentMembership: info.currentMembership
            ? {
                planName: info.currentMembership.planName,
                price: planPrice,
                durationDays: planDurationDays,
                status: 'ACTIVE',
                startDate: info.currentMembership.startDate,
                endDate: info.currentMembership.endDate,
                remainingDays,
                usedPercent,
                features: planFeatures,
                canRenew: myMembership?.canRenew || false,
              }
            : null,
          renewals: (info.pendingRenewals || []).map((r, i) => ({
            index: i + 1,
            planName: r.planName,
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status,
          })),
          renewalCount: (info.pendingRenewals || []).length,
          refund,
          history,
          totalPastCycles: allPastCycles.length,
          pendingCancel: myMembership?.pendingCancelRequest || null,
          hasPT: !!ptAssignment,
          ptName: ptAssignment?.ptId?.fullName || ptAssignment?.ptId?.name || null,
        }
      }
      case 'list_plans': {
        const plans = await Plan.find({ isActive: true })
          .populate('featureIds', 'code name description')
          .sort({ price: 1 })
          .lean()
        if (!plans.length) return { error: 'NO_DATA', plans: [] }
        return {
          plans: plans.map((p) => ({
            id: p._id,
            nameVi: p.nameVi,
            price: p.price,
            durationDays: p.durationDays,
            description: p.descriptionVi || '',
            features: (p.featureIds || []).map((f) => ({
              code: f.code,
              name: f.name,
              description: f.description || '',
            })),
          })),
        }
      }
      case 'plan_detail': {
        let plan
        const planId = args.planId
        const planName = args.planName
        if (planId && mongoose.Types.ObjectId.isValid(planId)) {
          plan = await Plan.findOne({ _id: planId, isActive: true })
        } else if (planName) {
          plan = await Plan.findOne({ nameVi: { $regex: planName, $options: 'i' }, isActive: true })
        }
        if (!plan) return { error: 'NO_DATA' }
        plan = await Plan.populate(plan, { path: 'featureIds', select: 'code name description' })
        return {
          id: plan._id,
          nameVi: plan.nameVi,
          price: plan.price,
          durationDays: plan.durationDays,
          description: plan.descriptionVi || '',
          features: (plan.featureIds || []).map((f) => ({
            code: f.code,
            name: f.name,
            description: f.description || '',
          })),
        }
      }
      case 'my_pt': {
        const assignment = await PTAssignment.findOne({ memberId: user._id, status: 'active' })
          .populate('ptId', 'name fullName')
          .lean()
        if (!assignment) return { hasPT: false }
        return {
          hasPT: true,
          ptName: assignment.ptId?.fullName || assignment.ptId?.name || '',
          assignedAt: assignment.startDate || assignment.createdAt,
        }
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
