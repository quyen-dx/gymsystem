import HealthMetric from '../models/HealthMetric.js'
import BodyComposition from '../models/BodyComposition.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

export const createMetric = async (data, userId) => {
  const metric = await HealthMetric.create({
    userId,
    date: new Date(data.date),
    weight: data.weight ?? null,
    height: data.height ?? null,
    bodyFatPercent: data.bodyFatPercent ?? null,
    muscleMass: data.muscleMass ?? null,
    boneMass: data.boneMass ?? null,
    waterPercent: data.waterPercent ?? null,
    visceralFat: data.visceralFat ?? null,
    bmi: data.bmi ?? null,
    bmr: data.bmr ?? null,
    waist: data.waist ?? null,
    hip: data.hip ?? null,
    chest: data.chest ?? null,
    arm: data.arm ?? null,
    thigh: data.thigh ?? null,
    source: data.source || 'manual',
    scanImageUrl: data.scanImageUrl || '',
    notes: data.notes || '',
  })
  return metric
}

export const getMetricById = async (id) => {
  if (!isValidObjectId(id)) return null
  const metric = await HealthMetric.findById(id)
    .populate('userId', 'name fullName avatar memberCode')
    .lean()
  return metric
}

export const getMetrics = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    userId,
    dateFrom,
    dateTo,
    source,
  } = filters

  const query = {}

  if (userId) {
    if (typeof userId === 'object' && userId.$in) {
      query.userId = userId
    } else if (isValidObjectId(userId)) {
      query.userId = userId
    }
  }

  if (dateFrom || dateTo) {
    query.date = {}
    if (dateFrom) query.date.$gte = new Date(dateFrom)
    if (dateTo) query.date.$lte = new Date(dateTo)
  }

  if (source) {
    query.source = source
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [metrics, total] = await Promise.all([
    HealthMetric.find(query)
      .populate('userId', 'name fullName avatar memberCode')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    HealthMetric.countDocuments(query),
  ])

  return {
    metrics,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const updateMetric = async (id, data) => {
  if (!isValidObjectId(id)) return null
  const metric = await HealthMetric.findById(id)
  if (!metric) return null

  const fields = [
    'date', 'weight', 'height', 'bodyFatPercent', 'muscleMass', 'boneMass',
    'waterPercent', 'visceralFat', 'bmi', 'bmr', 'waist', 'hip', 'chest',
    'arm', 'thigh', 'source', 'scanImageUrl', 'notes',
  ]
  for (const field of fields) {
    if (data[field] !== undefined) {
      if (field === 'date') {
        metric[field] = new Date(data[field])
      } else {
        metric[field] = data[field]
      }
    }
  }

  await metric.save()
  return metric
}

export const deleteMetric = async (id) => {
  if (!isValidObjectId(id)) return null
  const metric = await HealthMetric.findByIdAndDelete(id)
  return metric
}

export const getTrends = async (userId, options = {}) => {
  const { metric = 'weight', dateFrom, dateTo } = options

  const query = { userId }
  if (dateFrom || dateTo) {
    query.date = {}
    if (dateFrom) query.date.$gte = new Date(dateFrom)
    if (dateTo) query.date.$lte = new Date(dateTo)
  }

  const metrics = await HealthMetric.find(query)
    .sort({ date: 1 })
    .select(`date ${metric}`)
    .lean()

  return metrics.filter(m => m[metric] != null).map(m => ({
    date: m.date,
    value: m[metric],
  }))
}

export const createBodyComposition = async (data, userId) => {
  const doc = await BodyComposition.create({
    userId,
    date: new Date(data.date),
    source: data.source || 'manual',
    metricId: data.metricId || null,
    rawData: data.rawData || {},
    segmentalAnalysis: data.segmentalAnalysis || {},
    scanImageUrl: data.scanImageUrl || '',
    notes: data.notes || '',
  })
  return doc
}

export const getBodyCompositions = async (filters = {}) => {
  const { page = 1, limit = 20, userId, dateFrom, dateTo } = filters

  const query = {}
  if (userId) {
    if (typeof userId === 'object' && userId.$in) {
      query.userId = userId
    } else if (isValidObjectId(userId)) {
      query.userId = userId
    }
  }

  if (dateFrom || dateTo) {
    query.date = {}
    if (dateFrom) query.date.$gte = new Date(dateFrom)
    if (dateTo) query.date.$lte = new Date(dateTo)
  }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  const skip = (pageNum - 1) * limitNum

  const [compositions, total] = await Promise.all([
    BodyComposition.find(query)
      .populate('userId', 'name fullName avatar memberCode')
      .populate('metricId', 'weight bmi bodyFatPercent')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    BodyComposition.countDocuments(query),
  ])

  return {
    compositions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

export const getBodyCompositionById = async (id) => {
  if (!isValidObjectId(id)) return null
  const doc = await BodyComposition.findById(id)
    .populate('userId', 'name fullName avatar memberCode')
    .populate('metricId', 'weight bmi bodyFatPercent muscleMass')
    .lean()
  return doc
}
