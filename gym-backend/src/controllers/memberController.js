import mongoose from 'mongoose'
import User from '../models/User.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import Payment from '../models/Payment.js'
import Plan from '../models/Plan.js'
import UserActivity from '../models/UserActivity.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import TrainingClass from '../models/TrainingClass.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingRequest from '../models/TrainingRequest.js'
import { buildClientUrl } from '../config/appUrls.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { recordUserActivity } from '../services/userActivityService.js'
import { sendRenewalSuccessEmail } from '../services/emailService.js'
import AppError from '../utils/appError.js'
import sendError from '../utils/sendError.js'
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/identifier.js'
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js'
import { calculateRemainingDays } from '../utils/dateUtils.js'
import { getActivePeriodEndDate } from '../utils/membershipDays.js'

const PLAN_OFFLINE_PAYMENT_TYPE = 'PLAN_PURCHASE_OFFLINE'
const BANK_INFO = {
  bankName: process.env.GYM_BANK_NAME || 'Vietcombank',
  accountName: process.env.GYM_BANK_ACCOUNT_NAME || 'GYMPRO - TRUNG TAM THE HINH',
  accountNumber: process.env.GYM_BANK_ACCOUNT_NUMBER || '1234567890',
}

const buildTransferContent = (member, plan) => {
  const code = member.memberCode || `GP${String(member.memberNumber || '').padStart(3, '0')}` || member._id.toString().slice(-6).toUpperCase()
  const planName = String(plan.nameVi || plan.nameEn || 'GOI TAP')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
  return `${code} ${planName}`.slice(0, 80)
}

const getPlanPurchasePayment = async ({ paymentId, memberId, planId, session }) => {
  const query = Payment.findOne({
    _id: paymentId,
    userId: memberId,
    planId,
    type: PLAN_OFFLINE_PAYMENT_TYPE,
  })
  return session ? query.session(session) : query
}

const sanitizeMember = (user) => {
  const obj = normalizeUserMemberIdentity(user)
  delete obj.password
  delete obj.refreshToken
  return obj
}

