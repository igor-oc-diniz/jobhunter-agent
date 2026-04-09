import { createLogger, format, transports } from 'winston'

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new transports.Console()],
})

export function createRunLogger(runId: string, userId: string) {
  const entries: Array<{ timestamp: string; level: string; action: string; details: Record<string, unknown> }> = []

  function log(level: 'info' | 'warn' | 'error', action: string, details: Record<string, unknown> = {}) {
    const entry = { timestamp: new Date().toISOString(), level, action, details }
    entries.push(entry)
    logger[level]({ runId, userId, action, ...details })
  }

  return {
    info: (action: string, details?: Record<string, unknown>) => log('info', action, details),
    warn: (action: string, details?: Record<string, unknown>) => log('warn', action, details),
    error: (action: string, details?: Record<string, unknown>) => log('error', action, details),
    getEntries: () => entries,
  }
}
