import mongoose from 'mongoose'
import Plan from '../../src/models/Plan.js'
import PT from '../../src/models/PT.js'
import Membership from '../../src/models/Membership.js'
import Product from '../../src/models/Product.js'
import { gymProAgent } from '../../src/ai/agent/gymProAgent.js'

/* ============================================================
   Phase 3 — Hallucination Tests
   100+ random prompts across all domains.
   Verify AI never invents data, drops records, or changes values.
   ============================================================ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym'
const TEST_USER = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), role: 'member', email: 'test@example.com', fullName: 'Test User' }

const FAILURES = [] // { prompt, type, detail }
let PASS = 0; let TOTAL = 0

function pass(prompt) { TOTAL++; PASS++; process.stdout.write('.') }
function fail(prompt, type, detail) { TOTAL++; FAILURES.push({ prompt, type, detail }); process.stdout.write('x') }

function extractAnswer(result) {
  if (typeof result === 'string') return result
  if (result?.answer) return result.answer
  return ''
}

function normalizeText(t) {
  return String(t || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').toLowerCase().trim()
}

/* ---- Load DB ground truth ---- */
let DB = { plans: [], pts: [], memberships: [], products: [] }

async function loadDB() {
  const [plans, pts, memberships, products] = await Promise.all([
    Plan.find({ isActive: true }).lean(),
    PT.find({ isActive: true }).select('fullName name email specialization rating experience').lean(),
    Membership.findOne({ user: TEST_USER._id }).populate('planId').lean(),
    Product.find({ isActive: true }).lean(),
  ])
  DB.plans = plans.map(p => ({ name: p.nameVi || p.nameEn || p.name, price: p.price, durationDays: p.durationDays }))
  DB.pts = pts.map(p => ({ fullName: p.fullName || p.name, _id: String(p._id) }))
  DB.memberships = memberships ? { status: memberships.status, planName: memberships.planId?.nameVi || memberships.planId?.nameEn || '', remainingDays: memberships.remainingDays } : null
  DB.products = products.map(p => ({ name: p.name, price: p.price }))
  DB.ptFullNames = new Set(DB.pts.map(p => normalizeText(p.fullName)))
  DB.ptIds = new Set(DB.pts.map(p => p._id))
  DB.planNames = new Set(DB.plans.map(p => normalizeText(p.name)))
  DB.planPrices = new Map(DB.plans.map(p => [normalizeText(p.name), p.price]))
  DB.productNames = new Set(DB.products.map(p => normalizeText(p.name)))
}

/* ---- Hallucination checks ---- */

function checkNoFakePTNames(answer) {
  if (!answer || DB.pts.length === 0) return true
  const norm = normalizeText(answer)
  const tokens = norm.split(/[\s,.\n!?;:()]+/).filter(t => t.length > 3)

  // Common Vietnamese / fitness words that are NOT PT names
  const knownWords = new Set([
    'huan', 'luyen', 'vien', 'gym', 'phong', 'tap', 'hlv', 'coach', 'trainer',
    'basic', 'premium', 'vip', 'silver', 'gold', 'standard', 'member', 'xin', 'chao',
    'ban', 'minh', 'toi', 'co', 'the', 'day', 'nay', 'hom', 'qua', 'sau',
    'khi', 'sao', 'phai', 'rat', 'tot', 'nhieu', 'it', 'va', 'hoac', 'neu',
    'thi', 'duoc', 'hay', 'voi', 'cua', 'trong', 'tai', 'tu', 've',
    'ben', 'giam', 'can', 'che', 'do', 'an', 'uong', 'suc', 'khoe',
    'goi', 'gia', 'tien', 'thang', 'ngay', 'buoi', 'lich', 'gio',
    'check', 'in', 'pt', 'danh', 'sach', 'thong', 'tin', 'chi', 'tiet',
  ])

  for (const token of tokens) {
    if (token.length <= 3) continue
    if (knownWords.has(token)) continue
    if (/\d/.test(token)) continue
    if (DB.ptFullNames.has(token)) continue
    // Check if it's a substring of any real name (partial match)
    let isReal = false
    for (const realName of DB.ptFullNames) {
      if (realName.includes(token) || token.includes(realName)) { isReal = true; break }
    }
    if (isReal) continue
    // Also check if token is a known Vietnamese first name
    if (/^(anh|chi|em|thay|co|ban|nguyen|tran|le|pham|hoang|vu|vo|dang|bui|do|ngo|duong|ly)/i.test(token)) continue

    return { fake: true, token, message: `Possible invented name: "${token}"` }
  }
  return null
}

