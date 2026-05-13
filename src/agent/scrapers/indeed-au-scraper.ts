import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BaseScraper } from './base-scraper'
import { extractTechStack } from '../utils/tech-extractor'
import type { RawJobInput } from '@/types/scraper'

chromium.use(StealthPlugin())

function extractSkills(text: string): string[] {
  return extractTechStack(text).map((s) => s.toLowerCase())
}

interface IndeedJobCard {
  jobkey?: string
  displayTitle?: string
  company?: string
  formattedLocation?: string
  snippet?: string
  salary?: { text?: string }
  jobTypes?: string[]
  pubDate?: number
}

export class IndeedAUScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const browser = await chromium.launch({ headless: true })
    const jobs: RawJobInput[] = []

    try {
      const context = await browser.newContext({
        locale: 'en-AU',
        timezoneId: 'Australia/Sydney',
        viewport: { width: 1280, height: 800 },
        userAgent:
          this.config.userAgent ??
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      })

      await context.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}', (r) => r.abort())

      const page = await context.newPage()
      const maxPages = Math.ceil(this.config.maxJobsPerRun / 15)

      for (let pageNum = 0; pageNum < maxPages && jobs.length < this.config.maxJobsPerRun; pageNum++) {
        const start = pageNum * 10
        const url = `https://au.indeed.com/jobs?q=software+developer&l=Australia&sort=date&fromage=7${start > 0 ? `&start=${start}` : ''}`

        this.logger.info('indeed_au_fetch_page', { page: pageNum + 1, url })

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout ?? 30000 })
          await page.waitForTimeout(2000 + Math.random() * 3000)

          const pageJobs = await page.evaluate(() => {
            try {
              const scripts = Array.from(document.querySelectorAll('script'))
              for (const script of scripts) {
                const content = script.textContent ?? ''
                if (content.includes('mosaic-provider-jobcards')) {
                  const match = content.match(
                    /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});/s
                  )
                  if (match) {
                    const data = JSON.parse(match[1])
                    return (data?.metaData?.mosaicProviderJobCardsModel?.results ?? []) as IndeedJobCard[]
                  }
                }
              }
              return [] as IndeedJobCard[]
            } catch {
              return [] as IndeedJobCard[]
            }
          })

          if (pageJobs.length === 0) {
            this.logger.info('indeed_au_no_jobs', { page: pageNum + 1 })
            break
          }

          for (const card of pageJobs) {
            if (!card.jobkey || !card.displayTitle) continue

            const description = card.snippet ?? card.displayTitle
            jobs.push({
              externalId: card.jobkey,
              platform: 'indeed-au',
              title: card.displayTitle,
              company: card.company ?? 'Unknown',
              location: card.formattedLocation ?? 'Australia',
              url: `https://au.indeed.com/viewjob?jk=${card.jobkey}`,
              description,
              salary: card.salary?.text,
              employmentType: card.jobTypes?.[0],
              postedDate: card.pubDate ? new Date(card.pubDate).toISOString() : undefined,
              requiredSkills: extractSkills(description),
              scrapedAt: new Date(),
            })
          }

          this.logger.info('indeed_au_page_done', { page: pageNum + 1, collected: jobs.length })

          if (pageNum < maxPages - 1 && jobs.length < this.config.maxJobsPerRun) {
            await page.waitForTimeout(10000 + Math.random() * 10000)
          }
        } catch (err) {
          this.logger.error('indeed_au_page_error', { page: pageNum + 1, error: String(err) })
          break
        }
      }

      await context.close()
    } catch (err) {
      this.logger.error('indeed_au_scraper_failed', { error: String(err) })
    } finally {
      await browser.close()
    }

    this.logger.info('indeed_au_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }

  override async scrapeJobDetail(url: string): Promise<string | null> {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        locale: 'en-AU',
        timezoneId: 'Australia/Sydney',
        viewport: { width: 1280, height: 800 },
        userAgent:
          this.config.userAgent ??
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()
      await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}', (route) => route.abort())

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout ?? 30000 })
      await page.waitForTimeout(2000 + Math.random() * 2000)

      const description = await page.$eval(
        '#jobDescriptionText',
        (el) => el.innerHTML
      ).catch(() => null)

      await context.close()
      return description
    } catch (err) {
      this.logger.warn('indeed_au_detail_failed', { url, error: String(err) })
      return null
    } finally {
      await browser.close()
    }
  }
}
