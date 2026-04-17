'use server'

import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { RawJob } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

export interface JobFilters {
  status?: RawJob['status'] | 'all'
  platform?: string
  search?: string
  remoteOnly?: boolean
  sort?: 'recent' | 'score'
}

export async function getRawJobsAction(filters?: JobFilters): Promise<RawJob[]> {
  const userId = await requireUserId()

  const snap = await adminDb.collection(`users/${userId}/rawJobs`).get()

  let jobs = snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      scrapedAt: data.scrapedAt?.toDate?.().toISOString() ?? null,
      fullPageAccessedAt: data.fullPageAccessedAt?.toDate?.().toISOString() ?? null,
      matchDetails: data.matchDetails
        ? {
            ...data.matchDetails,
            matchedAt: data.matchDetails.matchedAt?.toDate?.().toISOString() ?? null,
          }
        : undefined,
    } as unknown as RawJob
  })

  if (filters?.status && filters.status !== 'all') {
    jobs = jobs.filter((j) => j.status === filters.status)
  }

  if (filters?.platform && filters.platform !== 'all') {
    jobs = jobs.filter((j) => j.sourcePlatform === filters.platform)
  }

  if (filters?.remoteOnly) {
    jobs = jobs.filter((j) => j.isRemote)
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q)
    )
  }

  if (filters?.sort === 'score') {
    jobs.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
  } else {
    jobs.sort((a, b) => {
      const aTime = a.scrapedAt ? new Date(a.scrapedAt as unknown as string).getTime() : 0
      const bTime = b.scrapedAt ? new Date(b.scrapedAt as unknown as string).getTime() : 0
      return bTime - aTime
    })
  }

  return jobs.slice(0, 200)
}

export async function archiveRawJobAction(jobId: string): Promise<void> {
  const userId = await requireUserId()

  const jobRef = adminDb.doc(`users/${userId}/rawJobs/${jobId}`)
  const jobSnap = await jobRef.get()

  if (!jobSnap.exists) return

  const data = jobSnap.data()!

  await jobRef.update({ status: 'rejected' })

  await adminDb.collection(`users/${userId}/blacklist`).add({
    sourceUrl: data.sourceUrl ?? '',
    company: data.company ?? '',
    title: data.title ?? '',
    addedAt: FieldValue.serverTimestamp(),
    reason: 'manually_archived',
  })
}

export async function approveRawJobAction(jobId: string): Promise<void> {
  const userId = await requireUserId()

  const syntheticMatchDetails = {
    stackOverlap: 0,
    seniorityScore: 0,
    contractScore: 0,
    modalityScore: 0,
    salaryScore: 0,
    semanticScore: 0,
    positives: ['Manually approved by user'],
    gaps: [],
    cvAdaptations: [],
    redFlags: [],
    justification: 'Manually approved by user — no Claude analysis performed.',
    manuallyApproved: true,
    matchedAt: FieldValue.serverTimestamp(),
  }

  await adminDb.doc(`users/${userId}/rawJobs/${jobId}`).update({
    status: 'matched',
    matchScore: 70,
    matchDetails: syntheticMatchDetails,
  })

  await adminDb.doc(`users/${userId}/applicationQueue/${jobId}`).set({
    jobId,
    priority: 70000,
    matchScore: 70,
    status: 'queued',
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function getRawJobAction(jobId: string): Promise<RawJob | null> {
  const userId = await requireUserId()

  const doc = await adminDb.doc(`users/${userId}/rawJobs/${jobId}`).get()

  if (!doc.exists) return null

  const data = doc.data()!
  return {
    ...data,
    id: doc.id,
    scrapedAt: data.scrapedAt?.toDate?.().toISOString() ?? null,
    fullPageAccessedAt: data.fullPageAccessedAt?.toDate?.().toISOString() ?? null,
    matchDetails: data.matchDetails
      ? {
          ...data.matchDetails,
          matchedAt: data.matchDetails.matchedAt?.toDate?.().toISOString() ?? null,
        }
      : undefined,
  } as unknown as RawJob
}
