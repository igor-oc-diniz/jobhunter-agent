import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/client'
import type { UserProfile } from '@/types'

const profileRef = (userId: string) =>
  doc(getDb(), 'users', userId, 'profile', 'data')

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(userId))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function saveProfile(
  userId: string,
  profile: Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const ref = profileRef(userId)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    await updateDoc(ref, { ...profile, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, {
      ...profile,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}
