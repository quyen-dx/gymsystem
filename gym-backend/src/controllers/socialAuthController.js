import {
  linkSocialAccount,
  unlinkSocialAccount,
} from '../services/socialAuthService.js'
import sendError from '../utils/sendError.js'

export const linkSocial = async (req, res) => {
  try {
    const { provider, token } = req.body

    if (!provider) {
      return res.status(400).json({ message: 'Thiếu nhà cung cấp (provider)' })
    }
    if (!token) {
      return res.status(400).json({ message: 'Thiếu token xác thực' })
    }

    await linkSocialAccount(req.user._id, provider, token)

    return res.status(200).json({ message: 'Liên kết tài khoản mạng xã hội thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const unlinkSocial = async (req, res) => {
  try {
    const { provider } = req.body

    if (!provider) {
      return res.status(400).json({ message: 'Thiếu nhà cung cấp (provider)' })
    }

    await unlinkSocialAccount(req.user._id, provider)

    return res.status(200).json({ message: 'Hủy liên kết tài khoản mạng xã hội thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}
