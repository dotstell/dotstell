'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-xl font-bold">dotstell</span>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">Connect your knowledge</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✉️</div>
              <h2 className="text-lg font-semibold mb-2">Check your email</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                We sent a confirmation link to <strong>{email}</strong>
              </p>
              <Link href="/auth/login" className="block mt-4 text-[var(--primary)] hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold mb-4">Create account</h1>
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading ? 'Creating...' : 'Create account'}
                </Button>
              </form>
              <p className="text-center text-sm text-[var(--muted-foreground)] mt-4">
                Already have one?{' '}
                <Link href="/auth/login" className="text-[var(--primary)] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
