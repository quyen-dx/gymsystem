import InventoryReservation from '../models/InventoryReservation.js'
import Product from '../models/Product.js'
import ProductVariant from '../models/ProductVariant.js'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ALERT_STATE_PATH = path.join(__dirname, '..', 'data', 'low_stock_alerts.json')

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const DEFAULT_TTL_MINUTES = 30
const LOW_STOCK_THRESHOLD = 5
const LOW_STOCK_DEBOUNCE_MS = 60 * 60 * 1000

function readAlertState() {
  try {
    if (fs.existsSync(ALERT_STATE_PATH)) {
      const raw = fs.readFileSync(ALERT_STATE_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (_) {
    // corrupt file → start fresh
  }
  return {}
}

function writeAlertState(state) {
  const dir = path.dirname(ALERT_STATE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(ALERT_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

export const reserve = async ({ userId, productId, variantId, quantity, ttlMinutes = DEFAULT_TTL_MINUTES }) => {
  if (!isValidObjectId(userId) || !isValidObjectId(productId)) return null

  const product = await Product.findById(productId).select('name stock isActive').lean()
  if (!product || !product.isActive) return null

  const physicalStock = variantId && isValidObjectId(variantId)
    ? (await ProductVariant.findById(variantId).select('stock').lean())?.stock ?? 0
    : product.stock

  const reservedQty = await getReservedQuantity(productId, variantId || null)

  if (quantity > physicalStock - reservedQty) return null

  const session = await mongoose.startSession()
  let reservation

  try {
    reservation = await InventoryReservation.findOneAndUpdate(
      { userId, productId, variantId: variantId || null, status: 'reserved' },
      {
        $setOnInsert: {
          userId,
          productId,
          variantId: variantId || null,
          quantity,
          status: 'reserved',
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    )
  } finally {
    session.endSession()
  }

  return reservation
}

export const release = async (reservationId) => {
  if (!isValidObjectId(reservationId)) return null
  const reservation = await InventoryReservation.findOneAndUpdate(
    { _id: reservationId, status: 'reserved' },
    { $set: { status: 'released' } },
    { new: true },
  )
  return reservation
}

export const deduct = async (reservationId) => {
  if (!isValidObjectId(reservationId)) return null
  const reservation = await InventoryReservation.findOneAndUpdate(
    { _id: reservationId, status: 'reserved' },
    { $set: { status: 'deducted' } },
    { new: true },
  )
  return reservation
}

export const getActiveReservations = async (userId) => {
  if (!isValidObjectId(userId)) return []
  const reservations = await InventoryReservation.find({ userId, status: 'reserved' })
    .populate('productId', 'name price image images slug category')
    .populate('variantId', 'name sku price stock')
    .sort({ createdAt: -1 })
    .lean()
  return reservations
}

export const getReservedQuantity = async (productId, variantId = null) => {
  if (!isValidObjectId(productId)) return 0

  const result = await InventoryReservation.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(String(productId)),
        variantId: variantId && isValidObjectId(variantId) ? new mongoose.Types.ObjectId(String(variantId)) : null,
        status: 'reserved',
        expiresAt: { $gt: new Date() },
      },
    },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ])

  return result.length > 0 ? result[0].total : 0
}

export const expireStaleReservations = async () => {
  const result = await InventoryReservation.updateMany(
    { status: 'reserved', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } },
  )
  return result.modifiedCount
}

export const checkLowStock = async (threshold = LOW_STOCK_THRESHOLD) => {
  const products = await Product.find({ isActive: true, stock: { $lt: threshold, $gt: -1 } })
    .populate('shop_id', 'name user_id')
    .select('name stock category slug')
    .lean()

  const lowStockItems = []

  for (const product of products) {
    lowStockItems.push({
      type: 'product',
      id: product._id,
      name: product.name,
      stock: product.stock,
      threshold,
      shopId: product.shop_id?._id,
      shopName: product.shop_id?.name,
      sellerId: product.shop_id?.user_id,
    })
  }

  const variants = await ProductVariant.find({ isActive: true, stock: { $lt: threshold, $gt: -1 } })
    .populate({ path: 'productId', select: 'name shop_id', populate: { path: 'shop_id', select: 'name user_id' } })
    .select('name sku stock productId')
    .lean()

  for (const variant of variants) {
    if (!variant.productId) continue
    lowStockItems.push({
      type: 'variant',
      id: variant._id,
      productId: variant.productId._id,
      name: `${variant.productId.name} - ${variant.name}`,
      sku: variant.sku,
      stock: variant.stock,
      threshold,
      shopId: variant.productId.shop_id?._id,
      shopName: variant.productId.shop_id?.name,
      sellerId: variant.productId.shop_id?.user_id,
    })
  }

  const alertState = readAlertState()
  const now = Date.now()
  const result = []
  let dirty = false

  for (const item of lowStockItems) {
    const key = String(item.id)
    const lastAlerted = alertState[key]
    if (lastAlerted && (now - lastAlerted) < LOW_STOCK_DEBOUNCE_MS) continue

    alertState[key] = now
    dirty = true
    result.push(item)
  }

  if (dirty) {
    writeAlertState(alertState)
  }

  return result
}
