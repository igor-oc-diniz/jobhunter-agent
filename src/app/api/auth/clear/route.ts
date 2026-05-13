import { NextResponse } from 'next/server'

/**
 * Clears the session cookie and redirects to /login.
 * Used when the stored ID token has expired or is invalid.
 */
export async function GET() {
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
  )
  response.cookies.delete('session')
  return response
}
