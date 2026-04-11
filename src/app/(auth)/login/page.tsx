'use client'

import { useSearchParams } from 'next/navigation'

const errorMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  token_exchange: 'Failed to complete sign in. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  no_email: 'Could not retrieve email from Google. Please try again.',
}

export default function LoginPage() {
  const params = useSearchParams()
  const error = params.get('error')

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
          <p className="text-sm text-destructive text-center">
            {errorMessages[error] ?? 'An error occurred. Please try again.'}
          </p>
        )}

        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Continue with Google
        </a>
      </div>
    </div>
  )
}
