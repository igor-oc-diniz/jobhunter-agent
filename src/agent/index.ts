import './orchestrator/scheduler'
import { logger } from './utils/logger'

logger.info('agent_started', {
  node: process.version,
  env: process.env.NODE_ENV,
})

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { reason: String(reason) })
})

process.on('SIGTERM', () => {
  logger.info('agent_shutting_down')
  process.exit(0)
})
