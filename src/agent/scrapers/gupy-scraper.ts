import { chromium, type Browser, type Page } from 'playwright'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

export class GupyScraper extends BaseScraper {
  private browser: Browser | null = null

  /**
   * Scrape jobs from Gupy platform using Playwright
   */
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    try {
      // Launch browser with stealth configuration
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      })

      const context = await this.browser.newContext({
        userAgent: this.config.userAgent || 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR',
      })

      const page = await context.newPage()

      // Set timeout from config
      page.setDefaultTimeout(this.config.timeout || 30000)

      // Navigate to Gupy jobs portal
      // Using a generic Gupy search page - in production this should be configurable
      const searchUrl = 'https://portal.gupy.io/job-search/term='
      
      this.logger.info('Navigating to Gupy portal', { url: searchUrl })
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })

      // Wait for job cards to load
      await page.waitForSelector('[class*="job"], [data-testid*="job"], .sc-job-card, div[role="listitem"]', { 
        timeout: 10000,
        state: 'visible',
      }).catch(() => {
        this.logger.warn('Job cards selector not found, trying alternative selectors')
      })

      let jobsCollected = 0
      const maxJobs = this.config.maxJobsPerRun

      // Extract jobs with pagination
      while (jobsCollected < maxJobs) {
        const newJobs = await this.extractJobsFromPage(page)
        
        if (newJobs.length === 0) {
          this.logger.info('No more jobs found on page')
          break
        }

        jobs.push(...newJobs)
        jobsCollected = jobs.length

        this.logger.debug(`Collected ${jobsCollected} jobs so far`)

        if (jobsCollected >= maxJobs) {
          break
        }

        // Try to load more jobs
        const hasMore = await this.loadMoreJobs(page)
        if (!hasMore) {
          this.logger.info('No more jobs to load')
          break
        }

        // Wait for new jobs to load
        await page.waitForTimeout(2000)
      }

      this.logger.info('Gupy scraping completed', { totalJobs: jobs.length })

      await context.close()

      // Return only up to maxJobsPerRun
      return jobs.slice(0, maxJobs)
    } catch (error) {
      this.logger.error('Gupy scraping failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      })
      return []
    } finally {
      if (this.browser) {
        await this.browser.close().catch((err) => {
          this.logger.error('Failed to close browser', { error: err })
        })
        this.browser = null
      }
    }
  }

  /**
   * Extract job data from current page
   */
  private async extractJobsFromPage(page: Page): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    try {
      // Extract all job cards from the page
      const jobCards = await page.$$('[class*="job-card"], [data-testid*="job"], div[role="listitem"]')

      this.logger.debug(`Found ${jobCards.length} job cards on page`)

      for (const card of jobCards) {
        try {
          const jobData = await this.extractJobData(page, card)
          if (jobData) {
            jobs.push(jobData)
          }
        } catch (error) {
          this.logger.warn('Failed to extract job from card', {
            error: (error as Error).message,
          })
        }
      }
    } catch (error) {
      this.logger.error('Failed to extract jobs from page', {
        error: (error as Error).message,
      })
    }

    return jobs
  }

  /**
   * Extract data from a single job card
   */
  private async extractJobData(page: Page, cardElement: any): Promise<RawJobInput | null> {
    try {
      // Extract job title
      const titleElement = await cardElement.$('[class*="title"], [class*="job-title"], h2, h3')
      const title = titleElement ? await titleElement.textContent() : null

      if (!title) {
        return null
      }

      // Extract company name
      const companyElement = await cardElement.$('[class*="company"], [class*="company-name"]')
      const company = companyElement ? await companyElement.textContent() : 'Unknown'

      // Extract location
      const locationElement = await cardElement.$('[class*="location"], [class*="city"]')
      const location = locationElement ? await locationElement.textContent() : 'Remote'

      // Extract job URL
      const linkElement = await cardElement.$('a')
      const relativeUrl = linkElement ? await linkElement.getAttribute('href') : null
      const url = relativeUrl ? new URL(relativeUrl, 'https://portal.gupy.io').toString() : ''

      if (!url) {
        return null
      }

      // Extract job ID from URL
      const urlMatch = url.match(/\/job\/([^/?]+)/)
      const externalId = urlMatch ? urlMatch[1] : url

      // Extract salary if available
      const salaryElement = await cardElement.$('[class*="salary"], [class*="wage"]')
      const salary = salaryElement ? await salaryElement.textContent() : undefined

      // Extract employment type
      const typeElement = await cardElement.$('[class*="type"], [class*="contract"]')
      const employmentType = typeElement ? await typeElement.textContent() : undefined

      // Extract description (usually requires clicking into the job)
      const descElement = await cardElement.$('[class*="description"], [class*="summary"], p')
      const description = descElement ? await descElement.textContent() : title

      return {
        externalId,
        platform: 'gupy',
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        url,
        description: description.trim(),
        salary: salary?.trim(),
        employmentType: employmentType?.trim(),
        postedDate: undefined,
        requiredSkills: [],
        scrapedAt: new Date(),
      }
    } catch (error) {
      this.logger.warn('Failed to extract job data from card', {
        error: (error as Error).message,
      })
      return null
    }
  }

  /**
   * Try to load more jobs by clicking "Load More" button
   */
  private async loadMoreJobs(page: Page): Promise<boolean> {
    try {
      // Look for common "Load More" button selectors
      const loadMoreButton = await page.$(
        'button:has-text("Carregar mais"), button:has-text("Ver mais"), [class*="load-more"], [class*="show-more"]'
      )

      if (!loadMoreButton) {
        return false
      }

      const isVisible = await loadMoreButton.isVisible()
      const isEnabled = await loadMoreButton.isEnabled()

      if (!isVisible || !isEnabled) {
        return false
      }

      await loadMoreButton.click()
      await page.waitForTimeout(1500)
      return true
    } catch (error) {
      this.logger.debug('Could not load more jobs', {
        error: (error as Error).message,
      })
      return false
    }
  }
}
