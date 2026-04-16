import axios from 'axios'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api'

// Tech-relevant tags/keywords to filter for dev roles
const DEV_KEYWORDS = [
  'software', 'engineer', 'developer', 'backend', 'frontend', 'fullstack', 'full-stack',
  'devops', 'cloud', 'data engineer', 'machine learning', 'python', 'java', 'javascript',
  'typescript', 'node', 'react', 'vue', 'angular', 'go', 'rust', 'kotlin', 'php',
  'infrastructure', 'platform', 'sre', 'site reliability', 'mobile', 'ios', 'android',
  'architect', 'tech lead',
]

function isDevRole(title: string, tags: string[]): boolean {
  const haystack = [title, ...tags].join(' ').toLowerCase()
  return DEV_KEYWORDS.some((k) => haystack.includes(k))
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

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[]
  links: { next?: string; prev?: string }
}

export class ArbeitnowScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []
    let page = 1
    const maxPages = 5

    this.logger.info('arbeitnow_scrape_start', { maxJobsPerRun: this.config.maxJobsPerRun })

    while (jobs.length < this.config.maxJobsPerRun && page <= maxPages) {
      try {
        const { data } = await axios.get<ArbeitnowResponse>(ARBEITNOW_API, {
          params: { page },
          timeout: this.config.timeout ?? 15000,
          headers: {
            'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
            Accept: 'application/json',
          },
        })

        if (!data.data || data.data.length === 0) break

        this.logger.info('arbeitnow_page', { page, returned: data.data.length })

        for (const job of data.data) {
          if (jobs.length >= this.config.maxJobsPerRun) break
          if (!isDevRole(job.title, job.tags)) continue

          const description = stripHtml(job.description ?? '')
          const skillsFromTags = job.tags.map((t) => t.toLowerCase())
          const skillsFromDesc = extractSkills(description)
          const requiredSkills = [...new Set([...skillsFromTags, ...skillsFromDesc])]

          const location = job.remote
            ? 'Remote (Europe)'
            : job.location || 'Europe'

          const employmentType = job.job_types?.[0] ?? 'full-time'

          jobs.push({
            externalId: job.slug,
            platform: 'arbeitnow',
            title: job.title,
            company: job.company_name,
            location,
            url: job.url,
            description,
            salary: undefined, // Arbeitnow doesn't expose salary in API
            employmentType,
            postedDate: job.created_at ? new Date(job.created_at * 1000).toISOString() : undefined,
            requiredSkills,
            scrapedAt: new Date(),
          })
        }

        // No next page link means we've reached the end
        if (!data.links?.next) break
        page++
      } catch (err) {
        this.logger.error('arbeitnow_page_error', { page, error: String(err) })
        break
      }
    }

    this.logger.info('arbeitnow_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
