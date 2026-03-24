import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ DB Error:',err))

app.listen(3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`)
})