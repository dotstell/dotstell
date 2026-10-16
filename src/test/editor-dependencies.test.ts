import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Two copies of a ProseMirror package break the editor at runtime: nodes built by one copy are rejected by the other,
// so pressing Enter (a block split) throws and nothing happens. A dependency bump can leave stale pins behind in the
// lockfile, which is how this shipped once; this keeps it from happening again.
const lock = readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8')
const packagesSection = lock.slice(lock.indexOf('\npackages:'), lock.indexOf('\nsnapshots:'))

describe('editor dependencies', () => {
  for (const name of ['prosemirror-model', 'prosemirror-transform', 'prosemirror-state', 'prosemirror-view']) {
    it(`${name} resolves to a single version`, () => {
      const versions = [...packagesSection.matchAll(new RegExp(`^  ${name}@([^:\\s]+):`, 'gm'))].map(m => m[1])
      expect(versions).toHaveLength(1)
    })
  }
})
