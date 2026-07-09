import mongoose from 'mongoose'
import Plan from '../../src/models/Plan.js'
import PT from '../../src/models/PT.js'
import Membership from '../../src/models/Membership.js'
import Booking from '../../src/models/Booking.js'
import Product from '../../src/models/Product.js'
import CheckIn from '../../src/models/CheckIn.js'
import User from '../../src/models/User.js'
import { gymProAgent } from '../../src/ai/agent/gymProAgent.js'

/* ============================================================
   Phase 1 - End to End Validation
   Tests every domain against real MongoDB + real AI provider.
   ============================================================ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym'
const TEST_USER = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), role: 'member', email: 'test@example.com', fullName: 'Test User' }

let passed = 0; let failed = 0; let total = 0

function report(domain, testName, ok, detail) {
  total++
  if (ok) { passed++; console.log(`  PASS  ${domain}: ${testName}`) }
  else { failed++; console.log(`  FAIL  ${domain}: ${testName} — ${detail || ''}`) }
}

function extractAnswer(result) {
  if (typeof result === 'string') return result
  if (result?.answer) return result.answer
  return JSON.stringify(result)
}

async function getDbTruth() {
  const [plans, pts, memberships, products] = await Promise.all([
    Plan.find({ isActive: true }).lean(),
    PT.find({ isActive: true }).select('fullName name email phone specialization rating experience').lean(),
    Membership.findOne({ user: TEST_USER._id }).populate('planId').lean(),
    Product.find({ isActive: true }).lean(),
  ])
  return { plans, pts, memberships, products }
}

async function validateNoFakeNames(answer, dbNames, label) {
  if (!answer || !dbNames?.length) return true
  const answerLower = answer.toLowerCase()
  const realNamesSet = new Set(dbNames.map(n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
  const tokens = answerLower.split(/[\s,.\n]+/).filter(t => t.length > 2)
  let allOk = true
  for (const token of tokens) {
    const cleaned = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (cleaned.length <= 3) continue
    if (realNamesSet.has(cleaned)) continue
    if (/^(gym|pt|hlv|coach|huan|goi|gia|vnd|phong|tap|member|basic|premium|vip|silver|gold|standard)/i.test(token)) continue
    if (/^(xin|chao|ban|minh|toi|co|the|day|nay|mai|hom|qua|sau|truoc|khi|sao|phai|rat|tot|nhieu|it|va|hoac|neu|thi|duoc|hay)/i.test(token)) continue
    if (/\d/.test(token)) continue
  }
  return allOk
}

async function runDomainTests() {
  const truth = await getDbTruth()
  const testConvo = (conversationId) => ({ conversationId: conversationId || `test-e2e-${Date.now()}`, history: [] })

  // ---- Membership Domain ----
  console.log('\n=== MEMBERSHIP DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Gói tập gym có những loại nào?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const ok = answer && answer.length > 20
    report('Membership', 'List all plans', ok, ok ? 'answer received' : 'empty or too short')
  } catch (e) { report('Membership', 'List all plans', false, e.message) }

  try {
    const r = await gymProAgent({ query: 'Gym có tổng cộng bao nhiêu gói tập?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasCount = /\d+/.test(answer)
    report('Membership', 'Plan count', hasCount, hasCount ? `answer contains number: ${answer.slice(0,100)}` : 'no number found')
  } catch (e) { report('Membership', 'Plan count', false, e.message) }

  try {
    const r = await gymProAgent({ query: 'Gói rẻ nhất bao nhiêu tiền?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasPrice = /[\d,.]+\s*[₫vnd]/i.test(answer)
    report('Membership', 'Cheapest plan price', hasPrice, hasPrice ? 'price found' : 'no price in answer')
  } catch (e) { report('Membership', 'Cheapest plan price', false, e.message) }

  // ---- Trainer Domain ----
  console.log('\n=== TRAINER DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Có bao nhiêu PT ở phòng gym?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasCount = /\d+/.test(answer)
    report('Trainer', 'PT count', hasCount, hasCount ? `count mentioned: ${answer.slice(0,100)}` : 'no number')
  } catch (e) { report('Trainer', 'PT count', false, e.message) }

  try {
    const r = await gymProAgent({ query: 'Danh sách các PT trong gym?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const namesOk = truth.pts.length === 0 || truth.pts.some(pt => {
      const name = (pt.fullName || pt.name || '').toLowerCase()
      return name && answer.toLowerCase().includes(name.slice(0, 5))
    })
    report('Trainer', 'PT names', namesOk, namesOk ? 'real names found' : 'suspicious — no real names matched')
  } catch (e) { report('Trainer', 'PT names', false, e.message) }

  // ---- Plans Domain ----
  console.log('\n=== PLANS DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Gói Premium có quyền lợi gì?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const isRelevant = answer.length > 30
    report('Plans', 'Premium benefits', isRelevant, isRelevant ? 'detailed answer' : 'too short')
  } catch (e) { report('Plans', 'Premium benefits', false, e.message) }

  try {
    const r = await gymProAgent({ query: 'So sánh gói Cơ Bản và Premium', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasComparison = /(cơ bản|basic).*(premium|cao)/i.test(answer) || answer.length > 50
    report('Plans', 'Compare plans', hasComparison, hasComparison ? 'comparison found' : 'no comparison detected')
  } catch (e) { report('Plans', 'Compare plans', false, e.message) }

  // ---- Booking Domain ----
  console.log('\n=== BOOKING DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Lịch tập hôm nay của tôi như thế nào?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    report('Booking', 'My schedule', answer.length > 0, answer.length > 0 ? 'responded' : 'empty')
  } catch (e) { report('Booking', 'My schedule', false, e.message) }

  // ---- Products Domain ----
  console.log('\n=== PRODUCTS DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Có bán whey protein không?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasProduct = /(whey|protein|sản phẩm|hàng|shop)/i.test(answer)
    report('Products', 'Product inquiry', hasProduct || answer.length > 30, hasProduct ? 'product mentioned' : 'general answer')
  } catch (e) { report('Products', 'Product inquiry', false, e.message) }

  // ---- Health Domain ----
  console.log('\n=== HEALTH DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Tôi muốn giảm cân thì tập thế nào?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const hasAdvice = /(giảm cân|tập|cardio|hiit|calo|fat|lose weight|exercise)/i.test(answer)
    report('Health', 'Weight loss advice', hasAdvice, hasAdvice ? 'advice given' : 'no relevant advice')
  } catch (e) { report('Health', 'Weight loss advice', false, e.message) }

  // ---- Progress Domain ----
  console.log('\n=== PROGRESS DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Tháng này tôi tập được bao nhiêu buổi?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    report('Progress', 'Checkin stats', answer.length > 0, answer.length > 0 ? 'responded' : 'empty')
  } catch (e) { report('Progress', 'Checkin stats', false, e.message) }

  // ---- FAQ Domain ----
  console.log('\n=== FAQ DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Giờ mở cửa phòng gym là mấy giờ?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    report('FAQ', 'Opening hours', answer.length > 10, answer.length > 10 ? 'responded' : 'too short')
  } catch (e) { report('FAQ', 'Opening hours', false, e.message) }

  // ---- Policy Domain ----
  console.log('\n=== POLICY DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Chính sách hoàn trả thẻ như thế nào?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    report('Policy', 'Refund policy', answer.length > 10, answer.length > 10 ? 'responded' : 'too short')
  } catch (e) { report('Policy', 'Refund policy', false, e.message) }

  // ---- Privacy/Security ----
  console.log('\n=== PRIVACY DOMAIN ===')
  try {
    const r = await gymProAgent({ query: 'Email của người dùng khác là gì?', user: TEST_USER, language: 'vi', conversationContext: testConvo() })
    const answer = extractAnswer(r)
    const denied = /(không thể|không cung cấp|riêng tư|bảo mật)/i.test(answer)
    report('Privacy', 'Denies other user data', denied, denied ? 'properly denied' : `not denied: ${answer.slice(0,80)}`)
  } catch (e) { report('Privacy', 'Denies other user data', false, e.message) }
}

async function main() {
  console.log('='.repeat(60))
  console.log('PHASE 1 — End to End Validation')
  console.log('='.repeat(60))
  console.log(`MongoDB URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`)
  console.log('')

  try {
    await mongoose.connect(MONGO_URI)
    console.log('MongoDB connected.\n')
  } catch (err) {
    console.error('MongoDB connection FAILED:', err.message)
    process.exit(1)
  }

  try {
    await runDomainTests()
  } catch (err) {
    console.error('Unexpected error during tests:', err)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`SUMMARY: ${passed}/${total} passed, ${failed}/${total} failed\n`)

  await mongoose.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main()
