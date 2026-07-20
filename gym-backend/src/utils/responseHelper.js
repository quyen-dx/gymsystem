export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  })
}

export const sendPaginated = (res, data, pagination) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages ?? Math.ceil(pagination.total / pagination.limit),
    },
  })
}

export default { sendSuccess, sendPaginated }
