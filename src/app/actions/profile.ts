'use server'

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/agent/firebase-admin'
import { requireUserId } from '@/lib/auth/server'
import type { UserProfile } from '@/types'

export async function saveProfileAction(
  profile: Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const userId = await requireUserId()
  const ref = adminDb.doc(`users/${userId}/profile/data`)
  const snap = await ref.get()

  if (snap.exists) {
    await ref.update({ ...profile, updatedAt: FieldValue.serverTimestamp() })
  } else {
    await ref.set({
      ...profile,
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
}
