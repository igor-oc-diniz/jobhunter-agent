import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseScraper, type SearchQuery } from './base-scraper'
import { cleanHtml } from '../utils/html-cleaner'
import { humanDelay, platformDelay } from '../utils/human-delay'
import { logger } from '../utils/logger'
import type { RawJob } from '@/types'

const BASE_URL = 'https://br.indeed.com'

export class IndeedScraper extends BaseScraper {
  platform = 'indeed'

  private get headers() {
    return {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  }

  async scrape(userId: string, query: SearchQuery): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    const maxPages = query.maxPages ?? 3

    for (const keyword of query.keywords) {
      for (let page = 0; page < maxPages; page++) {
        try {
          const url = `${BASE_URL}/jobs?q=${encodeURIComponent(keyword)}&l=Brasil&start=${page * 10}`
          const { data } = await axios.get<string>(url, { headers: this.headers, timeout: 15000 })
          const $ = cheerio.load(data)

          const cards = $('.job_seen_beacon').toArray()
          if (cards.length === 0) break

          for (const card of cards) {
            try {
              const titleEl = $(card).find('.jobTitle a')
              const title = titleEl.text().trim()
              const company = $(card).find('.companyName').text().trim()
              const jk = $(card).find('[data-jk]').attr('data-jk')

              if (!title || !jk) continue

              const sourceUrl = `${BASE_URL}/viewjob?jk=${jk}`

              await humanDelay(1000, 3000)

              const { data: detail } = await axios.get<string>(sourceUrl, {
                headers: this.headers,
                timeout: 15000,
              })
              const $d = cheerio.load(detail)
              const rawDesc = $d('#jobDescriptionText').html() ?? ''
              const description = cleanHtml(rawDesc)
              const isRemote =
                description.toLowerCase().includes('remoto') ||
                description.toLowerCase().includes('home office') ||
                description.toLowerCase().includes('remote')

              const saved = await this.saveRawJob(userId, {
                title,
                company,
                location: $d('.jobsearch-JobInfoHeader-subtitle').text().trim() || 'Brazil',
                isRemote,
                description,
                techStack: this.extractTechStack(description),
                sourceUrl,
                sourcePlatform: this.platform,
                status: 'pending',
              })

              if (saved) jobs.push(saved)
            } catch (err) {
              logger.warn('indeed_card_error', { error: String(err) })
            }
          }

          await humanDelay()
        } catch (err: any) {
          if (err.response?.status === 429) {
            logger.warn('rate_limited', { platform: this.platform })
            await platformDelay()
          } else {
            logger.error('indeed_page_error', { page, error: String(err) })
          }
          break
        }
      }

      await platformDelay()
    }

    return jobs
  }
}
