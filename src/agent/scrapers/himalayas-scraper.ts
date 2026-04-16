import axios from 'axios'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

const HIMALAYAS_API = 'https://himalayas.app/jobs/api'

// Category slugs that identify software/engineering roles on Himalayas
const DEV_CATEGORY_PATTERNS = [
  'software', 'engineer', 'developer', 'programming', 'backend', 'frontend',
  'full-stack', 'fullstack', 'devops', 'sysadmin', 'cloud', 'data-engineer',
  'machine-learning', 'ai-engineer', 'mobile', 'ios', 'android', 'react',
  'node', 'python', 'java', 'typescript', 'golang', 'rust', 'platform',
  'site-reliability', 'sre', 'infrastructure', 'security-engineer',
]

function isDevJob(categories: string[]): boolean {
  const joined = categories.join(' ').toLowerCase()
  return DEV_CATEGORY_PATTERNS.some((p) => joined.includes(p))
}

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

interface HimalayasJob {
  guid: string
  title: string
  companyName: string
  employmentType: string
  minSalary: number | null
  maxSalary: number | null
  currency: string
  locationRestrictions: string[]
  categories: string[]
  parentCategories: string[]
  pubDate: number
  applicationLink: string
  description?: string
}

interface HimalayasResponse {
  jobs: HimalayasJob[]
  totalCount: number
  offset: number
  limit: number
}

export class HimalayadScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []
    const seenIds = new Set<string>()
    const pageSize = 100
    let offset = 0
    const maxPages = 5 // cap at 500 API results to avoid hammering

    this.logger.info('himalayas_scrape_start', { maxJobsPerRun: this.config.maxJobsPerRun })

    while (jobs.length < this.config.maxJobsPerRun && offset / pageSize < maxPages) {
      try {
        const { data } = await axios.get<HimalayasResponse>(HIMALAYAS_API, {
          params: { limit: pageSize, offset },
          timeout: this.config.timeout ?? 15000,
          headers: {
            'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
            Accept: 'application/json',
          },
        })

        if (!data.jobs || data.jobs.length === 0) break

        this.logger.info('himalayas_page', { offset, returned: data.jobs.length, total: data.totalCount })

        for (const job of data.jobs) {
          if (jobs.length >= this.config.maxJobsPerRun) break

          const allCategories = [...(job.categories ?? []), ...(job.parentCategories ?? [])]
          if (!isDevJob(allCategories)) continue

          if (!job.guid || seenIds.has(job.guid)) continue
          seenIds.add(job.guid)

          const description = stripHtml(job.description ?? '')
          const requiredSkills = extractSkills(description)

          const location =
            job.locationRestrictions && job.locationRestrictions.length > 0
              ? job.locationRestrictions.join(', ')
              : 'Worldwide'

          let salary: string | undefined
          if (job.minSalary && job.maxSalary) {
            salary = `${job.currency ?? 'USD'} ${job.minSalary.toLocaleString()} – ${job.maxSalary.toLocaleString()}`
          } else if (job.minSalary) {
            salary = `${job.currency ?? 'USD'} ${job.minSalary.toLocaleString()}+`
          }

          jobs.push({
            externalId: job.guid,
            platform: 'himalayas',
            title: job.title,
            company: job.companyName,
            location,
            url: job.applicationLink,
            description,
            salary,
            employmentType: job.employmentType ?? 'full-time',
            postedDate: job.pubDate ? new Date(job.pubDate * 1000).toISOString() : undefined,
            requiredSkills,
            scrapedAt: new Date(),
          })
        }

        offset += pageSize

        // If we've seen all available jobs, stop
        if (offset >= data.totalCount) break
      } catch (err) {
        this.logger.error('himalayas_page_error', { offset, error: String(err) })
        break
      }
    }

    this.logger.info('himalayas_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
