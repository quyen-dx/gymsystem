import User from '../models/User.js'
import MembershipCycle from '../models/MembershipCycle.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import Transaction from '../models/Transaction.js'
import Order from '../models/Order.js'
import Payment from '../models/Payment.js'
import NotificationPreference from '../models/NotificationPreference.js'

export const exportMemberData = async (userId) => {
    const [profile, memberships, checkIns, bookings, transactions, orders, payments, notificationPreferences] = await Promise.all([
        User.findById(userId).select('-passwordHash -refreshTokens').lean(),
        MembershipCycle.find({ userId }).lean(),
        CheckIn.find({ userId }).lean(),
        Booking.find({ userId }).lean(),
        Transaction.find({ userId }).lean(),
        Order.find({ userId }).lean(),
        Payment.find({ userId }).lean(),
        NotificationPreference.findOne({ userId }).lean(),
    ])

    if (!profile) return null

    return {
        exportedAt: new Date().toISOString(),
        profile,
        memberships: memberships || [],
        checkIns: checkIns || [],
        bookings: bookings || [],
        transactions: transactions || [],
        orders: orders || [],
        payments: payments || [],
        notificationPreferences: notificationPreferences || null,
    }
}

export const anonymizeMemberData = async (userId) => {
    const user = await User.findById(userId)
    if (!user) return null

    const anonymizedId = `anonymized_${user._id}`

    user.name = anonymizedId
    user.email = `${anonymizedId}@deleted.local`
    user.phone = ''
    user.avatar = ''
    user.gender = 'other'
    user.dateOfBirth = null
    user.address = { street: '', ward: '', district: '', city: '' }
    user.isActive = false
    user.deletedAt = new Date()
    await user.save()

    return { userId: user._id, anonymizedAt: new Date().toISOString() }
}
