import AppError from '../utils/appError.js'

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source]
    if (!data) {
      return next(new AppError(`Request ${source} is required`, 400, 'VALIDATION_MISSING_BODY'))
    }

    const result = schema.safeParse(data)
    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR'))
    }

    req[source] = result.data
    next()
  }
}

export const validateBody = (schema) => validate(schema, 'body')
export const validateQuery = (schema) => validate(schema, 'query')
export const validateParams = (schema) => validate(schema, 'params')

export default validate
