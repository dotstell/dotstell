'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    // Always show the same success state regardless of outcome — never reveal
    // whether an email address has an account (avoids account enumeration).
    if (error) console.error('resetPasswordForEmail:', error)
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <DotstellLogo size="lg" showTagline />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✉️</div>
              <h2 className="text-lg font-semibold mb-2">Check your email</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                If an account exists for <strong>{email}</strong>, we sent a password reset link.
              </p>
              <Link href="/auth/login" className="block mt-4 text-[var(--primary)] hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold mb-1">Reset your password</h1>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {error && <p className="text-[var(--destructive)] text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
              <p className="text-center text-sm text-[var(--muted-foreground)] mt-4">
                <Link href="/auth/login" className="text-[var(--primary)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
