'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        // Clear per-user localStorage state when a different user signs in
        const incomingId = data.user?.id
        const storedId   = localStorage.getItem('dotstell-user-id')
        if (incomingId && storedId && storedId !== incomingId) {
          const keysToWipe = [
            'dotstell-note-tabs',
            'dotstell-note-active-tab',
            'dotstell-notified-tasks',
            'sidebar-collapsed',
          ]
          keysToWipe.forEach(k => localStorage.removeItem(k))
        }
        if (incomingId) localStorage.setItem('dotstell-user-id', incomingId)
        // Hard redirect (not router.push + router.refresh) — those two overlap into a
        // router-cache race that left the very next client-side navigation (e.g. the
        // first "+ New note" click after sign-in) hitting an inconsistent transition
        // state and crashing. A full page load guarantees a clean start.
        window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error('Login exception:', err)
      setError('Connection failed. Check your Supabase keys.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <DotstellLogo size="lg" showTagline />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h1 className="text-lg font-semibold mb-4">Sign in</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
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
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pr-10"
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
            {error && (
              <p className="text-[var(--destructive)] text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-4">
            No account?{' '}
            <Link href="/auth/register" className="text-[var(--primary)] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
