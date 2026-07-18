/**
 * Cleanup script: dọn PTAssignment bị trùng (nhiều hơn 1 active cho cùng cặp memberId+ptId).
 *
 * Quy tắc chọn "hợp lệ":
 *   - Ưu tiên bản có >=1 WorkoutSchedule.status='active' liên quan (theo memberId+templateId).
 *   - Nếu nhiều bản cùng có / không có schedule active -> chọn bản createdAt mới nhất.
 *
 * Không đụng:
 *   - Bản active hợp lệ (được giữ).
 *   - Bản không active.
 *
 * Output log:
 *   - Số cặp (memberId+ptId) bị trùng
 *   - Danh sách chi tiết từng cặp + bản được giữ + bản bị hủy
 *
 * Chạy:  npm run cleanup:dup-pt-assignments                     (DRY-RUN)
 *        npm run cleanup:dup-pt-assignments -- --commit
 */
import mongoose from 'mongoose'
import PTAssignment from '../models/PTAssignment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import User from '../models/User.js'

const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--commit')

async function getUserInfo(id) {
  const u = await User.findById(id).select('name fullName memberCode memberNumber').lean()
  return u
    ? { name: u.fullName || u.name || '(no name)', code: u.memberCode || u.memberNumber || '' }
    : { name: '(missing user)', code: '' }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log(`Connected to MongoDB. Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'COMMIT'}`)
  console.log('------------------------------------------------------------')

  // 1) Tìm các cặp (memberId, ptId) có >1 PTAssignment active
  const groups = await PTAssignment.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: { memberId: '$memberId', ptId: '$ptId' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ])

  console.log(`Found ${groups.length} (memberId+ptId) pairs with more than 1 active PTAssignment`)
  console.log('------------------------------------------------------------')

  if (groups.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  const allIds = groups.flatMap(g => g.ids)
  const assignments = await PTAssignment.find({ _id: { $in: allIds } }).lean()
  const byId = new Map(assignments.map(a => [String(a._id), a]))

  // For each assignment: count active WorkoutSchedules for (memberId, templateId=workoutId)
  const scheduleCountByAssignment = new Map()
  for (const a of assignments) {
    if (!a.workoutId) {
      scheduleCountByAssignment.set(String(a._id), 0)
      continue
    }
    const cnt = await WorkoutSchedule.countDocuments({
      memberId: a.memberId,
      templateId: a.workoutId,
      status: 'active',
    })
    scheduleCountByAssignment.set(String(a._id), cnt)
  }

  const report = []
  let totalToCancel = 0

  for (const g of groups) {
    const items = g.ids.map(id => byId.get(String(id))).filter(Boolean)
    // Sort: scheduleCount DESC, then createdAt DESC
    items.sort((a, b) => {
      const sa = scheduleCountByAssignment.get(String(a._id)) || 0
      const sb = scheduleCountByAssignment.get(String(b._id)) || 0
      if (sb !== sa) return sb - sa
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const keep = items[0]
    const toCancel = items.slice(1)

    const memberInfo = await getUserInfo(g._id.memberId)
    const ptInfo = await getUserInfo(g._id.ptId)

    const keepDetails = {
      id: String(keep._id),
      workoutId: keep.workoutId,
      createdAt: keep.createdAt?.toISOString(),
      activeSchedules: scheduleCountByAssignment.get(String(keep._id)) || 0,
    }
    const cancelDetails = toCancel.map(a => ({
      id: String(a._id),
      workoutId: a.workoutId,
      createdAt: a.createdAt?.toISOString(),
      activeSchedules: scheduleCountByAssignment.get(String(a._id)) || 0,
    }))

    report.push({
      memberId: String(g._id.memberId),
      ptId: String(g._id.ptId),
      memberInfo,
      ptInfo,
      totalActive: items.length,
      keep: keepDetails,
      cancel: cancelDetails,
    })
    totalToCancel += toCancel.length
  }

  // Detailed log
  console.log('\n[DETAIL LOG]')
  for (const r of report) {
    console.log(`\n  Member: ${r.memberInfo.code || 'no-code'}  ${r.memberInfo.name}  (memberId=${r.memberId})`)
    console.log(`  PT:      ${r.ptInfo.code || 'no-code'}  ${r.ptInfo.name}  (ptId=${r.ptId})`)
    console.log(`  Total active PTAssignments for this pair: ${r.totalActive}`)
    console.log(`  => KEEP:    id=${r.keep.id}  workoutId=${r.keep.workoutId}  createdAt=${r.keep.createdAt}  activeSchedules=${r.keep.activeSchedules}`)
    for (const c of r.cancel) {
      console.log(`  => CANCEL:  id=${c.id}  workoutId=${c.workoutId}  createdAt=${c.createdAt}  activeSchedules=${c.activeSchedules}`)
    }
  }

  console.log('\n------------------------------------------------------------')
  console.log(`SUMMARY:`)
  console.log(`  Duplicate pairs to clean: ${report.length}`)
  console.log(`  PTAssignments to cancel:  ${totalToCancel}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes — use --commit to apply)' : 'COMMIT (changes saved)'}`)

  if (!DRY_RUN) {
    let cancelled = 0
    for (const r of report) {
      for (const c of r.cancel) {
        await PTAssignment.updateOne(
          { _id: new mongoose.Types.ObjectId(c.id) },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: 'cleanup_duplicate_pt_assignment',
            },
          },
        )
        cancelled++
      }
    }
    console.log(`Cancelled ${cancelled} PTAssignment records`)
  } else {
    console.log('\nTo apply: npm run cleanup:dup-pt-assignments -- --commit')
  }

  process.exit(0)
}

main().catch(err => { console.error('Cleanup error:', err); process.exit(1) })