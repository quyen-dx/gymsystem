import mongoose from 'mongoose'

const FALLBACK_URI = 'mongodb://127.0.0.1:27017/gym'
let _isFallback = false
let _fallbackError = null

const dropStaleIndexes = async (db) => {
  try {
    const paymentsIndexes = await db.collection('payments').indexes()
    const staleRefIdIndex = paymentsIndexes.find(
      (idx) => idx.name === 'referenceId_1' || (idx.key && idx.key.referenceId === 1),
    )
    if (staleRefIdIndex && staleRefIdIndex.unique) {
      await db.collection('payments').dropIndex(staleRefIdIndex.name || 'referenceId_1')
      console.log('✅ Dropped stale unique index referenceId_1 from payments collection')
    }
  } catch (idxError) {
    if (idxError.code !== 27 && idxError.codeName !== 'IndexNotFound') {
      console.warn('⚠️ Could not check/drop stale payment indexes:', idxError.message)
    }
  }
}

const MONGO_OPTIONS = {
  retryWrites: true,
  w: 'majority',
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
    console.log(`✅ Atlas connected: ${mongoose.connection.host}`)
    _isFallback = false
    _fallbackError = null
    await dropStaleIndexes(mongoose.connection.db)
  } catch (error) {
    console.error(`❌ Atlas failed: ${error.message}`)
    console.log('↳ Falling back to local MongoDB (127.0.0.1:27017)...')
    try { await mongoose.disconnect() } catch {}
    try {
      await mongoose.connect(FALLBACK_URI, MONGO_OPTIONS)
      console.log(`✅ Local MongoDB connected (read-only mode)`)
      _isFallback = true
      _fallbackError = error.message
    } catch (fallbackError) {
      console.error(`❌ Local MongoDB also failed: ${fallbackError.message}`)
      process.exit(1)
    }
  }
}

export const isFallbackActive = () => _isFallback

export const getFallbackError = () => _fallbackError

export const reconnectToPrimary = async () => {
  try {
    await mongoose.disconnect()
    await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS)
    console.log(`✅ Reconnected to Atlas: ${mongoose.connection.host}`)
    _isFallback = false
    _fallbackError = null
    return { success: true }
  } catch (error) {
    _fallbackError = error.message
    try {
      await mongoose.disconnect()
      await mongoose.connect(FALLBACK_URI)
    } catch {}
    return { success: false, message: error.message }
  }
}

export default connectDB
