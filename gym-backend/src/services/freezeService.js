import mongoose from 'mongoose'
import MembershipFreeze from '../models/MembershipFreeze.js'
import MembershipCycle from '../models/MembershipCycle.js'
import AppError from '../utils/appError.js'
import logger from '../config/logger.js'

const MAX_FREEZES_PER_CYCLE = 2
const MAX_FREEZE_DAYS = 30
const MIN_DAYS_BETWEEN_FREEZES = 7

export const createFreezeRequest = async (userId, { startDate, endDate, reason }) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()

  if (start >= end) {
    throw new AppError('Ngày bắt đầu phải trước ngày kết thúc', 400)
  }

  if (start < now) {
    throw new AppError('Ngày bắt đầu không được trong quá khứ', 400)
  }

  const durationMs = end.getTime() - start.getTime()
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24))

  if (durationDays > MAX_FREEZE_DAYS) {
    throw new AppError(`Thời gian tạm ngưng tối đa là ${MAX_FREEZE_DAYS} ngày`, 400)
  }

  const activeCycle = await MembershipCycle.findOne({
    memberId: userId,
    status: 'active',
  }).lean()

  if (!activeCycle) {
    throw new AppError('Không tìm thấy gói tập đang hoạt động', 404)
  }

  const lastCompletedFreeze = await MembershipFreeze.findOne({
    cycleId: activeCycle._id,
    status: 'completed',
  }).sort({ endDate: -1 }).lean()

  if (lastCompletedFreeze) {
    const lastEnd = new Date(lastCompletedFreeze.endDate)
    const daysSinceLastFreeze = Math.ceil((start.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceLastFreeze < MIN_DAYS_BETWEEN_FREEZES) {
      throw new AppError(
        `Phải cách lần tạm ngưng trước ít nhất ${MIN_DAYS_BETWEEN_FREEZES} ngày`,
        400,
      )
    }
  }

  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    const doc = await MembershipCycle.findOneAndUpdate(
      { _id: activeCycle._id, freezeCount: { $lt: MAX_FREEZES_PER_CYCLE } },
      { $inc: { freezeCount: 1 } },
      { new: true, session },
    )

    if (!doc) {
      throw new AppError(
        `Đã đạt giới hạn ${MAX_FREEZES_PER_CYCLE} lần tạm ngưng cho chu kỳ này`,
        400,
      )
    }

    const [freeze] = await MembershipFreeze.create(
      [
        {
          cycleId: activeCycle._id,
          userId,
          startDate: start,
          endDate: end,
          durationDays,
          reason: reason || '',
          status: 'pending',
          previousFreezeEndDate: lastCompletedFreeze?.endDate || null,
        },
      ],
      { session },
    )

    await session.commitTransaction()

    logger.info('Freeze request created', {
      freezeId: freeze._id.toString(),
      userId,
      cycleId: activeCycle._id.toString(),
      durationDays,
    })

    return freeze
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

export const getMyFreezes = async (userId, query) => {
  const { page = 1, limit = 20, status, cycleId } = query

  const filter = { userId }

  if (status) {
    filter.status = status
  }
  if (cycleId) {
    filter.cycleId = cycleId
  }

  const skip = (page - 1) * limit

  const [freezes, total] = await Promise.all([
    MembershipFreeze.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('cycleId', 'startDate endDate status')
      .lean(),
    MembershipFreeze.countDocuments(filter),
  ])

  return {
    freezes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const listFreezes = async (query) => {
  const { page = 1, limit = 20, status, cycleId } = query

  const filter = {}

  if (status) {
    filter.status = status
  }
  if (cycleId) {
    filter.cycleId = cycleId
  }

  const skip = (page - 1) * limit

  const [freezes, total] = await Promise.all([
    MembershipFreeze.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('cycleId', 'startDate endDate status')
      .lean(),
    MembershipFreeze.countDocuments(filter),
  ])

  return {
    freezes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const approveFreeze = async (freezeId, adminId) => {
  const freeze = await MembershipFreeze.findById(freezeId)

  if (!freeze) {
    throw new AppError('Yêu cầu tạm ngưng không tồn tại', 404)
  }

  if (freeze.status !== 'pending') {
    throw new AppError('Yêu cầu tạm ngưng không ở trạng thái chờ duyệt', 400)
  }

  freeze.status = 'approved'
  freeze.approvedBy = adminId
  freeze.approvedAt = new Date()
  await freeze.save()

  await MembershipCycle.updateOne(
    { _id: freeze.cycleId, endDate: { $ne: null } },
    [
      {
        $set: {
          endDate: {
            $add: [
              '$endDate',
              freeze.durationDays * 24 * 60 * 60 * 1000,
            ],
          },
        },
      },
    ],
  )

  logger.info('Freeze request approved', {
    freezeId: freeze._id.toString(),
    adminId,
    userId: freeze.userId.toString(),
  })

  return freeze
}

export const rejectFreeze = async (freezeId, adminId) => {
  const freeze = await MembershipFreeze.findById(freezeId)

  if (!freeze) {
    throw new AppError('Yêu cầu tạm ngưng không tồn tại', 404)
  }

  if (freeze.status !== 'pending') {
    throw new AppError('Yêu cầu tạm ngưng không ở trạng thái chờ duyệt', 400)
  }

  freeze.status = 'rejected'
  freeze.rejectedAt = new Date()
  await freeze.save()

  await MembershipCycle.updateOne(
    { _id: freeze.cycleId },
    { $inc: { freezeCount: -1 } },
  )

  logger.info('Freeze request rejected', {
    freezeId: freeze._id.toString(),
    adminId,
    userId: freeze.userId.toString(),
  })

  return freeze
}
