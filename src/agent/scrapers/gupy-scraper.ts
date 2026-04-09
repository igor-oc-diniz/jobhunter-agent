import { BaseScraper, type SearchQuery } from './base-scraper'
import { createBrowser, createPage, detectCaptcha } from '../utils/browser-pool'
import { cleanHtml } from '../utils/html-cleaner'
import { logger } from '../utils/logger'
import type { RawJob } from '@/types'

export class GupyScraper extends BaseScraper {
  platform = 'gupy'

  async scrape(userId: string, query: SearchQuery): Promise<RawJob[]> {
    const browser = await createBrowser()
    const jobs: RawJob[] = []

    try {
      for (const keyword of query.keywords) {
        const page = await createPage(browser)

        try {
          const url = `https://portal.gupy.io/job-search/term=${encodeURIComponent(keyword)}`
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

          if (await detectCaptcha(page)) {
            logger.warn('captcha_detected', { platform: this.platform, url })
            await page.close()
            continue
          }

          // Collect job cards (scroll-based pagination)
          let previousCount = 0
          let stableCount = 0

          while (stableCount < 2) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await this.humanDelay()

            const cards = await page.locator('[data-testid="job-card"]').all()
            if (cards.length === previousCount) {
              stableCount++
            } else {
              stableCount = 0
              previousCount = cards.length
            }

            if (cards.length >= (query.maxPages ?? 5) * 10) break
          }

          const cardElements = await page.locator('[data-testid="job-card"]').all()

          for (const card of cardElements) {
            try {
              const title = await card.locator('[data-testid="job-name"]').textContent() ?? ''
              const company = await card.locator('[data-testid="job-company-name"]').textContent() ?? ''
              const href = await card.locator('a').first().getAttribute('href') ?? ''
              const sourceUrl = href.startsWith('http') ? href : `https://portal.gupy.io${href}`

              if (!title || !company) continue

              // Visit job detail page
              const detailPage = await createPage(browser)
              try {
                await detailPage.goto(sourceUrl, { waitUntil: 'networkidle', timeout: 20000 })
                await this.humanDelay()

                const descEl = await detailPage.locator('[data-testid="job-description"]').first()
                const rawDesc = await descEl.innerHTML().catch(() => '')
                const description = cleanHtml(rawDesc)
                const isRemote = description.toLowerCase().includes('remoto') || description.toLowerCase().includes('remote')

                const saved = await this.saveRawJob(userId, {
                  title: title.trim(),
                  company: company.trim(),
                  location: isRemote ? 'Remote' : 'Brazil',
                  isRemote,
                  description,
                  techStack: this.extractTechStack(description),
                  sourceUrl,
                  sourcePlatform: this.platform,
                  status: 'pending',
                })

                if (saved) jobs.push(saved)
              } finally {
                await detailPage.close()
              }

              await this.humanDelay()
            } catch (err) {
              logger.warn('job_card_error', { platform: this.platform, error: String(err) })
            }
          }
        } finally {
          await page.close()
        }
      }
    } finally {
      await browser.close()
    }

    return jobs
  }
}