export const getMembers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      keyword = '',
      planId,
      status,
      membershipStatus,
      remainingDays: remainingDaysFilter,
      remainingDaysMin,
      remainingDaysMax,
      checkinMin,
      checkinMax,
      sortBy = 'memberNumber',
      sortOrder = 'asc',
    } = req.query

    const filter = { role: 'member' }
    const searchTerm = String(keyword || search || '').trim()

    if (searchTerm) {
      const phone = searchTerm.replace(/\s/g, '')
      const isPhoneSearch = /^(0|\+84)\d{8,9}$/.test(phone)
      const isMemberCodeSearch = /^GP\d+$/i.test(searchTerm)
      if (isPhoneSearch) {
        filter.phone = { $regex: phone.replace(/^0/, '(+84|0)'), $options: 'i' }
      } else if (isMemberCodeSearch) {
        filter.memberCode = { $regex: searchTerm, $options: 'i' }
      } else {
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { fullName: { $regex: searchTerm, $options: 'i' } },
          { memberCode: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } },
        ]
      }
    }

    if (status === 'active') filter.isActive = true
    else if (status === 'locked') filter.isActive = false

    const users = await User.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .lean()

    const membersWithMembership = await Promise.all(
      users.map(async (user) => {
        const activeCycle = await MembershipCycle.findOne({
          memberId: user._id,
          status: 'active',
        })
          .populate('currentPlanId', 'nameVi nameEn price durationDays color')
          .sort({ createdAt: -1 })
          .lean()

        const membershipHistory = await Membership.find({ memberId: user._id })
          .populate('planId', 'nameVi nameEn')
          .sort({ createdAt: -1 })
          .lean()

        const periodEndDate = activeCycle
          ? await getActivePeriodEndDate({ membershipId: activeCycle.currentMembershipId, cycle: activeCycle })
          : null

        let remainingDays = 0
        if (periodEndDate) {
          remainingDays = calculateRemainingDays(periodEndDate)
        }

        const checkinCount = await UserActivity.countDocuments({
          user: user._id,
          type: 'checkin',
        })

        const membershipExpired = Boolean(activeCycle && (!periodEndDate || new Date(periodEndDate) < new Date()))
        const hasActivePlan = Boolean(activeCycle && !membershipExpired && remainingDays > 0)
        let matchFilter = false
        if (planId && activeCycle) {
          matchFilter = activeCycle.currentPlanId?._id?.toString() === planId
        } else if (planId) {
          matchFilter = false
        } else {
          matchFilter = true
        }

        if (remainingDaysMin && remainingDays < Number(remainingDaysMin)) matchFilter = false
        if (remainingDaysMax && remainingDays > Number(remainingDaysMax)) matchFilter = false
        if (remainingDaysFilter) {
          const matchesRemainingRange = (() => {
            switch (String(remainingDaysFilter)) {
              case '0-7':
                return remainingDays >= 0 && remainingDays <= 7
              case '8-30':
                return remainingDays >= 8 && remainingDays <= 30
              case '31-90':
                return remainingDays >= 31 && remainingDays <= 90
              case '90+':
                return remainingDays > 90
              // Backward compatibility for old clients; still use actual remainingDays.
              case 'under7':
                return remainingDays >= 0 && remainingDays <= 7
              case 'under15':
                return remainingDays >= 0 && remainingDays <= 14
              case 'under30':
                return remainingDays >= 0 && remainingDays <= 29
              default:
                return true
            }
          })()
          if (!matchesRemainingRange) matchFilter = false
        }
        if (membershipStatus === 'no_plan' && activeCycle) matchFilter = false
        if (membershipStatus === 'active' && !hasActivePlan) matchFilter = false
        if (membershipStatus === 'expiring' && (!hasActivePlan || remainingDays > 7)) matchFilter = false
        if (membershipStatus === 'expired' && !membershipExpired) matchFilter = false
        if (checkinMin && checkinCount < Number(checkinMin)) matchFilter = false
        if (checkinMax && checkinCount > Number(checkinMax)) matchFilter = false

        return {
          ...normalizeUserMemberIdentity(user),
          remainingDays,
          activeMembership: activeCycle ? {
            _id: activeCycle.currentMembershipId,
            memberId: user._id,
            planId: activeCycle.currentPlanId,
            status: 'active',
            startDate: activeCycle.startDate,
            endDate: periodEndDate,
            remainingDays,
          } : null,
          membershipHistory,
          checkinCount,
          membershipExpired,
          matchFilter,
        }
      })
    )

    const filteredMembers = membersWithMembership.filter((m) => m.matchFilter)
    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.max(1, Number(limit) || 20)
    const pagedMembers = filteredMembers.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber)

    res.json({
      members: pagedMembers,
      pagination: {
        total: filteredMembers.length,
        filtered: filteredMembers.length,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(filteredMembers.length / limitNumber),
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

    const [totalMembers, newThisMonth, lockedMembers] = await Promise.all([
      User.countDocuments({ role: 'member' }),
      User.countDocuments({ role: 'member', createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ role: 'member', isActive: false }),
    ])

    const expiredMemberships = await MembershipCycle.countDocuments({
      status: 'completed',
    })

    const expiringMemberships = await MembershipCycle.countDocuments({
      status: 'active',
      expiresAt: { $gte: now, $lte: sevenDaysFromNow },
    })

    const activeMemberships = await MembershipCycle.countDocuments({ status: 'active' })

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

    const cycles = await MembershipCycle.find({
      status: 'active',
      expiresAt: { $gte: now, $lte: sevenDaysFromNow },
    })
      .populate('memberId', 'name email phone avatar')
      .populate('currentPlanId', 'nameVi nameEn durationDays price')
      .sort({ expiresAt: 1 })
      .lean()

    const members = await Promise.all(cycles.map(async (c) => {
      const periodEndDate = await getActivePeriodEndDate({ membershipId: c.currentMembershipId, cycle: c })
      return {
        ...c.memberId,
        membership: {
          plan: c.currentPlanId,
          startDate: c.startDate,
          endDate: periodEndDate,
          remainingDays: periodEndDate ? calculateRemainingDays(periodEndDate) : 0,
        },
      }
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

    const [activeCycle, membershipHistory] = await Promise.all([
      MembershipCycle.findOne({ memberId: user._id, status: 'active' })
        .populate('currentPlanId')
        .sort({ createdAt: -1 })
        .lean(),
      Membership.find({ memberId: user._id })
        .populate('planId', 'nameVi nameEn durationDays price color')
        .sort({ createdAt: -1 })
        .lean(),
    ])

    const periodEndDate = activeCycle
      ? await getActivePeriodEndDate({ membershipId: activeCycle.currentMembershipId, cycle: activeCycle })
      : null

    const remainingDays = periodEndDate ? calculateRemainingDays(periodEndDate) : 0

    const activeMembership = activeCycle ? {
      _id: activeCycle.currentMembershipId,
      memberId: user._id,
      planId: activeCycle.currentPlanId,
      status: 'active',
      startDate: activeCycle.startDate,
      endDate: periodEndDate,
      remainingDays,
    } : null

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

    const pwd = password || 'member123'
    if (pwd.length < 6) throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400)

    const userData = {
      name: name.trim(),
      role: 'member',
      provider: email ? 'email' : 'phone',
      isVerified: true,
      password: pwd,
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

export const createOfflinePlanPayment = async (req, res) => {
  try {
    const { planId, method, confirmed = false, flow = 'register' } = req.body
    const paymentMethod = String(method || '').toUpperCase().trim()

    if (!planId) throw new AppError('planId là bắt buộc', 400)
    if (!['CASH', 'POS', 'BANK_TRANSFER'].includes(paymentMethod)) {
      throw new AppError('Phương thức thanh toán không hợp lệ', 400)
    }

    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') throw new AppError('Không tìm thấy hội viên', 404)

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    if (paymentMethod !== 'BANK_TRANSFER' && !confirmed) {
      throw new AppError('Staff phải xác nhận đã thu tiền trước khi tạo payment', 400)
    }

    const transferContent = buildTransferContent(member, plan)
    const status = paymentMethod === 'BANK_TRANSFER' ? 'PENDING' : 'PAID'
    const payment = await Payment.create({
      userId: member._id,
      planId: plan._id,
      amount: Number(plan.price || 0),
      currency: 'vnd',
      status,
      type: PLAN_OFFLINE_PAYMENT_TYPE,
      paymentMethod,
      method: paymentMethod,
      source: 'OFFLINE',
      paidAt: status === 'PAID' ? new Date() : null,
      metadata: {
        purpose: PLAN_OFFLINE_PAYMENT_TYPE,
        staffId: req.user._id,
        staffName: req.user.name || req.user.fullName || '',
        flow,
        transferContent,
        bankInfo: BANK_INFO,
      },
    })

    const paymentUrl = paymentMethod === 'BANK_TRANSFER'
      ? buildClientUrl(`/bank-transfer/${payment._id}`)
      : ''

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentUrl,
        status: payment.status,
        type: payment.type,
        amount: payment.amount,
        method: payment.paymentMethod,
        transferContent,
        bankInfo: BANK_INFO,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getOfflinePlanPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      type: PLAN_OFFLINE_PAYMENT_TYPE,
    })
      .populate('userId', 'name fullName email phone memberCode memberNumber avatar')
      .populate('planId', 'nameVi nameEn price durationDays')
      .lean()

    if (!payment) throw new AppError('Không tìm thấy payment mua gói', 404)

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        type: payment.type,
        amount: payment.amount,
        method: payment.paymentMethod || payment.method,
        member: payment.userId,
        plan: payment.planId,
        bankInfo: payment.metadata?.bankInfo || BANK_INFO,
        transferContent: payment.metadata?.transferContent || payment.txnRef || String(payment._id),
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const confirmOfflinePlanPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      type: PLAN_OFFLINE_PAYMENT_TYPE,
    })

    if (!payment) throw new AppError('Không tìm thấy payment mua gói', 404)
    if (payment.status !== 'PAID') {
      payment.status = 'PAID'
      payment.paidAt = new Date()
      payment.metadata = {
        ...(payment.metadata || {}),
        customerConfirmedAt: new Date(),
      }
      await payment.save()
    }

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
      },
    })
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
    const { planId, paymentId } = req.body
    if (!planId) throw new AppError('planId là bắt buộc', 400)
    if (!paymentId) throw new AppError('paymentId là bắt buộc', 400)

    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    const existingActive = await MembershipCycle.findOne({
      memberId: member._id,
      status: 'active',
    })

    if (existingActive) {
      throw new AppError('Member đang có gói tập active. Hãy gia hạn hoặc đợi hết hạn.', 400)
    }

    const payment = await getPlanPurchasePayment({ paymentId, memberId: member._id, planId: plan._id })
    if (!payment) throw new AppError('Không tìm thấy payment mua gói phù hợp', 404)
    if (payment.status !== 'PAID') throw new AppError('Payment chưa PAID, không thể đăng ký gói', 400)
    if (Number(payment.amount) < Number(plan.price || 0)) {
      throw new AppError('Số tiền payment không đủ giá gói', 400)
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
      status: 'active',
      source: 'staff',
      paymentId: payment._id,
    })

    const cycle = await MembershipCycle.create({
      memberId: member._id,
      currentMembershipId: membership._id,
      currentPlanId: plan._id,
      startDate,
      expiresAt: endDate,
      durationDays: plan.durationDays,
      status: 'active',
      purchasedAt: new Date(),
      activatedAt: new Date(),
    })

    payment.membershipId = membership._id
    payment.metadata = {
      ...(payment.metadata || {}),
      activatedAt: new Date(),
      activatedBy: req.user._id,
    }
    await payment.save()

    await recordUserActivity({
      userId: member._id,
      type: 'membership',
      title: 'Đăng ký gói tập',
      description: `Đăng ký gói "${plan.nameVi}" - ${plan.durationDays} ngày`,
      metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentType: PLAN_OFFLINE_PAYMENT_TYPE },
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
        startDate: cycle.startDate,
        endDate: cycle.expiresAt,
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
    const { planId, paymentId, renewFrom = 'endDate' } = req.body
    if (!planId) throw new AppError('planId là bắt buộc', 400)
    if (!paymentId) throw new AppError('paymentId là bắt buộc', 400)

    const member = await User.findById(req.params.id)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy member', 404)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    const activeCycle = await MembershipCycle.findOne({
      memberId: member._id,
      status: 'active',
    }).populate('currentPlanId')

    if (!activeCycle) {
      throw new AppError('Hội viên chưa có gói tập để gia hạn.', 400)
    }

    const currentPlanId = String(activeCycle.currentPlanId?._id || activeCycle.currentPlanId)
    if (currentPlanId !== String(plan._id)) {
      throw new AppError('Chỉ có thể gia hạn gói tập hiện tại của hội viên.', 400)
    }

    const payment = await getPlanPurchasePayment({ paymentId, memberId: member._id, planId: plan._id })
    if (!payment) throw new AppError('Không tìm thấy payment mua gói phù hợp', 404)
    if (payment.status !== 'PAID') throw new AppError('Payment chưa PAID, không thể gia hạn gói', 400)
    if (Number(payment.amount) < Number(plan.price || 0)) {
      throw new AppError('Số tiền payment không đủ giá gói', 400)
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let startDate
    if (renewFrom === 'endDate') {
      const prevEnd = new Date(activeCycle.expiresAt)
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
      status: 'active',
      source: 'staff',
      paymentId: payment._id,
    })

    const cycle = await MembershipCycle.create({
      memberId: member._id,
      currentMembershipId: membership._id,
      currentPlanId: plan._id,
      startDate,
      expiresAt: endDate,
      durationDays: plan.durationDays,
      status: 'active',
      purchasedAt: new Date(),
      activatedAt: new Date(),
      previousCycleId: activeCycle._id,
    })

    payment.membershipId = membership._id
    payment.metadata = {
      ...(payment.metadata || {}),
      activatedAt: new Date(),
      activatedBy: req.user._id,
    }
    await payment.save()

    await recordUserActivity({
      userId: member._id,
      type: 'membership',
      title: 'Gia hạn gói tập',
      description: `Gia hạn gói "${plan.nameVi}" thêm ${plan.durationDays} ngày`,
      metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, renewFrom, paymentType: PLAN_OFFLINE_PAYMENT_TYPE },
    })

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: member,
      details: `Gia hạn gói "${plan.nameVi}" cho member (từ ${renewFrom === 'endDate' ? 'ngày hết hạn cũ' : 'hôm nay'})`,
    })

    if (member.email) {
      sendRenewalSuccessEmail({
        toEmail: member.email,
        userName: member.fullName || member.name || member.email,
        planName: plan.nameVi || plan.nameEn,
        endDate: cycle.expiresAt,
      }).catch((e) => console.error('Gửi email gia hạn thất bại:', e.message))
    }

    res.json({
      message: 'Gia hạn gói tập thành công',
      membership: {
        id: membership._id,
        plan: { nameVi: plan.nameVi, nameEn: plan.nameEn, durationDays: plan.durationDays },
        startDate: cycle.startDate,
        endDate: cycle.expiresAt,
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
      const existingCycle = await MembershipCycle.findOne({
        memberId: member._id,
        status: 'active',
      }).populate('currentPlanId')

      if (!existingCycle) {
        results.push({
          memberId: member._id,
          memberName: member.name,
          error: 'Hội viên chưa có gói tập để gia hạn.',
        })
        continue
      }

      const existingPlanId = String(existingCycle.currentPlanId?._id || existingCycle.currentPlanId)
      if (existingPlanId !== String(plan._id)) {
        results.push({
          memberId: member._id,
          memberName: member.name,
          error: 'Hội viên đang dùng gói tập khác, không thể gia hạn hàng loạt.',
        })
        continue
      }

      let startDate
      if (renewFrom === 'endDate') {
        const prevEnd = new Date(existingCycle.expiresAt)
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
        status: 'active',
      })

      const cycle = await MembershipCycle.create({
        memberId: member._id,
        currentMembershipId: membership._id,
        currentPlanId: plan._id,
        startDate,
        expiresAt: endDate,
        durationDays: plan.durationDays,
        status: 'active',
        purchasedAt: new Date(),
        activatedAt: new Date(),
        previousCycleId: existingCycle._id,
      })

      if (member.email) {
        sendRenewalSuccessEmail({
          toEmail: member.email,
          userName: member.fullName || member.name || member.email,
          planName: plan.nameVi || plan.nameEn,
          endDate: cycle.expiresAt,
        }).catch((e) => console.error('Gửi email gia hạn thất bại:', e.message))
      }

      results.push({
        memberId: member._id,
        memberName: member.name,
        membershipId: membership._id,
        endDate: cycle.expiresAt,
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

    const [checkinCount, activeCycle] = await Promise.all([
      UserActivity.countDocuments({
        user: member._id,
        type: 'checkin',
        createdAt: { $gte: thirtyDaysAgo },
      }),
      MembershipCycle.findOne({ memberId: member._id, status: 'active' }).populate('currentPlanId').lean(),
    ])

    const expectedCheckins = 15
    const checkinScore = Math.min(100, (checkinCount / expectedCheckins) * 100)

    let workoutCompletionScore = 0
    if (activeCycle) {
      const completedWorkouts = await UserActivity.countDocuments({
        user: member._id,
        type: 'workout_complete',
        createdAt: { $gte: thirtyDaysAgo },
      })
      const expectedWorkouts = activeCycle.currentPlanId?.durationDays
        ? Math.min(30, Math.ceil(activeCycle.currentPlanId.durationDays / 2))
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

export const createMemberAndRegister = async (req, res) => {
  try {
    const { name, email, phone, dateOfBirth, gender, password, planId, paymentMethod, amountPaid, memo } = req.body

    if (!name?.trim()) throw new AppError('Họ tên là bắt buộc', 400)
    if (!planId) throw new AppError('planId là bắt buộc', 400)
    if (!paymentMethod) throw new AppError('Phương thức thanh toán là bắt buộc', 400)

    const existingUser = email
      ? await User.findOne({ email: email.toLowerCase() })
      : phone
        ? await User.findOne({ phone: normalizePhone(phone) })
        : null

    if (existingUser) {
      throw new AppError('Email hoặc số điện thoại đã tồn tại', 400)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    if (!amountPaid || Number(amountPaid) < Number(plan.price)) {
      throw new AppError('Số tiền thu phải lớn hơn hoặc bằng giá gói tập', 400)
    }

    const validMethods = ['CASH', 'BANK_TRANSFER', 'POS']
    const method = String(paymentMethod || '').toUpperCase().trim()
    if (!validMethods.includes(method)) {
      throw new AppError('Phương thức thanh toán không hợp lệ. Chấp nhận: CASH, BANK_TRANSFER, POS', 400)
    }

    const pwd = password || 'member123'
    if (pwd.length < 6) throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400)

    const userData = {
      name: name.trim(),
      role: 'member',
      provider: email ? 'email' : 'phone',
      isVerified: true,
      password: pwd,
    }
    if (email) userData.email = email.toLowerCase().trim()
    if (phone) userData.phone = normalizePhone(phone)
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth)
    if (gender) userData.gender = gender

    const user = await User.create(userData)

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const startDate = new Date(now)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Number(plan.durationDays) - 1)
    endDate.setHours(23, 59, 59, 999)

    const membership = await Membership.create({
      memberId: user._id,
      planId: plan._id,
      status: 'active',
    })

    const cycle = await MembershipCycle.create({
      memberId: user._id,
      currentMembershipId: membership._id,
      currentPlanId: plan._id,
      startDate,
      expiresAt: endDate,
      durationDays: plan.durationDays,
      status: 'active',
      purchasedAt: new Date(),
      activatedAt: new Date(),
    })

    const payment = await Payment.create({
      userId: user._id,
      planId: plan._id,
      membershipId: membership._id,
      amount: Number(amountPaid),
      currency: 'vnd',
      status: 'PAID',
      paymentMethod: method,
      source: 'OFFLINE',
      paidAt: new Date(),
      metadata: {
        staffId: req.user._id,
        staffName: req.user.name || req.user.fullName || '',
        memo: String(memo || '').trim(),
        registrationType: 'create_and_register',
      },
    })

    membership.paymentId = payment._id
    await membership.save()

    await recordUserActivity({
      userId: user._id,
      type: 'membership',
      title: 'Đăng ký gói tập',
      description: `Nhân viên ${req.user.name || ''} tạo tài khoản và đăng ký gói "${plan.nameVi || plan.nameEn}" - ${plan.durationDays} ngày | ${method} ${Number(amountPaid).toLocaleString('vi-VN')}đ`,
      metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentMethod: method, source: 'OFFLINE', staffId: req.user._id },
    })

    await recordAuditLog({
      req,
      module: 'users',
      action: 'create',
      entity: user,
      details: `Nhân viên ${req.user.name || ''} tạo member + đăng ký gói "${plan.nameVi || plan.nameEn}" (${method} ${Number(amountPaid).toLocaleString('vi-VN')}đ)`,
    })

    res.status(201).json({
      message: 'Tạo member và đăng ký gói tập thành công',
      member: sanitizeMember(user),
      membership: {
        id: membership._id,
        plan: { nameVi: plan.nameVi, nameEn: plan.nameEn, durationDays: plan.durationDays },
        startDate: cycle.startDate,
        endDate: cycle.expiresAt,
        remainingDays: calculateRemainingDays(endDate),
        status: membership.status,
      },
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.paymentMethod,
        status: payment.status,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const searchMembers = async (req, res) => {
  try {
    const { q } = req.query
    if (!q || String(q).trim().length < 1) {
      return res.json({ members: [] })
    }

    const keyword = String(q).trim()
    const isObjectId = mongoose.Types.ObjectId.isValid(keyword)
    const conditions = [
      { fullName: { $regex: keyword, $options: 'i' } },
      { name: { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } },
      { phone: { $regex: keyword, $options: 'i' } },
      { memberCode: { $regex: keyword, $options: 'i' } },
    ]
    if (isObjectId) {
      conditions.push({ _id: keyword })
    }
    if (/^\d+$/.test(keyword)) {
      conditions.push({ memberNumber: Number(keyword) })
    }

    const members = await User.find({
      role: 'member',
      $or: conditions,
    })
      .select('name fullName email phone memberCode memberNumber isActive status')
      .limit(20)
      .lean()

    const memberIds = members.map((m) => m._id)
    const activeCycles = await MembershipCycle.find({
      memberId: { $in: memberIds },
      status: 'active',
    })
      .populate('currentPlanId', 'nameVi nameEn price durationDays')
      .sort({ createdAt: -1 })
      .lean()

    const cycleByMemberId = {}
    for (const c of activeCycles) {
      if (!cycleByMemberId[String(c.memberId)]) {
        cycleByMemberId[String(c.memberId)] = c
      }
    }

    const result = await Promise.all(members.map(async (member) => {
      const cycle = cycleByMemberId[String(member._id)] || null
      const periodEndDate = cycle
        ? await getActivePeriodEndDate({ membershipId: cycle.currentMembershipId, cycle })
        : null
      return {
        _id: member._id,
        name: member.fullName || member.name,
        email: member.email,
        phone: member.phone,
        memberCode: member.memberCode,
        memberNumber: member.memberNumber,
        isActive: member.isActive,
        status: member.status,
        currentPlan: cycle
          ? {
              planName: cycle.currentPlanId?.nameVi || cycle.currentPlanId?.nameEn || '',
              startDate: cycle.startDate,
              endDate: periodEndDate,
              remainingDays: periodEndDate ? calculateRemainingDays(periodEndDate) : 0,
            }
          : null,
      }
    }))

    res.json({ members: result })
  } catch (error) {
    return sendError(res, error)
  }
}

export const offlineRegisterMembership = async (req, res) => {
  try {
    const { memberId, planId, paymentMethod, amountPaid, note } = req.body
    if (!memberId) throw new AppError('memberId là bắt buộc', 400)
    if (!planId) throw new AppError('planId là bắt buộc', 400)

    const member = await User.findById(memberId)
    if (!member || member.role !== 'member') {
      throw new AppError('Không tìm thấy hội viên', 404)
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true })
    if (!plan) throw new AppError('Không tìm thấy gói tập hợp lệ', 404)

    if (!amountPaid || Number(amountPaid) < Number(plan.price)) {
      throw new AppError('Số tiền thu phải lớn hơn hoặc bằng giá gói tập', 400)
    }

    const validMethods = ['CASH', 'BANK_TRANSFER', 'POS']
    const method = String(paymentMethod || '').toUpperCase().trim()
    if (!validMethods.includes(method)) {
      throw new AppError('Phương thức thanh toán không hợp lệ. Chấp nhận: CASH, BANK_TRANSFER, POS', 400)
    }

    const existingActive = await MembershipCycle.findOne({
      memberId: member._id,
      status: 'active',
    })

    if (existingActive) {
      throw new AppError('Hội viên đang có gói hoạt động. Vui lòng gia hạn trong mục Gói tập của tôi hoặc dùng chức năng gia hạn offline.', 400)
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
      status: 'active',
    })

    const cycle = await MembershipCycle.create({
      memberId: member._id,
      currentMembershipId: membership._id,
      currentPlanId: plan._id,
      startDate,
      expiresAt: endDate,
      durationDays: plan.durationDays,
      status: 'active',
      purchasedAt: new Date(),
      activatedAt: new Date(),
    })

    const payment = await Payment.create({
      userId: member._id,
      planId: plan._id,
      membershipId: membership._id,
      amount: Number(amountPaid),
      currency: 'vnd',
      status: 'PAID',
      paymentMethod: method,
      source: 'OFFLINE',
      paidAt: new Date(),
      metadata: {
        staffId: req.user._id,
        staffName: req.user.name || req.user.fullName || '',
        note: String(note || '').trim(),
        registrationType: 'offline',
      },
    })

    membership.paymentId = payment._id
    await membership.save()

    await recordUserActivity({
      userId: member._id,
      type: 'membership',
      title: 'Đăng ký gói tập offline',
      description: `Nhân viên ${req.user.name || req.user.fullName || ''} đăng ký gói "${plan.nameVi || plan.nameEn}" - ${plan.durationDays} ngày | ${method} ${Number(amountPaid).toLocaleString('vi-VN')}đ`,
      metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentMethod: method, source: 'OFFLINE', staffId: req.user._id },
    })

    await recordAuditLog({
      req,
      module: 'users',
      action: 'create',
      entity: membership,
      details: `Đăng ký gói tập offline: "${plan.nameVi || plan.nameEn}" cho ${member.fullName || member.name || member.email} (${method} ${Number(amountPaid).toLocaleString('vi-VN')}đ)`,
    })

    res.status(201).json({
      message: 'Đăng ký gói tập offline thành công',
      membership: {
        id: membership._id,
        plan: { nameVi: plan.nameVi, nameEn: plan.nameEn, durationDays: plan.durationDays },
        startDate: cycle.startDate,
        endDate: cycle.expiresAt,
        remainingDays: calculateRemainingDays(endDate),
        status: membership.status,
      },
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.paymentMethod,
        source: payment.source,
        status: payment.status,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMyEnrollmentStatus = async (req, res) => {
  try {
    const memberId = req.user._id

    // Chỉ trả về enrollment data nếu member có membership đang active
    const activeCycle = await MembershipCycle.findOne({ memberId, status: 'active' }).lean()
    if (!activeCycle) {
      return res.json({
        hasActiveEnrollment: false,
        assignmentType: null,
        hasActiveSchedules: false,
        hasPendingRequest: false,
        pendingRequest: null,
        pt: null,
        class: null,
        workout: null,
      })
    }

    const [assignment, trainingAssignment, classEnrollment, pendingRequest, activeSchedules] = await Promise.all([
      PTAssignment.findOne({ memberId, status: 'active' })
        .populate('ptId', 'name fullName email')
        .populate('workoutId', 'name goal')
        .lean(),
      TrainingAssignment.findOne({ memberId, status: 'active' })
        .populate('classId')
        .lean(),
      ClassEnrollment.findOne({ memberId, status: 'active' })
        .populate('classId', 'name code specialization daysOfWeek startTime endTime')
        .lean(),
      TrainingRequest.findOne({ memberId, status: 'pending' })
        .select('_id specialization timeSlots daysOfWeek')
        .lean(),
      WorkoutSchedule.countDocuments({ memberId, status: 'active' }),
    ])

    let classInfo = null
    // Nguồn lớp hợp lệ: TrainingAssignment (legacy) HOẶC ClassEnrollment (hiện tại).
    // Ưu tiên TrainingAssignment, fallback ClassEnrollment để không bỏ sót hội viên nhóm.
    const classSource = trainingAssignment?.classId || classEnrollment?.classId
    if (classSource) {
      const cls = typeof classSource === 'object'
        ? classSource
        : await TrainingClass.findById(classSource)
            .select('name code specialization daysOfWeek startTime endTime')
            .lean()
      if (cls) {
        classInfo = {
          classId: cls._id,
          name: cls.name,
          code: cls.code,
          specialization: cls.specialization,
          daysOfWeek: cls.daysOfWeek,
          time: `${cls.startTime} - ${cls.endTime}`,
        }
      }
    }

    const ptInfo = assignment?.ptId && typeof assignment.ptId === 'object'
      ? { ptId: assignment.ptId._id, name: assignment.ptId.fullName || assignment.ptId.name }
      : null

    const workoutInfo = assignment?.workoutId && typeof assignment.workoutId === 'object'
      ? { name: assignment.workoutId.name, goal: assignment.workoutId.goal }
      : null

    // Loại hình tập luyện là nguồn quyết định nút thao tác:
    // - Đang trong lớp nhóm (dù có PTAssignment do PT lớp tạo ra) → 'group' → chỉ hiển thị "Rời lớp"
    // - Chỉ có PT riêng (không trong lớp) → 'private' → chỉ hiển thị "Rời PT"
    let assignmentType = null
    if (classInfo) assignmentType = 'group'
    else if (ptInfo) assignmentType = 'private'

    const hasActiveEnrollment = !!(assignment || trainingAssignment || classEnrollment)

    res.json({
      hasActiveEnrollment,
      assignmentType,
      hasActiveSchedules: activeSchedules > 0,
      hasPendingRequest: !!pendingRequest,
      pendingRequest: pendingRequest
        ? { _id: pendingRequest._id, specialization: pendingRequest.specialization, timeSlots: pendingRequest.timeSlots, daysOfWeek: pendingRequest.daysOfWeek }
        : null,
      pt: ptInfo,
      class: classInfo,
      workout: workoutInfo,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
