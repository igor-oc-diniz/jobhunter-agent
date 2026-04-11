import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/agent/firebase-admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function exchangeCodeForTokens(code: string): Promise<{ access_token: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/auth/callback/google`,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`)
  }

  return res.json()
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{
  email: string
  name?: string
  picture?: string
  email_verified?: boolean
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.json()
}

async function getOrCreateFirebaseUser(userInfo: {
  email: string
  name?: string
  picture?: string
  email_verified?: boolean
}): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(userInfo.email)
    return existing.uid
  } catch {
    const created = await adminAuth.createUser({
      email: userInfo.email,
      displayName: userInfo.name ?? userInfo.email,
      photoURL: userInfo.picture,
      emailVerified: userInfo.email_verified ?? false,
    })
    return created.uid
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code')
  const oauthError = request.nextUrl.searchParams.get('error')

  if (oauthError || !code) {
    return NextResponse.redirect(`${APP_URL}/login?error=cancelled`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const userInfo = await fetchGoogleUserInfo(tokens.access_token)

    if (!userInfo.email) {
      return NextResponse.redirect(`${APP_URL}/login?error=no_email`)
    }

    const uid = await getOrCreateFirebaseUser(userInfo)
    const customToken = await adminAuth.createCustomToken(uid)

    return NextResponse.redirect(
      `${APP_URL}/auth/finalize?token=${encodeURIComponent(customToken)}`
    )
  } catch (err) {
    // Log without sensitive token data
    console.error('[auth/callback]', toErrorMessage(err))
    return NextResponse.redirect(`${APP_URL}/login?error=auth_failed`)
  }
}
