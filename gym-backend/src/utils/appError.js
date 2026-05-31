export default class AppError extends Error {
  constructor(message, statusCode = 400, code = undefined) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}
