import { v4 as uuidv4 } from 'uuid'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin'
import { extractTechStack } from '../utils/html-cleaner'
import { humanDelay } from '../utils/human-delay'
import { logger } from '../utils/logger'
import type { RawJob } from '@/types'

export interface SearchQuery {
  keywords: string[]
  location?: string
  remote?: boolean
  maxPages?: number
}

export abstract class BaseScraper {
  abstract platform: string

  abstract scrape(userId: string, query: SearchQuery): Promise<RawJob[]>

  protected extractTechStack(text: string): string[] {
    return extractTechStack(text)
  }

  protected async humanDelay(): Promise<void> {
    await humanDelay()
  }

  protected async isBlacklisted(userId: string, url: string): Promise<boolean> {
    const blacklistRef = adminDb.collection(`users/${userId}/blacklist`)
    const snap = await blacklistRef.where('sourceUrl', '==', url).limit(1).get()
    if (!snap.empty) return true

    const appliedRef = adminDb.collection(`users/${userId}/applications`)
    const appliedSnap = await appliedRef
      .where('jobSnapshot.sourceUrl', '==', url)
      .limit(1)
      .get()
    return !appliedSnap.empty
  }

  protected async saveRawJob(userId: string, job: Omit<RawJob, 'id' | 'userId' | 'scrapedAt'>): Promise<RawJob | null> {
    const alreadySeen = await this.isBlacklisted(userId, job.sourceUrl)
    if (alreadySeen) return null

    const rawJob: RawJob = {
      ...job,
      id: uuidv4(),
      userId,
      scrapedAt: FieldValue.serverTimestamp() as any,
      status: 'pending',
    }

    await adminDb
      .collection(`users/${userId}/rawJobs`)
      .doc(rawJob.id)
      .set(rawJob)

    logger.info('raw_job_saved', { userId, jobId: rawJob.id, platform: this.platform, title: rawJob.title })
    return rawJob
  }
}
