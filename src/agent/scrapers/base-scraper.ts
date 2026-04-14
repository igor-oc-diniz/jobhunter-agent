import type { Logger } from 'winston'
import type {
  ScraperConfig,
  ScraperResult,
  RawJobInput,
  NormalizedJob,
  BlacklistCheckResult,
} from '@/types/scraper'
import { generateJobHash, checkBlacklist } from '../utils/deduplication'
import { adminDb } from '../firebase-admin'

export abstract class BaseScraper {
  protected config: ScraperConfig
  protected logger: Logger

  constructor(config: ScraperConfig, logger: Logger) {
    this.config = config
    this.logger = logger
  }

  /**
   * Abstract method to be implemented by each platform scraper
   * Should return array of raw job data scraped from the platform
   */
  abstract scrape(): Promise<RawJobInput[]>

  /**
   * Normalize raw job input and generate hash for deduplication
   */
  protected normalize(raw: RawJobInput): NormalizedJob {
    const hash = generateJobHash(raw.externalId, raw.platform)

    return {
      ...raw,
      scrapedAt: raw.scrapedAt.toISOString(),
      normalized: true,
      hash,
    }
  }

  /**
   * Check if a job hash exists in the blacklist
   */
  protected async checkBlacklist(hash: string): Promise<BlacklistCheckResult> {
    return checkBlacklist(adminDb, hash)
  }

  /**
   * Main orchestration method that runs the full scraping pipeline:
   * 1. Scrape jobs from platform
   * 2. Normalize each job
   * 3. Check for duplicates against blacklist
   * 4. Return statistics
   */
  public async run(): Promise<ScraperResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let jobsScraped = 0
    let jobsDeduped = 0

    try {
      this.logger.info('Starting scraper run', {
        platform: this.config.platform,
        maxJobs: this.config.maxJobsPerRun,
      })

      // Step 1: Scrape raw jobs
      let rawJobs: RawJobInput[] = []
      try {
        rawJobs = await this.scrape()
        jobsScraped = rawJobs.length
        
        this.logger.info('Scraping completed', {
          platform: this.config.platform,
          jobsScraped,
        })
      } catch (scrapeError) {
        const errorMsg = `Scraping failed: ${(scrapeError as Error).message}`
        this.logger.error(errorMsg, {
          platform: this.config.platform,
          error: scrapeError,
        })
        errors.push(errorMsg)
        
        // Return early if scraping failed
        return {
          platform: this.config.platform,
          jobsScraped: 0,
          jobsDeduped: 0,
          jobs: [],
          errors,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }
      }

      // Step 2: Normalize and deduplicate
      const normalizedJobs: NormalizedJob[] = []
      
      for (const rawJob of rawJobs) {
        try {
          const normalized = this.normalize(rawJob)
          
          // Step 3: Check blacklist
          const blacklistResult = await this.checkBlacklist(normalized.hash)
          
          if (blacklistResult.isDuplicate) {
            jobsDeduped++
            this.logger.debug('Job is duplicate, skipping', {
              platform: this.config.platform,
              hash: normalized.hash,
              title: normalized.title,
            })
            continue
          }

          normalizedJobs.push(normalized)
        } catch (normalizeError) {
          const errorMsg = `Failed to normalize job: ${(normalizeError as Error).message}`
          this.logger.warn(errorMsg, {
            platform: this.config.platform,
            jobTitle: rawJob.title,
            error: normalizeError,
          })
          errors.push(errorMsg)
        }
      }

      this.logger.info('Scraper run completed', {
        platform: this.config.platform,
        jobsScraped,
        jobsDeduped,
        newJobs: normalizedJobs.length,
        errors: errors.length,
      })

      return {
        platform: this.config.platform,
        jobsScraped,
        jobsDeduped,
        jobs: normalizedJobs,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const errorMsg = `Scraper run failed: ${(error as Error).message}`
      this.logger.error(errorMsg, {
        platform: this.config.platform,
        error,
      })
      errors.push(errorMsg)

      return {
        platform: this.config.platform,
        jobsScraped,
        jobsDeduped,
        jobs: [],
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    }
  }
}
