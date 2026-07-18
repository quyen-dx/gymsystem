/**
 * Migration script: khởi tạo ClassEnrollment cho các hội viên đang active.
 *
 * Chiến lược (theo thứ tự ưu tiên — PHIÊN BẢN 3):
 *  1. [PRIMARY] WorkoutSchedule gần nhất theo createdAt (status != 'cancelled'),
 *     lấy classCode từ session gần "hôm nay" nhất. Bao gồm cả status='completed'
 *     vì phản ánh đúng lớp hiện tại của hội viên (xử lý edge case hội viên đang
 *     ở trong lớp nhưng tạm thời không có giáo án 'active').
 *  2. [FALLBACK — CẢNH BÁO] TrainingAssignment status='active' mới nhất theo
 *     createdAt DESC (nguồn DEPRECATED, có thể chứa dữ liệu cũ/sai). Nếu phải
 *     dùng fallback, log sẽ đánh dấu WARNING để admin kiểm tra thủ công.
 *
 * Giới hạn: chỉ migrate cho hội viên có PTAssignment.status='active'.
 * Quy tắc: 1 hội viên chỉ được active ở 1 lớp — script chỉ tạo DUY NHẤT 1
 * enrollment active cho mỗi member (lớp mớ nhất).
 * Mọi bản ghi tạo ra đều có sourceReason='auto_migrated'.
 *
 * Chạy:  npm run migrate:class-enrollments          (DRY-RUN)
 *        npm run migrate:class-enrollments -- --commit
 */
import mongoose from 'mongoose'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import PTAssignment from '../models/PTAssignment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import User from '../models/User.js'

const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--commit')

async function findClassForMember({ memberId }) {
  // 1) [PRIMARY] WorkoutSchedule gần nhất theo createdAt, status != 'cancelled'
  //    (bao gồm 'active' + 'completed' + 'archived' — completed phản ánh lớp hiện tại)
  const now = Date.now()
  const schedules = await WorkoutSchedule.find({
    memberId,
    status: { $ne: 'cancelled' },
  })
    .sort({ createdAt: -1 })
    .lean()

  for (const s of schedules) {
    const sessionsWithCode = (s.sessions || [])
      .filter(sess => sess.classCode && sess.classCode.trim() !== '')
      .map(sess => ({ sess, dist: sess.date ? Math.abs(new Date(sess.date).getTime() - now) : Number.POSITIVE_INFINITY }))
      .sort((a, b) => a.dist - b.dist)

    if (sessionsWithCode.length > 0) {
      const code = sessionsWithCode[0].sess.classCode
      const cls = await TrainingClass.findOne({ code }).select('code name ptId').lean()
      if (cls) {
        return {
          cls,
          via: `WorkoutSchedule(${s.status})`,
          scheduleId: s._id,
          scheduleStatus: s.status,
          scheduleCreatedAt: s.createdAt,
          sessionCount: (s.sessions || []).length,
        }
      }
    }
  }

  // 2) [FALLBACK — WARNING] TrainingAssignment active mới nhất theo createdAt DESC
  //    (nguồn DEPRECATED — có thể chứa dữ liệu cũ/sai)
  const ta = await TrainingAssignment.findOne({ memberId, status: 'active' })
    .sort({ createdAt: -1 })
    .lean()
  if (ta?.classId) {
    const cls = await TrainingClass.findById(ta.classId).select('code name ptId').lean()
    if (cls) {
      return {
        cls,
        via: 'TrainingAssignment(FALLBACK-WARNING)',
        scheduleId: null,
        scheduleStatus: null,
        scheduleCreatedAt: ta.createdAt,
        taId: ta._id,
      }
    }
  }

  return null
}

