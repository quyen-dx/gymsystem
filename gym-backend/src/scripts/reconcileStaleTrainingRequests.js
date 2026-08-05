import 'dotenv/config'
import mongoose from 'mongoose'
import { reconcileStaleRequests } from '../services/trainingRequestService.js'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gym'
try {
  await mongoose.connect(uri)
  const result = await reconcileStaleRequests()
  console.log(JSON.stringify({ message: 'Training request reconciliation completed', ...result }, null, 2))
} finally {
  await mongoose.disconnect()
}

