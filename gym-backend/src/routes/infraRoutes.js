import express from 'express'
import os from 'os'
import { sendSuccess } from '../utils/responseHelper.js'
import catchAsync from '../utils/catchAsync.js'
import { isConfigured as isAiConfigured, checkAiHealth, getError as getAiError } from '../config/ai.js'
import { healthCheck as dbHealthCheck } from '../config/db.js'
import config from '../config/env.js'
import {
  getActiveProviderName,
  listProviders,
  isReady as isAiReady,
} from '../ai/providerRegistry.js'

const router = express.Router()
const { env: nodeEnv } = config

const startTime = Date.now()

const getUptime = () => Math.floor((Date.now() - startTime) / 1000)

const getMemoryUsage = () => {
  const mem = process.memoryUsage()
  return {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  }
}

const getCpuUsage = () => {
  const cpus = os.cpus()
  const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  const totalTick = cpus.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0)
  return {
    cores: cpus.length,
    model: cpus[0]?.model || 'unknown',
  }
}

router.get(
  '/health',
  catchAsync(async (req, res) => {
    const [dbResult, aiResult] = await Promise.allSettled([
      dbHealthCheck(),
      checkAiHealth(),
    ])

    sendSuccess(res, {
      server: 'running',
      environment: nodeEnv,
      database: dbResult.status === 'fulfilled' ? dbResult.value : { status: 'error' },
      ai: aiResult.status === 'fulfilled' ? aiResult.value : { status: 'error' },
      memory: getMemoryUsage(),
      uptime: getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    })
  }),
)

router.get(
  '/ready',
  catchAsync(async (req, res) => {
    const [dbResult, aiResult] = await Promise.allSettled([
      dbHealthCheck(),
      checkAiHealth(),
    ])

    const checks = {
      database: dbResult.status === 'fulfilled' && dbResult.value?.status === 'connected',
      ai: isAiConfigured()
        ? aiResult.status === 'fulfilled' && aiResult.value?.status === 'healthy'
        : 'skipped',
      environment: Boolean(nodeEnv),
      critical: Boolean(dbResult.status === 'fulfilled' && dbResult.value?.status === 'connected'),
    }

    const allPassed = Object.values(checks).every((v) => v === true || v === 'skipped')

    sendSuccess(
      res,
      {
        status: allPassed ? 'ready' : 'not_ready',
        checks,
      },
      allPassed ? 200 : 503,
    )
  }),
)

router.get(
  '/live',
  catchAsync(async (req, res) => {
    sendSuccess(res, {
      status: 'alive',
      uptime: getUptime(),
    })
  }),
)

router.get(
  '/metrics',
  catchAsync(async (req, res) => {
    sendSuccess(res, {
      uptime: getUptime(),
      memory: getMemoryUsage(),
      cpu: getCpuUsage(),
      process: {
        pid: process.pid,
        ppid: process.ppid,
        title: process.title,
      },
      node: process.version,
      platform: {
        os: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
      },
    })
  }),
)

router.get(
  '/version',
  catchAsync(async (req, res) => {
    sendSuccess(res, {
      appVersion: process.env.npm_package_version || '1.0.0',
      apiVersion: 'v1',
      environment: nodeEnv,
      timestamp: new Date().toISOString(),
    })
  }),
)

router.get(
  '/info',
  catchAsync(async (req, res) => {
    sendSuccess(res, {
      project: 'GymPro',
      runtime: {
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ai: {
        configured: isAiConfigured(),
        ready: isAiReady(),
        activeProvider: getActiveProviderName(),
        availableProviders: listProviders(),
        error: isAiConfigured() ? null : getAiError(),
      },
    })
  }),
)

export default router
