#!/usr/bin/env node
// Guards against supabase/schema.sql drifting from supabase/migrations/.
//
// The two files serve different audiences: schema.sql is what a fresh install runs (see
// README), migrations are what an existing database applies. When a migration adds an
// object that never reaches schema.sql, new self-hosters silently get a different database
// than production. That is how match_notes/match_bookmarks/match_tasks and the bookmarks
// unique constraint went missing -- leaving AI semantic search broken on any fresh setup,
// with nothing in the install steps to explain why.
//
// Matching is done against a tokenised copy of schema.sql rather than a word-boundary
// regex: identifiers are [a-z0-9_] runs, so tokenising is both exact (no `notes` matching
// `notes_parent_id`) and immune to escaping mistakes in the pattern itself.

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const MIGRATIONS = 'supabase/migrations'
const SCHEMA     = 'supabase/schema.sql'

const PATTERNS = [
  [/add\s+constraint\s+([a-z0-9_]+)/gi,                                   'constraint'],
  [/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)/gi, 'function'],
  [/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,            'table'],
  [/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi, 'index'],
  [/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,              'column'],
]

const schema = readFileSync(SCHEMA, 'utf8').toLowerCase()
const schemaTokens = new Set(schema.match(/[a-z0-9_]+/g) ?? [])

const missing = []
const seen = new Set()

for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
  for (const [re, kind] of PATTERNS) {
    for (const [, rawName] of sql.matchAll(re)) {
      const name = rawName.toLowerCase()
      if (schemaTokens.has(name)) continue
      const key = kind + ':' + name
      if (seen.has(key)) continue
      seen.add(key)
      missing.push({ file, kind, name })
    }
  }
}

if (missing.length === 0) {
  console.log('schema.sql is in sync with all migrations.')
  process.exit(0)
}

console.error('schema.sql is missing ' + missing.length + ' object(s) that migrations create:')
console.error('')
for (const m of missing) {
  console.error('  ' + m.kind.padEnd(11) + ' ' + m.name.padEnd(28) + ' (from ' + m.file + ')')
}
console.error('')
console.error('Add them to supabase/schema.sql so a fresh install matches production.')
process.exit(1)
