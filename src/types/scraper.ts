// src/types/scraper.ts

export interface ScraperConfig {
  platform: string
  enabled: boolean
  maxJobsPerRun: number
  userAgent?: string
  timeout?: number
}

export interface ScraperResult {
  platform: string
  jobsScraped: number
  jobsDeduped: number
  jobs: NormalizedJob[]
  errors: string[]
  duration: number
  timestamp: string
}

export interface RawJobInput {
  externalId: string
  platform: string
  title: string
  company: string
  location: string
  url: string
  description: string
  salary?: string
  employmentType?: string
  postedDate?: string
  requiredSkills?: string[]
  scrapedAt: Date
}

export interface NormalizedJob extends Omit<RawJobInput, 'scrapedAt'> {
  scrapedAt: string
  normalized: boolean
  hash: string
}

export interface BlacklistCheckResult {
  isDuplicate: boolean
  existingJobId?: string
  hash: string
}

export interface CronSchedule {
  expression: string
  timezone: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

export interface AgentContainerConfig {
  scrapers: ScraperConfig[]
  schedule: CronSchedule
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  firestoreProject: string
  redisUrl: string
}
