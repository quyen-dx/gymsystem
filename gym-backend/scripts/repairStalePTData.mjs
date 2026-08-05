/**
 * Migration: Cleanup stale PT/assignment/booking/workout data for members without active membership.
 *
 * Usage: node scripts/repairStalePTData.mjs [--dry-run]
 */
import dotenv from 'dotenv'
dotenv.config()
import mongoose from 'mongoose'
import User from '../src/models/User.js'
import MembershipCycle from '../src/models/MembershipCycle.js'
import PTAssignment from '../src/models/PTAssignment.js'
import TrainingAssignment from '../src/models/TrainingAssignment.js'
import Booking from '../src/models/Booking.js'
import WorkoutSchedule from '../src/models/WorkoutSchedule.js'
import Workout from '../src/models/Workout.js'
import ClassEnrollment from '../src/models/ClassEnrollment.js'
import TrainingRequest from '../src/models/TrainingRequest.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gym'
const DRY_RUN = process.argv.includes('--dry-run')

if (DRY_RUN) console.log('🔍 DRY-RUN mode — no writes will be performed\n')
else console.log('⚠️  COMMIT mode — writing changes to database\n')

await mongoose.connect(MONGO_URI)
console.log(`✅ Connected to MongoDB: ${MONGO_URI}\n`)

// ── Find all members WITH active MembershipCycle ──
const activeMemberIds = await MembershipCycle.distinct('memberId', { status: 'active' })
const activeSet = new Set(activeMemberIds.map(id => String(id)))
console.log(`📋 Members WITH active cycle: ${activeSet.size}`)

// ── Define repairs ──
const repairs = [
  { name: 'PTAssignment', model: PTAssignment, filter: { status: 'active' }, update: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Membership không còn active (auto-repair)' }, key: 'ptAssignments' },
  { name: 'TrainingAssignment', model: TrainingAssignment, filter: { status: 'active' }, update: { status: 'finished', endDate: new Date() }, key: 'trainingAssignments' },
  { name: 'Booking', model: Booking, filter: { status: { $in: ['pending', 'awaiting_payment', 'confirmed'] } }, update: { status: 'cancelled', cancelReason: 'Membership không còn active (auto-repair)' }, key: 'bookings' },
  { name: 'WorkoutSchedule', model: WorkoutSchedule, filter: { status: 'active' }, update: { status: 'cancelled' }, key: 'workoutSchedules' },
  { name: 'Workout', model: Workout, filter: { isTemplate: false, status: 'active' }, update: { status: 'archived' }, key: 'workouts' },
  { name: 'ClassEnrollment', model: ClassEnrollment, filter: { status: 'active' }, update: { status: 'ended', leftAt: new Date(), sourceReason: 'membership_repair', note: 'Membership không còn active (auto-repair)' }, key: 'classEnrollments' },
  { name: 'TrainingRequest', model: TrainingRequest, filter: { status: { $in: ['pending', 'message_sent', 'waiting_assignment', 'assigned'] } }, update: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Membership không còn active (auto-repair)' }, key: 'trainingRequests' },
]

const stats = { ptAssignments: 0, trainingAssignments: 0, bookings: 0, workoutSchedules: 0, workouts: 0, classEnrollments: 0, trainingRequests: 0 }
const affectedMembers = new Set()

for (const { name, model, filter, update, key } of repairs) {
  const records = await model.find(filter).lean()
  const stale = records.filter(r => !activeSet.has(String(r.memberId)))

  if (stale.length === 0) {
    console.log(`✅ ${name}: 0 stale`)
    continue
  }

  stale.forEach(r => affectedMembers.add(String(r.memberId)))
  stats[key] = stale.length
  const memberCount = new Set(stale.map(r => String(r.memberId))).size
  console.log(`🔧 ${name}: ${stale.length} stale (${memberCount} members)`)

  if (!DRY_RUN) {
    const ids = stale.map(r => r._id)
    const result = await model.updateMany({ _id: { $in: ids } }, { $set: update })
    console.log(`   → Updated ${result.modifiedCount} records`)
  } else {
    // Show a few samples in dry-run
    for (const r of stale.slice(0, 3)) {
      console.log(`   ⓘ  id=${r._id} memberId=${r.memberId} status=${r.status}`)
    }
  }
}

const total = stats.ptAssignments + stats.trainingAssignments + stats.bookings + stats.workoutSchedules + stats.workouts + stats.classEnrollments + stats.trainingRequests

console.log('\n' + '='.repeat(55))
console.log('📊 SUMMARY')
console.log('='.repeat(55))
console.log(`  Members affected:     ${affectedMembers.size}`)
console.log(`  PTAssignments:        ${stats.ptAssignments}`)
console.log(`  TrainingAssignments:  ${stats.trainingAssignments}`)
console.log(`  Bookings:             ${stats.bookings}`)
console.log(`  WorkoutSchedules:     ${stats.workoutSchedules}`)
console.log(`  Workouts:             ${stats.workouts}`)
console.log(`  ClassEnrollments:     ${stats.classEnrollments}`)
console.log(`  TrainingRequests:     ${stats.trainingRequests}`)
console.log(`  ─────────────────────────`)
console.log(`  Total:                ${total}`)
console.log('='.repeat(55))

if (DRY_RUN) {
  console.log('\n⚠️  DRY-RUN — no changes written. Remove --dry-run to commit.')
} else if (total > 0) {
  console.log('\n✅ Committed. All stale records updated.')
} else {
  console.log('\n✅ No stale data found. Database is clean.')
}

await mongoose.disconnect()
process.exit(0)
