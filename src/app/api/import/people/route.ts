import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

const IMPORT_TAG = /^imported-[A-Za-z0-9-]{1,40}$/

const MAX_PER_REQUEST = 50
const LIMITS = { name: 200, role: 200, company: 200, email: 254, phone: 50 } as const
const CONTROL = /[\u0000-\u001f\u007f]/
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

interface IncomingPerson {
  name: string
  role: string | null
  company: string | null
  email: string | null
  phone: string | null
}

const optional = (v: unknown, max: number) => v === null || v === undefined || (typeof v === 'string' && v.length <= max && !CONTROL.test(v))

// POST /api/import/people
// Body: { importTag, people: IncomingPerson[] }
// Creates people from a contacts file. People who already exist (same email, or same name when
// there is no email) are skipped, so importing the same file twice does not duplicate anyone.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`import-people:${user.id}`, 120, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  if (typeof body.importTag !== 'string' || !IMPORT_TAG.test(body.importTag)) {
    return NextResponse.json({ error: 'Invalid import tag' }, { status: 400 })
  }
  if (!Array.isArray(body.people) || body.people.length === 0 || body.people.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_PER_REQUEST} people per request` }, { status: 400 })
  }

  const people: IncomingPerson[] = body.people
  for (const p of people) {
    const ok = p && typeof p === 'object'
      && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= LIMITS.name && !CONTROL.test(p.name)
      && optional(p.role, LIMITS.role) && optional(p.company, LIMITS.company) && optional(p.phone, LIMITS.phone)
      && optional(p.email, LIMITS.email) && (!p.email || EMAIL.test(p.email))
    if (!ok) return NextResponse.json({ error: 'Invalid contact' }, { status: 400 })
  }

  const emails = [...new Set(people.map(p => p.email).filter((e): e is string => !!e).flatMap(e => [e, e.toLowerCase()]))]
  const namesWithoutEmail = [...new Set(people.filter(p => !p.email).map(p => p.name))]

  const existingEmails = new Set<string>()
  const existingNames = new Set<string>()
  if (emails.length) {
    const { data } = await supabase.from('people').select('email').eq('user_id', user.id).in('email', emails)
    for (const r of data ?? []) if (r.email) existingEmails.add(r.email.toLowerCase())
  }
  if (namesWithoutEmail.length) {
    const { data } = await supabase.from('people').select('name').eq('user_id', user.id).in('name', namesWithoutEmail)
    for (const r of data ?? []) existingNames.add(r.name.toLowerCase())
  }

  const rows = people
    .filter(p => (p.email ? !existingEmails.has(p.email.toLowerCase()) : !existingNames.has(p.name.toLowerCase())))
    .map(p => ({
      user_id: user.id,
      name: p.name.trim(),
      role: p.role || null,
      company: p.company || null,
      email: p.email || null,
      phone: p.phone || null,
      tags: [body.importTag as string],
    }))

  if (rows.length) {
    const { error } = await supabase.from('people').insert(rows)
    if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return NextResponse.json({ created: rows.length, skipped: people.length - rows.length }, { status: 201 })
}
