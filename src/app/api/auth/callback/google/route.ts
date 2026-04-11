import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/agent/firebase-admin'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=cancelled`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokens)
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange`)
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userRes.json()

    if (!userInfo.email) {
      return NextResponse.redirect(`${appUrl}/login?error=no_email`)
    }

    // Get or create Firebase user
    let uid: string
    try {
      const existing = await adminAuth.getUserByEmail(userInfo.email)
      uid = existing.uid
    } catch {
      const created = await adminAuth.createUser({
        email: userInfo.email,
        displayName: userInfo.name ?? userInfo.email,
        photoURL: userInfo.picture,
        emailVerified: userInfo.email_verified ?? false,
      })
      uid = created.uid
    }

    // Create short-lived custom token (client uses it to get a real ID token)
    const customToken = await adminAuth.createCustomToken(uid)

    return NextResponse.redirect(
      `${appUrl}/auth/finalize?token=${encodeURIComponent(customToken)}`
    )
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
