import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'
import { GupyScraper } from './scrapers/gupy-scraper'
import { IndeedBRScraper } from './scrapers/indeed-br-scraper'
import { RemotiveScraper } from './scrapers/remotive-scraper'
import { WeWorkRemotelyScraper } from './scrapers/weworkremotely-scraper'
import { HimalayadScraper } from './scrapers/himalayas-scraper'
import { WellfoundScraper } from './scrapers/wellfound-scraper'
import { RemoteOKScraper } from './scrapers/remoteok-scraper'
import { ArbeitnowScraper } from './scrapers/arbeitnow-scraper'
import { IndeedCAScraper } from './scrapers/indeed-ca-scraper'
import { IndeedAUScraper } from './scrapers/indeed-au-scraper'
import { GreenhouseScraper } from './scrapers/greenhouse-scraper'
import { LeverScraper } from './scrapers/lever-scraper'
import { BaseScraper } from './scrapers/base-scraper'
import { runMatching } from './matching/matcher'
import { truncateDescription } from './utils/description-truncator'
import { extractTechStack } from './utils/tech-extractor'
import { runPreFilter } from './utils/pre-filter'
import { discoverAtsCompanies } from './utils/ats-discovery'
import { humanDelay, platformDelay } from './utils/human-delay'
import { createLogger } from './utils/logger'
import { loadConfig } from './utils/config'
import type { RawJob, UserProfile } from '@/types'
import type { NormalizedJob, ScraperConfig } from '@/types/scraper'
import type { JobListing } from './utils/pre-filter'

const logger = createLogger('pipeline')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSalaryRange(raw?: string): { salaryMin?: number; salaryMax?: number } {
  if (!raw) return {}
  const nums = raw.replace(/[^\d]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean)
  if (nums.length >= 2) return { salaryMin: nums[0], salaryMax: nums[1] }
  if (nums.length === 1) return { salaryMin: nums[0], salaryMax: nums[0] }
  return {}
}

function resolveContractType(employmentType?: string): 'clt' | 'pj' | 'both' | 'unknown' {
  const contractMap: Record<string, 'clt' | 'pj' | 'unknown'> = {
    clt: 'clt', pj: 'pj', 'full-time': 'clt', 'part-time': 'clt',
    'regime clt': 'clt', 'pessoa jurídica': 'pj',
  }
  return employmentType ? (contractMap[employmentType.toLowerCase()] ?? 'unknown') : 'unknown'
}

function resolveIsRemote(location: string): boolean {
  const lower = location.toLowerCase()
  return lower.includes('remot') || lower.includes('home office') || lower === ''
}

/**
 * Converts a NormalizedJob (Phase 1 output) to the JobListing shape
 * required by the pre-filter. The `description` field here is the snippet.
 */
function toJobListing(job: NormalizedJob): JobListing {
  return {
    url: job.url,
    title: job.title,
    company: job.company,
    location: job.location,
    isRemote: resolveIsRemote(job.location),
    snippet: job.description,
    salaryRaw: job.salary,
    publishedAt: job.postedDate,
    contractTypeRaw: job.employmentType,
    sourcePlatform: job.platform,
  }
}

/**
 * Builds the final RawJob document to be saved in Firestore.
 */
function buildRawJob(
  job: NormalizedJob,
  userId: string,
  description: string,
  descriptionSource: 'full_page' | 'snippet',
  preFilterPassed: boolean,
  preFilterReason?: string,
): RawJob {
  const { salaryMin, salaryMax } = parseSalaryRange(job.salary)

  return {
    id: uuidv4(),
    userId,
    title: job.title,
    company: job.company,
    location: job.location,
    isRemote: resolveIsRemote(job.location),
    description,
    descriptionSource,
    descriptionMissing: description.trim().length === 0,
    preFilterPassed,
    preFilterReason,
    techStack: extractTechStack(description),
    sourceUrl: job.url,
    sourcePlatform: job.platform,
    scrapedAt: FieldValue.serverTimestamp() as never,
    ...(descriptionSource === 'full_page'
      ? { fullPageAccessedAt: FieldValue.serverTimestamp() as never }
      : {}),
    status: 'pending',
    salaryMin,
    salaryMax,
    contractType: resolveContractType(job.employmentType),
    publishedAt: job.postedDate,
  }
}

async function addToUserBlacklist(
  userId: string,
  job: NormalizedJob,
  reason: string,
): Promise<void> {
  try {
    const entryId = uuidv4()
    await adminDb.doc(`users/${userId}/blacklist/${entryId}`).set({
      sourceUrl: job.url,
      company: job.company,
      title: job.title,
      addedAt: FieldValue.serverTimestamp(),
      reason: 'pre_filter',
      preFilterReason: reason,
    })
  } catch (err) {
    logger.warn('blacklist_write_failed', { url: job.url, error: String(err) })
  }
}

// ---------------------------------------------------------------------------
// Pipeline entry point
// ---------------------------------------------------------------------------

