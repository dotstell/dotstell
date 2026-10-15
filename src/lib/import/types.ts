/** A note produced by one of the non-Markdown adapters, before it is given an id. */
export interface DraftNote {
  /** Where it came from, for the report. */
  path: string
  title: string
  html: string
  tags: string[]
  notebook: string | null
  createdAt: string | null
  updatedAt: string | null
  pinned: boolean
}

/** A person to create from a vCard or a contacts spreadsheet. */
export interface PlannedContact {
  name: string
  role: string | null
  company: string | null
  email: string | null
  phone: string | null
}

/**
 * Things adapters tell the planner about. "Refusals" become warnings in the preview, the rest
 * plain notes about what was changed or left out.
 */
export type ReportKind =
  | 'image-embedded'
  | 'image-too-large'
  | 'attachment-skipped'
  | 'link-removed'
  | 'encrypted-text'
  | 'trashed-skipped'
  | 'extra-contact-fields'
  | 'fake-image'
  | 'unsafe-svg'
  | 'unreadable-file'
  | 'xml-entities'

export type Reporter = (kind: ReportKind, detail?: string) => void

/** Same limit as vault.ts: below the server's 2 MB per note. */
export const MAX_IMAGE_BYTES = 500 * 1024

/** `Mon DD` style tags from other apps become the lowercase-hyphen form the rest of the app uses. */
export const toTagSlug = (raw: string) => raw.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 60)
