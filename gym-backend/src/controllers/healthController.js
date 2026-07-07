import HealthLog from '../models/HealthLog.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const normalizeDate = (value) => {
  const date = value ? new Date(value) : new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

const pickNumericFields = (body) => {
  const fields = ['height', 'weight', 'bodyFat', 'muscle', 'visceralFat', 'chest', 'waist', 'hips', 'arm', 'thigh']
  return fields.reduce((payload, field) => {
    const value = toNumberOrUndefined(body[field])
    if (value !== undefined) payload[field] = value
    return payload
  }, {})
}

const buildLogPayload = (req, extra = {}) => ({
  memberId: req.user._id,
  user: req.user._id,
  type: req.body.type || 'measurement',
  date: normalizeDate(req.body.date),
  height: toNumberOrUndefined(req.body.height) ?? req.user.healthInfo?.height ?? undefined,
  mood: req.body.mood || '',
  notes: req.body.notes || '',
  source: req.body.source || 'manual',
  ...pickNumericFields(req.body),
  ...extra,
})

const memberHealthFilter = (memberId) => ({
  $or: [{ memberId }, { user: memberId }],
})

const getDateRange = (days = 30) => {
  const end = new Date()
  const start = new Date(end.getTime() - Number(days) * MS_PER_DAY)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

const calculateChange = (first, latest, field) => {
  const start = Number(first?.[field])
  const current = Number(latest?.[field])
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null

  return {
    start,
    current,
    change: Math.round((current - start) * 10) / 10,
    changePercent: start === 0 ? 0 : Math.round(((current - start) / start) * 1000) / 10,
  }
}

export const createHealthLog = async (req, res) => {
  try {
    const log = await HealthLog.create(buildLogPayload(req))
    return res.status(201).json({ message: 'Da luu nhat ky suc khoe', log })
  } catch (error) {
    return res.status(400).json({ message: 'Khong the luu nhat ky suc khoe', error: error.message })
  }
}

export const uploadHealthPhoto = async (req, res) => {
  try {
    const photoUrl = req.file?.path || req.file?.secure_url || req.body.photoUrl
    if (!photoUrl) {
      return res.status(400).json({ message: 'Vui long upload anh progress' })
    }

    const log = await HealthLog.create(buildLogPayload(req, { photoUrl }))
    return res.status(201).json({ message: 'Da luu anh progress', log })
  } catch (error) {
    return res.status(400).json({ message: 'Khong the luu anh progress', error: error.message })
  }
}

export const getBmiHistory = async (req, res) => {
  try {
    const logs = await HealthLog.find({
      ...memberHealthFilter(req.user._id),
      bmi: { $ne: null },
    }).sort({ date: 1 }).select('date bmi weight height').lean()

    return res.json({ history: logs })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay BMI history', error: error.message })
  }
}

export const getWeightHistory = async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days || 30))
    const { start, end } = getDateRange(days)

    const logs = await HealthLog.find({
      ...memberHealthFilter(req.user._id),
      date: { $gte: start, $lte: end },
      weight: { $ne: null },
    }).sort({ date: 1 }).select('date weight bmi bodyFat').lean()

    return res.json({ days, history: logs })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay weight history', error: error.message })
  }
}

export const compareHealthLogs = async (req, res) => {
  try {
    const [first, latest] = await Promise.all([
      HealthLog.findOne(memberHealthFilter(req.user._id)).sort({ date: 1 }).lean(),
      HealthLog.findOne(memberHealthFilter(req.user._id)).sort({ date: -1 }).lean(),
    ])

    if (!first || !latest) {
      return res.status(404).json({ message: 'Chua co du lieu suc khoe de so sanh' })
    }

    return res.json({
      first,
      latest,
      comparison: {
        weight: calculateChange(first, latest, 'weight'),
        bodyFat: calculateChange(first, latest, 'bodyFat'),
        chest: calculateChange(first, latest, 'chest'),
        waist: calculateChange(first, latest, 'waist'),
        hips: calculateChange(first, latest, 'hips'),
        bmi: calculateChange(first, latest, 'bmi'),
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Loi so sanh suc khoe', error: error.message })
  }
}

export const getMonthlyMeasurements = async (req, res) => {
  try {
    const measurements = await HealthLog.aggregate([
      { $match: memberHealthFilter(req.user._id) },
      { $sort: { date: 1 } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          date: { $last: '$date' },
          weight: { $last: '$weight' },
          bodyFat: { $last: '$bodyFat' },
          chest: { $last: '$chest' },
          waist: { $last: '$waist' },
          hips: { $last: '$hips' },
          arm: { $last: '$arm' },
          thigh: { $last: '$thigh' },
          bmi: { $last: '$bmi' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])

    return res.json({ measurements })
  } catch (error) {
    return res.status(500).json({ message: 'Loi lay so do theo thang', error: error.message })
  }
}
