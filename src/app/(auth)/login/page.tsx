'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithGoogle } from '@/lib/firebase/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const user = await signInWithGoogle()
      const token = await user.getIdToken()

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      router.push('/applications')
    } catch {
      setError('Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-xl shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Job Hunter Agent</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to manage your job applications
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </Button>
      </div>
    </div>
  )
}