async function getMemberInfo(memberId) {
  const u = await User.findById(memberId).select('name fullName memberCode memberNumber').lean()
  return u
    ? {
      id: String(u._id),
      name: u.fullName || u.name || '(không tên)',
      code: u.memberCode || u.memberNumber || '',
    }
    : { id: String(memberId), name: '(missing user)', code: '' }
}

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
    console.log(`Connected to MongoDB. Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'COMMIT'}`)
    console.log('------------------------------------------------------------')

    // Only active PT assignments = members still under PT supervision
    const activeAssignments = await PTAssignment.find({ status: 'active' }).lean()
    const activeMemberIds = Array.from(new Set(activeAssignments.map(a => String(a.memberId))))
    console.log(`Active PTAssignments: ${activeAssignments.length} rows, unique members: ${activeMemberIds.length}`)

    // Existing active enrollments (skip already-migrated)
    const existingActive = await ClassEnrollment.find({ status: 'active' }).lean()
    const existingKey = new Set(existingActive.map(e => `${e.classId}_${e.memberId}`))
    console.log(`Existing active ClassEnrollments: ${existingActive.length} rows`)
    console.log('------------------------------------------------------------')

    const classes = await TrainingClass.find().select('code name ptId').lean()
    const classByCode = new Map(classes.map(c => [c.code, c]))

    const report = []
    let created = 0
    let createdViaPrimary = 0
    let createdViaFallback = 0
    let skippedExisting = 0
    let noClassFound = 0

    for (const memberId of activeMemberIds) {
      const memberInfo = await getMemberInfo(memberId)
      const found = await findClassForMember({ memberId })

      if (!found) {
        noClassFound++
        report.push({ ...memberInfo, class: null, action: 'SKIPPED_no_class' })
        continue
      }

      const { cls, via, scheduleId, scheduleStatus, scheduleCreatedAt, sessionCount, taId } = found
      const isFallback = String(via).includes('FALLBACK')
      const key = `${cls._id}_${memberId}`
      if (existingKey.has(key)) {
        skippedExisting++
        report.push({ ...memberInfo, class: { id: String(cls._id), code: cls.code, name: cls.name }, action: 'SKIPPED_existing', via, scheduleId, scheduleCreatedAt, sessionCount })
        continue
      }

      const detail = isFallback
        ? `Fallback via TrainingAssignment (id=${taId}). WARNING: cần admin kiểm tra thủ công — nguồn này DEPRECATED và có thể chứa dữ liệu cũ/sai.`
        : `Via active WorkoutSchedule ${scheduleId} (createdAt=${scheduleCreatedAt?.toISOString?.() || scheduleCreatedAt}, sessions=${sessionCount})`

      const doc = {
        classId: cls._id,
        memberId: new mongoose.Types.ObjectId(memberId),
        status: 'active',
        joinedAt: new Date(),
        sourceReason: 'auto_migrated',
        note: `Auto-migrated — ${detail}`,
      }

      if (!DRY_RUN) {
        await ClassEnrollment.create(doc)
      }
      existingKey.add(key)
      created++
      if (isFallback) createdViaFallback++
      else createdViaPrimary++
      report.push({
        ...memberInfo,
        class: { id: String(cls._id), code: cls.code, name: cls.name },
        action: 'CREATED',
        via,
        isFallback,
        scheduleId,
        scheduleCreatedAt,
        sessionCount,
      })
    }

    // Detailed log for review
    console.log('---------------- DETAILED LOG ----------------')
    const byAction = { CREATED: [], SKIPPED_existing: [], SKIPPED_no_class: [] }
    for (const r of report) byAction[r.action]?.push(r)

    console.log(`\n[CREATED] (${byAction.CREATED.length})`)
    for (const r of byAction.CREATED) {
      const tag = r.isFallback ? '  ⚠️ FALLBACK-WARNING' : ''
      const schedInfo = r.scheduleId
        ? `  sched=${r.scheduleId} createdAt=${r.scheduleCreatedAt?.toISOString?.() || r.scheduleCreatedAt} sessions=${r.sessionCount}`
        : ''
      console.log(`  +${tag}  ${r.code || 'no-code'}  ${r.name}  -> class ${r.class.code} "${r.class.name}"  (via ${r.via})${schedInfo}`)
    }

    console.log(`\n[SKIPPED_existing] (${byAction.SKIPPED_existing.length})`)
    for (const r of byAction.SKIPPED_existing) {
      console.log(`  = ${r.code || 'no-code'}  ${r.name}  -> class ${r.class.code} "${r.class.name}"  (already enrolled)  via ${r.via}`)
    }

    console.log(`\n[SKIPPED_no_class] (${byAction.SKIPPED_no_class.length})`)
    for (const r of byAction.SKIPPED_no_class) {
      console.log(`  - ${r.code || 'no-code'}  ${r.name}  (không tìm thấy lớp)`)
    }

    if (createdViaFallback > 0) {
      console.log('\n---------------- ⚠️ FALLBACK WARNINGS ----------------')
      console.log(`Có ${createdViaFallback} hội viên migration dùng FALLBACK (TrainingAssignment DEPRECATED).`)
      console.log('Vui lòng kiểm tra thủ công các dòng có tag "⚠️ FALLBACK-WARNING" ở trên trước khi --commit.')
      console.log('Nguy cơ: dữ liệu TrainingAssignment có thể cũ/sai (đã từng gây lỗi "Sức chứa hiện tại").')
      console.log('------------------------------------------------------------')
    }

    console.log('------------------------------------------------------------')
    console.log(`SUMMARY: created=${created} (primary=${createdViaPrimary}, fallback=${createdViaFallback}), skipped_existing=${skippedExisting}, no_class=${noClassFound}`)
    console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes — use --commit to apply)' : 'COMMIT (changes saved to DB)'}`)

    // Per-class summary
    console.log('\nPer-class projected active count (after migration):')
    const counts = await ClassEnrollment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ])
    // merge projected (DRY-RUN): add planned creations
    const projected = new Map()
    for (const c of counts) projected.set(String(c._id), c.count)
    if (DRY_RUN) {
      for (const r of byAction.CREATED) {
        const k = r.class.id
        projected.set(k, (projected.get(k) || 0) + 1)
      }
    }
    for (const [cid, cnt] of projected) {
      const cls = classByCode.size ? (await TrainingClass.findById(cid).select('code name').lean()) : null
      console.log(`  ${cls?.code || cid}  "${cls?.name || ''}"  active=${cnt}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('Migration error:', err)
    process.exit(1)
  }
}

migrate()