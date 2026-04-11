import cron from 'node-cron'
import { createLogger } from './utils/logger'
import { loadConfig } from './utils/config'
import { startHealthServer } from './utils/health'
import { GupyScraper } from './scrapers/gupy-scraper'
import { IndeedBRScraper } from './scrapers/indeed-br-scraper'
import type { ScraperConfig } from '@/types/scraper'
import { adminDb } from './firebase-admin'

// Initialize logger for agent container
const logger = createLogger('agent-container')

// Load and validate configuration
let config: ReturnType<typeof loadConfig>
try {
  config = loadConfig()
  logger.info('Configuration loaded successfully', {
    platforms: config.scraperPlatforms,
    cronSchedule: config.cronSchedule,
    maxJobsPerRun: config.maxJobsPerRun,
  })
} catch (error) {
  console.error('Failed to load configuration:', error)
  process.exit(1)
}

/**
 * Run all enabled scrapers in parallel
 */
async function runScrapers(): Promise<void> {
  const startTime = Date.now()
  
  logger.info('Starting scraper run', {
    timestamp: new Date().toISOString(),
    platforms: config.scraperPlatforms,
  })

  try {
    // Create scraper configurations
    const scraperConfigs: ScraperConfig[] = config.scraperPlatforms.map(platform => ({
      platform,
      enabled: true,
      maxJobsPerRun: config.maxJobsPerRun,
      userAgent: config.userAgent,
      timeout: config.scraperTimeout,
    }))

    // Instantiate scrapers
    const scrapers = scraperConfigs.map(scraperConfig => {
      const scraperLogger = createLogger(`scraper:${scraperConfig.platform}`)
      
      switch (scraperConfig.platform) {
        case 'gupy':
          return new GupyScraper(scraperConfig, scraperLogger)
        case 'indeed-br':
          return new IndeedBRScraper(scraperConfig, scraperLogger)
        default:
          logger.warn('Unknown scraper platform', { platform: scraperConfig.platform })
          return null
      }
    }).filter((scraper): scraper is GupyScraper | IndeedBRScraper => scraper !== null)

    if (scrapers.length === 0) {
      logger.warn('No scrapers to run')
      return
    }

    logger.info('Running scrapers', { count: scrapers.length })

    // Run all scrapers in parallel
    const results = await Promise.allSettled(
      scrapers.map(scraper => scraper.run())
    )

    // Process and log results
    let totalJobsScraped = 0
    let totalJobsDeduped = 0
    let totalErrors = 0
    const platformResults: Record<string, any> = {}

    results.forEach((result, index) => {
      const scraper = scrapers[index]
      const platform = scraper ? (scraper as any).config.platform : 'unknown'
      
      if (result.status === 'fulfilled') {
        const scraperResult = result.value
        totalJobsScraped += scraperResult.jobsScraped
        totalJobsDeduped += scraperResult.jobsDeduped
        totalErrors += scraperResult.errors.length

        platformResults[scraperResult.platform] = {
          jobsScraped: scraperResult.jobsScraped,
          jobsDeduped: scraperResult.jobsDeduped,
          newJobs: scraperResult.jobsScraped - scraperResult.jobsDeduped,
          errors: scraperResult.errors.length,
          duration: scraperResult.duration,
        }

        logger.info('Scraper completed', {
          platform: scraperResult.platform,
          jobsScraped: scraperResult.jobsScraped,
          jobsDeduped: scraperResult.jobsDeduped,
          newJobs: scraperResult.jobsScraped - scraperResult.jobsDeduped,
          errors: scraperResult.errors.length,
          duration: scraperResult.duration,
        })

        if (scraperResult.errors.length > 0) {
          logger.error('Scraper encountered errors', {
            platform: scraperResult.platform,
            errors: scraperResult.errors,
          })
        }
      } else {
        logger.error('Scraper failed', {
          platform,
          error: result.reason,
        })
        totalErrors++
        platformResults[platform] = {
          error: String(result.reason),
        }
      }
    })

    const duration = Date.now() - startTime
    const newJobs = totalJobsScraped - totalJobsDeduped

    // Log aggregated results to Firestore
    try {
      await adminDb.collection('agentRuns').add({
        type: 'scraper',
        timestamp: new Date(),
        duration,
        totalJobsScraped,
        totalJobsDeduped,
        newJobs,
        totalErrors,
        platforms: config.scraperPlatforms,
        platformResults,
        status: totalErrors > 0 ? 'completed_with_errors' : 'success',
      })
    } catch (error) {
      logger.error('Failed to log run to Firestore', {
        error: (error as Error).message,
      })
    }

    logger.info('Scraper run completed', {
      duration,
      totalJobsScraped,
      totalJobsDeduped,
      newJobs,
      totalErrors,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Scraper run failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      duration,
    })

    // Log failure to Firestore
    try {
      await adminDb.collection('agentRuns').add({
        type: 'scraper',
        timestamp: new Date(),
        duration,
        status: 'failed',
        error: (error as Error).message,
        platforms: config.scraperPlatforms,
      })
    } catch (firestoreError) {
      logger.error('Failed to log failure to Firestore', {
        error: (firestoreError as Error).message,
      })
    }
  }
}

/**
 * Main function to start the agent container
 */
async function main(): Promise<void> {
  logger.info('Agent container starting', {
    nodeVersion: process.version,
    platform: process.platform,
    env: config.nodeEnv,
  })

  // Start health check server
  const healthPort = parseInt(process.env.HEALTH_PORT || '3001', 10)
  startHealthServer(healthPort)

  // Validate cron expression
  if (!cron.validate(config.cronSchedule)) {
    logger.error('Invalid cron schedule', { schedule: config.cronSchedule })
    process.exit(1)
  }

  // Run once on startup if enabled
  if (config.runOnStartup) {
    logger.info('Running scrapers on startup')
    await runScrapers()
  }

  // Schedule periodic runs
  const task = cron.schedule(
    config.cronSchedule,
    async () => {
      logger.info('Cron triggered scraper run')
      await runScrapers()
    },
    {
      timezone: config.timezone,
    }
  )

  logger.info('Agent container started successfully', {
    cronSchedule: config.cronSchedule,
    timezone: config.timezone,
    healthCheckPort: healthPort,
  })

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info('Shutdown signal received', { signal })

    try {
      // Stop cron task
      task.stop()
      logger.info('Cron task stopped')

      // Close Firestore connection
      const admin = await import('firebase-admin')
      if (admin.apps.length > 0) {
        await admin.app().delete()
        logger.info('Firebase Admin SDK closed')
      }

      logger.info('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      })
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    })
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason: String(reason),
    })
  })
}

// Start the agent container
main().catch((error) => {
  console.error('Fatal error starting agent container:', error)
  process.exit(1)
})
