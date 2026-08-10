import User from '../models/User.js'
import PT from '../models/PT.js'
import PTPriceHistory from '../models/PTPriceHistory.js'
import { recordAuditLog } from '../services/auditLogService.js'

const MAX_PRICE = 100000000
const PRICE_TYPE_LABELS = { ONE_TO_ONE: 'PT 1-1', GROUP: 'PT nhóm' }

const normalizePrice = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const num = Number(value)
  if (!Number.isFinite(num)) {
    const err = new Error('Giá phải là một số hợp lệ')
    err.statusCode = 400
    throw err
  }
  if (num <= 0) {
    const err = new Error('Giá phải lớn hơn 0')
    err.statusCode = 400
    throw err
  }
  if (num > MAX_PRICE) {
    const err = new Error(`Giá không được vượt quá ${MAX_PRICE.toLocaleString('vi-VN')}đ`)
    err.statusCode = 400
    throw err
  }
  return Math.round(num)
}

const buildPriceListItem = (user, pt, updatedByUser) => ({
  _id: user._id,
  name: user.fullName || user.name,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  isActive: user.isActive,
  status: user.status,
  oneToOnePrice: pt?.oneToOnePrice ?? null,
  groupPrice: pt?.groupPrice ?? null,
  priceUpdatedAt: pt?.priceUpdatedAt || null,
  priceUpdatedBy: updatedByUser
    ? {
        _id: updatedByUser._id,
        name: updatedByUser.fullName || updatedByUser.name,
      }
    : null,
  hasOneToOne: !!(pt?.oneToOnePrice && pt.oneToOnePrice > 0),
  hasGroup: !!(pt?.groupPrice && pt.groupPrice > 0),
})

export const getPriceList = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', priceStatus = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query

    const userFilter = { role: 'pt' }
    if (search) {
      const keyword = String(search).trim()
      const compactKeyword = keyword.replace(/\s+/g, '')
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedCompact = compactKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      userFilter.$or = [
        { fullName: { $regex: escapedKeyword, $options: 'i' } },
        { name: { $regex: escapedKeyword, $options: 'i' } },
        { email: { $regex: escapedCompact, $options: 'i' } },
        { phone: { $regex: escapedCompact, $options: 'i' } },
      ]
    }

    const allUsers = await User.find(userFilter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .lean()

    const userIds = allUsers.map((u) => u._id)
    const ptRecords = await PT.find({ userId: { $in: userIds } }).lean()
    const ptMap = {}
    ptRecords.forEach((pt) => { ptMap[pt.userId.toString()] = pt })

    const updaterIds = [...new Set(ptRecords.map((p) => p.priceUpdatedBy && String(p.priceUpdatedBy)).filter(Boolean))]
    const updaterMap = {}
    if (updaterIds.length > 0) {
      const updaters = await User.find({ _id: { $in: updaterIds } }).select('name fullName').lean()
      updaters.forEach((u) => { updaterMap[u._id.toString()] = u })
    }

    const items = allUsers.map((u) => {
      const pt = ptMap[u._id.toString()]
      return buildPriceListItem(u, pt, pt?.priceUpdatedBy ? updaterMap[String(pt.priceUpdatedBy)] : null)
    })

    let filtered = items
    if (priceStatus === 'configured') {
      filtered = items.filter((i) => i.hasOneToOne || i.hasGroup)
    } else if (priceStatus === 'missing') {
      filtered = items.filter((i) => !i.hasOneToOne && !i.hasGroup)
    }

    const pageNumber = Math.max(Number(page) || 1, 1)
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100)
    const total = filtered.length
    const paged = filtered.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber)

    res.json({
      pts: paged,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi lấy danh sách giá PT' })
  }
}

export const getPTPrice = async (req, res) => {
  try {
    const { ptId } = req.params
    if (!ptId || !/^[0-9a-fA-F]{24}$/.test(ptId)) {
      return res.status(400).json({ message: 'ptId không hợp lệ' })
    }

    const user = await User.findOne({ _id: ptId, role: 'pt' }).lean()
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }
    const pt = await PT.findOne({ userId: ptId }).lean()
    const updater = pt?.priceUpdatedBy
      ? await User.findById(pt.priceUpdatedBy).select('name fullName').lean()
      : null

    res.json({ pt: buildPriceListItem(user, pt, updater) })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi lấy giá PT' })
  }
}

