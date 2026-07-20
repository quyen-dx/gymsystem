import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { isProduction, log as logConfig } from './env.js'

const consoleFormat = isProduction
  ? winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.json(),
    )
  : winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} ${level}: ${message}${metaStr}`
      }),
    )

const fileTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '5d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json(),
  ),
})

const logger = winston.createLogger({
  level: logConfig.level,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    fileTransport,
  ],
  exitOnError: false,
})

export const createRequestLogger = () => {
  return (req, res, next) => {
    const start = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - start
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

      logger.log(level, 'request completed', {
        correlationId: req.correlationId || req.headers['x-request-id'],
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
      })
    })

    next()
  }
}

export default logger
