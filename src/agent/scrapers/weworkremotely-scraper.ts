import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

// RSS feeds for dev-relevant categories
const FEEDS = [
  { url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', category: 'programming' },
  { url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss', category: 'devops' },
  { url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss', category: 'fullstack' },
  { url: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss', category: 'backend' },
  { url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss', category: 'frontend' },
]

const SKILL_PATTERNS = [
  'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'kotlin', 'swift',
  'react', 'angular', 'vue', 'next.js', 'node.js', 'express', 'nestjs', 'fastapi', 'django', 'spring',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform',
  'git', 'ci/cd', 'graphql', 'rest', 'microservices', 'machine learning', 'ai',
]

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter((s) => lower.includes(s))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// WWR RSS <title> format: "Company Name | Job Title"  or  "Job Title at Company Name"
function parseTitle(raw: string): { title: string; company: string } {
  const pipeIdx = raw.indexOf(' | ')
  if (pipeIdx !== -1) {
    return { company: raw.slice(0, pipeIdx).trim(), title: raw.slice(pipeIdx + 3).trim() }
  }
  const atIdx = raw.lastIndexOf(' at ')
  if (atIdx !== -1) {
    return { title: raw.slice(0, atIdx).trim(), company: raw.slice(atIdx + 4).trim() }
  }
  return { title: raw.trim(), company: 'Unknown' }
}

export class WeWorkRemotelyScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []
    const seenIds = new Set<string>()
    const limitPerFeed = Math.ceil(this.config.maxJobsPerRun / FEEDS.length)

    for (const feed of FEEDS) {
      if (jobs.length >= this.config.maxJobsPerRun) break

      try {
        this.logger.info('wwr_fetch', { category: feed.category })

        const { data: xml } = await axios.get<string>(feed.url, {
          timeout: this.config.timeout ?? 15000,
          headers: {
            'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
            Accept: 'application/rss+xml, application/xml, text/xml',
          },
        })

        const $ = cheerio.load(xml, { xmlMode: true })
        const items = $('item').toArray()

        this.logger.info('wwr_feed_loaded', { category: feed.category, items: items.length })

        let countThisFeed = 0
        for (const item of items) {
          if (jobs.length >= this.config.maxJobsPerRun) break
          if (countThisFeed >= limitPerFeed) break

          const rawTitle = $(item).find('title').first().text()
          const link = $(item).find('link').first().text() ||
                       $(item).find('link').first().next().text()
          const pubDate = $(item).find('pubDate').first().text()
          const descHtml = $(item).find('description').first().text()
          const guid = $(item).find('guid').first().text() || link

          if (!guid || seenIds.has(guid)) continue
          seenIds.add(guid)

          const { title, company } = parseTitle(rawTitle)
          const description = stripHtml(descHtml)
          const requiredSkills = extractSkills(description)

          // Region filter: skip if clearly region-restricted to non-remote-worldwide
          // WWR sometimes lists USA-only roles — we still include them for matching to decide
          const regionEl = $(item).find('region').first().text()

          jobs.push({
            externalId: guid,
            platform: 'weworkremotely',
            title,
            company,
            location: regionEl || 'Worldwide',
            url: link || guid,
            description,
            salary: undefined,
            employmentType: 'full-time',
            postedDate: pubDate ? new Date(pubDate).toISOString() : undefined,
            requiredSkills,
            scrapedAt: new Date(),
          })

          countThisFeed++
        }

        this.logger.info('wwr_feed_done', { category: feed.category, collected: countThisFeed })
      } catch (err) {
        this.logger.error('wwr_feed_error', { category: feed.category, error: String(err) })
      }
    }

    this.logger.info('wwr_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
