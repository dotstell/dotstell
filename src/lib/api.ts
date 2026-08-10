import { NextResponse } from 'next/server'

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export function serverError(err: unknown) {
  console.error('[api]', err)
  return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
}
