import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/client'
import type { Application, ApplicationStatus } from '@/types'

export const applicationsRef = (userId: string) =>
  collection(getDb(), 'users', userId, 'applications')

export async function getApplications(
  userId: string,
  filters?: { status?: ApplicationStatus }
): Promise<Application[]> {
  let q = query(applicationsRef(userId), orderBy('appliedAt', 'desc'))
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status))
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as Application))
}

export function subscribeApplications(
  userId: string,
  callback: (apps: Application[]) => void
): Unsubscribe {
  return onSnapshot(
    query(applicationsRef(userId), orderBy('appliedAt', 'desc')),
    (snap) =>
      callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as Application)))
  )
}

export async function updateApplicationStatus(
  userId: string,
  jobId: string,
  status: ApplicationStatus,
  stageName?: string
): Promise<void> {
  const ref = doc(getDb(), 'users', userId, 'applications', jobId)
  const update: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  }

  if (stageName) {
    update['stages'] = [{ name: stageName, date: new Date().toISOString() }]
  }

  await updateDoc(ref, update)
}
