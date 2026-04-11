import { createHash } from 'crypto'
import type { Firestore } from 'firebase-admin/firestore'
import type { BlacklistCheckResult, NormalizedJob } from '@/types/scraper'

/**
 * Generate a SHA256 hash from externalId and platform
 * This creates a unique identifier for each job posting
 */
export function generateJobHash(externalId: string, platform: string): string {
  const data = `${externalId}::${platform}`
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Check if a job hash exists in the blacklist collection
 * Returns isDuplicate=true if the job was already processed
 */
export async function checkBlacklist(
  db: Firestore,
  hash: string
): Promise<BlacklistCheckResult> {
  try {
    const docRef = db.collection('jobBlacklist').doc(hash)
    const doc = await docRef.get()

    if (doc.exists) {
      return {
        isDuplicate: true,
        existingJobId: hash,
        hash,
      }
    }

    return {
      isDuplicate: false,
      hash,
    }
  } catch (error) {
    // On error, log but don't fail - treat as not duplicate to avoid missing jobs
    console.error('Error checking blacklist:', error)
    return {
      isDuplicate: false,
      hash,
    }
  }
}

/**
 * Add a job hash to the blacklist collection
 * This prevents re-processing the same job in future scraping runs
 */
export async function addToBlacklist(
  db: Firestore,
  hash: string,
  jobData: Partial<NormalizedJob>
): Promise<void> {
  try {
    const docRef = db.collection('jobBlacklist').doc(hash)
    
    await docRef.set({
      hash,
      externalId: jobData.externalId || '',
      platform: jobData.platform || '',
      title: jobData.title || '',
      company: jobData.company || '',
      url: jobData.url || '',
      createdAt: new Date(),
    })
  } catch (error) {
    // Log error but don't throw - blacklist failure shouldn't stop scraping
    console.error('Error adding to blacklist:', error)
  }
}
