import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')
  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/finalize')

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/applications', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
