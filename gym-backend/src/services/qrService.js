import jwt from 'jsonwebtoken'
import CheckIn from '../models/CheckIn.js'
import AppError from '../utils/appError.js'

const QR_TOKEN_TTL = Number(process.env.QR_TOKEN_TTL) || 30

export const generateCheckinQR = (memberId) => {
  const now = new Date()
  const expiredAt = new Date(now.getTime() + QR_TOKEN_TTL * 1000)

  const token = jwt.sign(
    {
      memberId: memberId.toString(),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiredAt.getTime() / 1000),
      purpose: 'checkin',
    },
    process.env.JWT_SECRET,
  )

  return { token, expiredAt, ttl: QR_TOKEN_TTL }
}

export const verifyCheckinQR = async (token) => {
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    throw new AppError('Mã QR không hợp lệ hoặc đã hết hạn', 401)
  }

  if (decoded.purpose !== 'checkin' || !decoded.memberId) {
    throw new AppError('Mã QR không hợp lệ', 401)
  }

  const alreadyUsed = await CheckIn.findOne({ qrToken: token }).lean()
  if (alreadyUsed) {
    throw new AppError('Mã QR này đã được sử dụng', 409)
  }

  return { memberId: decoded.memberId }
}