export const updatePTPrice = async (req, res) => {
  try {
    const { ptId } = req.params
    if (!/^[0-9a-fA-F]{24}$/.test(ptId)) {
      return res.status(400).json({ message: 'ptId không hợp lệ' })
    }

    const { oneToOnePrice, groupPrice } = req.body || {}

    const ptUser = await User.findOne({ _id: ptId, role: 'pt' }).lean()
    if (!ptUser) {
      return res.status(404).json({ message: 'Không tìm thấy PT' })
    }

    if (oneToOnePrice === undefined && groupPrice === undefined) {
      return res.status(400).json({ message: 'Vui lòng nhập ít nhất một mức giá' })
    }

    const nextOneToOne = normalizePrice(oneToOnePrice)
    const nextGroup = normalizePrice(groupPrice)

    const ptProfile = await PT.findOne({ userId: ptId })
    if (!ptProfile) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ PT' })
    }

    const oldOneToOne = ptProfile.oneToOnePrice ?? null
    const oldGroup = ptProfile.groupPrice ?? null

    const changes = []
    if (nextOneToOne !== undefined && nextOneToOne !== oldOneToOne) {
      changes.push({ priceType: 'ONE_TO_ONE', oldPrice: oldOneToOne, newPrice: nextOneToOne })
      ptProfile.oneToOnePrice = nextOneToOne
    }
    if (nextGroup !== undefined && nextGroup !== oldGroup) {
      changes.push({ priceType: 'GROUP', oldPrice: oldGroup, newPrice: nextGroup })
      ptProfile.groupPrice = nextGroup
    }

    if (changes.length === 0) {
      return res.json({ message: 'Không có thay đổi nào để cập nhật', pt: ptProfile })
    }

    ptProfile.priceUpdatedAt = new Date()
    ptProfile.priceUpdatedBy = req.user._id
    await ptProfile.save()

    if (changes.length > 0) {
      await PTPriceHistory.insertMany(
        changes.map((c) => ({
          ptId: ptId,
          priceType: c.priceType,
          oldPrice: c.oldPrice,
          newPrice: c.newPrice,
          changedBy: req.user._id,
          changedAt: new Date(),
        })),
      )
    }

    const updater = req.user && (req.user.fullName || req.user.name)
    const changeText = changes.map((c) => `${PRICE_TYPE_LABELS[c.priceType]}: ${c.oldPrice ? c.oldPrice.toLocaleString('vi-VN') + 'đ' : 'Chưa cấu hình'} → ${c.newPrice.toLocaleString('vi-VN')}đ`).join('; ')

    recordAuditLog({
      req,
      module: 'pt_price',
      action: 'update_pt_price',
      entity: ptProfile,
      entityName: `Cấu hình giá PT ${ptUser.fullName || ptUser.name || ptUser.email}`,
      details: `${changeText}. Người thay đổi: ${updater || 'Admin'}`,
    }).catch((err) => console.error('Audit updatePTPrice failed:', err.message))

    res.json({
      message: 'Cập nhật giá PT thành công',
      pt: {
        _id: ptUser._id,
        name: ptUser.fullName || ptUser.name,
        oneToOnePrice: ptProfile.oneToOnePrice ?? null,
        groupPrice: ptProfile.groupPrice ?? null,
        priceUpdatedAt: ptProfile.priceUpdatedAt,
        priceUpdatedBy: updater || null,
      },
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi cập nhật giá PT' })
  }
}

export const getPriceHistory = async (req, res) => {
  try {
    const { ptId } = req.params
    const { priceType = '' } = req.query

    if (!/^[0-9a-fA-F]{24}$/.test(ptId)) {
      return res.status(400).json({ message: 'ptId không hợp lệ' })
    }

    const filter = { ptId }
    if (priceType === 'ONE_TO_ONE' || priceType === 'GROUP') filter.priceType = priceType

    const history = await PTPriceHistory.find(filter)
      .sort({ changedAt: -1 })
      .limit(100)
      .populate('changedBy', 'name fullName email')
      .lean()

    res.json({ history })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi lấy lịch sử giá PT' })
  }
}
