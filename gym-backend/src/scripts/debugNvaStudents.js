import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI)

  const db = mongoose.connection.db
  const req = await db.collection('trainingrequests').findOne({ assignedTrainerId: new mongoose.Types.ObjectId('6a563d175791137c9e93b251') })
  if (!req) { console.log('no request'); process.exit(1) }
  console.log('request id:', req._id, 'status:', req.status)

  const { getPtSuggestions } = await import('../services/trainingRequestService.js')
  const results = await getPtSuggestions({ requestId: req._id.toString() })
  const nva = results.find((r) => r.name.includes('NVA'))
  console.log('NVA suggestion:', JSON.stringify({
    totalStudents: nva.totalStudents,
    waitingConfirmation: nva.waitingConfirmation,
    hasSchedule: nva.hasSchedule,
    matchScore: nva.matchScore,
  }, null, 2))

  await mongoose.disconnect()
}
run().catch((e) => { console.error(e); process.exit(1) })