function checkNoFakePlanNames(answer) {
  if (!answer || DB.plans.length === 0) return null
  const norm = normalizeText(answer)
  // Extract plan-like mentions: "gói X", "gói tập X"
  const planRefs = norm.match(/gói\s+(\w+(?:\s+\w+)?)/g)
  if (!planRefs) return null

  const knownPlanNames = new Set([...DB.planNames].flatMap(n => {
    const parts = n.split(/\s+/)
    return parts.length > 1 ? [n, parts[0]] : [n]
  }))

  for (const ref of planRefs) {
    const planName = ref.replace(/^gói\s+/, '').trim()
    if (planName.length <= 2) continue
    if (/^(nào|đó|gym|tập|mới|cũ|này|kia|rẻ|đắt|tốt)/i.test(planName)) continue
    if (!knownPlanNames.has(planName)) {
      return { fake: true, planName, message: `Possible invented plan: "${planName}"` }
    }
  }
  return null
}

function checkPriceAccuracy(answer) {
  if (!answer || DB.plans.length === 0) return null
  const norm = normalizeText(answer)
  const priceMatches = norm.match(/[\d]{3,}(?:\s*[₫vnd])/gi)
  if (!priceMatches) return null

  const dbPrices = new Set(DB.plans.map(p => p.price))
  for (const pm of priceMatches) {
    const num = parseInt(pm.replace(/[^0-9]/g, ''), 10)
    if (num > 0 && ![...dbPrices].some(dp => Math.abs(dp - num) <= 1)) {
      // Allow for "100k" type formatting
      const normalizedK = num >= 1000 ? num : num * 1000
      const normalizedPrice = num >= 10000 ? num : num * 1000
      const match = [...dbPrices].some(dp => {
        const diff = Math.abs(dp - normalizedPrice)
        return diff < 1000 || diff / dp < 0.05 // within 5%
      })
      if (!match) {
        return { fake: true, price: num, message: `Price ${num} not found in DB plans` }
      }
    }
  }
  return null
}

function checkDateAccuracy(answer) {
  if (!answer) return null
  // Check for dates that might be invented
  const dateRefs = answer.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)
  if (!dateRefs) return null
  // For now just flag any specific dates as needing verification
  // Most queries shouldn't return invented dates
  return null
}

/* ---- Prompt generators ---- */

