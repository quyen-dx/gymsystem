import jwt from 'jsonwebtoken'

export const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: 'gym-system',
    audience: 'user',
  })

export const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'gym-system',
  })

export const generateResetToken = ({ userId, identifier }) =>
  jwt.sign({ userId, identifier, type: 'password_reset' }, process.env.JWT_SECRET, {
    expiresIn: '10m',
    issuer: 'gym-system',
    audience: 'password-reset',
  })

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'gym-system',
      audience: 'user',
    })
  } catch {
    return null
  }
}

// Chỉ lấy identity của access token để đối chiếu khi refresh (chấp nhận token đã hết hạn,
// nhưng vẫn kiểm tra chữ ký — token giả mạo sẽ bị từ chối)
export const decodeAccessTokenIdentity = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
      issuer: 'gym-system',
      audience: 'user',
    })
  } catch {
    return null
  }
}

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'gym-system',
    })
  } catch {
    return null
  }
}

export const verifyResetToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'gym-system',
      audience: 'password-reset',
    })
  } catch {
    return null
  }
}
