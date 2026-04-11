import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/agent/firebase-admin'

/**
 * Reads the session cookie and returns the verified userId.
 * Redirects to /login if the session is missing or invalid.
 * Use only in server components and API routes.
 */
export async function requireUserId(): Promise<string> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (!session) redirect('/login')

  try {
    const decoded = await adminAuth.verifyIdToken(session)
    return decoded.uid
  } catch {
    redirect('/login')
  }
}
