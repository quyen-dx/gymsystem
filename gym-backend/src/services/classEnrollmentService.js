import ClassEnrollment from '../models/ClassEnrollment.js'
import TrainingClass from '../models/TrainingClass.js'
import User from '../models/User.js'
import mongoose from 'mongoose'

/**
 * Ensure member has an active ClassEnrollment for the given classId.
 *
 * BUSINESS RULE: 1 member can be active in AT MOST 1 class at any time.
 *  - If member already has an active enrollment in the SAME class: no-op (idempotent).
 *  - If member has an active enrollment in a DIFFERENT class: end the old one
 *    (sourceReason='transfer_class') and create a new active one in the new class.
 *  - If no active enrollment exists: create one.
 *
 * Also enforces capacity based on Zone.maxCapacity.
 *
 * @returns {Object} { created: boolean, transferredFrom: ObjectId|null, enrollment: Object }
 */
export const ensureEnrollment = async ({ classId, memberId, session, sourceReason = 'assigned_by_pt', enforceCapacity = true }) => {
  if (!classId || !memberId) return { created: false, transferredFrom: null, enrollment: null }

  // Các luồng cũ có thể gọi service ngoài transaction. Bao transaction ở đây để
  // không kết thúc lớp cũ khi lớp mới đã đầy, và để chặn hai yêu cầu cùng vượt chỗ.
  if (!session) {
    const ownSession = await mongoose.startSession()
    try {
      let result
      await ownSession.withTransaction(async () => {
        result = await ensureEnrollment({ classId, memberId, session: ownSession, sourceReason, enforceCapacity })
      })
      return result
    } finally {
      await ownSession.endSession()
    }
  }

  // Ghi lên User trước khi đọc enrollment để serialize các yêu cầu đồng thời của
  // cùng một hội viên; transaction bị retry sẽ nhìn thấy enrollment mới nhất.
  const memberLock = await User.updateOne(
    { _id: memberId },
    { $inc: { classEnrollmentRevision: 1 } },
    { session },
  )
  if (memberLock.matchedCount !== 1) {
    const err = new Error('Không tìm thấy hội viên để xếp lớp')
    err.statusCode = 404
    throw err
  }

  const existingActive = await ClassEnrollment.findOne({
    memberId,
    status: 'active',
  }).session(session || null).lean()

  // Case 1: member already in the SAME class -> nothing to do
  if (existingActive && String(existingActive.classId) === String(classId)) {
    return { created: false, transferredFrom: null, enrollment: existingActive }
  }

  // Capacity check. Việc tăng capacityRevision tạo write-conflict giữa hai
  // transaction xếp cùng một lớp; MongoDB sẽ retry transaction sau và đếm lại.
  if (enforceCapacity) {
    const cls = await TrainingClass.findById(classId).populate('zoneId', 'maxCapacity').session(session).lean()
    if (!cls) {
      const err = new Error('Không tìm thấy lớp tập')
      err.statusCode = 404
      throw err
    }
    const maxCapacity = cls?.zoneId?.maxCapacity || 0
    if (maxCapacity > 0) {
      const currentCount = await ClassEnrollment.countDocuments({
        classId,
        status: 'active',
      }).session(session)
      if (currentCount >= maxCapacity) {
        const err = new Error(`Lớp ${cls?.name || cls?.code || ''} đã đầy (${currentCount}/${maxCapacity})`)
        err.statusCode = 409
        throw err
      }
      await TrainingClass.updateOne({ _id: classId }, { $inc: { capacityRevision: 1 } }, { session })
    }
  }

  // Chỉ rời lớp cũ sau khi lớp mới đã được kiểm tra còn chỗ; toàn bộ thao tác
  // nằm trong cùng transaction nên không để hội viên rơi vào trạng thái treo.
  let transferredFrom = null
  if (existingActive) {
    transferredFrom = existingActive.classId
    await ClassEnrollment.updateMany(
      { memberId, status: 'active' },
      {
        $set: {
          status: 'ended',
          leftAt: new Date(),
          sourceReason: 'transfer_class',
        },
      },
      { session },
    )
  }

  const [enrollment] = await ClassEnrollment.create([{
    classId,
    memberId,
    status: 'active',
    joinedAt: new Date(),
    sourceReason,
  }], { session })

  return { created: true, transferredFrom, enrollment }
}

/**
 * End all active ClassEnrollments for a member (when PT stops supervising
 * the member completely or member leaves entirely).
 *
 * @param {Object} params
 * @param {String} params.memberId
 * @param {String} [params.classId]   - if provided, only end enrollments in that class
 * @param {String} [params.sourceReason='ended_by_pt']
 * @param {String} [params.note='']
 * @param {mongoose.ClientSession} [params.session]
 * @returns {Object} { modifiedCount }
 */
export const endEnrollments = async ({ memberId, classId, sourceReason = 'ended_by_pt', note = '', session }) => {
  const filter = { memberId, status: 'active' }
  if (classId) filter.classId = classId

  const result = await ClassEnrollment.updateMany(
    filter,
    {
      $set: {
        status: 'ended',
        leftAt: new Date(),
        sourceReason,
        note,
      },
    },
    { session: session || undefined },
  )

  return { modifiedCount: result.modifiedCount || 0 }
}

/**
 * Move a member from one class to another.
 * Ends the enrollment in the old class (if any) and creates an active
 * enrollment in the new class.
 *
 * @returns {Object} { endedOld, createdNew }
 */
export const transferEnrollment = async ({ memberId, fromClassId, toClassId, sourceReason = 'transfer_class', note = '', session }) => {
  if (!session) {
    const ownSession = await mongoose.startSession()
    try {
      let result
      await ownSession.withTransaction(async () => {
        result = await transferEnrollment({ memberId, fromClassId, toClassId, sourceReason, note, session: ownSession })
      })
      return result
    } finally {
      await ownSession.endSession()
    }
  }
  let endedOld = 0
  if (fromClassId) {
    const r = await endEnrollments({ memberId, classId: fromClassId, sourceReason, note, session })
    endedOld = r.modifiedCount
  }
  const { created } = await ensureEnrollment({
    classId: toClassId,
    memberId,
    sourceReason,
    enforceCapacity: true,
    session,
  })
  return { endedOld, createdNew: created }
}

/**
 * Count members actively enrolled in a class.
 */
export const countActiveEnrollment = async ({ classId, session }) => {
  return ClassEnrollment.countDocuments({ classId, status: 'active' }).session(session || null)
}

/**
 * Map of classId -> count of active enrollments.
 * Used by getAllClasses to compute current occupancy in one aggregated query.
 *
 * @param {Array<String|ObjectId>} classIds
 */
export const getActiveCountMap = async (classIds = []) => {
  if (!classIds.length) return {}
  const rows = await ClassEnrollment.aggregate([
    { $match: { classId: { $in: classIds.map(id => new mongoose.Types.ObjectId(id)) }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ])
  const map = {}
  for (const r of rows) {
    map[String(r._id)] = r.count
  }
  return map
}