export interface PipelineResult {
  scraped: number
  preFilterApproved: number
  preFilterRejected: number
  saved: number
  matched: number
  rejected: number
  errors: string[]
}

async function setStatus(userId: string, fields: Record<string, unknown>) {
  await adminDb.doc(`users/${userId}/agentStatus/current`).set(
    { ...fields, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}

function buildScraper(sc: ScraperConfig): BaseScraper | null {
  const log = createLogger(`scraper:${sc.platform}`)
  if (sc.platform === 'gupy') return new GupyScraper(sc, log)
  if (sc.platform === 'indeed-br') return new IndeedBRScraper(sc, log)
  if (sc.platform === 'remotive') return new RemotiveScraper(sc, log)
  if (sc.platform === 'weworkremotely') return new WeWorkRemotelyScraper(sc, log)
  if (sc.platform === 'himalayas') return new HimalayadScraper(sc, log)
  if (sc.platform === 'wellfound') return new WellfoundScraper(sc, log)
  if (sc.platform === 'remoteok') return new RemoteOKScraper(sc, log)
  if (sc.platform === 'arbeitnow') return new ArbeitnowScraper(sc, log)
  if (sc.platform === 'indeed-ca') return new IndeedCAScraper(sc, log)
  if (sc.platform === 'indeed-au') return new IndeedAUScraper(sc, log)
  if (sc.platform === 'greenhouse') return new GreenhouseScraper(sc, log)
  if (sc.platform === 'lever') return new LeverScraper(sc, log)
  return null
}

export async function runPipeline(userId: string): Promise<PipelineResult> {
  logger.info('pipeline_start', { userId })

  const errors: string[] = []
  const runId = uuidv4()
  const logEntries: Array<{ level: string; action: string; message: string; timestamp: string }> = []

  function addEntry(level: 'info' | 'warn' | 'error', action: string, message: string) {
    logEntries.push({ level, action, message, timestamp: new Date().toISOString() })
    adminDb.doc(`users/${userId}/agentLogs/${runId}`)
      .update({ entries: logEntries })
      .catch(() => { /* non-critical */ })
  }

  const profileSnap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!profileSnap.exists) throw new Error(`Profile not found for userId: ${userId}`)
  const profile = profileSnap.data() as UserProfile

  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).set({
    startedAt: FieldValue.serverTimestamp(),
    status: 'running',
    applicationsProcessed: 0,
    applicationsSubmitted: 0,
    errors: 0,
    entries: [],
  })

  await setStatus(userId, { status: 'running', triggeredManually: true, currentJob: 'Iniciando pipeline...' })
  addEntry('info', 'pipeline_start', 'Pipeline iniciado')

  const config = loadConfig()

  const enabledPlatforms =
    profile.agentConfig?.enabledPlatforms?.length > 0
      ? profile.agentConfig.enabledPlatforms
      : [
          'greenhouse',
          'lever',
          'remotive',
          'weworkremotely',
          'himalayas',
          'remoteok',
          'arbeitnow',
          'wellfound',
        ]

  const scraperConfigs: ScraperConfig[] = enabledPlatforms.map((platform) => ({
    platform,
    enabled: true,
    maxJobsPerRun: config.maxJobsPerRun,
    userAgent: config.userAgent,
    timeout: config.scraperTimeout,
  }))

  const scrapers = scraperConfigs.map(buildScraper).filter((s): s is BaseScraper => s !== null)

  // -------------------------------------------------------------------------
  // PHASE 1 — scrape all platforms in parallel (returns snippets)
  // -------------------------------------------------------------------------
  const platformNames = scraperConfigs.map((s) => s.platform).join(', ')
  await setStatus(userId, { currentJob: `Scraping vagas em ${platformNames}...` })
  addEntry('info', 'scraping_start', `Iniciando Phase 1 em ${platformNames}`)
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).update({ entries: logEntries })

  const phase1Results = await Promise.allSettled(scrapers.map((s) => s.run()))

  let totalScraped = 0
  let totalPreFilterApproved = 0
  let totalPreFilterRejected = 0
  let totalSaved = 0
  const allScrapedUrls: string[] = []

  for (let i = 0; i < phase1Results.length; i++) {
    const result = phase1Results[i]
    const scraper = scrapers[i]

    if (result.status === 'rejected') {
      errors.push(String(result.reason))
      addEntry('error', 'scraper_failed', String(result.reason))
      continue
    }

    const { jobs, jobsScraped, errors: scraperErrors } = result.value
    totalScraped += jobsScraped
    errors.push(...scraperErrors)
    allScrapedUrls.push(...jobs.map((j) => j.url))

    if (jobs.length === 0) continue

    // -----------------------------------------------------------------------
    // PRE-FILTER — local rules, zero Claude calls
    // -----------------------------------------------------------------------
    const listings = jobs.map(toJobListing)
    const { approved, rejected } = runPreFilter(listings, profile)

    totalPreFilterApproved += approved.length
    totalPreFilterRejected += rejected.length

    addEntry(
      'info',
      'pre_filter_done',
      `[${scraper.constructor.name}] ${jobs.length} vagas → ${approved.length} aprovadas, ${rejected.length} rejeitadas no pré-filtro`,
    )

    if (rejected.length === jobs.length) {
      addEntry('warn', 'pre_filter_all_rejected', `[${scraper.constructor.name}] 100% das vagas rejeitadas — verifique keywords do perfil`)
    }

    // Write rejected listings to user blacklist (fire-and-forget per entry)
    const jobByUrl = new Map(jobs.map((j) => [j.url, j]))
    for (const { listing, reason } of rejected) {
      const job = jobByUrl.get(listing.url)
      if (job) {
        addToUserBlacklist(userId, job, reason).catch(() => { /* non-critical */ })
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 2 — fetch full description for approved listings only
    // -----------------------------------------------------------------------
    await setStatus(userId, {
      currentJob: `Buscando descrições completas (${approved.length} vagas de ${scraper.constructor.name})...`,
    })

    const approvedUrls = new Set(approved.map((l) => l.url))
    const approvedJobs = jobs.filter((j) => approvedUrls.has(j.url))

    const batch = adminDb.batch()

    for (const job of approvedJobs) {
      try {
        // Respectful delay between individual page accesses (3–10s)
        await humanDelay(3000, 10000)

        const fullHtml = await scraper.scrapeJobDetail(job.url)

        let description: string
        let descriptionSource: 'full_page' | 'snippet'

        if (fullHtml && fullHtml.trim().length > 0) {
          description = truncateDescription(fullHtml)
          descriptionSource = 'full_page'
        } else {
          // Fallback: use snippet already scraped in Phase 1
          description = truncateDescription(job.description)
          descriptionSource = 'snippet'
          logger.warn('phase2_fallback_to_snippet', { url: job.url, platform: job.platform })
        }

        const rawJob = buildRawJob(job, userId, description, descriptionSource, true)
        batch.set(adminDb.doc(`users/${userId}/rawJobs/${rawJob.id}`), rawJob)
        totalSaved++
      } catch (err) {
        const msg = `Failed to process job ${job.url}: ${(err as Error).message}`
        errors.push(msg)
        addEntry('error', 'phase2_job_failed', msg)
      }
    }

    if (approvedJobs.length > 0) {
      try {
        await batch.commit()
      } catch (err) {
        const msg = `Batch commit failed for ${scraper.constructor.name}: ${(err as Error).message}`
        errors.push(msg)
        addEntry('error', 'batch_commit_failed', msg)
      }
    }

    // Delay between platforms
    await platformDelay()
  }

  // Fire-and-forget ATS company discovery from all scraped URLs
  discoverAtsCompanies(allScrapedUrls)
    .then(({ newGreenhouse, newLever }) => {
      if (newGreenhouse > 0 || newLever > 0) {
        logger.info('ats_discovery_done', { newGreenhouse, newLever })
      }
    })
    .catch((err) => logger.warn('ats_discovery_error', { error: String(err) }))

  addEntry(
    'info',
    'scraping_done',
    `${totalScraped} coletadas → ${totalPreFilterApproved} aprovadas (${totalPreFilterRejected} rejeitadas no pré-filtro) → ${totalSaved} salvas`,
  )
  logger.info('scraping_done', { userId, totalScraped, totalPreFilterApproved, totalPreFilterRejected, totalSaved })

  // -------------------------------------------------------------------------
  // MATCHING — Claude semantic analysis on saved rawJobs
  // -------------------------------------------------------------------------
  await setStatus(userId, { currentJob: `Analisando compatibilidade de ${totalSaved} vagas...` })
  addEntry('info', 'matching_start', 'Iniciando análise semântica')
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).update({ entries: logEntries })

  await runMatching(userId, profile, addEntry)

  const [matchedSnap, rejectedSnap] = await Promise.all([
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'matched').get(),
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'rejected').get(),
  ])

  addEntry('info', 'matching_done', `${matchedSnap.size} vagas aprovadas, ${rejectedSnap.size} rejeitadas`)
  addEntry('info', 'pipeline_done', 'Pipeline concluído com sucesso')

  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).set({
    finishedAt: FieldValue.serverTimestamp(),
    status: errors.length > 0 ? 'failed' : 'completed',
    applicationsProcessed: totalScraped,
    applicationsSubmitted: matchedSnap.size,
    errors: errors.length,
    entries: logEntries,
  }, { merge: true })

  await setStatus(userId, {
    status: 'idle',
    lastRunAt: FieldValue.serverTimestamp(),
    currentJob: null,
  })

  const summary: PipelineResult = {
    scraped: totalScraped,
    preFilterApproved: totalPreFilterApproved,
    preFilterRejected: totalPreFilterRejected,
    saved: totalSaved,
    matched: matchedSnap.size,
    rejected: rejectedSnap.size,
    errors,
  }

  logger.info('pipeline_done', { userId, ...summary })
  return summary
}
