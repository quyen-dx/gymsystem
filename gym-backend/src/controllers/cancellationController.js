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
import { cleanupMemberPTData } from '../services/membershipService.js';
import MembershipCycle from '../models/MembershipCycle.js';
import PlanChangeHistory from '../models/PlanChangeHistory.js';
import ClassEnrollment from '../models/ClassEnrollment.js';
import PTAssignment from '../models/PTAssignment.js';
import { NOTIFICATION_TYPES } from '../models/Notification.js';
import { createNotification } from '../services/notificationService.js';
import { sendRefundRequestSubmittedEmail, sendRefundRequestProcessedEmail } from '../services/emailService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REFUND_WINDOW_DAYS = 7;
const REFUND_USED_ERROR = 'Gói tập đã được sử dụng, không đủ điều kiện hoàn tiền.';
const REFUND_EXPIRED_ERROR = 'Đã quá thời hạn hoàn tiền (7 ngày).';

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const calculateUsageSnapshot = (startDate, endDate) => {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = endOfDay(endDate).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / MS_PER_DAY));
  const usedDays = Math.max(0, Math.min(totalDays, Math.ceil((now - start) / MS_PER_DAY)));
  const remainingDays = Math.max(0, Math.round((end - now) / MS_PER_DAY));
  const usedPercent = Math.round((usedDays / totalDays) * 100);
  return { usedDays, remainingDays, totalDays, usedPercent };
};

const getPurchaseDate = async (membership, session = null) => {
  if (membership.paymentId) {
    const query = Payment.findById(membership.paymentId).select('paidAt createdAt');
    if (session) query.session(session);
    const payment = await query.lean();
    if (payment?.paidAt || payment?.createdAt) return new Date(payment.paidAt || payment.createdAt);
  }

  return new Date(membership.createdAt || membership.startDate);
};

const hasUsedMembershipBenefits = async ({ memberId, purchaseDate, session = null }) => {
  const since = new Date(purchaseDate);
  const now = new Date();

  const checkInQuery = CheckIn.exists({
    memberId,
    status: 'success',
    checkinTime: { $gte: since },
  });
  const bookingQuery = Booking.exists({
    memberId,
    status: { $in: ['completed', 'confirmed'] },
    date: { $gte: since, $lte: now },
  });

  if (session) {
    checkInQuery.session(session);
    bookingQuery.session(session);
  }

  const [checkIn, booking] = await Promise.all([checkInQuery, bookingQuery]);
  return Boolean(checkIn || booking);
};

const assertRefundEligibility = async ({ membership, memberId, session = null }) => {
  const purchaseDate = await getPurchaseDate(membership, session);
  const refundDeadline = new Date(purchaseDate.getTime() + REFUND_WINDOW_DAYS * MS_PER_DAY);

  if (Date.now() > refundDeadline.getTime()) {
    const error = new Error(REFUND_EXPIRED_ERROR);
    error.statusCode = 400;
    throw error;
  }

  const hasUsedBenefits = await hasUsedMembershipBenefits({ memberId, purchaseDate, session });
  if (hasUsedBenefits) {
    const error = new Error(REFUND_USED_ERROR);
    error.statusCode = 400;
    throw error;
  }

  return {
    purchaseDate,
    refundDeadline,
    policyCode: 'REFUND_100',
    policyLabel: 'Hoàn 100% nếu chưa sử dụng và trong vòng 7 ngày',
    refundRate: 1,
  };
};

