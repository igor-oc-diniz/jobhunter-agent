import axios from 'axios'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

const REMOTEOK_API = 'https://remoteok.com/api'

// Tags that identify dev roles on RemoteOK
const DEV_TAGS = new Set([
  'dev', 'web dev', 'backend', 'frontend', 'full stack', 'fullstack', 'mobile dev',
  'engineer', 'sys admin', 'devops', 'cloud', 'data', 'machine learning', 'ai',
  'javascript', 'typescript', 'python', 'node', 'react', 'vue', 'angular',
  'ruby', 'go', 'rust', 'java', 'php', 'c#', 'swift', 'kotlin',
  'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes', 'aws',
])

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

function isDevJob(tags: string[]): boolean {
  return tags.some((t) => DEV_TAGS.has(t.toLowerCase()))
}

interface RemoteOKJob {
  id: string
  slug: string
  epoch: number
  date: string
  company: string
  position: string
  tags: string[]
  description: string
  location: string
  salary_min?: number
  salary_max?: number
  url: string
  apply_url: string
}

export class RemoteOKScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    try {
      this.logger.info('remoteok_fetch', {})

      // RemoteOK API returns all recent jobs — first element is metadata, skip it
      const { data } = await axios.get<Array<RemoteOKJob | { legal: string }>>(REMOTEOK_API, {
        timeout: this.config.timeout ?? 20000,
        headers: {
          'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
          Accept: 'application/json',
          // Required: RemoteOK returns 403 without a Referer
          Referer: 'https://remoteok.com/',
        },
      })

      const rawJobs = data.filter((j): j is RemoteOKJob => 'position' in j && 'id' in j)

      this.logger.info('remoteok_response', { total: rawJobs.length })

      for (const job of rawJobs) {
        if (jobs.length >= this.config.maxJobsPerRun) break
        if (!isDevJob(job.tags)) continue

        const description = stripHtml(job.description ?? '')
        const skillsFromTags = job.tags.map((t) => t.toLowerCase())
        const skillsFromDesc = extractSkills(description)
        const requiredSkills = [...new Set([...skillsFromTags, ...skillsFromDesc])]

        let salary: string | undefined
        if (job.salary_min && job.salary_max) {
          salary = `USD ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}`
        } else if (job.salary_min) {
          salary = `USD ${job.salary_min.toLocaleString()}+`
        }

        jobs.push({
          externalId: String(job.id),
          platform: 'remoteok',
          title: job.position,
          company: job.company,
          location: job.location || 'Worldwide',
          url: job.url || job.apply_url,
          description,
          salary,
          employmentType: 'full-time',
          postedDate: job.date,
          requiredSkills,
          scrapedAt: new Date(),
        })
      }
    } catch (err) {
      this.logger.error('remoteok_fetch_error', { error: String(err) })
    }

    this.logger.info('remoteok_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
