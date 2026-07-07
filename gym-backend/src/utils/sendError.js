export default function sendError(res, error) {
  console.error('[sendError]', error?.constructor?.name, error?.message, error)

  if (!error) {
    return res.status(500).json({ message: 'Lỗi không xác định' })
  }

  if (error.code === 11000 || error.code === 11001) {
    const field = Object.keys(error.keyPattern || {}).join(', ')
    if (field === 'email') return res.status(400).json({ message: 'Email đã được sử dụng' })
    if (field === 'phone') return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' })
    return res.status(400).json({ message: `Dữ liệu bị trùng lặp (${field})` })
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message).join(', ')
    return res.status(400).json({ message: messages || 'Dữ liệu không hợp lệ' })
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'ID không hợp lệ' })
  }

  if (error.constructor?.name === 'AppError' || error.statusCode) {
    return res.status(error.statusCode || 400).json({ message: error.message })
  }

  const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500
  const message = typeof error.message === 'string' ? error.message : 'Lỗi máy chủ'
  return res.status(statusCode).json({ message })
}
