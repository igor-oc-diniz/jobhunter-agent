import { redirect } from 'next/navigation'
import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { UserProfile } from '@/types'

export default async function ProfileEditPage() {
  const userId = await requireUserId()

  const snap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!snap.exists) redirect('/profile/setup')

  const raw = snap.data()!
  // Firestore Timestamps are not serializable across server→client boundary
  const profile = {
    ...raw,
    createdAt: raw.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: raw.updatedAt?.toDate?.().toISOString() ?? null,
  } as unknown as UserProfile

  return <ProfileEditor initialProfile={profile} />
}
