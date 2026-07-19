/**
 * DIAGNOSTIC SCRIPT: Trace cancellation/refund data flow
 * 
 * Usage: node scripts/diagnoseRefundFlow.js <memberId OR email>
 * 
 * If no argument, lists all members with pending cancellation requests.
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gym'

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('✅ Connected to MongoDB\n')

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }))
  const MembershipCycle = mongoose.model('MembershipCycle', new mongoose.Schema({}, { strict: false, collection: 'membershipcycles' }))
  const MembershipCancellationRequest = mongoose.model('MembershipCancellationRequest', new mongoose.Schema({}, { strict: false, collection: 'membershipcancellationrequests' }))
  const Membership = mongoose.model('Membership', new mongoose.Schema({}, { strict: false, collection: 'memberships' }))
  const Plan = mongoose.model('Plan', new mongoose.Schema({}, { strict: false, collection: 'plans' }))
  const RefundRequest = mongoose.model('RefundRequest', new mongoose.Schema({}, { strict: false, collection: 'refundrequests' }))
  const PlanChangeHistory = mongoose.model('PlanChangeHistory', new mongoose.Schema({}, { strict: false, collection: 'planchangehistories' }))

  const input = process.argv[2]
  let memberIds = []

  if (input) {
    // Find member by ID or email
    const filter = mongoose.Types.ObjectId.isValid(input)
      ? { _id: new mongoose.Types.ObjectId(input) }
      : { $or: [{ email: { $regex: input, $options: 'i' } }, { memberCode: { $regex: input, $options: 'i' } }] }
    const users = await User.find(filter).select('_id fullName name email memberCode').lean()
    memberIds = users.map(u => u._id)
    if (memberIds.length === 0) {
      console.log('❌ No member found with that ID/email')
      process.exit(1)
    }
    console.log(`\n📋 Found ${memberIds.length} matching member(s):`)
    for (const u of users) {
      console.log(`   ${u._id} | ${u.fullName || u.name || 'N/A'} | ${u.email || 'N/A'} | ${u.memberCode || 'N/A'}`)
    }
  } else {
    // List all members with pending cancellation requests
    console.log('📋 Listing all members with pending cancellation requests...')
    const pendingCancels = await MembershipCancellationRequest.find({ status: 'pending' }).select('memberId').lean()
    memberIds = [...new Set(pendingCancels.map(c => c.memberId.toString()))]
    console.log(`   Found ${memberIds.length} member(s) with pending cancellations\n`)
    for (const mid of memberIds) {
      const u = await User.findById(mid).select('fullName name email memberCode').lean()
      console.log(`   ${mid} | ${u?.fullName || u?.name || 'N/A'} | ${u?.email || 'N/A'} | ${u?.memberCode || 'N/A'}`)
    }
    if (memberIds.length === 0) {
      const allCancels = await MembershipCancellationRequest.find().sort({ createdAt: -1 }).limit(5).lean()
      console.log('   No pending cancellations. Recent cancellations:', allCancels.length)
      for (const c of allCancels) {
        console.log(`     ${c._id} | memberId: ${c.memberId} | status: ${c.status} | refundEligible: ${c.refundEligible} | amount: ${c.estimatedRefundAmount}`)
      }
    }
  }

  // For each member, trace full data
  for (const memberId of memberIds) {
    console.log('\n' + '='.repeat(80))
    console.log(`🔍 TRACING MEMBER: ${memberId}`)
    console.log('='.repeat(80))

    // --- 1. MembershipCycle ---
    console.log('\n─── 1. MEMBERSHIP CYCLES ───')
    const cycles = await MembershipCycle.find({ memberId }).sort({ createdAt: -1 }).lean()
    if (cycles.length === 0) {
      console.log('   (no cycles found)')
    }
    for (const c of cycles) {
      console.log(`   _id:             ${c._id}`)
      console.log(`   status:          ${c.status}`)
      console.log(`   purchasedAt:     ${c.purchasedAt || 'NULL ⚠️'}`)
      console.log(`   activatedAt:     ${c.activatedAt || 'NULL'}`)
      console.log(`   expiresAt:       ${c.expiresAt || 'NULL'}`)
      console.log(`   startDate:       ${c.startDate || 'NULL'}`)
      console.log(`   endDate:         ${c.endDate || 'NULL'}`)
      console.log(`   durationDays:    ${c.durationDays}`)
      console.log(`   refundEligible:  ${c.refundEligible}`)
      console.log(`   firstBenefitUsedAt: ${c.firstBenefitUsedAt || 'NULL'}`)
      console.log(`   currentPlanId:   ${c.currentPlanId}`)
      console.log(`   currentMembershipId: ${c.currentMembershipId}`)
      console.log(`   refundExpiredAt: ${c.refundExpiredAt || 'NULL'}`)
      console.log(`   createdAt:       ${c.createdAt}`)
      console.log(`   updatedAt:       ${c.updatedAt}`)
      console.log('')
    }

    // --- 2. Cancellation Requests ---
    console.log('─── 2. CANCELLATION REQUESTS ───')
    const cancels = await MembershipCancellationRequest.find({ memberId }).sort({ createdAt: -1 }).lean()
    if (cancels.length === 0) {
      console.log('   (no cancellation requests)')
    }
    for (const cr of cancels) {
      console.log(`   _id:                 ${cr._id}`)
      console.log(`   status:              ${cr.status}`)
      console.log(`   membershipCycleId:   ${cr.membershipCycleId || 'NULL ⚠️'}`)
      console.log(`   planId:              ${cr.planId}`)
      console.log(`   refundEligible:      ${cr.refundEligible}`)
      console.log(`   estimatedRefundAmount: ${cr.estimatedRefundAmount} (${cr.estimatedRefundAmount === 0 ? '⚠️ ZERO' : 'OK'})`)
      console.log(`   finalRefundAmount:   ${cr.finalRefundAmount}`)
      console.log(`   policyCode:          ${cr.policyCode}`)
      console.log(`   policyLabel:         ${cr.policyLabel}`)
      console.log(`   refundRate:          ${cr.refundRate}`)
      console.log(`   totalDays:           ${cr.totalDays}`)
      console.log(`   usedDays:            ${cr.usedDays}`)
      console.log(`   registeredAt:        ${cr.registeredAt || 'NULL'}`)
      console.log(`   requestedAt:         ${cr.requestedAt || 'NULL'}`)
      console.log(`   createdAt:           ${cr.createdAt}`)
      console.log('')
    }

    // --- 3. Plan ---
    console.log('─── 3. PLAN ───')
    if (cancels.length > 0 && cancels[0].planId) {
      const plan = await Plan.findById(cancels[0].planId).lean()
      if (plan) {
        console.log(`   _id:          ${plan._id}`)
        console.log(`   nameVi:       ${plan.nameVi}`)
        console.log(`   price:        ${plan.price}`)
        console.log(`   durationDays: ${plan.durationDays}`)
      }
    } else if (cycles.length > 0 && cycles[0].currentPlanId) {
      const plan = await Plan.findById(cycles[0].currentPlanId).lean()
      if (plan) {
        console.log(`   _id:          ${plan._id}`)
        console.log(`   nameVi:       ${plan.nameVi}`)
        console.log(`   price:        ${plan.price}`)
        console.log(`   durationDays: ${plan.durationDays}`)
      }
    } else {
      console.log('   (no plan found)')
    }

    // --- 4. Membership ---
    console.log('\n─── 4. MEMBERSHIPS ───')
    const memberships = await Membership.find({ memberId }).sort({ createdAt: -1 }).lean()
    if (memberships.length === 0) {
      console.log('   (no memberships)')
    }
    for (const m of memberships) {
      console.log(`   _id:        ${m._id}`)
      console.log(`   status:     ${m.status}`)
      console.log(`   startDate:  ${m.startDate}`)
      console.log(`   endDate:    ${m.endDate}`)
      console.log(`   planId:     ${m.planId}`)
      console.log(`   createdAt:  ${m.createdAt}`)
      console.log('')
    }

    // --- 5. PlanChangeHistory ---
    console.log('─── 5. PLAN CHANGE HISTORY ───')
    const changes = await PlanChangeHistory.find({ memberId }).sort({ changedAt: -1 }).lean()
    if (changes.length === 0) {
      console.log('   (no history)')
    }
    for (const ch of changes) {
      console.log(`   ${ch.changedAt || ch.createdAt} | type: ${ch.changeType || ch.type} | from: ${ch.fromPlanId} | to: ${ch.toPlanId} | amount: ${ch.amount}`)
    }

    // --- 6. RefundRequest (period-based) ---
    console.log('\n─── 6. REFUND REQUESTS (period-based) ───')
    const refunds = await RefundRequest.find({ memberId }).sort({ createdAt: -1 }).lean()
    if (refunds.length === 0) {
      console.log('   (none)')
    }
    for (const r of refunds) {
      console.log(`   _id:      ${r._id}`)
      console.log(`   status:   ${r.status}`)
      console.log(`   amount:   ${r.refundAmount}`)
      console.log(`   periodId: ${r.membershipPeriodId}`)
      console.log(`   policy:   ${r.refundPolicyResult}`)
      console.log('')
    }
  }

  console.log('\n✅ Diagnostic complete')
  await mongoose.disconnect()
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
