import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Shop from './src/models/Shop.js'
dotenv.config()

try {
    await mongoose.connect(process.env.MONGO_URI)
    const count = await Shop.countDocuments()
    console.log('shopCount=' + count)
    const sample = await Shop.find().limit(5).populate('user_id', 'name email role').lean()
    console.log(JSON.stringify(sample, null, 2))
    await mongoose.disconnect()
} catch (err) {
    console.error(err)
    process.exit(1)
}
