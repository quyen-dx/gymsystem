/**
 * Migration script: khôi phục status='active' cho các WorkoutSchedule bị force-end sai.
 *
 * Tiêu chí "force-end sai":
 *   status='completed'  AND  TẤT CẢ sessions có status != 'completed' (toàn pending/skipped)
 *
 * Không đụng:
 *   - Schedule có status='active' (không cần khôi phục).
 *   - Schedule có status='completed' nhưng sessions có >=1 'completed' (kết thúc đúng).
 *   - Schedule có status='archived'/'cancelled' (trạng thái chủ động khác).
 *
 * Optional filters (để thu hẹp phạm vi khi cần):
 *   --template=ID            chỉ khôi phục schedules thuộc templateId này
 *   --totalWeeks=N           chỉ khôi phục schedules có totalWeeks=N (dùng kèm --template)
 *
 * Chạy:  npm run migrate:restore-force-ended-schedules          (DRY-RUN, toàn bộ victims)
 *        npm run migrate:restore-force-ended-schedules -- --commit
 *        npm run migrate:restore-force-ended-schedules -- --commit --template=ABC --totalWeeks=3
 */
import mongoose from 'mongoose'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import User from '../models/User.js'

const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--commit')
const FILTER_TEMPLATE = (args.find(a => a.startsWith('--template=')) || '').slice('--template='.length) || null
const FILTER_TOTAL_WEEKS = (() => {
  const val = (args.find(a => a.startsWith('--totalWeeks=')) || '').slice('--totalWeeks='.length)
  return val ? Number(val) : null
})()

async function getMemberInfo(memberId) {
  const u = await User.findById(memberId).select('name fullName memberCode memberNumber').lean()
  return u
    ? { id: String(u._id), name: u.fullName || u.name || '(không tên)', code: u.memberCode || u.memberNumber || '' }
    : { id: String(memberId), name: '(missing user)', code: '' }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log(`Connected to MongoDB. Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'COMMIT'}`)
  if (FILTER_TEMPLATE) console.log(`Filter: templateId=${FILTER_TEMPLATE}`)
  if (FILTER_TOTAL_WEEKS != null) console.log(`Filter: totalWeeks=${FILTER_TOTAL_WEEKS}`)
  console.log('------------------------------------------------------------')

  // Query all 'completed' schedules, analyze sessions.client
  const candidates = await WorkoutSchedule.find({ status: 'completed' }).lean()
  console.log(`Total WorkoutSchedule.status='completed': ${candidates.length}`)

  const victimSchedules = []
  const legitSchedules = []

  for (const s of candidates) {
    const sessions = s.sessions || []
    const completedCount = sessions.filter(x => x.status === 'completed').length
    const isForceEndedWrongly = sessions.length > 0 && completedCount === 0
    if (!isForceEndedWrongly) {
      legitSchedules.push({ s, completedCount, sessionTotal: sessions.length })
      continue
    }
    // Apply optional filters
    if (FILTER_TEMPLATE && String(s.templateId) !== FILTER_TEMPLATE) continue
    if (FILTER_TOTAL_WEEKS != null && Number(s.totalWeeks) !== FILTER_TOTAL_WEEKS) continue
    victimSchedules.push({ s, completedCount, sessionTotal: sessions.length })
  }

  console.log(`  -> Force-ended WRONG (all sessions pending, status=completed): ${victimSchedules.length}${FILTER_TEMPLATE || FILTER_TOTAL_WEEKS != null ? ' (within filters)' : ''}`)
  console.log(`  -> Legit completed  (at least 1 session completed):              ${legitSchedules.length}`)
  console.log('------------------------------------------------------------')

  // Group victims by member
  const byMember = new Map()
  for (const v of victimSchedules) {
    const mid = String(v.s.memberId)
    if (!byMember.has(mid)) byMember.set(mid, [])
    byMember.get(mid).push(v)
  }

  console.log(`\n[VICTIMS BY MEMBER] (${byMember.size} unique members)`)
  const memberReport = []
  for (const [mid, items] of byMember) {
    const info = await getMemberInfo(mid)
    const rows = items.map(v => ({
      sid: String(v.s._id),
      createdAt: v.s.createdAt?.toISOString?.(),
      updatedAt: v.s.updatedAt?.toISOString?.(),
      templateId: v.s.templateId?.toString?.() || null,
      weekIndex: v.s.weekIndex,
      totalWeeks: v.s.totalWeeks,
      sessionCount: v.sessionTotal,
    }))
    memberReport.push({ mid, info, rows })
    console.log(`  Member: ${info.code || 'no-code'}  ${info.name}  (memberId=${mid})  -> ${rows.length} schedules to restore`)
    for (const r of rows) {
      console.log(`     ws=${r.sid}  createdAt=${r.createdAt}  updatedAt=${r.updatedAt}  week=${r.weekIndex}/${r.totalWeeks}  sessions=${r.sessionCount}  templateId=${r.templateId}`)
    }
  }

  console.log('------------------------------------------------------------')
  console.log(`SUMMARY:`)
  console.log(`  Schedules to restore: ${victimSchedules.length}`)
  console.log(`  Unique members affected: ${byMember.size}`)
  console.log(`  Legit 'completed' schedules (untouched): ${legitSchedules.length}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes — use --commit to apply)' : 'COMMIT (changes saved)'}`)

  if (!DRY_RUN) {
    let restored = 0
    for (const v of victimSchedules) {
      await WorkoutSchedule.updateOne(
        { _id: v.s._id },
        { $set: { status: 'active' } },
      )
      restored++
    }
    console.log(`Restored ${restored} schedules to status='active'`)
  } else {
    console.log('\nTo apply, run: npm run migrate:restore-force-ended-schedules -- --commit')
  }

  process.exit(0)
}

main().catch(err => { console.error('Migration error:', err); process.exit(1) })