'use server'

import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import { generateCV } from '@/agent/cv/cv-generator'
import logger from '@/agent/utils/logger'
import type { RawJob, UserProfile, MatchDetails } from '@/types'
import type { GenerateCVResult } from '@/types/cv-generation'

const EMPTY_MATCH_DETAILS: MatchDetails = {
  stackOverlap: 0,
  seniorityScore: 0,
  contractScore: 0,
  modalityScore: 0,
  salaryScore: 0,
  semanticScore: 0,
  positives: [],
  gaps: [],
  cvAdaptations: [],
  redFlags: [],
  justification: '',
  matchedAt: null as never,
}

export async function generateCVAction(userId: string, jobId: string): Promise<GenerateCVResult> {
  const sessionUserId = await requireUserId()
  if (sessionUserId !== userId) return { error: 'Unauthorized' }

  try {
    const [jobsSnap, profileSnap, appSnap] = await Promise.all([
      adminDb.collection(`users/${userId}/rawJobs`).where('id', '==', jobId).limit(1).get(),
      adminDb.doc(`users/${userId}/profile/data`).get(),
      adminDb.doc(`users/${userId}/applications/${jobId}`).get(),
    ])

    if (!profileSnap.exists) return { error: 'Profile not found' }
    if (jobsSnap.empty) return { error: 'Job not found' }

    const job = jobsSnap.docs[0].data() as RawJob
    const profile = profileSnap.data() as UserProfile
    const matchDetails: MatchDetails = appSnap.exists
      ? ((appSnap.data()?.matchDetails as MatchDetails) ?? EMPTY_MATCH_DETAILS)
      : EMPTY_MATCH_DETAILS

    const result = await generateCV(userId, jobId, job, profile, matchDetails)
    return result
  } catch (err) {
    logger.error('generate_cv_action_error', { userId, jobId, error: String(err) })
    return { error: err instanceof Error ? err.message : 'Failed to generate CV' }
  }
}
