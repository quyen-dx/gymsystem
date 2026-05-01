import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
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

    const shop = await Shop.findById(id)
    if (!shop) {
      return next(new AppError('Không tìm thấy shop', 404))
    }

    const ownerId = shop.user_id
    const shopName = shop.name

    // 1. Fetch owner details for email and audit log BEFORE deleting shop
    const owner = await User.findById(ownerId)
    const userEmail = owner?.email

    // 2. Delete all products of this shop
    await Product.deleteMany({ shop_id: id })

    // 3. Delete the shop
    await shop.deleteOne()

    // 4. Update user role and shop references
    // We use findByIdAndUpdate to bypass potential validation issues with other fields
    // and ensure the update is performed directly in the database.
    if (ownerId) {
      await User.findByIdAndUpdate(ownerId, {
        $set: {
          role: 'member',
          isSeller: false,
          shopId: null,
          shop_id: null
        }
      })
    }

    // 5. Send email if email exists
    if (userEmail) {
      try {
        await sendShopDeletionEmail({ toEmail: userEmail, shopName, reason })
      } catch (emailErr) {
        console.error('Failed to send shop deletion email:', emailErr)
      }
    }

    // 6. Audit log
    await recordAuditLog({
      req,
      module: 'shops',
      action: 'delete',
      entity: { _id: id, name: shopName, owner: owner?.name },
      details: `Xóa shop với lý do: ${reason}`,
    })

    res.json({ message: 'Đã xóa shop thành công' })
  } catch (err) {
    next(err)
  }
}