export const createCancellationRequest = async (req, res, next) => {
  try {
    await assertPolicyConsent(req.user._id, ['refund', 'membership'])

    const memberId = req.user._id;
    const {
      reason,
      policyAccepted,
    } = req.body;

    if (!policyAccepted) {
      return res.status(400).json({ message: 'Vui lòng xác nhận đã đọc chính sách hoàn tiền.' });
    }

    const membership = await Membership.findOne({
      memberId,
      status: 'active',
    }).sort({ endDate: -1 }).populate('planId');

    if (!membership) {
      return res.status(400).json({ message: 'Bạn chưa có gói tập nào đang hoạt động.' });
    }

    const existingPending = await MembershipCancellationRequest.findOne({
      memberId,
      membershipId: membership._id,
      status: 'pending',
    });

    if (existingPending) {
      return res.status(400).json({ message: 'Bạn đã có yêu cầu hủy gói đang chờ xử lý.' });
    }

    const plan = membership.planId;
    if (!plan) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin gói tập.' });
    }

    const refundPolicy = await assertRefundEligibility({ membership, memberId });

    const { usedDays, remainingDays, totalDays, usedPercent } = calculateUsageSnapshot(
      membership.startDate,
      membership.endDate,
    );

    const { purchaseDate, policyCode, policyLabel, refundRate } = refundPolicy;
    const refundEligible = true;
    const estimatedRefundAmount = Number(plan.price || 0);

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

      await assertRefundEligibility({ membership, memberId, session });

      membership.status = 'pending_cancel';
      await membership.save({ session });

      [cancellationRequest] = await MembershipCancellationRequest.create([{
      memberId,
      membershipId: membership._id,
      planId: plan._id,
      reason: String(reason || '').trim(),
      usedDays,
      remainingDays,
      totalDays,
      usedPercent,
      policyCode,
      policyLabel,
      refundRate,
      registeredAt: purchaseDate,
      requestedAt: new Date(),
      policyAccepted: true,
      policyAcceptedAt: new Date(),
      refundEligible,
      estimatedRefundAmount,
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
          membershipId: membership._id,
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

    const planName = plan.nameVi || plan.nameEn || ''
    if (req.user.email) {
      sendRefundRequestSubmittedEmail({
        toEmail: req.user.email,
        userName: req.user.fullName || req.user.name || req.user.email,
        planName,
        periodDetail: `Gói: ${planName} (${new Date(membership.startDate).toLocaleDateString('vi-VN')} → ${new Date(membership.endDate).toLocaleDateString('vi-VN')})`,
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
      .populate('membershipId', 'startDate endDate status')
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
        .populate('membershipId', 'startDate endDate status')
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

          const [checkInCount, bookingCount] = await Promise.all([
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
          ]);

          const hasUsedBenefits = checkInCount > 0 || bookingCount > 0;
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

    const membership = await Membership.findById(cancellationRequest.membershipId);
    if (!membership) {
      return res.status(404).json({ message: 'Không tìm thấy gói tập.' });
    }

    if (membership.status !== 'pending_cancel') {
      return res.status(400).json({ message: 'Gói tập không ở trạng thái chờ hủy.' });
    }

    const maxRefundAmount = Number(cancellationRequest.estimatedRefundAmount || 0);
    const requestedRefundAmount = finalRefundAmount === undefined || finalRefundAmount === null
      ? maxRefundAmount
      : Number(finalRefundAmount);
    const refundAmount = Math.max(0, Math.min(Number.isFinite(requestedRefundAmount) ? requestedRefundAmount : maxRefundAmount, maxRefundAmount));

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // === Read MembershipCycle.refundEligible ===
      const cycle = await MembershipCycle.findOne({
        memberId: cancellationRequest.memberId,
        status: 'active',
      }).session(session).sort({ createdAt: -1 }).lean()

      const cycleRefundEligible = cycle?.refundEligible ?? false
      const refundMethod = cycleRefundEligible && refundAmount > 0 ? 'WALLET' : 'NONE'

      membership.status = refundAmount > 0 ? 'refunded' : 'cancelled';
      membership.cancelledAt = new Date();
      membership.cancelReason = cancellationRequest.reason;
      membership.cancelHandledBy = staffId;
      membership.cancelHandledAt = new Date();
      await membership.save({ session });

      // Update cycle status
      if (cycle) {
        await MembershipCycle.updateOne(
          { _id: cycle._id },
          { $set: { status: 'cancelled' } },
        ).session(session)
      }

      // PlanChangeHistory(cancel)
      await PlanChangeHistory.create([{
        memberId: cancellationRequest.memberId,
        membershipId: membership._id,
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
              membershipId: membership._id,
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

      if (refundAmount > 0) {
        await Payment.updateMany(
          {
            membershipId: membership._id,
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
            membershipId: membership._id,
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
          membershipId: membership._id,
          handledBy: staffId,
          finalRefundAmount: refundAmount,
          policyCode: cancellationRequest.policyCode,
        },
        session,
      });

      // Check & cleanup active PT/class if member has any
      const [activeEnrollment, activeAssignment] = await Promise.all([
        ClassEnrollment.findOne({ memberId: cancellationRequest.memberId, status: 'active' })
          .populate('classId', 'code name').lean(),
        PTAssignment.findOne({ memberId: cancellationRequest.memberId, status: 'active' })
          .populate('ptId', 'name fullName').lean(),
      ]);

      if (activeEnrollment) {
        await ClassEnrollment.updateOne(
          { _id: activeEnrollment._id },
          {
            $set: {
              status: 'ended',
              leftAt: new Date(),
              sourceReason: 'member_cancelled_plan',
              note: 'Hội viên hủy gói tập',
            },
          },
          { session },
        )
      }

      if (activeAssignment) {
        await PTAssignment.updateOne(
          { _id: activeAssignment._id },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: 'Hội viên hủy gói tập',
            },
          },
          { session },
        )
      }

      if (activeEnrollment || activeAssignment) {
        const memberUser = await User.findById(cancellationRequest.memberId)
          .select('name fullName').lean()
        const mName = memberUser?.fullName || memberUser?.name || 'Hội viên'

        await createNotification({
          receiverId: cancellationRequest.memberId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
          title: 'Quyền lợi PT đã kết thúc',
          content: 'Gói tập của bạn đã được duyệt hủy. Quyền lợi PT và lớp học đã được đóng lại.',
          redirectUrl: '/my-membership',
          createdBy: 'System',
        })

        if (activeAssignment?.ptId?._id) {
          await createNotification({
            receiverId: activeAssignment.ptId._id,
            receiverRole: 'pt',
            notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
            title: 'Hội viên đã hủy gói tập',
            content: `Hội viên ${mName} đã hủy gói tập. Vui lòng xác nhận kết thúc phụ trách đối với hội viên này.`,
            relatedId: cancellationRequest.memberId,
            relatedType: 'User',
            redirectUrl: '/pt/clients',
            createdBy: 'System',
          })
        }
      }

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

      const membership = await Membership.findById(cancellationRequest.membershipId).session(session);
      if (membership?.status === 'pending_cancel') {
        membership.status = new Date(membership.endDate) >= new Date() ? 'active' : 'expired';
        await membership.save({ session });
      }

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
