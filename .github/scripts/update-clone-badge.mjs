#!/usr/bin/env node
// Fetches this repo's clone traffic and accumulates it into a running total stored in
// badges/clones.json, so the README can show a genuinely cumulative clone count via a
// shields.io endpoint badge. GitHub's Traffic API only returns a rolling 14-day window,
// not an all-time total -- each past day's count is locked in exactly once, on the first
// run after that day has fully ended. Overwriting an already-recorded day (rather than
// adding to it) keeps this idempotent even if the workflow runs more than once on the
// same day, or a day's count changes before the day is over.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'

const REPO = 'dotstell/dotstell'
const BADGE_FILE = 'badges/clones.json'

const token = process.env.GH_TOKEN
if (!token) throw new Error('GH_TOKEN is required')

const res = await fetch(`https://api.github.com/repos/${REPO}/traffic/clones?per=day`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  },
})
if (!res.ok) {
  throw new Error(`Traffic API request failed: ${res.status} ${await res.text()}`)
}
const { clones } = await res.json()

const today = new Date().toISOString().slice(0, 10)

let seenDates = {}
if (existsSync(BADGE_FILE)) {
  const prev = JSON.parse(readFileSync(BADGE_FILE, 'utf8'))
  seenDates = prev.seenDates ?? {}
}

for (const { timestamp, count } of clones) {
  const day = timestamp.slice(0, 10)
  if (day === today) continue // today's count is still live -- locked in on a later run
  seenDates[day] = count // a past day's count from GitHub is final, safe to overwrite
}

const totalClones = Object.values(seenDates).reduce((sum, n) => sum + n, 0)

mkdirSync('badges', { recursive: true })
writeFileSync(BADGE_FILE, JSON.stringify({
  schemaVersion: 1,
  label: 'clones',
  message: String(totalClones),
  color: '7c6aff',
  seenDates,
  updatedAt: new Date().toISOString(),
}, null, 2) + '\n')

console.log(`Recorded ${Object.keys(seenDates).length} days, total clones: ${totalClones}`)
