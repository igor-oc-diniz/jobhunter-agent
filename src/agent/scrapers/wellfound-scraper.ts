/**
 * Wellfound (formerly AngelList Talent) scraper
 *
 * Anti-bot: DataDome + Cloudflare JS challenge.
 * Strategy: Playwright + stealth plugin, navigate role pages, extract from
 * __NEXT_DATA__ (Next.js hydration JSON) — more stable than CSS selectors.
 *
 * DataDome may still block in CI/cloud containers. The scraper detects the
 * challenge page and exits cleanly with a warning rather than crashing.
 */
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

chromium.use(StealthPlugin())

// Role pages to visit — each page typically lists 10-20 startup jobs
const ROLE_PATHS = [
  '/role/r/software-engineer',
  '/role/r/full-stack-engineer',
  '/role/r/backend-engineer',
  '/role/r/frontend-engineer',
  '/role/r/devops-engineer',
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

// Wellfound __NEXT_DATA__ shape (simplified — only fields we use)
interface WFJobListing {
  id?: string
  title?: string
  remote?: boolean
  locationNames?: string[]
  compensation?: string
  jobType?: string
  description?: string
  slug?: string
  startupJob?: {
    id?: string
    title?: string
    remote?: boolean
    locationNames?: string[]
    compensation?: string
    jobType?: string
    description?: string
    slug?: string
    startup?: { name?: string; slug?: string }
  }
}

interface WFPageProps {
  jobs?: WFJobListing[]
  jobListings?: WFJobListing[]
  // Apollo/Relay cache — may hold job nodes at arbitrary keys
  [key: string]: unknown
}

function extractJobsFromNextData(nextData: Record<string, unknown>): WFJobListing[] {
  const found: WFJobListing[] = []

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const obj = node as Record<string, unknown>
    // A job listing node typically has title + (startup or companyName)
    if (typeof obj.title === 'string' && obj.title.length > 0) {
      if (obj.startup || obj.startupJob || obj.jobType !== undefined || obj.remote !== undefined) {
        found.push(obj as unknown as WFJobListing)
        return // don't recurse into matched nodes to avoid duplicates
      }
    }
    for (const val of Object.values(obj)) walk(val)
  }

  walk(nextData)
  return found
}

function normalizeJob(raw: WFJobListing, url: string): Omit<RawJobInput, 'scrapedAt'> | null {
  // Support both flat and nested (startupJob wrapper) shapes
  const job = raw.startupJob ?? raw
  const title = job.title ?? raw.title
  const startup = (raw as Record<string, unknown>).startup as { name?: string; slug?: string } | undefined
  const company = startup?.name ?? 'Unknown'
  const slug = job.slug ?? raw.slug ?? startup?.slug

  if (!title || !company || company === 'Unknown') return null

  const location =
    (job.locationNames ?? []).join(', ') ||
    ((job.remote ?? raw.remote) ? 'Worldwide' : 'Unknown')

  const description = (job.description ?? raw.description ?? title)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const jobUrl = slug
    ? `https://wellfound.com/jobs/${slug}`
    : url

  return {
    externalId: String((raw as Record<string, unknown>).id ?? slug ?? title + company),
    platform: 'wellfound',
    title,
    company,
    location,
    url: jobUrl,
    description,
    salary: (job.compensation ?? raw.compensation) as string | undefined,
    employmentType: (job.jobType ?? raw.jobType) as string | undefined,
    postedDate: undefined, // Wellfound doesn't reliably expose this in page data
    requiredSkills: extractSkills(description),
  }
}

export class WellfoundScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    const browser = await chromium.launch({ headless: true })
    const jobs: RawJobInput[] = []
    const seenIds = new Set<string>()

    try {
      const context = await browser.newContext({
        locale: 'en-US',
        timezoneId: 'America/New_York',
        viewport: { width: 1440, height: 900 },
        userAgent:
          this.config.userAgent ??
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      })

      // Block images, fonts, and analytics to speed up page load
      await context.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,svg}', (r) => r.abort())
      await context.route('**/{analytics,metrics,tracking,beacon}*', (r) => r.abort())

      const page = await context.newPage()

      for (const rolePath of ROLE_PATHS) {
        if (jobs.length >= this.config.maxJobsPerRun) break

        const url = `https://wellfound.com${rolePath}`
        this.logger.info('wellfound_fetch', { url })

        try {
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout ?? 45000,
          })

          // Detect DataDome / Cloudflare challenge
          const bodyText = await page.evaluate(() => document.body?.innerText ?? '')
          if (
            bodyText.includes('datadome') ||
            bodyText.includes('Please verify') ||
            bodyText.includes('Just a moment') ||
            bodyText.includes('Enable JavaScript') ||
            (await page.title()).toLowerCase().includes('just a moment')
          ) {
            this.logger.warn('wellfound_blocked', { url, reason: 'Anti-bot challenge detected' })
            continue
          }

          // Human-like pause
          await page.waitForTimeout(1500 + Math.random() * 2000)

          // Primary: extract from __NEXT_DATA__ (Next.js hydration JSON)
          const nextData = await page.evaluate(() => {
            try {
              const el = document.getElementById('__NEXT_DATA__')
              return el ? JSON.parse(el.textContent ?? '{}') : null
            } catch {
              return null
            }
          })

          let pageJobs: WFJobListing[] = []

          if (nextData) {
            pageJobs = extractJobsFromNextData(nextData as Record<string, unknown>)
            this.logger.info('wellfound_next_data', { url, candidates: pageJobs.length })
          }

          // Fallback: try to extract from Apollo/Relay cache in window.__APOLLO_STATE__
          if (pageJobs.length === 0) {
            const apolloState = await page.evaluate(() => {
              try {
                return (window as unknown as Record<string, unknown>).__APOLLO_STATE__ ?? null
              } catch {
                return null
              }
            })
            if (apolloState) {
              pageJobs = extractJobsFromNextData(apolloState as Record<string, unknown>)
              this.logger.info('wellfound_apollo_state', { url, candidates: pageJobs.length })
            }
          }

          for (const raw of pageJobs) {
            if (jobs.length >= this.config.maxJobsPerRun) break
            const normalized = normalizeJob(raw, url)
            if (!normalized) continue
            if (seenIds.has(normalized.externalId)) continue
            seenIds.add(normalized.externalId)
            jobs.push({ ...normalized, scrapedAt: new Date() })
          }

          this.logger.info('wellfound_role_done', { url, collected: jobs.length })

          // Respectful inter-page delay: 8–15s
          if (jobs.length < this.config.maxJobsPerRun) {
            await page.waitForTimeout(8000 + Math.random() * 7000)
          }
        } catch (err) {
          this.logger.error('wellfound_role_error', { url, error: String(err) })
        }
      }

      await context.close()
    } catch (err) {
      this.logger.error('wellfound_scraper_failed', { error: String(err) })
    } finally {
      await browser.close()
    }

    this.logger.info('wellfound_scrape_complete', { total: jobs.length })
    return jobs.slice(0, this.config.maxJobsPerRun)
  }
}