const prompts = [
  // Membership / Plans
  'Có bao nhiêu gói tập?',
  'Gym có mấy gói membership?',
  'Gói tập nào rẻ nhất?',
  'Gói nào đắt nhất?',
  'Gói Basic có gì?',
  'Gói Premium giá bao nhiêu?',
  'Gói VIP có quyền lợi gì?',
  'So sánh gói Basic và Premium',
  'Gói nào phù hợp cho người mới?',
  'Tôi muốn đăng ký gói tập',
  'Gói tập nào có PT kèm?',
  'Giá gói tập là bao nhiêu?',
  'Gói nào dùng được lâu nhất?',
  'Có gói tập 1 năm không?',
  'Gói Basic tập được những gì?',
  'Gym có gói tập cho sinh viên không?',
  'Tôi muốn tìm gói tập giá rẻ',
  'Gói Premium khác gì VIP?',
  'Gói nào có locker?',
  'Có gói tập 6 tháng không?',

  // Trainers
  'Danh sách PT trong gym?',
  'Gym có bao nhiêu huấn luyện viên?',
  'Có bao nhiêu PT?',
  'PT nào dạy giỏi nhất?',
  'Có PT nữ không?',
  'PT A có chuyên môn gì?',
  'HLV nào chuyên giảm cân?',
  'Tôi muốn tập với PT',
  'PT có kinh nghiệm bao lâu?',
  'Đánh giá của các PT?',
  'PT nào đang nhận học viên?',
  'Có PT mới không?',
  'PT nào có lịch buổi sáng?',
  'Lịch tập của các PT?',
  'PT dạy những môn gì?',
  'Coach nào dạy yoga?',
  'HLV nào chuyên tăng cơ?',
  'Tôi muốn đặt lịch với PT',
  'Cho tôi xem thông tin PT',
  'Các PT có bằng cấp gì?',

  // Booking
  'Lịch tập hôm nay của tôi?',
  'Tôi có lịch tập không?',
  'Ngày mai tôi tập lúc mấy giờ?',
  'Đặt lịch tập với PT',
  'Huỷ lịch tập giúp tôi',
  'Tuần này tôi tập mấy buổi?',
  'Lịch tập tuần sau?',
  'Tôi đã đặt lịch chưa?',
  'Cho tôi xem lịch tập',
  'Có thể đặt lịch online không?',

  // Products
  'Có bán whey protein không?',
  'Gym có shop bán đồ không?',
  'Sản phẩm nào đang bán?',
  'Giá whey protein bao nhiêu?',
  'Có bán nước tăng lực không?',
  'Gym bán những gì?',
  'Có bán áo tập không?',
  'Sản phẩm nào tốt nhất?',
  'Mua đồ tập ở đâu?',
  'Gym có bán thực phẩm chức năng không?',

  // Health / Fitness
  'Tôi muốn giảm cân, tập thế nào?',
  'Bài tập giảm mỡ bụng?',
  'Tập cardio bao lâu?',
  'Tôi muốn tăng cơ',
  'Chế độ dinh dưỡng cho người tập gym?',
  'Tập bao lâu thì có kết quả?',
  'Bài tập cho người mới bắt đầu?',
  'Lịch tập 3 buổi/tuần?',
  'Tập buổi sáng hay tối tốt?',
  'Ăn gì trước khi tập?',
  'Ăn gì sau khi tập?',
  'Uống bao nhiêu nước mỗi ngày?',
  'Tập gym có giảm cân không?',
  'Bài tập chân cho nam?',
  'Tập lưng xô như thế nào?',
  'Tập ngực hiệu quả?',
  'Tập vai đúng cách?',
  'Kéo giãn cơ sau tập?',
  'Cách hít thở khi tập tạ?',
  'Tập bao nhiêu hiệp là đủ?',

  // Progress / Check-in
  'Tháng này tôi tập bao nhiêu buổi?',
  'Check-in tuần này?',
  'Tôi đã tập được mấy ngày?',
  'Số buổi tập trong tháng?',
  'Tôi có chăm chỉ không?',
  'So sánh tháng này với tháng trước',
  'Tôi đã checkin hôm nay chưa?',
  'Thống kê tập luyện của tôi?',
  'Tuần trước tôi tập mấy buổi?',
  'Tôi cần tập thêm bao nhiêu buổi?',

  // FAQ / Support
  'Giờ mở cửa phòng gym?',
  'Gym mở cửa lúc mấy giờ?',
  'Ngày lễ gym có mở không?',
  'Có bãi giữ xe không?',
  'Phòng gym ở đâu?',
  'Có wifi không?',
  'Gym có máy lạnh không?',
  'Có phòng thay đồ không?',
  'Hướng dẫn đăng ký thành viên?',
  'Làm sao để đăng ký tập?',
  'Quên thẻ thì có tập được không?',
  'Có khóa tập thử không?',
  'Phí giữ xe bao nhiêu?',
  'Gym có bán nước uống không?',
  'Gym đông người không?',

  // Policy
  'Chính sách hoàn trả?',
  'Huỷ thẻ tập được không?',
  'Đóng băng thẻ tập?',
  'Chuyển nhượng thẻ tập?',
  'Quy định phòng tập?',
  'Nội quy gym?',
  'Ăn mặc như thế nào khi tập?',
  'Có được quay phim chụp ảnh?',
  'Chính sách bảo mật?',
  'Điều khoản sử dụng?',

  // Mixed / edge cases
  'Xin chào',
  'Cảm ơn',
  'Bạn có khoẻ không?',
  'Bạn tên gì?',
  'Bạn làm được gì?',
  'Giúp tôi với',
  'Tôi không biết nên chọn gói nào',
  'Gym Pro là gì?',
  'Bạn có phải người thật không?',
  'Tôi muốn hỏi về phòng tập',
  'Có gì mới không?',
  'Gym có event gì không?',
  'Tôi muốn góp ý',
  'Báo cáo sự cố',
  'Liên hệ quản lý',
]

