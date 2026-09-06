import Link from 'next/link'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export default function EmailConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <DotstellLogo size="lg" showTagline />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
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
        </div>
      </div>
    </div>
  )
}
