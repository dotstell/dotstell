const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Please enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Please enter a valid email address.'
  return null
}

// Mirrors the Supabase project's password policy (Authentication > Policies):
// min 8 chars, lowercase, uppercase, digit, and symbol.
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.'
  return null
}
