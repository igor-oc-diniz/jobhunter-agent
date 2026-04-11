'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithCustomToken, browserSessionPersistence, setPersistence } from 'firebase/auth'
import { getAuth } from '@/lib/firebase/client'
import { StatusBeacon } from '@/components/design-system'

function FinalizeContent() {
  const router = useRouter()
  const params = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function finalize() {
      const token = params.get('token')
      const error = params.get('error')

      if (error || !token) {
        router.push('/login?error=' + (error ?? 'no_token'))
        return
      }

      try {
        const auth = getAuth()
        await setPersistence(auth, browserSessionPersistence)
        const result = await signInWithCustomToken(auth, token)
        const idToken = await result.user.getIdToken()

        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: idToken }),
        })

        router.push('/applications')
      } catch (err) {
        console.error('Finalize error:', err)
        router.push('/login?error=auth_failed')
      }
    }

    finalize()
  }, [params, router])

  return (
    <div className="flex items-center gap-3">
      <StatusBeacon variant="success" pulse />
      <p className="text-on-surface-variant text-sm font-label">Completing sign in...</p>
    </div>
  )
}

export default function FinalizePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense>
        <FinalizeContent />
      </Suspense>
    </div>
  )
}
