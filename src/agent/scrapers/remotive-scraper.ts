import axios from 'axios'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

const REMOTIVE_API = 'https://remotive.com/api/remote-jobs'

// Categories that map to software development roles
const CATEGORIES = ['software-dev', 'devops-sysadmin', 'data']

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

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo?: string
  category: string
  tags: string[]
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

interface RemotiveResponse {
  'job-count': number
  jobs: RemotiveJob[]
}

export class RemotiveScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    for (const category of CATEGORIES) {
      if (jobs.length >= this.config.maxJobsPerRun) break

      try {
        this.logger.info('remotive_fetch', { category })

        const { data } = await axios.get<RemotiveResponse>(REMOTIVE_API, {
          params: { category, limit: Math.ceil(this.config.maxJobsPerRun / CATEGORIES.length) },
          timeout: this.config.timeout ?? 15000,
          headers: {
            'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
            Accept: 'application/json',
          },
        })

        this.logger.info('remotive_response', { category, count: data['job-count'] })

        for (const job of data.jobs) {
          if (jobs.length >= this.config.maxJobsPerRun) break

          const description = stripHtml(job.description)
          const skillsFromTags = job.tags.map((t) => t.toLowerCase())
          const skillsFromDesc = extractSkills(description)
          const requiredSkills = [...new Set([...skillsFromTags, ...skillsFromDesc])]

          jobs.push({
            externalId: String(job.id),
            platform: 'remotive',
            title: job.title,
            company: job.company_name,
            location: job.candidate_required_location || 'Worldwide',
            url: job.url,
            description,
            salary: job.salary || undefined,
            employmentType: job.job_type,
            postedDate: job.publication_date,
            requiredSkills,
            scrapedAt: new Date(),
          })
        }

        this.logger.info('remotive_category_done', { category, collected: jobs.length })
      } catch (err) {
        this.logger.error('remotive_category_error', { category, error: String(err) })
      }
    }

    this.logger.info('remotive_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
