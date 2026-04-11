/**
 * Example: Run a single scraper manually
 * 
 * Usage:
 *   tsx src/agent/examples/run-single-scraper.ts gupy
 *   tsx src/agent/examples/run-single-scraper.ts indeed-br
 */

import { createLogger } from '../utils/logger'
import { GupyScraper } from '../scrapers/gupy-scraper'
import { IndeedBRScraper } from '../scrapers/indeed-br-scraper'
import type { ScraperConfig } from '@/types/scraper'

async function main() {
  const platform = process.argv[2] || 'gupy'
  const logger = createLogger(`example:${platform}`)

  logger.info('Running single scraper example', { platform })

  // Create scraper configuration
  const config: ScraperConfig = {
    platform,
    enabled: true,
    maxJobsPerRun: 10, // Limit to 10 for testing
    timeout: 60000,
  }

  // Instantiate appropriate scraper
  let scraper: GupyScraper | IndeedBRScraper | null = null

  switch (platform) {
    case 'gupy':
      scraper = new GupyScraper(config, logger)
      break
    case 'indeed-br':
      scraper = new IndeedBRScraper(config, logger)
      break
    default:
      logger.error('Unknown platform', { platform })
      process.exit(1)
  }

  try {
    // Run the scraper
    logger.info('Starting scraper...')
    const result = await scraper.run()

    // Display results
    logger.info('Scraper completed!', {
      platform: result.platform,
      jobsScraped: result.jobsScraped,
      jobsDeduped: result.jobsDeduped,
      newJobs: result.jobsScraped - result.jobsDeduped,
      errors: result.errors,
      duration: `${result.duration}ms`,
    })

    if (result.errors.length > 0) {
      logger.warn('Errors encountered:', { errors: result.errors })
    }

    process.exit(0)
  } catch (error) {
    logger.error('Scraper failed', { error })
    process.exit(1)
  }
}

main()