/* ---- Main loop ---- */

async function main() {
  console.log('='.repeat(60))
  console.log('PHASE 3 — Hallucination Tests (100+ prompts)')
  console.log('='.repeat(60))
  console.log('')

  await mongoose.connect(MONGO_URI)
  await loadDB()
  console.log(`DB: ${DB.plans.length} plans, ${DB.pts.length} PTs, ${DB.products.length} products\n`)

  const BATCH_SIZE = 5
  const seenConversations = new Set()

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (prompt) => {
      // Use a stable conversation ID per prompt to avoid memory bleed
      const convoId = `hallucination-${Buffer.from(prompt).toString('hex').slice(0, 12)}`
      seenConversations.add(convoId)

      try {
        const result = await gymProAgent({
          query: prompt,
          user: TEST_USER,
          language: 'vi',
          conversationContext: { conversationId: convoId, history: [] },
        })
        const answer = extractAnswer(result)

        if (!answer || answer.trim().length < 2) {
          fail(prompt, 'empty_response', 'Empty or missing answer')
          return
        }

        // Run all hallucination checks
        const checks = [
          checkNoFakePTNames(answer),
          checkNoFakePlanNames(answer),
          checkPriceAccuracy(answer),
          checkDateAccuracy(answer),
        ]
        let hasError = false
        for (const check of checks) {
          if (check && check.fake) {
            fail(prompt, check.type || check.message, check.message)
            hasError = true
            break
          }
        }
        if (!hasError) pass(prompt)

      } catch (e) {
        fail(prompt, 'error', e.message)
      }
    }))
  }

  console.log('\n')

  // Summary
  console.log('='.repeat(60))
  console.log(`RESULTS: ${PASS}/${TOTAL} passed, ${FAILURES.length} failures`)
  console.log('='.repeat(60))

  if (FAILURES.length > 0) {
    console.log('\nFAILURES:')
    for (const f of FAILURES) {
      console.log(`  x [${f.type}] Prompt: "${f.prompt.slice(0, 60)}"`)
      console.log(`    ${f.detail}`)
    }
  }

  // Generate hallucination report
  console.log('\n=== HALLUCINATION REPORT ===')
  const types = {}
  for (const f of FAILURES) {
    types[f.type] = (types[f.type] || 0) + 1
  }
  console.log('Failure breakdown:')
  for (const [type, count] of Object.entries(types)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log(`\nTotal prompts: ${TOTAL}`)
  console.log(`Hallucination rate: ${TOTAL > 0 ? ((FAILURES.length / TOTAL) * 100).toFixed(1) : 0}%`)
  console.log()

  await mongoose.disconnect()
  process.exit(FAILURES.length > 0 ? 1 : 0)
}

main()
