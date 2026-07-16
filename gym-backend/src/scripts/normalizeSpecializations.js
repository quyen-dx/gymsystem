import mongoose from 'mongoose'
import connectDB from '../config/db.js'

// Normalize any non-standard-case specialization value to UPPERCASE.
// This handles mixed-case variants like "gym", "Boxing", "crossfit", "GYM", etc.
const matchNonUppercase = /^(?!$)[^A-Z]*$|^[A-Z][a-z]/

async function migrate() {
  await connectDB()

  const TrainingRequest = mongoose.model('TrainingRequest', new mongoose.Schema({}, { strict: false }), 'trainingrequests')
  const TrainingClass = mongoose.model('TrainingClass', new mongoose.Schema({}, { strict: false }), 'trainingclasses')
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))
  const PT = mongoose.model('PT', new mongoose.Schema({}, { strict: false }), 'pts')

  // ---- 1. TrainingRequest ----
  const reqDocs = await TrainingRequest.find({
    specialization: { $nin: [null, '', /^[A-Z_]+$/] },
  }).lean()
  let reqUpdated = 0
  for (const d of reqDocs) {
    const val = d.specialization?.toUpperCase()
    if (val && val !== d.specialization) {
      await TrainingRequest.updateOne({ _id: d._id }, { $set: { specialization: val } })
      reqUpdated++
    }
  }
  console.log(`TrainingRequest: ${reqDocs.length} matched, ${reqUpdated} updated`)

  // ---- 2. TrainingClass ----
  const clsDocs = await TrainingClass.find({
    specialization: { $nin: [null, '', /^[A-Z_]+$/] },
  }).lean()
  let clsUpdated = 0
  for (const d of clsDocs) {
    const val = d.specialization?.toUpperCase()
    if (val && val !== d.specialization) {
      await TrainingClass.updateOne({ _id: d._id }, { $set: { specialization: val } })
      clsUpdated++
    }
  }
  console.log(`TrainingClass: ${clsDocs.length} matched, ${clsUpdated} updated`)

  // ---- 3. User (PTs) — normalize specialties array ----
  const ptUsers = await User.find({ role: 'pt', specialties: { $exists: true, $ne: [] } }).lean()
  let puUpdated = 0
  for (const u of ptUsers) {
    const old = u.specialties || []
    const updated = old.map((s) => (typeof s === 'string' ? s.toUpperCase() : s))
    const changed = old.some((s, i) => s !== updated[i])
    if (changed) {
      await User.updateOne({ _id: u._id }, { $set: { specialties: updated } })
      puUpdated++
    }
  }
  console.log(`User (PT) specialties: ${ptUsers.length} docs checked, ${puUpdated} updated`)

  // ---- 4. PT model ----
  const ptDocs = await PT.find({ specialties: { $exists: true, $ne: [] } }).lean()
  let ptUpdated = 0
  for (const p of ptDocs) {
    const old = p.specialties || []
    const updated = old.map((s) => (typeof s === 'string' ? s.toUpperCase() : s))
    const changed = old.some((s, i) => s !== updated[i])
    if (changed) {
      await PT.updateOne({ _id: p._id }, { $set: { specialties: updated } })
      ptUpdated++
    }
  }
  console.log(`PT: ${ptDocs.length} docs checked, ${ptUpdated} updated`)

  console.log('Migration complete — all specializations normalized to UPPERCASE')
  await mongoose.disconnect()
}

migrate().catch(err => { console.error(err); process.exit(1) })
