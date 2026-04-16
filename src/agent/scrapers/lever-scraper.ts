import axios from 'axios'
import { BaseScraper } from './base-scraper'
import { getLeverSlugs } from '../utils/ats-discovery'
import type { RawJobInput } from '@/types/scraper'

const LEVER_API = 'https://api.lever.co/v0/postings'

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

function isDevRole(title: string, categories: string[]): boolean {
  const haystack = [title, ...categories].join(' ').toLowerCase()
  return DEV_KEYWORDS.some((k) => haystack.includes(k))
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter((s) => lower.includes(s))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface LeverPosting {
  id: string
  text: string
  categories: {
    commitment?: string
    department?: string
    location?: string
    team?: string
  }
  description: string
  descriptionPlain: string
  lists: Array<{ text: string; content: string }>
  additional?: string
  additionalPlain?: string
  hostedUrl: string
  applyUrl: string
  createdAt: number
}

export class LeverScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    const slugs = await getLeverSlugs()
    this.logger.info('lever_scrape_start', { companies: slugs.length })

    for (const slug of slugs) {
      if (jobs.length >= this.config.maxJobsPerRun) break

      try {
        const { data } = await axios.get<LeverPosting[]>(`${LEVER_API}/${slug}`, {
          params: { mode: 'json' },
          timeout: this.config.timeout ?? 15000,
          headers: {
            'User-Agent': this.config.userAgent ?? 'Mozilla/5.0 (compatible; JobHunterBot/1.0)',
            Accept: 'application/json',
          },
        })

        if (!Array.isArray(data) || data.length === 0) continue

        this.logger.info('lever_company_fetched', { company: slug, count: data.length })

        for (const posting of data) {
          if (jobs.length >= this.config.maxJobsPerRun) break

          const categories = Object.values(posting.categories ?? {}).filter(Boolean) as string[]
          if (!isDevRole(posting.text, categories)) continue

          const baseDescription = posting.descriptionPlain
            ? posting.descriptionPlain
            : stripHtml(posting.description ?? '')

          const listContent = (posting.lists ?? [])
            .map((l) => `${l.text}\n${stripHtml(l.content)}`)
            .join('\n\n')

          const additionalContent = posting.additionalPlain ?? stripHtml(posting.additional ?? '')

          const fullDescription = [baseDescription, listContent, additionalContent]
            .filter(Boolean)
            .join('\n\n')
            .trim()

          const requiredSkills = extractSkills(fullDescription)
          const location = posting.categories?.location ?? 'Not specified'

          jobs.push({
            externalId: `lever-${posting.id}`,
            platform: 'lever',
            title: posting.text,
            company: slug.charAt(0).toUpperCase() + slug.slice(1),
            location,
            url: posting.hostedUrl,
            description: fullDescription,
            salary: undefined,
            employmentType: posting.categories?.commitment?.toLowerCase() ?? 'full-time',
            postedDate: posting.createdAt ? new Date(posting.createdAt).toISOString() : undefined,
            requiredSkills,
            scrapedAt: new Date(),
          })
        }
      } catch (err) {
        const status = (err as { response?: { status: number } }).response?.status
        if (status !== 404) {
          this.logger.warn('lever_company_error', { company: slug, error: String(err) })
        }
      }
    }

    this.logger.info('lever_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
