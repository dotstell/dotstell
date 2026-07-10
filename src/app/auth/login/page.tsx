'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      console.log('Login result:', { data, error })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
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
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
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
