import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

chromium.use(StealthPlugin())

const SKILL_PATTERNS = [
  'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'kotlin', 'swift',
  'react', 'angular', 'vue', 'next.js', 'node.js', 'express', 'nestjs', 'fastapi', 'django', 'spring',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform',
  'git', 'ci/cd', 'graphql', 'rest', 'microservices',
]

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter((s) => lower.includes(s))
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

export class IndeedBRScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const browser = await chromium.launch({ headless: true })
    const jobs: RawJobInput[] = []

    try {
      const context = await browser.newContext({
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1280, height: 800 },
        userAgent:
          this.config.userAgent ??
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      // Block images/fonts to speed up loading
      await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf}', (route) => route.abort())

      const maxPages = Math.ceil(this.config.maxJobsPerRun / 15)

      for (let pageNum = 0; pageNum < maxPages && jobs.length < this.config.maxJobsPerRun; pageNum++) {
        const start = pageNum * 10
        const url = `https://br.indeed.com/jobs?q=desenvolvedor&l=Brasil&sort=date&fromage=7${start > 0 ? `&start=${start}` : ''}`

        this.logger.info('indeed_fetch_page', { page: pageNum + 1, url })

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout ?? 30000 })

          // Random human-like delay
          await page.waitForTimeout(2000 + Math.random() * 3000)

          // Extract embedded JSON from window.mosaic.providerData
          const pageJobs = await page.evaluate(() => {
            try {
              // Indeed embeds job data as JSON in the page
              const scripts = Array.from(document.querySelectorAll('script'))
              for (const script of scripts) {
                const content = script.textContent ?? ''
                if (content.includes('mosaic-provider-jobcards')) {
                  const match = content.match(
                    /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});/s
                  )
                  if (match) {
                    const data = JSON.parse(match[1])
                    const results = data?.metaData?.mosaicProviderJobCardsModel?.results ?? []
                    return results as IndeedJobCard[]
                  }
                }
              }
              return []
            } catch {
              return []
            }
          })

          if (pageJobs.length === 0) {
            this.logger.info('indeed_no_jobs_on_page', { page: pageNum + 1 })
            break
          }

          for (const card of pageJobs) {
            if (!card.jobkey || !card.displayTitle) continue

            const salary = card.salary?.text
            const employmentType = card.jobTypes?.[0]
            const postedDate = card.pubDate ? new Date(card.pubDate).toISOString() : undefined
            const description = card.snippet ?? card.displayTitle

            jobs.push({
              externalId: card.jobkey,
              platform: 'indeed-br',
              title: card.displayTitle,
              company: card.company ?? 'Unknown',
              location: card.formattedLocation ?? 'Brasil',
              url: `https://br.indeed.com/viewjob?jk=${card.jobkey}`,
              description,
              salary,
              employmentType,
              postedDate,
              requiredSkills: extractSkills(description),
              scrapedAt: new Date(),
            })
          }

          this.logger.info('indeed_page_done', { page: pageNum + 1, collected: jobs.length })

          // Respectful delay between pages: 10–20s
          if (pageNum < maxPages - 1 && jobs.length < this.config.maxJobsPerRun) {
            await page.waitForTimeout(10000 + Math.random() * 10000)
          }
        } catch (err) {
          this.logger.error('indeed_page_error', { page: pageNum + 1, error: String(err) })
          break
        }
      }

      await context.close()
    } catch (err) {
      this.logger.error('indeed_scraper_failed', { error: String(err) })
    } finally {
      await browser.close()
    }

    this.logger.info('indeed_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
