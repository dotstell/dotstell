import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // Email confirmation (any device) — Supabase sends token_hash + type
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const VALID_OTP_TYPES = ['email', 'sms', 'magiclink', 'invite', 'recovery', 'email_change'] as const
  type OtpType = typeof VALID_OTP_TYPES[number]
  if (token_hash && type && (VALID_OTP_TYPES as readonly string[]).includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as OtpType })
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }

  // OAuth / PKCE — same browser as signup, sends code
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
}
