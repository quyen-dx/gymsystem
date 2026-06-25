import mongoose from 'mongoose';
import MembershipCancellationRequest from '../models/MembershipCancellationRequest.js';
import Membership from '../models/Membership.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import { recordUserActivity } from '../services/userActivityService.js';
import { invalidatePersonalContextCache } from '../services/conversationContextCache.js';
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js';
import { assertPolicyConsent } from '../utils/policyConsent.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const calculateUsedDays = (startDate, endDate) => {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = endOfDay(endDate).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / MS_PER_DAY));
  const usedDays = Math.max(1, Math.min(totalDays, Math.ceil((now - start) / MS_PER_DAY)));
  const remainingDays = Math.max(0, Math.round((end - now) / MS_PER_DAY));
  const usedPercent = Math.round((usedDays / totalDays) * 100);
  return { usedDays, remainingDays, totalDays, usedPercent };
};

const getRefundPolicy = ({ price, usedDays, usedPercent }) => {
  if (usedPercent > 50) {
    return {
      refundEligible: false,
      estimatedRefundAmount: 0,
      policyCode: 'NO_REFUND',
      policyLabel: 'Không hoàn',
      refundRate: 0,
    };
  }

  if (usedDays <= 7) {
    return {
      refundEligible: true,
      estimatedRefundAmount: Number(price || 0),
      policyCode: 'REFUND_100',
      policyLabel: 'Hoàn tối đa 100%',
      refundRate: 1,
    };
  }

  return {
    refundEligible: true,
    estimatedRefundAmount: Math.floor(Number(price || 0) * 0.5),
    policyCode: 'REFUND_50',
    policyLabel: 'Hoàn tối đa 50%',
    refundRate: 0.5,
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

    const { usedDays, remainingDays, totalDays, usedPercent } = calculateUsedDays(
      membership.startDate,
      membership.endDate,
    );

    const refundPolicy = getRefundPolicy({
      price: plan.price,
      usedDays,
      usedPercent,
    });
    const { refundEligible, estimatedRefundAmount, policyCode, policyLabel, refundRate } = refundPolicy;

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
      registeredAt: membership.startDate,
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

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    try {
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
      });
      invalidatePersonalContextCache(memberId);
    } catch (activityError) {
      console.error('Không thể ghi hoạt động hủy gói:', activityError.message);
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

    return res.json({
      cancellations: items.map((item) => {
        const raw = item.toObject ? item.toObject() : item;
        return { ...raw, memberId: normalizeUserMemberIdentity(raw.memberId) };
      }),
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

    const refundAmount = Number(finalRefundAmount) || 0;
    const refundMethod = cancellationRequest.refundEligible && refundAmount > 0 ? 'WALLET' : 'NONE';

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      membership.status = 'cancelled';
      membership.cancelledAt = new Date();
      membership.cancelReason = cancellationRequest.reason;
      membership.cancelHandledBy = staffId;
      membership.cancelHandledAt = new Date();
      await membership.save({ session });

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

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    try {
      await recordUserActivity({
        userId: cancellationRequest.memberId,
        type: 'membership',
        title: 'Hủy gói tập',
        description: `Gói "${cancellationRequest.planId?.nameVi || cancellationRequest.planId?.nameEn}" đã được hủy bởi staff${refundAmount > 0 ? `. Hoàn tiền: ${refundAmount.toLocaleString('vi-VN')}đ` : ''}`,
        metadata: {
          cancellationRequestId: cancellationRequest._id,
          membershipId: membership._id,
          handledBy: staffId,
          finalRefundAmount: refundAmount,
          policyCode: cancellationRequest.policyCode,
        },
      });
      invalidatePersonalContextCache(cancellationRequest.memberId);
    } catch (activityError) {
      console.error('Không thể ghi hoạt động hủy gói:', activityError.message);
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

    cancellationRequest.status = 'rejected';
    cancellationRequest.rejectReason = String(reason || '').trim();
    cancellationRequest.staffNote = String(reason || '').trim();
    cancellationRequest.refundStatus = 'NOT_APPLICABLE';
    cancellationRequest.handledBy = staffId;
    cancellationRequest.handledAt = new Date();
    await cancellationRequest.save();

    const membership = await Membership.findById(cancellationRequest.membershipId);
    if (membership?.status === 'pending_cancel') {
      membership.status = new Date(membership.endDate) >= new Date() ? 'active' : 'expired';
      await membership.save();
    }

    try {
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
      });
      invalidatePersonalContextCache(cancellationRequest.memberId);
    } catch (activityError) {
      console.error('Không thể ghi hoạt động từ chối hủy gói:', activityError.message);
    }

    return res.json({
      message: 'Đã từ chối yêu cầu hủy gói. Gói tập của hội viên vẫn hoạt động.',
      cancellationRequest,
    });
  } catch (error) {
    next(error);
  }
};
