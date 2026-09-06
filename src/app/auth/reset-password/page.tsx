'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validatePassword } from '@/lib/auth-validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  // The callback route only gets here after exchanging a valid recovery token for a
  // session, but the client-side session hasn't hydrated from that cookie yet on first
  // paint — check it explicitly so a stale/expired link shows a real error instead of a
  // silently-failing form.
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setSessionReady(!!data.user))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // noValidate on the form hands validation to us so the error shows in our own
    // styled box instead of the browser's inconsistent native tooltip.
    const passwordError = validatePassword(password)
    if (passwordError) { setError(passwordError); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
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
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-lg font-semibold mb-2">Password updated</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Your password has been changed successfully.
              </p>
              <Link href="/dashboard" className="text-[var(--primary)] hover:underline text-sm">
                Continue to dashboard
              </Link>
            </div>
          ) : sessionReady === false ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-semibold mb-2">Link expired or invalid</h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                This password reset link is no longer valid. Request a new one below.
              </p>
              <Link href="/auth/forgot-password" className="text-[var(--primary)] hover:underline text-sm">
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold mb-4">Set a new password</h1>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (min 8 chars)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="pr-10"
                    disabled={sessionReady === null}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Must include uppercase, lowercase, a number, and a symbol.
                </p>
                {error && <p className="text-[var(--destructive)] text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>}
                <Button type="submit" disabled={loading || sessionReady === null} className="w-full mt-1">
                  {loading ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
