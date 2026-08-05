import mongoose from 'mongoose'

// A request is blocking only while it still needs member/admin processing.
// `assigned` is terminal for the request lifecycle; the active assignment is
// represented by PTAssignment/ClassEnrollment instead.
export const ACTIVE_TRAINING_REQUEST_STATUSES = [
  'pending',
  'processing',
  'message_sent',
  'waiting_member',
  'waiting_assignment',
  'waiting_reassign', // legacy alias; normalized by the reconciliation flow
]

const trainingRequestSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['group', 'pt1on1'],
    default: 'group',
    index: true,
  },
  specialization: { type: String, trim: true, default: 'GYM' },
  goals: [{ type: String, trim: true }],
  desiredSessions: { type: Number, min: 3, max: 5, default: 3 },
  timeSlots: [{ type: String, trim: true }],
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  healthNotes: { type: String, default: '', trim: true },
  isNewToGym: { type: Boolean, default: false },
  note: { type: String, default: '', trim: true },
  contactPhone: { type: String, default: '', trim: true },
  contactEmail: { type: String, default: '', trim: true },
  preferredTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: {
    type: String,
    enum: [...ACTIVE_TRAINING_REQUEST_STATUSES, 'declined_by_member', 'assigned', 'class_assigned', 'active', 'completed', 'ended', 'cancelled'],
    default: 'pending',
    index: true,
  },
  lastMessage: { type: String, default: '', trim: true },
  messageSentAt: Date,
  // Structured proposal metadata. Keep the original request fields intact;
  // Match Class can use the accepted proposal as the effective constraints.
  proposal: { type: mongoose.Schema.Types.Mixed, default: null },
  currentProposal: { type: mongoose.Schema.Types.Mixed, default: null },
  selectedProposal: { type: mongoose.Schema.Types.Mixed, default: null },
  approvedProposal: { type: mongoose.Schema.Types.Mixed, default: null },
  acceptedProposal: { type: mongoose.Schema.Types.Mixed, default: null },
  proposalAccepted: { type: Boolean, default: false },
  proposalAcceptedAt: Date,
  assignedClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null },
  assignedTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // PTs who explicitly declined this member; Admin must choose another PT.
  rejectedPtIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assignedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancelReason: { type: String, default: '' },
}, { timestamps: true })

trainingRequestSchema.index({ memberId: 1, status: 1 })
trainingRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.TrainingRequest || mongoose.model('TrainingRequest', trainingRequestSchema)
