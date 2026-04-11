import admin from 'firebase-admin'

let initialized = false

try {
  if (!initialized && !admin.apps.length) {
    const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT

    if (!serviceAccountJSON) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set')
    }

    let serviceAccount: admin.ServiceAccount
    try {
      serviceAccount = JSON.parse(serviceAccountJSON) as admin.ServiceAccount
    } catch (parseError) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ' + (parseError as Error).message)
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    })

    initialized = true
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', (error as Error).message)
  throw error
}

export const adminDb = admin.firestore()
export const adminStorage = admin.storage()
export const adminAuth = admin.auth()

export default admin
