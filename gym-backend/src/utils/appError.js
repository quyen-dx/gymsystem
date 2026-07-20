export default class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = undefined) {
    super(message)
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}
