import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch {
    // Last-resort catch: if updateSession itself throws (e.g. env vars missing in
    // preview deployments, unexpected Supabase SDK error), pass the request through
    // rather than surfacing a 500 "This page couldn't load" to the user.
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
