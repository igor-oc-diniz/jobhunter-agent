'use server'

import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { Application, ApplicationStatus } from '@/types'

export async function getApplicationsAction(): Promise<Application[]> {
  const userId = await requireUserId()

  const snap = await adminDb
    .collection(`users/${userId}/applications`)
    .orderBy('appliedAt', 'desc')
    .get()

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      // Serialize Timestamps
      appliedAt: data.appliedAt?.toDate?.().toISOString() ?? null,
      updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    } as unknown as Application
  })
}

export async function updateApplicationStatusAction(
  jobId: string,
  status: ApplicationStatus
): Promise<void> {
  const userId = await requireUserId()
  const ref = adminDb.doc(`users/${userId}/applications/${jobId}`)
  await ref.update({ status, updatedAt: new Date() })
}
