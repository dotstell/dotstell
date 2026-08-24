-- Add soft-delete support to notes table.
-- Notes moved to trash keep deleted_at set; they are excluded from all normal
-- queries and auto-purged after 30 days by the /api/notes/trash GET handler.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index so trash queries (NOT NULL filter) stay fast as the table grows
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes (user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
