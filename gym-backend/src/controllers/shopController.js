import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { sendShopDeletionEmail } from '../services/emailService.js'
import AppError from '../utils/appError.js'

export const getAdminShops = async (req, res, next) => {
  try {
    const shops = await Shop.find().populate('user_id', 'name email phone role isSeller')
    res.json(shops)
  } catch (err) {
    next(err)
  }
}

export const deleteShop = async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason) {
      return next(new AppError('Vui lòng cung cấp lý do xóa shop', 400))
    }

    const shop = await Shop.findById(id).populate('user_id')
    if (!shop) {
      return next(new AppError('Không tìm thấy shop', 404))
    }

    const user = shop.user_id
    const shopName = shop.name
    const userEmail = user?.email

    // 1. Delete all products of this shop
    await Product.deleteMany({ shop_id: id })

    // 2. Delete the shop
    await shop.deleteOne()

    // 3. Update user role (revert to 'user' or something?)
    if (user) {
      user.role = 'user'
      user.isSeller = false
      user.shopId = null
      user.shop_id = null
      await user.save()
    }

    // 4. Send email if email exists
    if (userEmail) {
      try {
        await sendShopDeletionEmail({ toEmail: userEmail, shopName, reason })
      } catch (emailErr) {
        console.error('Failed to send shop deletion email:', emailErr)
      }
    }

    // 5. Audit log
    await recordAuditLog({
      req,
      module: 'shops',
      action: 'delete',
      entity: { _id: id, name: shopName, owner: user?.name },
      details: `Xóa shop với lý do: ${reason}`,
    })

    res.json({ message: 'Đã xóa shop thành công' })
  } catch (err) {
    next(err)
  }
}
