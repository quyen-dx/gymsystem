import 'dotenv/config'
import http from 'http'
import createApp from './src/app.js'
import connectDB from './src/config/db.js'
import logger from './src/config/logger.js'
import config from './src/config/env.js'
import { initSocketIO } from './src/services/socketService.js'
import { initPushService } from './src/services/pushService.js'

const app = createApp()

const httpServer = http.createServer(app)
initSocketIO(httpServer)
initPushService()

import cron from 'node-cron'
import { runRefundReminderJob } from './src/jobs/refundReminderJob.js'
import { runActivateRenewalCyclesJob } from './src/jobs/activateRenewalCyclesJob.js'
import { runNotificationCleanupJob } from './src/jobs/notificationCleanupJob.js'
import { runMembershipExpiryRemindersJob } from './src/jobs/membershipExpiryRemindersJob.js'

cron.schedule('0 1 * * *', () => {
  logger.info('Running refundReminderJob')
  runRefundReminderJob().catch((err) => logger.error('refundReminderJob failed', { error: err.message }))
})
logger.info('refundReminderJob scheduled daily at 08:00 VN time')

cron.schedule('0 */6 * * *', () => {
  logger.info('Running activateRenewalCyclesJob')
  runActivateRenewalCyclesJob().catch((err) =>
    logger.error('activateRenewalCyclesJob failed', { error: err.message }),
  )
})
logger.info('activateRenewalCyclesJob scheduled every 6 hours')

cron.schedule('30 2 * * *', () => {
  logger.info('Running notificationCleanupJob')
  runNotificationCleanupJob().catch((err) => logger.error('notificationCleanupJob failed', { error: err.message }))
})
logger.info('notificationCleanupJob scheduled daily at 09:30 VN time')

cron.schedule('0 7 * * *', () => {
  logger.info('Running membershipExpiryRemindersJob')
  runMembershipExpiryRemindersJob().catch((err) =>
    logger.error('membershipExpiryRemindersJob failed', { error: err.message }),
  )
})
logger.info('membershipExpiryRemindersJob scheduled daily at 14:00 VN time (07:00 UTC)')

let server = null

const start = async () => {
  logger.info('Starting GymPro server', {
    environment: config.env,
    node: process.version,
    pid: process.pid,
  })

  try {
    await connectDB()
  } catch (error) {
    logger.error('Database connection failed during startup', { error: error.message })
    process.exit(1)
  }

  server = httpServer.listen(config.port, () => {
    logger.info(`✅Server listening on port ${config.port}`, {
      port: config.port,
      environment: config.env,
    })
  })
}

const shutdown = async (signal) => {
  logger.info(`${signal} received — starting graceful shutdown`, { signal })

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed — no longer accepting requests')
    })

    setTimeout(() => {
      logger.error('Forced shutdown after timeout — active connections did not drain')
      process.exit(1)
    }, 10000).unref()
  }

  try {
    const mongoose = await import('mongoose')
    await mongoose.default.connection.close()
    logger.info('Database connection closed')
  } catch (error) {
    logger.error('Error closing database connection', { error: error.message })
  }

  logger.info('Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  })
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  })
  process.exit(1)
})

start()
