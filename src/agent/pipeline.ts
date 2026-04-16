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
import { runMatching } from './matching/matcher'
import { generateCV } from './cv/cv-generator'
import { generateCoverLetter } from './cover-letter/cover-letter-generator'
import { createLogger } from './utils/logger'
import { loadConfig } from './utils/config'
import type { RawJob, UserProfile, MatchDetails } from '@/types'
import type { Application } from '@/types/application'
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
  cvGenerated: number
  errors: string[]
}

async function setStatus(userId: string, fields: Record<string, unknown>) {
  await adminDb.doc(`users/${userId}/agentStatus/current`).set(
    { ...fields, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}

export async function runPipeline(userId: string): Promise<PipelineResult> {
  logger.info('pipeline_start', { userId })
  const errors: string[] = []
  const runId = uuidv4()
  const logEntries: Array<{ level: string; action: string; message: string; timestamp: string }> = []

  function addEntry(level: 'info' | 'warn' | 'error', action: string, message: string) {
    logEntries.push({ level, action, message, timestamp: new Date().toISOString() })
  }

  const profileSnap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!profileSnap.exists) throw new Error(`Profile not found for userId: ${userId}`)
  const profile = profileSnap.data() as UserProfile

  // Create run log document
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
      if (sc.platform === 'remotive') return new RemotiveScraper(sc, log)
      if (sc.platform === 'weworkremotely') return new WeWorkRemotelyScraper(sc, log)
      if (sc.platform === 'himalayas') return new HimalayadScraper(sc, log)
      if (sc.platform === 'wellfound') return new WellfoundScraper(sc, log)
      if (sc.platform === 'remoteok') return new RemoteOKScraper(sc, log)
      if (sc.platform === 'arbeitnow') return new ArbeitnowScraper(sc, log)
      if (sc.platform === 'indeed-ca') return new IndeedCAScraper(sc, log)
      if (sc.platform === 'indeed-au') return new IndeedAUScraper(sc, log)
      return null
    })
    .filter(Boolean) as (GupyScraper | IndeedBRScraper)[]

  // Update status: scraping
  const platformNames = scraperConfigs.map((s) => s.platform).join(', ')
  await setStatus(userId, { currentJob: `Scraping vagas em ${platformNames}...` })
  addEntry('info', 'scraping_start', `Iniciando scraping em ${platformNames}`)

  // Flush partial log so dashboard sees the step immediately
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).update({ entries: logEntries })

  const results = await Promise.allSettled(scrapers.map((s) => s.run()))

  let scraped = 0
  let saved = 0

  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(String(result.reason))
      addEntry('error', 'scraper_failed', String(result.reason))
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
  addEntry('info', 'scraping_done', `${scraped} vagas coletadas, ${saved} salvas`)

  // Update status: matching
  await setStatus(userId, { currentJob: `Analisando compatibilidade de ${saved} vagas...` })
  addEntry('info', 'matching_start', 'Iniciando análise semântica')
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).update({ entries: logEntries })

  await runMatching(userId, profile)

  const [matchedSnap, rejectedSnap] = await Promise.all([
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'matched').get(),
    adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'rejected').get(),
  ])

  addEntry('info', 'matching_done', `${matchedSnap.size} vagas aprovadas, ${rejectedSnap.size} rejeitadas`)

  // Step 3: CV + Cover Letter generation for matched jobs
  const maxApplications = profile.agentConfig?.maxApplicationsPerDay ?? 10
  const matchedJobs = matchedSnap.docs.slice(0, maxApplications)
  let cvGenerated = 0

  await setStatus(userId, { currentJob: `Gerando CV e cartas para ${matchedJobs.length} vagas...` })
  addEntry('info', 'cv_generation_start', `Iniciando geração de CV para ${matchedJobs.length} vagas`)
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).update({ entries: logEntries })

  for (const doc of matchedJobs) {
    const job = doc.data() as RawJob
    const jobId = doc.id
    const matchDetails = job.matchDetails as MatchDetails

    // Skip if application already exists with CV
    const appSnap = await adminDb.doc(`users/${userId}/applications/${jobId}`).get()
    if (appSnap.exists && appSnap.data()?.cvUrl) {
      addEntry('info', 'cv_cache_hit', `CV já existe para ${job.title} @ ${job.company}`)
      cvGenerated++
      continue
    }

    // Create or update Application document
    const now = FieldValue.serverTimestamp()
    const appData: Partial<Application> = {
      jobId,
      userId,
      jobSnapshot: {
        title: job.title,
        company: job.company,
        location: job.location,
        isRemote: job.isRemote,
        techStack: job.techStack,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        contractType: job.contractType,
        sourceUrl: job.sourceUrl,
        sourcePlatform: job.sourcePlatform,
      },
      status: 'queued',
      matchScore: job.matchScore ?? 0,
      stages: [],
      createdAt: now as never,
      updatedAt: now as never,
    }
    await adminDb.doc(`users/${userId}/applications/${jobId}`).set(appData, { merge: true })

    try {
      await setStatus(userId, { currentJob: `Gerando CV: ${job.title} @ ${job.company}` })

      const [cvResult, coverLetterText] = await Promise.all([
        generateCV(userId, jobId, job, profile, matchDetails),
        generateCoverLetter(userId, jobId, job, profile, matchDetails),
      ])

      await adminDb.doc(`users/${userId}/applications/${jobId}`).set(
        {
          cvUrl: cvResult.pdfUrl,
          cvGeneratedAt: cvResult.generatedAt,
          coverLetterText,
          coverLetterGeneratedAt: now,
          status: 'awaiting_confirmation',
          updatedAt: now,
        },
        { merge: true }
      )

      cvGenerated++
      addEntry('info', 'cv_generated', `CV e carta gerados para ${job.title} @ ${job.company}`)
    } catch (err) {
      const msg = String(err)
      errors.push(msg)
      addEntry('error', 'cv_generation_error', `Erro ao gerar CV para ${job.title}: ${msg}`)
      await adminDb.doc(`users/${userId}/applications/${jobId}`).set(
        { status: 'failed', updatedAt: now },
        { merge: true }
      )
    }
  }

  addEntry('info', 'cv_generation_done', `${cvGenerated} CVs gerados`)
  addEntry('info', 'pipeline_done', 'Pipeline concluído com sucesso')

  // Finalize run log
  await adminDb.doc(`users/${userId}/agentLogs/${runId}`).set({
    finishedAt: FieldValue.serverTimestamp(),
    status: errors.length > 0 ? 'failed' : 'completed',
    applicationsProcessed: scraped,
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
    scraped,
    saved,
    matched: matchedSnap.size,
    rejected: rejectedSnap.size,
    cvGenerated,
    errors,
  }

  logger.info('pipeline_done', { userId, ...summary })
  return summary
}
