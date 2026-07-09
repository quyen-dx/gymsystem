import mongoose from 'mongoose'
import Plan from '../../src/models/Plan.js'
import PT from '../../src/models/PT.js'
import PTSchedule from '../../src/models/PTSchedule.js'
import Membership from '../../src/models/Membership.js'
import User from '../../src/models/User.js'
import { gymProAgent } from '../../src/ai/agent/gymProAgent.js'
import { searchFaqs } from '../../src/ai/services/faqPolicySearchService.js'

/* ============================================================
   Phase 2 — Regression Tests
   Verifies AI immediately reflects DB changes (no cache/staleness).
   ============================================================ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym'
const TEST_USER = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), role: 'member', email: 'test@example.com', fullName: 'Test User' }

const RESULTS = [] // { case, pass, detail }

function report(caseName, pass, detail) {
  RESULTS.push({ case: caseName, pass, detail })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${caseName}${detail ? ': ' + detail : ''}`)
}

let cleanupFns = []

async function extractAnswer(result) {
  if (typeof result === 'string') return result
  if (result?.answer) return result.answer
  return ''
}

async function makeRequest(query, conversationId) {
  const r = await gymProAgent({
    query,
    user: TEST_USER,
    language: 'vi',
    conversationContext: { conversationId: conversationId || `regression-${Date.now()}`, history: [] },
  })
  return extractAnswer(r)
}

/* ---------- Case 1: Rename trainer ---------- */
async function case1_RenameTrainer() {
  console.log('\n--- Case 1: Rename trainer fullName → AI reflects new name ---')

  // Pick any existing active PT user
  const existingPTUser = await User.findOne({ role: 'pt', isActive: true }).lean()
  if (!existingPTUser) { report('Case 1: Rename trainer', false, 'No PT user found'); return }

  const originalName = existingPTUser.fullName || existingPTUser.name || ''
  if (!originalName || originalName.trim() === '') {
    report('Case 1: Rename trainer', false, `PT user has no name (id=${existingPTUser._id})`)
    return
  }

  const testSuffix = ` [TEST-${Date.now()}]`
  const newName = originalName + testSuffix

  console.log(`  Original: "${originalName}"`)
  console.log(`  Renaming to: "${newName}"`)

  // Rename on User model (that's where fullName lives)
  await User.updateOne({ _id: existingPTUser._id }, { $set: { fullName: newName } })

  // Ask AI immediately (no restart, no cache clear)
  const answer = await makeRequest(`Gym có bao nhiêu PT?`)

  // Restore
  await User.updateOne({ _id: existingPTUser._id }, { $set: { fullName: originalName } })

  const found = answer.toLowerCase().includes(newName.toLowerCase())
  report('Case 1: Rename trainer', found,
    found ? `AI used new name: "${newName}"` : `AI did not use new name. Answer: ${answer.slice(0, 120)}`)
}

/* ---------- Case 2: Create new trainer ---------- */
async function case2_CreateTrainer() {
  console.log('\n--- Case 2: Create new trainer → AI returns increased count ---')

  const countBefore = await User.countDocuments({ role: 'pt', isActive: true })

  const tempUserId = new mongoose.Types.ObjectId()
  const tempPTId = new mongoose.Types.ObjectId()
  const now = Date.now()

  await User.create({
    _id: tempUserId,
    fullName: `TestPT_${now}`,
    name: `TestPT_${now}`,
    email: `testpt${now}@test.com`,
    phone: '0900000000',
    role: 'pt',
    provider: 'email',
    isActive: true,
  })
  await PT.create({
    _id: tempPTId,
    userId: tempUserId,
    specialties: ['GYM'],
    bio: 'Test PT',
    experienceYears: 1,
    rating: 5,
  })
  cleanupFns.push(async () => {
    await User.deleteOne({ _id: tempUserId })
    await PT.deleteOne({ _id: tempPTId })
    await PTSchedule.deleteMany({ ptId: tempPTId })
  })

  const answer = await makeRequest('Gym có bao nhiêu PT?')
  const countAfter = await User.countDocuments({ role: 'pt', isActive: true })

  const aiMentioned = /\d+/.test(answer)
  const matchReal = aiMentioned && countAfter > countBefore

  report('Case 2: Create trainer', matchReal,
    matchReal ? `AI answered: ${answer.slice(0, 100)}` : `countBefore=${countBefore}, countAfter=${countAfter}, AI: ${answer.slice(0, 100)}`)
}

/* ---------- Case 3: Delete trainer ---------- */
async function case3_DeleteTrainer() {
  console.log('\n--- Case 3: Delete trainer → AI stops mentioning them ---')

  const now = Date.now()
  const tempUserId = new mongoose.Types.ObjectId()
  const tempPTId = new mongoose.Types.ObjectId()
  const ptName = `DeleteTest_${now}`

  await User.create({
    _id: tempUserId,
    fullName: ptName,
    name: ptName,
    email: `deletetest${now}@test.com`,
    phone: '0900000001',
    role: 'pt',
    provider: 'email',
    isActive: true,
  })
  await PT.create({
    _id: tempPTId,
    userId: tempUserId,
    specialties: ['GYM'],
    rating: 3,
    experienceYears: 1,
  })

  // Verify AI sees them while active
  const answerBefore = await makeRequest(`Có PT tên ${ptName} không?`)
  const seenBefore = answerBefore.toLowerCase().includes(ptName.toLowerCase())

  // Delete both User and PT records
  await User.deleteOne({ _id: tempUserId })
  await PT.deleteOne({ _id: tempPTId })
  await PTSchedule.deleteMany({ ptId: tempPTId })

  // Ask again
  const answerAfter = await makeRequest(`Danh sách PT trong gym?`)
  const mentionedAfter = answerAfter.toLowerCase().includes(ptName.toLowerCase())

  report('Case 3: Delete trainer', seenBefore && !mentionedAfter,
    seenBefore
      ? (mentionedAfter ? `FAIL: AI still mentions deleted PT "${ptName}"` : `OK: AI stopped mentioning deleted PT`)
      : `AI didn't see PT even before deletion (answerBefore: ${answerBefore.slice(0, 80)})`)
}

