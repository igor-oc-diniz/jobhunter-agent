import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'
import { GupyScraper } from './scrapers/gupy-scraper'
import { IndeedBRScraper } from './scrapers/indeed-br-scraper'
import { runMatching } from './matching/matcher'
import { createLogger } from './utils/logger'
import { loadConfig } from './utils/config'
import type { RawJob, UserProfile } from '@/types'
import type { NormalizedJob, ScraperConfig } from '@/types/scraper'

const logger = createLogger('pipeline')

function toRawJob(job: NormalizedJob, userId: string): RawJob {
  let salaryMin: number | undefined
  let salaryMax: number | undefined
  if (job.salary) {
    const nums = job.salary.replace(/[^\d]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean)
    if (nums.length >= 2) { salaryMin = nums[0]; salaryMax = nums[1] }
    else if (nums.length === 1) { salaryMin = nums[0]; salaryMax = nums[0] }
  }

  const contractMap: Record<string, 'clt' | 'pj' | 'unknown'> = {
    clt: 'clt', pj: 'pj', 'full-time': 'clt', 'part-time': 'clt',
    'regime clt': 'clt', 'pessoa jurídica': 'pj',
  }
  const contractType = job.employmentType
    ? (contractMap[job.employmentType.toLowerCase()] ?? 'unknown')
    : 'unknown'

  const locationLower = job.location.toLowerCase()
  const isRemote = locationLower.includes('remot') || locationLower.includes('home office') || locationLower === ''

  return {
    id: uuidv4(),
    userId,
    title: job.title,
    company: job.company,
    location: job.location,
    isRemote,
    description: job.description,
    techStack: job.requiredSkills ?? [],
    sourceUrl: job.url,
    sourcePlatform: job.platform,
    scrapedAt: FieldValue.serverTimestamp() as never,
    status: 'pending',
    salaryMin,
    salaryMax,
    contractType,
    publishedAt: job.postedDate,
  }
}

export interface PipelineResult {
  scraped: number
  saved: number
  matched: number
  rejected: number
  errors: string[]
}

export async function runPipeline(userId: string): Promise<PipelineResult> {
  logger.info('pipeline_start', { userId })
  const errors: string[] = []

  const profileSnap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!profileSnap.exists) throw new Error(`Profile not found for userId: ${userId}`)
  const profile = profileSnap.data() as UserProfile

  await adminDb.doc(`users/${userId}/agentStatus/current`).set(
    { status: 'running', triggeredManually: true, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )

  const config = loadConfig()
  const scraperConfigs: ScraperConfig[] = config.scraperPlatforms.map((platform) => ({
    platform,
    enabled: true,
    maxJobsPerRun: config.maxJobsPerRun,
    userAgent: config.userAgent,
    timeout: config.scraperTimeout,
  }))

  const scrapers = scraperConfigs
    .map((sc) => {
      const log = createLogger(`scraper:${sc.platform}`)
      if (sc.platform === 'gupy') return new GupyScraper(sc, log)
      if (sc.platform === 'indeed-br') return new IndeedBRScraper(sc, log)
      return null
    })
    .filter(Boolean) as (GupyScraper | IndeedBRScraper)[]

  const results = await Promise.allSettled(scrapers.map((s) => s.run()))

  let scraped = 0
  let saved = 0

  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(String(result.reason))
      continue
    }
    scraped += result.value.jobsScraped
    errors.push(...result.value.errors)

    const batch = adminDb.batch()
    for (const job of result.value.jobs) {
      const rawJob = toRawJob(job, userId)
      batch.set(adminDb.doc(`users/${userId}/rawJobs/${rawJob.id}`), rawJob)
      saved++
    }
    if (result.value.jobs.length > 0) await batch.commit()
  }

  logger.info('scraping_done', { userId, scraped, saved })

  await runMatching(userId, profile)

  const [matchedSnap, rejectedSnap] = await Promise.all([
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'matched').get(),
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'rejected').get(),
  ])

  await adminDb.doc(`users/${userId}/agentStatus/current`).set(
    { status: 'idle', lastRunAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )

  const summary: PipelineResult = {
    scraped,
    saved,
    matched: matchedSnap.size,
    rejected: rejectedSnap.size,
    errors,
  }

  logger.info('pipeline_done', { userId, ...summary })
  return summary
}
