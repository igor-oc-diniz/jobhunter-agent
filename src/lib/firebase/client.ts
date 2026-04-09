import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function getApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
}

export function getAuth(): Auth {
  const { getAuth: _getAuth } = require('firebase/auth')
  return _getAuth(getApp())
}

export function getDb(): Firestore {
  const { getFirestore } = require('firebase/firestore')
  return getFirestore(getApp())
}

export function getStorage(): FirebaseStorage {
  const { getStorage: _getStorage } = require('firebase/storage')
  return _getStorage(getApp())
}
