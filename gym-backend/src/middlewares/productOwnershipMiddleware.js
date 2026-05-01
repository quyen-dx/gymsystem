import Product from '../models/Product.js'

export const checkProductOwner = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' })
    }

    const userShopId = req.user.shop_id || req.user.shopId

    if (!userShopId || !product.shop_id || product.shop_id.toString() !== userShopId.toString()) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác sản phẩm này' })
    }

    req.product = product
    return next()
  } catch (error) {
    return next(error)
  }
}
