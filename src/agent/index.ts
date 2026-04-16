import cron from 'node-cron'
import { createLogger } from './utils/logger'
import { loadConfig } from './utils/config'
import { startServer } from './server'
import { runPipeline } from './pipeline'
import { adminDb } from './firebase-admin'
import type { UserProfile } from '@/types'

const logger = createLogger('agent')

let config: ReturnType<typeof loadConfig>
try {
  config = loadConfig()
} catch {
  process.exit(1)
}

/**
 * Find all users with agent enabled and run the pipeline for each.
 */
async function runForAllEnabledUsers(): Promise<void> {
  const snap = await adminDb.collectionGroup('profile').get()

  const enabledUsers = snap.docs
    .filter((d) => {
      const data = d.data() as Partial<UserProfile>
      return data?.agentConfig?.enabledPlatforms?.length && data.userId
    })
    .map((d) => (d.data() as UserProfile).userId)

  if (enabledUsers.length === 0) {
    logger.info('no_enabled_users')
    return
  }

  logger.info('cron_run_start', { users: enabledUsers.length })

  for (const userId of enabledUsers) {
    try {
      await runPipeline(userId)
    } catch (err) {
      logger.error('pipeline_error', { userId, error: String(err) })
    }
  }
}

async function main(): Promise<void> {
  const httpPort = parseInt(process.env.PORT || '3001', 10)
  startServer(httpPort)

  if (!cron.validate(config.cronSchedule)) {
    logger.error('invalid_cron', { schedule: config.cronSchedule })
    process.exit(1)
  }

  if (config.runOnStartup) {
    logger.info('startup_run')
    await runForAllEnabledUsers()
  }

  const task = cron.schedule(config.cronSchedule, runForAllEnabledUsers, {
    timezone: config.timezone,
  })

  logger.info('agent_started', {
    port: httpPort,
    cron: config.cronSchedule,
    timezone: config.timezone,
  })

  const shutdown = async (signal: string) => {
    logger.info('shutdown', { signal })
    task.stop()
    const admin = await import('firebase-admin')
    if (admin.apps.length > 0) await admin.app().delete()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    logger.error('uncaught_exception', { error: err.message })
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { reason: String(reason) })
  })
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