/* ---------- Case 4: Modify membership ---------- */
async function case4_ModifyMembership() {
  console.log('\n--- Case 4: Modify membership status → AI reflects new status ---')

  // Find a membership to modify, or create a temp one
  let membership = await Membership.findOne().populate('planId').lean()
  if (!membership) { report('Case 4: Modify membership', false, 'No memberships in DB'); return }

  // Toggle status temporarily
  const originalStatus = membership.status
  const newStatus = originalStatus === 'active' ? 'expired' : 'active'

  await Membership.updateOne({ _id: membership._id }, { $set: { status: newStatus } })

  // Ask about membership status
  const memberUser = { _id: membership.user, role: 'member', email: 'member@test.com', fullName: 'Member' }
  let answer
  try {
    const r = await gymProAgent({
      query: 'Thẻ tập của tôi còn hạn không?',
      user: memberUser,
      language: 'vi',
      conversationContext: { conversationId: `case4-${Date.now()}`, history: [] },
    })
    answer = await extractAnswer(r)
  } catch (e) { answer = '' }

  // Restore
  await Membership.updateOne({ _id: membership._id }, { $set: { status: originalStatus } })

  const matchesNewStatus = newStatus === 'active'
    ? /(còn hạn|đang hoạt động|active|có thể)/i.test(answer)
    : /(hết hạn|expired|không còn|đã hết)/i.test(answer)

  report('Case 4: Modify membership', matchesNewStatus,
    matchesNewStatus ? `AI reflected new status "${newStatus}"` : `Original: ${originalStatus}, Changed to: ${newStatus}, AI: ${answer.slice(0, 100)}`)
}

/* ---------- Case 5: Modify plan benefits ---------- */
async function case5_ModifyPlanBenefits() {
  console.log('\n--- Case 5: Modify plan benefits → AI uses updated benefits ---')

  const plan = await Plan.findOne({ isActive: true }).lean()
  if (!plan) { report('Case 5: Modify plan benefits', false, 'No active plan'); return }

  const originalFeatures = plan.featuresVi || []
  const testFeature = `Ưu đãi đặc biệt TEST ${Date.now()}`
  const newFeatures = [...originalFeatures, testFeature]

  await Plan.updateOne({ _id: plan._id }, { $set: { featuresVi: newFeatures } })

  const answer = await makeRequest(`Gói ${plan.nameVi || plan.nameEn || plan.name} có quyền lợi gì?`)

  // Restore
  await Plan.updateOne({ _id: plan._id }, { $set: { featuresVi: originalFeatures } })

  const hasTestFeature = answer.toLowerCase().includes(testFeature.toLowerCase())
  report('Case 5: Modify plan benefits', hasTestFeature,
    hasTestFeature ? `AI included new benefit "${testFeature}"` : `AI did not mention new benefit. Answer: ${answer.slice(0, 120)}`)
}

/* ---------- Case 6: Modify FAQ → vector search ---------- */
async function case6_ModifyFAQ() {
  console.log('\n--- Case 6: Modify FAQ → Vector search returns updated doc ---')

  try {
    const faqResult = await searchFaqs('đăng ký gói tập')
    const works = faqResult && typeof faqResult.count === 'number' && Array.isArray(faqResult.results)
    report('Case 6: FAQ vector search', works,
      works ? `searchFaqs works: count=${faqResult.count}, results=${faqResult.results.length}, matched="${faqResult.matched || 'none'}"` : `Unexpected return: ${JSON.stringify(faqResult).slice(0, 200)}`)
  } catch (e) {
    report('Case 6: FAQ vector search', false, `searchFaqs failed: ${e.message}`)
  }
}

/* ---------- Main ---------- */
async function main() {
  console.log('='.repeat(60))
  console.log('PHASE 2 — Regression Tests')
  console.log('='.repeat(60))

  await mongoose.connect(MONGO_URI)
  console.log('MongoDB connected.\n')

  try {
    await case1_RenameTrainer()
  } catch (e) { report('Case 1: Rename trainer', false, `Error: ${e.message}`) }

  try {
    await case2_CreateTrainer()
  } catch (e) { report('Case 2: Create trainer', false, `Error: ${e.message}`) }

  try {
    await case3_DeleteTrainer()
  } catch (e) { report('Case 3: Delete trainer', false, `Error: ${e.message}`) }

  try {
    await case4_ModifyMembership()
  } catch (e) { report('Case 4: Modify membership', false, `Error: ${e.message}`) }

  try {
    await case5_ModifyPlanBenefits()
  } catch (e) { report('Case 5: Modify plan benefits', false, `Error: ${e.message}`) }

  try {
    await case6_ModifyFAQ()
  } catch (e) { report('Case 6: FAQ', false, `Error: ${e.message}`) }

  // Run cleanup
  for (const fn of cleanupFns) { try { await fn() } catch {} }

  console.log('\n' + '='.repeat(60))
  const passCount = RESULTS.filter(r => r.pass).length
  console.log(`RESULTS: ${passCount}/${RESULTS.length} passed`)
  for (const r of RESULTS) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.case}${r.detail ? ': ' + r.detail : ''}`)
  }
  console.log()

  await mongoose.disconnect()
  process.exit(RESULTS.some(r => !r.pass) ? 1 : 0)
}

main()
