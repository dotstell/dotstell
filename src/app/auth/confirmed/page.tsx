'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function EmailConfirmedPage() {
  // The callback route only gets here after verifying a valid signup token and
  // establishing a session, but a stale/already-used/expired link would fail that
  // verification and land here anyway with no session — check explicitly so that case
  // shows a real message instead of a false "success" screen. Same pattern as
  // reset-password's sessionReady check.
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setSessionReady(!!data.user))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <DotstellLogo size="lg" showTagline />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          {sessionReady === false ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-semibold mb-2">Link expired or invalid</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                This confirmation link is no longer valid. Try signing up again, or sign in if you already have an account.
              </p>
              <Link href="/auth/login" className="text-[var(--primary)] hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : sessionReady === null ? (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--muted-foreground)]">Confirming…</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-lg font-semibold mb-2">Email confirmed!</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Your account is ready to go.
              </p>
              <Link href="/dashboard" className="text-[var(--primary)] hover:underline text-sm">
                Continue to dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
