import mongoose from 'mongoose'
import { mongoUri, mongoLocalUri } from './env.js'
import logger from './logger.js'

const ATLAS_URI = mongoUri
const FALLBACK_URI = mongoLocalUri || 'mongodb://127.0.0.1:27017/gym'
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
      logger.info('Dropped stale unique index referenceId_1 from payments collection')
    }
  } catch (idxError) {
    if (idxError.code !== 27 && idxError.codeName !== 'IndexNotFound') {
      logger.warn('Could not check/drop stale payment indexes', { error: idxError.message })
    }
  }
}

const MONGO_OPTIONS = {
  retryWrites: true,
  w: 'majority',
}

const RETRY_DELAYS_MS = [1000, 2000, 4000]
const MAX_RETRIES = RETRY_DELAYS_MS.length

const connectDB = async () => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(ATLAS_URI, MONGO_OPTIONS)
      logger.info(`Atlas connected: ${mongoose.connection.host}`)
      _isFallback = false
      _fallbackError = null
      await dropStaleIndexes(mongoose.connection.db)
      return
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt]
        logger.warn(
          `Atlas connection attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms`,
          { error: error.message },
        )
        try { await mongoose.disconnect() } catch {}
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        logger.error(`Atlas connection failed after ${MAX_RETRIES} retries: ${error.message}`)
        logger.info('Falling back to local MongoDB...')
        try { await mongoose.disconnect() } catch {}
        try {
          await mongoose.connect(FALLBACK_URI, MONGO_OPTIONS)
          logger.info('Local MongoDB connected (read-only mode)')
          _isFallback = true
          _fallbackError = error.message
        } catch (fallbackError) {
          logger.error(`Local MongoDB also failed: ${fallbackError.message}`)
          process.exit(1)
        }
      }
    }
  }
}

const healthCheck = async () => {
  try {
    const state = mongoose.connection.readyState
    if (state !== 1) {
      return { status: 'disconnected', readyState: state }
    }
    const start = Date.now()
    await mongoose.connection.db.admin().ping()
    const latencyMs = Date.now() - start
    return { status: 'connected', latencyMs }
  } catch (error) {
    return { status: 'disconnected', error: error.message }
  }
}

export const isFallbackActive = () => _isFallback

export const getFallbackError = () => _fallbackError

export { healthCheck }

export const reconnectToPrimary = async () => {
  try {
    await mongoose.disconnect()
    await mongoose.connect(mongodb.uri, MONGO_OPTIONS)
    logger.info(`Reconnected to Atlas: ${mongoose.connection.host}`)
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
