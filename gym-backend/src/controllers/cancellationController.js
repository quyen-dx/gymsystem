import mongoose from 'mongoose';
import MembershipCancellationRequest from '../models/MembershipCancellationRequest.js';
import Membership from '../models/Membership.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import CheckIn from '../models/CheckIn.js';
import Booking from '../models/Booking.js';
import { recordUserActivity } from '../services/userActivityService.js';
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js';
import { assertPolicyConsent } from '../utils/policyConsent.js';
import MembershipCycle from '../models/MembershipCycle.js';
import MembershipPeriod from '../models/MembershipPeriod.js';
import PlanChangeHistory from '../models/PlanChangeHistory.js';
import ClassEnrollment from '../models/ClassEnrollment.js';
import PTAssignment from '../models/PTAssignment.js';
import { NOTIFICATION_TYPES } from '../models/Notification.js';
import { createNotification } from '../services/notificationService.js';
import { emitRefundRequestUpdate } from '../services/socketService.js';
import { sendRefundRequestSubmittedEmail, sendRefundRequestProcessedEmail } from '../services/emailService.js';
import { computeRefundEligibility, hasUsedMembershipBenefits, cleanupMemberPTData } from '../services/membershipService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REFUND_WINDOW_DAYS = 7;

export const createCancellationRequest = async (req, res, next) => {
  try {
    await assertPolicyConsent(req.user._id, ['refund', 'membership'])

    const memberId = req.user._id;
    const { reason, policyAccepted } = req.body;

    if (!policyAccepted) {
      return res.status(400).json({ message: 'Vui lòng xác nhận đã đọc chính sách hoàn tiền.' });
    }

    const existingPending = await MembershipCancellationRequest.findOne({
      memberId, status: 'pending',
    })
    if (existingPending) {
      return res.status(400).json({ message: 'Bạn đã có yêu cầu hủy gói đang chờ xử lý.' });
    }

    // Tìm cycle đang hoạt động để hủy (kích hoạt ngay sau thanh toán nên chỉ có active)
    const cycle = await MembershipCycle.findOne({
      memberId, status: 'active',
    }).sort({ createdAt: -1 }).lean()

    if (!cycle) {
      return res.status(400).json({ message: 'Không tìm thấy gói tập để hủy.' });
    }

    const membership = cycle.currentMembershipId
      ? await Membership.findById(cycle.currentMembershipId).populate('planId')
      : null

    const plan = membership?.planId || (cycle.currentPlanId
      ? await Plan.findById(cycle.currentPlanId).lean()
      : null)

    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin gói tập.' });
    }

    // === Refund eligibility gói chính: hasUsedBenefit + registeredAt (7 ngày kể từ ngày đăng ký) ===
    const mainRefund = await computeRefundEligibility({ memberId, cycle })
    const mainRefundEligible = mainRefund.eligible
    const mainRefundAmount = mainRefundEligible ? (plan.price || 0) : 0
    const policyCode = mainRefundEligible ? 'REFUND_100' : 'NO_REFUND'
    const policyLabel = mainRefundEligible
      ? 'Bạn chưa sử dụng quyền lợi nào của gói và còn trong 7 ngày kể từ ngày đăng ký nên được hoàn 100% gói chính.'
      : mainRefund.reason
    const refundRate = mainRefundEligible ? 1 : 0

    // --- Các lần gia hạn ---
    const allPeriods = cycle.currentMembershipId
      ? await MembershipPeriod.find({ membershipId: cycle.currentMembershipId })
          .sort({ startDate: 1 })
          .lean()
      : []

    // Chỉ lấy các renewal còn hiệu lực (chưa hủy/chưa hoàn)
    const renewalPeriods = allPeriods.slice(1).filter(p =>
      p.status === 'PENDING' && p.refundStatus !== 'refunded'
    )
    const renewalRefunds = []
    let renewalsRefundTotal = 0
    const now = Date.now()

    for (const p of renewalPeriods) {
      const start = new Date(p.startDate).getTime()
      const periodRefund = now < start ? (p.price || 0) : 0
      if (periodRefund > 0) {
        renewalRefunds.push({
          periodId: p._id,
          price: p.price || 0,
          refundAmount: periodRefund,
        })
        renewalsRefundTotal += periodRefund
      }
    }

    const estimatedRefundAmount = mainRefundAmount + renewalsRefundTotal
    const refundEligible = mainRefundEligible || renewalsRefundTotal > 0

    let determinedRefundMethod = 'NONE';
    let determinedRefundStatus = 'NOT_APPLICABLE';
    if (refundEligible && estimatedRefundAmount > 0) {
      determinedRefundMethod = 'WALLET';
      determinedRefundStatus = 'PENDING';
    }

    const session = await mongoose.startSession();
    let cancellationRequest;

    try {
      session.startTransaction();

      [cancellationRequest] = await MembershipCancellationRequest.create([{
        memberId,
        membershipId: membership?._id || null,
        membershipCycleId: cycle._id,
        planId: plan._id,
        reason: String(reason || '').trim(),
        usedDays: 0,
        remainingDays: 0,
        totalDays: cycle.durationDays || 0,
        usedPercent: 0,
        policyCode,
        policyLabel,
        refundRate,
        registeredAt: mainRefund.registeredAt || cycle.purchasedAt || new Date(),
        requestedAt: new Date(),
        policyAccepted: true,
        policyAcceptedAt: new Date(),
        refundEligible,
        estimatedRefundAmount,
        renewalRefunds,
        finalRefundAmount: 0,
        status: 'pending',
        refundMethod: determinedRefundMethod,
        refundStatus: determinedRefundStatus,
      }], { session });

      await recordUserActivity({
        userId: memberId,
        type: 'membership',
        title: 'Yêu cầu hủy gói tập',
        description: `Yêu cầu hủy gói "${plan.nameVi || plan.nameEn}" - ${policyLabel}`,
        metadata: {
          cancellationRequestId: cancellationRequest._id,
          membershipId: membership?._id,
          planId: plan._id,
          policyCode,
          estimatedRefundAmount,
        },
        session,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // Notify staff + update badge
    emitRefundRequestUpdate().catch(() => {})
    createNotification({
      receiverId: null,
      receiverRole: 'staff',
      notificationType: NOTIFICATION_TYPES.REFUND_REMINDER,
      title: 'Yêu cầu hủy gói tập mới',
      content: `Hội viên ${req.user.fullName || req.user.name || ''} yêu cầu hủy gói "${plan.nameVi || plan.nameEn}".`,
      relatedId: cancellationRequest._id,
      relatedType: 'MembershipCancellationRequest',
      redirectUrl: '/staff/payments',
      createdBy: 'System',
    }).catch(() => {})

    const planName = plan.nameVi || plan.nameEn || ''
    if (req.user.email) {
      const sd = cycle.startDate || cycle.purchasedAt || cycle.createdAt
      const ed = cycle.expiresAt
      const periodDetail = sd && ed
        ? `Gói: ${planName} (${new Date(sd).toLocaleDateString('vi-VN')} → ${new Date(ed).toLocaleDateString('vi-VN')})`
        : `Gói: ${planName}`
      sendRefundRequestSubmittedEmail({
        toEmail: req.user.email,
        userName: req.user.fullName || req.user.name || req.user.email,
        planName,
        periodDetail,
        isFullCancel: true,
      }).catch((e) => console.error('Gửi email yêu cầu hủy gói thất bại:', e.message))
    }

    return res.status(201).json({
      message: 'Đã gửi yêu cầu hủy gói. Staff sẽ kiểm tra và phản hồi.',
      cancellationRequest,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyCancellationRequest = async (req, res, next) => {
  try {
    const memberId = req.user._id;
    const requests = await MembershipCancellationRequest.find({ memberId })
      .populate('planId', 'nameVi nameEn price durationDays')
      .populate('membershipId', 'status')
      .sort({ createdAt: -1 });
    return res.json({ cancellationRequests: requests });
  } catch (error) {
    next(error);
  }
};

export const listCancellationRequests = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      refundFilter,
      fromDate,
      toDate,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;

    if (refundFilter === 'eligible') filter.refundEligible = true;
    else if (refundFilter === 'not-eligible') filter.refundEligible = false;

    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    }

    if (search) {
      const keyword = String(search).trim();
      const matchingUsers = await User.find({
        $or: [
          { fullName: { $regex: keyword, $options: 'i' } },
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
          { memberCode: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').lean();

      const matchingPlans = await Plan.find({
        $or: [
          { nameVi: { $regex: keyword, $options: 'i' } },
          { nameEn: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').lean();

      const userIds = matchingUsers.map((u) => u._id);
      const planIds = matchingPlans.map((p) => p._id);
      const orConditions = [];
      if (userIds.length) orConditions.push({ memberId: { $in: userIds } });
      if (planIds.length) orConditions.push({ planId: { $in: planIds } });
      if (orConditions.length) filter.$or = orConditions;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      MembershipCancellationRequest.find(filter)
        .populate('memberId', 'name fullName email phone memberCode memberNumber avatar')
        .populate('planId', 'nameVi nameEn price durationDays')
        .populate('membershipId', 'status')
        .populate('handledBy', 'name fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      MembershipCancellationRequest.countDocuments(filter),
    ]);

    const enhancedItems = await Promise.all(items.map(async (item) => {
      try {
        const raw = item.toObject ? item.toObject() : item;
        const memberDoc = raw.memberId;
        const memberObjId = memberDoc?._id;
        raw.memberId = normalizeUserMemberIdentity(memberDoc);

        let activePT = null, activeClass = null;
        if (memberObjId) {
          const [enrollment, assignment] = await Promise.all([
            ClassEnrollment.findOne({ memberId: memberObjId, status: 'active' })
              .populate('classId', 'code name').lean(),
            PTAssignment.findOne({ memberId: memberObjId, status: 'active' })
              .populate('ptId', 'name fullName').lean(),
          ]);
          if (enrollment) {
            activeClass = {
              className: enrollment.classId ? `[${enrollment.classId.code}] ${enrollment.classId.name}` : '',
              enrollmentId: enrollment._id,
            };
          }
          if (assignment) {
            activePT = {
              ptName: assignment.ptId?.fullName || assignment.ptId?.name || '',
              assignmentId: assignment._id,
            };
          }
        }
        raw.activePT = activePT;
        raw.activeClass = activeClass;

        const purchaseDate = raw.registeredAt;
        if (purchaseDate && memberObjId) {
          const purchaseTime = new Date(purchaseDate).getTime();
          const now = Date.now();
          const daysSincePurchase = Math.max(0, Math.floor((now - purchaseTime) / MS_PER_DAY));
          const deadline = new Date(purchaseTime + REFUND_WINDOW_DAYS * MS_PER_DAY);
          const isPastDeadline = now > deadline.getTime();

          const [checkInCount, bookingCount, hasUsedBenefits] = await Promise.all([
            CheckIn.countDocuments({
              memberId: memberObjId,
              status: 'success',
              checkinTime: { $gte: new Date(purchaseTime) },
            }),
            Booking.countDocuments({
              memberId: memberObjId,
              status: { $in: ['completed', 'confirmed'] },
              date: { $gte: new Date(purchaseTime) },
            }),
            hasUsedMembershipBenefits({ memberId: memberObjId, purchaseDate: new Date(purchaseTime) }),
          ]);

          const currentRefundEligible = !isPastDeadline && !hasUsedBenefits;

          let ineligibilityReason = null;
          if (!currentRefundEligible) {
            if (isPastDeadline) {
              ineligibilityReason = 'Đã quá thời hạn hoàn tiền (7 ngày)';
            } else if (hasUsedBenefits) {
              ineligibilityReason = 'Gói tập đã được sử dụng';
            }
          }

          return {
            ...raw,
            daysSincePurchase,
            refundDeadline: deadline.toISOString(),
            isPastRefundDeadline: isPastDeadline,
            checkInCount,
            bookingCount,
            hasUsedBenefits,
            currentRefundEligible,
            ineligibilityReason,
          };
        }

        return raw;
      } catch (err) {
        const raw = item.toObject ? item.toObject() : item;
        raw.memberId = normalizeUserMemberIdentity(raw.memberId);
        raw.activePT = null;
        raw.activeClass = null;
        return raw;
      }
    }));

    return res.json({
      cancellations: enhancedItems,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approveCancellationRequest = async (req, res, next) => {
  try {
    const cancellationId = req.params.id;
    const staffId = req.user._id;
    const { finalRefundAmount, staffNote } = req.body;

    const cancellationRequest = await MembershipCancellationRequest.findById(cancellationId)
      .populate('planId', 'nameVi nameEn price');

    if (!cancellationRequest) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hủy.' });
    }

    if (cancellationRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Yêu cầu hủy đã được xử lý.' });
    }

    const maxRefundAmount = Number(cancellationRequest.estimatedRefundAmount || 0);
    const requestedRefundAmount = finalRefundAmount === undefined || finalRefundAmount === null
      ? maxRefundAmount
      : Number(finalRefundAmount);
    const refundAmount = Math.max(0, Math.min(Number.isFinite(requestedRefundAmount) ? requestedRefundAmount : maxRefundAmount, maxRefundAmount));

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const cycle = await MembershipCycle.findById(cancellationRequest.membershipCycleId)
        .session(session).lean()

      // Hoàn tiền chỉ đến từ các kỳ gia hạn chưa bắt đầu (gói chính đã hoạt động ngay sau thanh toán)
      const refundMethod = refundAmount > 0 ? 'WALLET' : 'NONE'

      if (cycle) {
        await MembershipCycle.updateOne(
          { _id: cycle._id },
          { $set: { status: refundAmount > 0 ? 'refunded' : 'cancelled' } },
        ).session(session)

        // Hủy tất cả các MembershipPeriod đang PENDING (gia hạn chưa sử dụng)
        if (cancellationRequest.membershipId) {
          const pendingPeriods = await MembershipPeriod.find({
            membershipId: cancellationRequest.membershipId,
            status: 'PENDING',
          }).session(session).lean()

          const now = new Date()
          for (const p of pendingPeriods) {
            const start = new Date(p.startDate).getTime()
            if (now.getTime() < start) {
              // Gia hạn chưa bắt đầu → hoàn tiền
              let wallet = await Wallet.findOne({ userId: cancellationRequest.memberId }).session(session)
              if (!wallet) {
                [wallet] = await Wallet.create([{ userId: cancellationRequest.memberId, balance: 0 }], { session })
              }
              const balanceBefore = Number(wallet.balance || 0)
              wallet.balance += p.price
              await wallet.save({ session })

              await Transaction.create([{
                userId: cancellationRequest.memberId,
                walletId: wallet._id,
                type: 'REFUND_TO_WALLET',
                provider: 'wallet',
                source: 'membership',
                description: `Hoàn tiền hủy gia hạn khi duyệt hủy gói (+${p.totalDays} ngày)`,
                amount: p.price,
                balanceBefore,
                balanceAfter: wallet.balance,
                referenceId: p._id.toString(),
                status: 'completed',
                completedAt: now,
                metadata: { periodId: p._id, membershipId: cancellationRequest.membershipId, reason: 'cancelled_on_approve' },
                idempotencyKey: `approve_cancel_period_${p._id}`,
              }], { session })

              await MembershipPeriod.updateOne(
                { _id: p._id },
                {
                  $set: {
                    status: 'CANCELLED',
                    refundStatus: 'refunded',
                    refundAmount: p.price,
                    refundAt: now,
                    refundMethod: 'WALLET',
                  },
                },
              ).session(session)
            } else {
              // Gia hạn đã bắt đầu → không hoàn
              await MembershipPeriod.updateOne(
                { _id: p._id },
                { $set: { status: 'CANCELLED', refundStatus: 'none' } },
              ).session(session)
            }
          }
        }
      }

      // PlanChangeHistory(cancel)
      await PlanChangeHistory.create([{
        memberId: cancellationRequest.memberId,
        membershipId: cancellationRequest.membershipId,
        fromPlanId: cancellationRequest.planId?._id || cancellationRequest.planId,
        toPlanId: null,
        changedAt: new Date(),
        changeType: 'cancel',
        type: 'cancel',
        amount: 0,
        priceDifference: 0,
        proratedValue: 0,
        proratedCredit: 0,
        walletCredit: 0,
      }], { session })

      cancellationRequest.status = 'approved';
      cancellationRequest.finalRefundAmount = refundAmount;
      cancellationRequest.staffNote = String(staffNote || '').trim();
      cancellationRequest.handledBy = staffId;
      cancellationRequest.handledAt = new Date();

      if (refundMethod === 'WALLET' && refundAmount > 0) {
        let wallet = await Wallet.findOne({ userId: cancellationRequest.memberId }).session(session);
        if (!wallet) {
          [wallet] = await Wallet.create([{ userId: cancellationRequest.memberId, balance: 0 }], { session });
        }

        const balanceBefore = Number(wallet.balance || 0);
        wallet.balance = balanceBefore + refundAmount;
        await wallet.save({ session });

        await Transaction.create(
          [{
            userId: cancellationRequest.memberId,
            walletId: wallet._id,
            type: 'REFUND_TO_WALLET',
            provider: 'wallet',
            source: 'membership',
            description: `Hoàn tiền hủy gói "${cancellationRequest.planId?.nameVi || cancellationRequest.planId?.nameEn}"`,
            amount: refundAmount,
            balanceBefore,
            balanceAfter: balanceBefore + refundAmount,
            referenceId: cancellationRequest._id.toString(),
            status: 'completed',
            completedAt: new Date(),
            metadata: {
              cancellationRequestId: cancellationRequest._id,
              membershipId: cancellationRequest.membershipId,
              planId: cancellationRequest.planId,
              policyCode: cancellationRequest.policyCode,
              estimatedRefundAmount: cancellationRequest.estimatedRefundAmount,
              finalRefundAmount: refundAmount,
            },
            idempotencyKey: `cancel_refund_${cancellationRequest._id}`,
          }],
          { session },
        );

        cancellationRequest.refundStatus = 'COMPLETED';
        cancellationRequest.refundCompletedAt = new Date();
      } else {
        cancellationRequest.refundStatus = 'NOT_APPLICABLE';
      }

      await cancellationRequest.save({ session });

      if (refundAmount > 0 && cancellationRequest.membershipId) {
        await Payment.updateMany(
          {
            membershipId: cancellationRequest.membershipId,
            status: { $in: ['PAID', 'paid'] },
          },
          {
            $set: {
              status: 'REFUNDED',
              'metadata.refundedByCancellationRequestId': cancellationRequest._id,
              'metadata.refundedAt': new Date(),
            },
          },
          { session },
        );

        await Payment.create(
          [{
            userId: cancellationRequest.memberId,
            membershipId: cancellationRequest.membershipId,
            planId: cancellationRequest.planId,
            amount: refundAmount,
            currency: 'vnd',
            status: 'REFUNDED',
            paymentMethod: refundMethod,
            source: 'OFFLINE',
            paidAt: new Date(),
            metadata: {
              cancellationRequestId: cancellationRequest._id,
              refundNote: staffNote,
              refundType: 'membership_cancellation',
              refundMethod,
              policyCode: cancellationRequest.policyCode,
              estimatedRefundAmount: cancellationRequest.estimatedRefundAmount,
            },
          }],
          { session },
        );
      }

      await recordUserActivity({
        userId: cancellationRequest.memberId,
        type: 'membership',
        title: refundAmount > 0 ? 'Hoàn tiền hủy gói tập' : 'Hủy gói tập',
        description: `Gói "${cancellationRequest.planId?.nameVi || cancellationRequest.planId?.nameEn}" đã được hủy bởi staff${refundAmount > 0 ? `. Hoàn tiền: ${refundAmount.toLocaleString('vi-VN')}đ` : ''}`,
        metadata: {
          cancellationRequestId: cancellationRequest._id,
          membershipId: cancellationRequest.membershipId,
          handledBy: staffId,
          finalRefundAmount: refundAmount,
          policyCode: cancellationRequest.policyCode,
        },
        session,
      });

      // Cleanup toàn bộ PT/class/booking/workout data (bao gồm notifications)
      await cleanupMemberPTData({
        memberId: cancellationRequest.memberId,
        session,
        sourceReason: 'member_cancelled_plan',
        note: refundAmount > 0 ? 'Gói tập đã được duyệt hủy và hoàn tiền' : 'Gói tập đã được duyệt hủy',
      })

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    const planName = cancellationRequest.planId?.nameVi || cancellationRequest.planId?.nameEn || ''
    const approveUser = await User.findById(cancellationRequest.memberId).select('email fullName name')
    const staffName = req.user.fullName || req.user.name || ''
    if (approveUser?.email) {
      sendRefundRequestProcessedEmail({
        toEmail: approveUser.email,
        userName: approveUser.fullName || approveUser.name || approveUser.email,
        planName,
        status: refundAmount > 0 ? 'APPROVED' : 'APPROVED',
        refundAmount,
        reason: staffNote || '',
        isFullCancel: true,
        staffName,
        staffNote: staffNote || '',
      }).catch((e) => console.error('Gửi email phê duyệt hủy gói thất bại:', e.message))
    }

    return res.json({
      message: refundAmount > 0
        ? `Đã hủy gói tập và hoàn tiền ${refundAmount.toLocaleString('vi-VN')}đ.`
        : 'Đã hủy gói tập.',
      cancellationRequest,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectCancellationRequest = async (req, res, next) => {
  try {
    const cancellationId = req.params.id;
    const staffId = req.user._id;
    const { reason } = req.body;

    const cancellationRequest = await MembershipCancellationRequest.findById(cancellationId);

    if (!cancellationRequest) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hủy.' });
    }

    if (cancellationRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Yêu cầu hủy đã được xử lý.' });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      cancellationRequest.status = 'rejected';
      cancellationRequest.rejectReason = String(reason || '').trim();
      cancellationRequest.staffNote = String(reason || '').trim();
      cancellationRequest.refundStatus = 'NOT_APPLICABLE';
      cancellationRequest.handledBy = staffId;
      cancellationRequest.handledAt = new Date();
      await cancellationRequest.save({ session });

      await recordUserActivity({
        userId: cancellationRequest.memberId,
        type: 'membership',
        title: 'Từ chối hủy gói tập',
        description: `Yêu cầu hủy gói tập đã bị từ chối.`,
        metadata: {
          cancellationRequestId: cancellationRequest._id,
          membershipId: cancellationRequest.membershipId,
          handledBy: staffId,
          reason: reason || '',
        },
        session,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    const planName = cancellationRequest.planId?.nameVi || cancellationRequest.planId?.nameEn || ''
    const rejectUser = await User.findById(cancellationRequest.memberId).select('email fullName name')
    const staffName = req.user.fullName || req.user.name || ''
    if (rejectUser?.email) {
      sendRefundRequestProcessedEmail({
        toEmail: rejectUser.email,
        userName: rejectUser.fullName || rejectUser.name || rejectUser.email,
        planName,
        status: 'REJECTED',
        refundAmount: 0,
        reason: reason || '',
        isFullCancel: true,
        staffName,
        staffNote: reason || '',
      }).catch((e) => console.error('Gửi email từ chối hủy gói thất bại:', e.message))
    }

    return res.json({
      message: 'Đã từ chối yêu cầu hủy gói. Gói tập của hội viên vẫn hoạt động.',
      cancellationRequest,
    });
  } catch (error) {
    next(error);
  }
};
