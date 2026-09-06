import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only allow same-origin, absolute-path redirect targets — never forward an open
// redirect via a query param straight into NextResponse.redirect.
function resolveNext(searchParams: URLSearchParams): string {
  const next = searchParams.get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = resolveNext(searchParams)

  // Email confirmation (any device) — Supabase sends token_hash + type
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const VALID_OTP_TYPES = ['email', 'sms', 'magiclink', 'invite', 'recovery', 'email_change'] as const
  type OtpType = typeof VALID_OTP_TYPES[number]
  if (token_hash && type && (VALID_OTP_TYPES as readonly string[]).includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as OtpType })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  // OAuth / PKCE — same browser as signup, sends code. Password-reset links also use this
  // path; the forgot-password page sets next=/auth/reset-password so this lands there
  // instead of the dashboard.
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
}
