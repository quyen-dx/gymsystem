import mongoose from 'mongoose'
import { gymProAgent } from '../../src/ai/agent/gymProAgent.js'
import Plan from '../../src/models/Plan.js'
import PT from '../../src/models/PT.js'

/* ============================================================
   Phase 5 — Performance Measurement
   Tool latency, Mongo query latency, prompt size, tokens, response latency.
   ============================================================ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://daoxuanquyen333_db_user:Ffz9I2eUIlvydGkt@gym-cluster.fhqkyis.mongodb.net/gym'
const TEST_USER = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), role: 'member', email: 'test@example.com', fullName: 'Test User' }

const RESULTS = {} // domain -> { min, max, avg, count, toolLatencies: [], responseTime: [] }

function record(domain, metric, value) {
  if (!RESULTS[domain]) RESULTS[domain] = {}
  if (!RESULTS[domain][metric]) RESULTS[domain][metric] = []
  RESULTS[domain][metric].push(value)
}

function ms() { return Date.now() }

async function measureQuery(prompt, domain) {
  const start = ms()
  try {
    const result = await gymProAgent({
      query: prompt,
      user: TEST_USER,
      language: 'vi',
      conversationContext: { conversationId: `perf-${Date.now()}`, history: [] },
    })
    const end = ms()
    record(domain, 'totalResponseTime', end - start)
    record(domain, 'answerLength', (result?.answer || '').length)

    // Log tool results structure for analysis
    if (result?.toolData) {
      const toolKeys = Object.keys(result.toolData)
      record(domain, 'toolCount', toolKeys.length)
    }
    return result
  } catch (e) {
    record(domain, 'errors', e.message)
    return null
  }
}

async function measureMongoLatency() {
  console.log('\n--- Mongo Query Latency ---')
  const queries = [
    ['Plan.find({ isActive: true })', () => Plan.find({ isActive: true }).lean()],
    ['PT.find({ isActive: true })', () => PT.find({ isActive: true }).lean()],
    ['Plan.countDocuments', () => Plan.countDocuments({ isActive: true })],
    ['PT.countDocuments', () => PT.countDocuments({ isActive: true })],
  ]
  for (const [name, queryFn] of queries) {
    const latencies = []
    for (let i = 0; i < 3; i++) {
      const start = ms()
      await queryFn()
      latencies.push(ms() - start)
    }
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
    console.log(`  ${name}: avg ${avg.toFixed(0)}ms [${latencies.join(', ')}ms]`)
    record('mongo', name, avg)
  }
}

const testPrompts = [
  { prompt: 'Gym có bao nhiêu gói tập?', domain: 'plans' },
  { prompt: 'Có bao nhiêu PT?', domain: 'trainers' },
  { prompt: 'Gói Premium có giá bao nhiêu?', domain: 'plans_detail' },
  { prompt: 'Tôi muốn giảm cân thì tập thế nào?', domain: 'health_advice' },
  { prompt: 'Giờ mở cửa phòng gym?', domain: 'faq' },
]

async function main() {
  console.log('='.repeat(60))
  console.log('PHASE 5 — Performance Measurement')
  console.log('='.repeat(60))

  await mongoose.connect(MONGO_URI)
  console.log('MongoDB connected.\n')

  // Measure Mongo query latency
  await measureMongoLatency()

  // Measure AI response latency per domain
  console.log('\n--- AI Response Latency ---')
  for (const { prompt, domain } of testPrompts) {
    console.log(`  [${domain}] "${prompt}"`)
    const result = await measureQuery(prompt, domain)
    if (result) {
      const time = RESULTS[domain]?.totalResponseTime
      const lastTime = time ? time[time.length - 1] : 'N/A'
      console.log(`    Response time: ${lastTime}ms, Answer length: ${(result?.answer || '').length} chars`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('PERFORMANCE SUMMARY')
  console.log('='.repeat(60))

  let grandTotalTime = 0; let grandTotalCount = 0
  for (const [domain, metrics] of Object.entries(RESULTS)) {
    console.log(`\n--- ${domain} ---`)
    for (const [metric, values] of Object.entries(metrics)) {
      if (typeof values[0] === 'number') {
        const min = Math.min(...values)
        const max = Math.max(...values)
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        console.log(`  ${metric}: avg=${avg.toFixed(0)}ms min=${min}ms max=${max}ms count=${values.length}`)
        if (metric === 'totalResponseTime') { grandTotalTime += avg; grandTotalCount++ }
      } else {
        console.log(`  ${metric}: [${values.join(', ')}]`)
      }
    }
  }

  if (grandTotalCount > 0) {
    console.log(`\nOVERALL: Average response time = ${(grandTotalTime / grandTotalCount).toFixed(0)}ms`)
  }

  await mongoose.disconnect()
  console.log('\nDone.')
}

main()
