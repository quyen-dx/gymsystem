import 'dotenv/config'
import mongoose from 'mongoose'
import Workout from '../models/Workout.js'

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI)
  const total = await Workout.countDocuments({})
  const templates = await Workout.find({ isTemplate: true }).select('name goal specializationId days').lean()
  console.log('Workout total:', total)
  console.log('isTemplate true:', templates.length)
  for (const t of templates.slice(0, 20)) {
    console.log(' -', t.name, '| goal:', t.goal, '| spec:', t.specializationId, '| days:', (t.days || []).length)
  }
  if (templates.length > 20) console.log('... (còn', templates.length - 20, 'nữa)')
  const specs = await Workout.distinct('specializationId', { isTemplate: true })
  const goals = await Workout.distinct('goal', { isTemplate: true })
  console.log('distinct specs:', specs)
  console.log('distinct goals:', goals)
  await mongoose.disconnect()
}
run().catch((e) => { console.error('ERR', e.message); process.exit(1) })
