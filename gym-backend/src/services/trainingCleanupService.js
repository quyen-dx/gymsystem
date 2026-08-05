import Booking from '../models/Booking.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import PTAssignment from '../models/PTAssignment.js'
import SessionFeedback from '../models/SessionFeedback.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingGroup from '../models/TrainingGroup.js'
import TrainingRequest, { ACTIVE_TRAINING_REQUEST_STATUSES } from '../models/TrainingRequest.js'
import User from '../models/User.js'
import Workout from '../models/Workout.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'

import { endEnrollments } from './classEnrollmentService.js'
import { createNotification } from './notificationService.js'
import { emitPtClientsUpdated } from './socketService.js'

/**
 * Removes the member's current PT service as one atomic business action.
 * This deliberately does not branch on PRIVATE/GROUP: both assignment modes
 * represent the same member-level PT service and must be cleaned together.
 */
export const leaveCurrentTraining = async ({ memberId, reason = '', session }) => {
  const now = new Date()
  // Close every non-terminal request variant, including legacy proposal/match
  // statuses that may still exist in older records.
  const requestStatusesToClose = [
    ...ACTIVE_TRAINING_REQUEST_STATUSES,
    'waiting_match',
    'proposal_pending',
    'matched',
    'assigned',
    'class_assigned',
    'active',
  ]
  const activeAssignments = await PTAssignment.find({
    memberId,
    status: { $in: ['active', 'pending_end_approval'] },
  }).select('_id workoutId ptId').session(session).lean()
  const activeTrainingAssignments = await TrainingAssignment.find({
    memberId,
    status: { $in: ['waiting_pt', 'active'] },
  }).select('_id classId').session(session).lean()
  const activeRequests = await TrainingRequest.find({
    memberId,
    status: { $in: requestStatusesToClose },
  }).select('_id status').session(session).lean()

  const assignmentIds = activeAssignments.map((item) => item._id)
  const trainingAssignmentIds = activeTrainingAssignments.map((item) => item._id)
  const requestIds = activeRequests.map((item) => item._id)
  const classIds = activeTrainingAssignments.map((item) => item.classId).filter(Boolean)

  // Capture thông tin để thông báo cho PT trước khi cleanup (dữ liệu bị cập nhật ngay sau đó).
  const member = await User.findById(memberId).select('fullName displayName name username email').session(session).lean()
  const memberName = member?.fullName || member?.displayName || member?.name || member?.username || member?.email || 'Hội viên'
  const pt11TargetIds = [...new Set(
    activeAssignments.map((a) => a.ptId && a.ptId.toString()).filter(Boolean),
  )]
  let classTargets = []
  if (classIds.length > 0) {
    const classes = await TrainingClass.find({ _id: { $in: classIds } })
      .select('name ptId').session(session).lean()
    classTargets = classes
      .map((c) => ({ ptId: c.ptId ? c.ptId.toString() : null, className: c.name, classId: c._id }))
      .filter((c) => c.ptId)
  }

  const result = {}
  result.ptAssignments = (await PTAssignment.updateMany(
    { _id: { $in: assignmentIds } },
    { $set: { status: 'cancelled', endDate: now, cancelledAt: now } },
    { session },
  )).modifiedCount || 0
  result.trainingAssignments = (await TrainingAssignment.updateMany(
    { _id: { $in: trainingAssignmentIds } },
    { $set: { status: 'cancelled', endDate: now } },
    { session },
  )).modifiedCount || 0
  result.classEnrollments = (await endEnrollments({
    memberId,
    sourceReason: 'member_request',
    note: reason || 'Hội viên rời toàn bộ dịch vụ PT',
    session,
  })).modifiedCount

  // GroupMember is embedded in TrainingGroup in this codebase.
  result.groupMembers = (await TrainingGroup.updateMany(
    { 'members.memberId': memberId },
    { $pull: { members: { memberId } } },
    { session },
  )).modifiedCount || 0
  result.bookings = (await Booking.deleteMany({ memberId }, { session })).deletedCount || 0
  result.workoutSchedules = (await WorkoutSchedule.deleteMany({ memberId }, { session })).deletedCount || 0
  result.workouts = (await Workout.deleteMany({ memberId }, { session })).deletedCount || 0
  result.sessionFeedback = (await SessionFeedback.deleteMany({ memberId }, { session })).deletedCount || 0
  for (const requestBeforeCancel of activeRequests) {
    console.log('[REQUEST CANCELLED]', {
      file: import.meta.url,
      function: 'leaveCurrentTraining',
      requestId: requestBeforeCancel._id,
      oldStatus: requestBeforeCancel.status,
      reason: reason || 'Hội viên rời toàn bộ dịch vụ PT',
      stack: new Error().stack,
    })
  }
  result.trainingRequests = (await TrainingRequest.updateMany(
    { _id: { $in: requestIds } },
    { $set: { status: 'cancelled', cancelledAt: now, cancelReason: reason || 'Hội viên rời toàn bộ dịch vụ PT' } },
    { session },
  )).modifiedCount || 0

  // Remove only notifications tied to this PT service; unrelated member
  // notifications must remain visible.
  const relatedIds = [...assignmentIds, ...trainingAssignmentIds, ...requestIds, ...classIds]
  if (relatedIds.length > 0) {
    result.notifications = (await Notification.deleteMany({
      receiverId: memberId,
      relatedId: { $in: relatedIds },
    }, { session })).deletedCount || 0
  } else {
    result.notifications = 0
  }

  // ─── Realtime + notifications (fire-and-forget, sau khi mọi DB write đã chạy) ───
  const affectedPtIds = [...new Set([
    ...pt11TargetIds,
    ...classTargets.map((t) => t.ptId),
  ])]

  for (const ptId of pt11TargetIds) {
    createNotification({
      receiverId: ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.PT_SERVICE_LEFT,
      title: 'Hội viên đã rời dịch vụ PT',
      content: `Hội viên ${memberName} đã rời dịch vụ PT 1-1.`,
      relatedId: memberId,
      relatedType: 'User',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    }).catch((err) => console.error('Notify PT service left (PT 1-1) failed:', err.message))
  }

  for (const target of classTargets) {
    createNotification({
      receiverId: target.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.PT_SERVICE_LEFT,
      title: 'Hội viên đã rời lớp',
      content: `Hội viên ${memberName} đã rời lớp PT ${target.className}.`,
      relatedId: target.classId,
      relatedType: 'TrainingClass',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    }).catch((err) => console.error('Notify PT service left (class) failed:', err.message))
  }

  createNotification({
    receiverId: memberId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.PT_SERVICE_LEFT,
    title: 'Đã rời dịch vụ PT',
    content: 'Bạn đã rời dịch vụ PT thành công.',
    relatedId: memberId,
    relatedType: 'User',
    redirectUrl: '/booking',
    createdBy: 'System',
  }).catch((err) => console.error('Notify member PT service left failed:', err.message))

  for (const ptId of affectedPtIds) {
    try {
      emitPtClientsUpdated({ userId: ptId, data: { action: 'removed', memberId } })
    } catch { /* ignore */ }
  }

  return result
}
