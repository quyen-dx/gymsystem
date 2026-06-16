import mongoose from 'mongoose'
import User from '../models/User.js'
import Membership from '../models/Membership.js'
import Plan from '../models/Plan.js'
import UserActivity from '../models/UserActivity.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { recordUserActivity } from '../services/userActivityService.js'
import AppError from '../utils/appError.js'
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/identifier.js'

const calculateRemainingDays = (endDate) => {
  const now = new Date()
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

const sanitizeMember = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user }
  delete obj.password
  delete obj.refreshToken
  return obj
}

const sendError = (res, error) => {
  console.error(error)
  if (error?.code === 11000) {
    if (error.keyPattern?.email) {
      return res.status(400).json({ message: 'Email dang nhap da duoc su dung' })
    }
    if (error.keyPattern?.phone) {
      return res.status(400).json({ message: 'So dien thoai da duoc su dung' })
    }
  }

  return res.status(error.statusCode || 500).json({
    ...(error.code ? { code: error.code } : {}),
    message: error.message || 'Lỗi máy chủ',
  })
}

export const getMembers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      planId,
      status,
      remainingDaysMin,
      remainingDaysMax,
      checkinMin,
      checkinMax,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    const filter = { role: 'member' }

    if (search) {
      const phone = search.replace(/\s/g, '')
      const isPhoneSearch = /^(0|\+84)\d{8,9}$/.test(phone)
      const isMemberCodeSearch = /^GP\d+$/i.test(search.trim())
      if (isPhoneSearch) {
        filter.phone = { $regex: phone.replace(/^0/, '(+84|0)'), $options: 'i' }
      } else if (isMemberCodeSearch) {
        filter.memberCode = { $regex: search.trim(), $options: 'i' }
      } else {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { memberCode: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]
      }
    }

    if (status === 'active') filter.isActive = true
    else if (status === 'locked') filter.isActive = false

    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean()

    const membersWithMembership = await Promise.all(
      users.map(async (user) => {
        const activeMembership = await Membership.findOne({
          memberId: user._id,
          status: 'active',
        })
          .populate('planId', 'nameVi nameEn price durationDays color')
          .sort({ endDate: -1 })
          .lean()

        const membershipHistory = await Membership.find({ memberId: user._id })
          .populate('planId', 'nameVi nameEn')
          .sort({ createdAt: -1 })
          .lean()

        let remainingDays = 0
        if (activeMembership) {
          remainingDays = calculateRemainingDays(activeMembership.endDate)
        }

        const checkinCount = await UserActivity.countDocuments({
          user: user._id,
          type: 'checkin',
        })

        let matchFilter = false
        if (planId && activeMembership) {
          matchFilter = activeMembership.planId?._id?.toString() === planId
        } else if (planId) {
          matchFilter = false
        } else {
          matchFilter = true
        }

        if (remainingDaysMin && remainingDays < Number(remainingDaysMin)) matchFilter = false
        if (remainingDaysMax && remainingDays > Number(remainingDaysMax)) matchFilter = false
        if (checkinMin && checkinCount < Number(checkinMin)) matchFilter = false
        if (checkinMax && checkinCount > Number(checkinMax)) matchFilter = false

        return {
          ...user,
          remainingDays,
          activeMembership,
          membershipHistory,
          checkinCount,
          matchFilter,
        }
      })
    )

    const filteredMembers = membersWithMembership.filter((m) => m.matchFilter)

    res.json({
      members: filteredMembers,
      pagination: {
        total,
        filtered: filteredMembers.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberStats = async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const [totalMembers, newThisMonth, expiredMemberships, lockedMembers] = await Promise.all([
      User.countDocuments({ role: 'member' }),
      User.countDocuments({ role: 'member', createdAt: { $gte: startOfMonth } }),
      Membership.countDocuments({ status: 'expired' }),
      User.countDocuments({ role: 'member', isActive: false }),
    ])

    const expiringMemberships = await Membership.find({
      status: 'active',
      endDate: { $gte: now, $lte: sevenDaysFromNow },
    }).countDocuments()

    const activeMemberships = await Membership.countDocuments({ status: 'active' })

    res.json({
      stats: {
        totalMembers,
        newThisMonth,
        activeMemberships,
        expiringSoon: expiringMemberships,
        expired: expiredMemberships,
        locked: lockedMembers,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getExpiringMembers = async (req, res) => {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const memberships = await Membership.find({
      status: 'active',
      endDate: { $gte: now, $lte: sevenDaysFromNow },
    })
      .populate('memberId', 'name email phone avatar')
      .populate('planId', 'nameVi nameEn durationDays price')
      .sort({ endDate: 1 })
      .lean()

    const members = memberships.map((m) => ({
      ...m.memberId,
      membership: {
        plan: m.planId,
        startDate: m.startDate,
        endDate: m.endDate,
        remainingDays: calculateRemainingDays(m.endDate),
      },
    }))

    res.json({ members })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const [activeMembership, membershipHistory] = await Promise.all([
      Membership.findOne({ memberId: user._id, status: 'active' })
        .populate('planId')
        .sort({ endDate: -1 })
        .lean(),
      Membership.find({ memberId: user._id })
        .populate('planId', 'nameVi nameEn durationDays price color')
        .sort({ createdAt: -1 })
        .lean(),
    ])

    const remainingDays = activeMembership
      ? calculateRemainingDays(activeMembership.endDate)
      : 0

    res.json({
      member: {
        ...sanitizeMember(user),
        activeMembership,
        membershipHistory,
        remainingDays,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const createMember = async (req, res) => {
  try {
    const { name, email, contactEmail, phone, dateOfBirth, gender, password } = req.body

    if (!name?.trim()) throw new AppError('Họ tên là bắt buộc', 400)

    const normalizedContactEmail = contactEmail?.trim().toLowerCase()
    if (normalizedContactEmail && !isValidEmail(normalizedContactEmail)) {
      throw new AppError('Email lien he khong hop le', 400)
    }

    const existingUser = email
      ? await User.findOne({ email: email.toLowerCase() })
      : phone
        ? await User.findOne({ phone: normalizePhone(phone) })
        : null

    if (existingUser) {
      throw new AppError('Email hoặc số điện thoại đã tồn tại', 400)
    }

    const userData = {
      name: name.trim(),
      role: 'member',
      provider: email ? 'email' : 'phone',
      isVerified: true,
      password: password || 'member123',
    }

    if (email) userData.email = email.toLowerCase().trim()
    if (normalizedContactEmail) userData.contactEmail = normalizedContactEmail
    if (phone) userData.phone = normalizePhone(phone)
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth)
    if (gender) userData.gender = gender

    const user = await User.create(userData)

    await recordAuditLog({
      req,
      module: 'users',
      action: 'create',
      entity: user,
      details: 'Thêm member mới',
    })

    res.status(201).json({ message: 'Thêm member thành công', member: sanitizeMember(user) })
  } catch (error) {
    return sendError(res, error)
  }
}

export const updateMember = async (req, res) => {
  try {
    const { name, email, contactEmail, phone, dateOfBirth, gender } = req.body
    const user = await User.findById(req.params.id)

    if (!user || user.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    if (name) user.name = name.trim()
    if (email) user.email = email.toLowerCase().trim()
    if (phone) {
      const normalizedPhone = normalizePhone(phone)
      if (!normalizedPhone) throw new AppError('Số điện thoại không hợp lệ', 400)
      user.phone = normalizedPhone
    }
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth)
    if (gender) user.gender = gender

    if (req.files?.avatar?.[0]) {
      user.avatar = req.files.avatar[0].path
    }

    await user.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: 'Cập nhật thông tin member',
    })

    res.json({ message: 'Cập nhật thành công', member: sanitizeMember(user) })
  } catch (error) {
    return sendError(res, error)
  }
}

export const toggleMemberStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    user.isActive = !user.isActive
    user.isLocked = !user.isActive
    user.status = user.isActive ? 'active' : 'locked'
    await user.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: user.isActive ? 'Mở khóa member' : 'Khóa member',
    })

    res.json({
      message: `Member đã được ${user.isActive ? 'mở khóa' : 'khóa'}`,
      member: sanitizeMember(user),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const registerPlanForMember = async (req, res) => {
  try {
    const { planId } = req.body
    if (!planId) throw new AppError('planId là bắt buộc', 400)

    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    const existingActive = await Membership.findOne({
      memberId: member._id,
      status: 'active',
    }).sort({ endDate: -1 })

    if (existingActive) {
      throw new AppError('Member đang có gói tập active. Hãy gia hạn hoặc đợi hết hạn.', 400)
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const startDate = new Date(now)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Number(plan.durationDays) - 1)
    endDate.setHours(23, 59, 59, 999)

    const membership = await Membership.create({
      memberId: member._id,
      planId: plan._id,
      startDate,
      endDate,
      status: 'active',
    })

    await recordUserActivity({
      userId: member._id,
      type: 'membership',
      title: 'Đăng ký gói tập',
      description: `Đăng ký gói "${plan.nameVi}" - ${plan.durationDays} ngày`,
      metadata: { membershipId: membership._id, planId: plan._id },
    })

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: member,
      details: `Đăng ký gói tập "${plan.nameVi}" cho member`,
    })

    res.status(201).json({
      message: 'Đăng ký gói tập thành công',
      membership: {
        id: membership._id,
        plan: { nameVi: plan.nameVi, nameEn: plan.nameEn, durationDays: plan.durationDays },
        startDate: membership.startDate,
        endDate: membership.endDate,
        remainingDays: calculateRemainingDays(endDate),
        status: membership.status,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const renewPlanForMember = async (req, res) => {
  try {
    const { planId, renewFrom = 'today' } = req.body
    if (!planId) throw new AppError('planId là bắt buộc', 400)

    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    const existingMembership = await Membership.findOne({
      memberId: member._id,
      planId: plan._id,
      status: 'active',
    }).sort({ endDate: -1 })

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let startDate
    if (existingMembership && renewFrom === 'endDate') {
      const prevEnd = new Date(existingMembership.endDate)
      prevEnd.setHours(0, 0, 0, 0)
      prevEnd.setDate(prevEnd.getDate() + 1)
      startDate = prevEnd
    } else {
      startDate = new Date(now)
    }

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Number(plan.durationDays) - 1)
    endDate.setHours(23, 59, 59, 999)

    const membership = await Membership.create({
      memberId: member._id,
      planId: plan._id,
      startDate,
      endDate,
      status: 'active',
    })

    await recordUserActivity({
      userId: member._id,
      type: 'membership',
      title: 'Gia hạn gói tập',
      description: `Gia hạn gói "${plan.nameVi}" thêm ${plan.durationDays} ngày`,
      metadata: { membershipId: membership._id, planId: plan._id, renewFrom },
    })

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: member,
      details: `Gia hạn gói "${plan.nameVi}" cho member (từ ${renewFrom === 'endDate' ? 'ngày hết hạn cũ' : 'hôm nay'})`,
    })

    res.json({
      message: 'Gia hạn gói tập thành công',
      membership: {
        id: membership._id,
        plan: { nameVi: plan.nameVi, nameEn: plan.nameEn, durationDays: plan.durationDays },
        startDate: membership.startDate,
        endDate: membership.endDate,
        remainingDays: calculateRemainingDays(endDate),
        status: membership.status,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const batchRenewMembers = async (req, res) => {
  try {
    const { memberIds, planId, renewFrom = 'today' } = req.body

    if (!memberIds?.length) throw new AppError('Danh sách memberIds là bắt buộc', 400)
    if (!planId) throw new AppError('planId là bắt buộc', 400)

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    const members = await User.find({ _id: { $in: memberIds }, role: 'member' })
    if (members.length === 0) throw new AppError('Không tìm thấy member nào', 404)

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const results = []
    for (const member of members) {
      const existingMembership = await Membership.findOne({
        memberId: member._id,
        planId: plan._id,
        status: 'active',
      }).sort({ endDate: -1 })

      let startDate
      if (existingMembership && renewFrom === 'endDate') {
        const prevEnd = new Date(existingMembership.endDate)
        prevEnd.setHours(0, 0, 0, 0)
        prevEnd.setDate(prevEnd.getDate() + 1)
        startDate = prevEnd
      } else {
        startDate = new Date(now)
      }

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + Number(plan.durationDays) - 1)
      endDate.setHours(23, 59, 59, 999)

      const membership = await Membership.create({
        memberId: member._id,
        planId: plan._id,
        startDate,
        endDate,
        status: 'active',
      })

      results.push({
        memberId: member._id,
        memberName: member.name,
        membershipId: membership._id,
        endDate: membership.endDate,
        remainingDays: calculateRemainingDays(endDate),
      })
    }

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: { _id: 'batch', name: `Batch renew ${results.length} members` },
      details: `Gia hạn hàng loạt ${results.length} member với gói "${plan.nameVi}"`,
    })

    res.json({
      message: `Đã gia hạn thành công cho ${results.length} member`,
      results,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberTimeline = async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const activities = await UserActivity.find({ user: member._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    const memberships = await Membership.find({ memberId: member._id })
      .populate('planId', 'nameVi nameEn price durationDays color')
      .sort({ createdAt: -1 })
      .lean()

    const membershipEvents = memberships.map((m) => ({
      _id: m._id,
      type: 'membership',
      title: m.status === 'active' ? 'Đăng ký gói tập' : 'Gói tập kết thúc',
      description: `${m.planId?.nameVi || 'N/A'} - ${new Date(m.startDate).toLocaleDateString('vi-VN')} đến ${new Date(m.endDate).toLocaleDateString('vi-VN')}`,
      metadata: {
        membershipId: m._id,
        planId: m.planId?._id,
        planName: m.planId?.nameVi,
        startDate: m.startDate,
        endDate: m.endDate,
        status: m.status,
        price: m.planId?.price,
      },
      createdAt: m.createdAt,
    }))

    const timeline = [
      ...activities,
      ...membershipEvents,
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({ timeline })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMemberHealthScore = async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [checkinCount, activeMembership] = await Promise.all([
      UserActivity.countDocuments({
        user: member._id,
        type: 'checkin',
        createdAt: { $gte: thirtyDaysAgo },
      }),
      Membership.findOne({ memberId: member._id, status: 'active' }).populate('planId').lean(),
    ])

    const expectedCheckins = 15
    const checkinScore = Math.min(100, (checkinCount / expectedCheckins) * 100)

    let workoutCompletionScore = 0
    if (activeMembership) {
      const completedWorkouts = await UserActivity.countDocuments({
        user: member._id,
        type: 'workout_complete',
        createdAt: { $gte: thirtyDaysAgo },
      })
      const expectedWorkouts = activeMembership.planId?.durationDays
        ? Math.min(30, Math.ceil(activeMembership.planId.durationDays / 2))
        : 15
      workoutCompletionScore = Math.min(100, (completedWorkouts / expectedWorkouts) * 100)
    }

    const overallScore = Math.round((checkinScore * 0.5) + (workoutCompletionScore * 0.5))

    const level = overallScore >= 80 ? 'good' : overallScore >= 50 ? 'average' : 'needs_improvement'
    const levelText = overallScore >= 80 ? 'Tốt' : overallScore >= 50 ? 'Trung bình' : 'Cần cải thiện'

    res.json({
      healthScore: {
        overall: overallScore,
        checkinScore: Math.round(checkinScore),
        workoutCompletionScore: Math.round(workoutCompletionScore),
        checkinCount,
        level,
        levelText,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}
