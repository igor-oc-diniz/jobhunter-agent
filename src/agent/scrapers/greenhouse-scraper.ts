import axios from 'axios'
import { BaseScraper } from './base-scraper'
import { getGreenhouseBoards } from '../utils/ats-discovery'
import type { RawJobInput } from '@/types/scraper'

const GREENHOUSE_API = 'https://boards-api.greenhouse.io/v1/boards'

const SKILL_PATTERNS = [
  'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'kotlin', 'swift',
  'react', 'angular', 'vue', 'next.js', 'node.js', 'express', 'nestjs', 'fastapi', 'django', 'spring',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform',
  'git', 'ci/cd', 'graphql', 'rest', 'microservices', 'machine learning', 'ai',
]

const DEV_KEYWORDS = [
  'software', 'engineer', 'developer', 'backend', 'frontend', 'fullstack', 'full-stack',
  'devops', 'cloud', 'data engineer', 'machine learning', 'ml', 'ai', 'platform', 'infrastructure',
  'site reliability', 'sre', 'mobile', 'ios', 'android', 'tech lead', 'architect', 'staff',
  'principal', 'python', 'javascript', 'typescript', 'react', 'node',
]

function isDevRole(title: string): boolean {
  const lower = title.toLowerCase()
  return DEV_KEYWORDS.some((k) => lower.includes(k))
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter((s) => lower.includes(s))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  absolute_url: string
  content?: string
  location: { name: string }
  metadata: Array<{ name: string; value: string | string[] | null }>
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
  meta: { total: number }
}

export class GreenhouseScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    const boards = await getGreenhouseBoards()
    this.logger.info('greenhouse_scrape_start', { boards: boards.length })

    for (const boardToken of boards) {
      if (jobs.length >= this.config.maxJobsPerRun) break

      try {
        const { data } = await axios.get<GreenhouseResponse>(
          `${GREENHOUSE_API}/${boardToken}/jobs`,
          {
            params: { content: true },
            timeout: this.config.timeout ?? 15000,
            headers: {
              'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
              Accept: 'application/json',
            },
          }
        )

        if (!data.jobs?.length) continue

        this.logger.info('greenhouse_board_fetched', { board: boardToken, count: data.jobs.length })

        for (const job of data.jobs) {
          if (jobs.length >= this.config.maxJobsPerRun) break
          if (!isDevRole(job.title)) continue

          const description = stripHtml(job.content ?? '')
          const requiredSkills = extractSkills(description)
          const locationName = job.location?.name ?? ''

          jobs.push({
            externalId: `greenhouse-${boardToken}-${job.id}`,
            platform: 'greenhouse',
            title: job.title,
            company: boardToken.charAt(0).toUpperCase() + boardToken.slice(1),
            location: locationName || 'Not specified',
            url: job.absolute_url,
            description,
            salary: undefined,
            employmentType: 'full-time',
            postedDate: job.updated_at,
            requiredSkills,
            scrapedAt: new Date(),
          })
        }
      } catch (err) {
        // 404 = company not on Greenhouse; skip silently
        const status = (err as { response?: { status: number } }).response?.status
        if (status !== 404) {
          this.logger.warn('greenhouse_board_error', { board: boardToken, error: String(err) })
        }
      }
    }

    this.logger.info('greenhouse_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
