'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const errorMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  token_exchange: 'Failed to complete sign in. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  no_email: 'Could not retrieve email from Google. Please try again.',
}

function LoginForm() {
  const params = useSearchParams()
  const error = params.get('error')

  return (
    <div className="w-full max-w-sm space-y-8 p-10 glass-panel rounded-[2rem] shadow-neon">
      <div className="space-y-2 text-center">
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface">Huntly</h1>
        <p className="text-on-surface-variant text-sm">
          Mission Control for your job search
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center bg-error-container/20 border border-destructive/30 px-4 py-2 rounded-[1rem]">
          {errorMessages[error] ?? 'An error occurred. Please try again.'}
        </p>
      )}

      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center rounded-[1rem] gradient-primary px-4 py-3 text-sm font-bold text-on-primary shadow-[0px_0px_20px_rgba(0,255,136,0.2)] hover:shadow-[0px_0px_25px_rgba(0,255,136,0.4)] transition-all active:scale-95"
      >
        Continue with Google
      </a>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
