import logger from '../config/logger.js'
import { isProduction } from '../config/env.js'
import AppError from '../utils/appError.js'

const errorHandler = (err, req, res, next) => {
  let statusCode = 500
  let errorCode = 'INTERNAL_ERROR'
  let message = err.message || 'Internal server error'
  let responseBody = null

  if (err.code === 11000 || err.code === 11001) {
    const field = Object.keys(err.keyPattern || {}).join(', ')
    statusCode = 409
    errorCode = 'DUPLICATE_KEY'
    responseBody = {
      success: false,
      message: `Duplicate value for: ${field}`,
      error: { code: errorCode, statusCode, field },
    }
  } else if (err.name === 'ValidationError') {
    statusCode = 422
    errorCode = 'VALIDATION_ERROR'
    const fields = Object.entries(err.errors || {}).map(([field, e]) => ({
      field,
      message: e.message,
    }))
    responseBody = {
      success: false,
      message: 'Validation failed',
      error: { code: errorCode, statusCode, fields },
    }
  } else if (err.name === 'CastError') {
    statusCode = 400
    errorCode = 'INVALID_ID'
    responseBody = {
      success: false,
      message: `Invalid value for ${err.path}: ${err.value}`,
      error: { code: errorCode, statusCode, field: err.path },
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode || 400
    errorCode = err.errorCode || err.code || 'INTERNAL_ERROR'
    responseBody = {
      success: false,
      message: err.message,
      error: {
        code: errorCode,
        statusCode,
        ...(err.field && { field: err.field }),
      },
    }
  } else {
    statusCode = 500
    errorCode = 'INTERNAL_ERROR'
    message = isProduction ? 'Internal server error' : err.message
    responseBody = {
      success: false,
      message,
      error: { code: errorCode, statusCode },
    }
  }

  const logLevel = statusCode >= 500 ? 'error' : 'warn'

  logger.log(logLevel, 'error handled', {
    correlationId: req.correlationId,
    errorCode,
    statusCode,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.originalUrl,
    method: req.method,
  })

  return res.status(statusCode).json(responseBody)
}

export default errorHandler
