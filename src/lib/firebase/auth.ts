import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { getAuth } from './client'

const provider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getAuth(), provider)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth())
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getAuth(), callback)
}
