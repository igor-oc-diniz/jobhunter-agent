import { z } from 'zod'

/**
 * Configuration schema for the agent container
 */
export const AgentConfigSchema = z.object({
  // Firebase
  firebaseServiceAccount: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT is required'),
  firebaseStorageBucket: z.string().optional(),

  // Cron
  cronSchedule: z.string().default('0 */6 * * *'),
  timezone: z.string().default('America/Sao_Paulo'),
  runOnStartup: z.boolean().default(false),

  // Scrapers
  scraperPlatforms: z.array(z.string()).default(['remotive', 'indeed-br']),
  maxJobsPerRun: z.number().int().positive().default(50),
  scraperTimeout: z.number().int().positive().default(60000),
  userAgent: z.string().optional(),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

/**
 * Load and validate agent configuration from environment variables
 */
export function loadConfig(): AgentConfig {
  const rawConfig = {
    firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    
    cronSchedule: process.env.CRON_SCHEDULE,
    timezone: process.env.TZ,
    runOnStartup: process.env.RUN_ON_STARTUP === 'true',
    
    scraperPlatforms: process.env.SCRAPER_PLATFORMS?.split(',').map(p => p.trim()).filter(Boolean),
    maxJobsPerRun: process.env.MAX_JOBS_PER_RUN ? parseInt(process.env.MAX_JOBS_PER_RUN, 10) : undefined,
    scraperTimeout: process.env.SCRAPER_TIMEOUT ? parseInt(process.env.SCRAPER_TIMEOUT, 10) : undefined,
    userAgent: process.env.SCRAPER_USER_AGENT,
    
    logLevel: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | undefined,
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test' | undefined,
  }

  try {
    return AgentConfigSchema.parse(rawConfig)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:')
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
      })
      throw new Error('Invalid agent configuration')
    }
    throw error
  }
}
