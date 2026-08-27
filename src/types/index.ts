export type NoteType = 'plain' | 'markdown' | 'checklist'

// tags: string[] serves dual purpose — user-visible labels AND notebook membership.
// Notebook membership is encoded as 'nb:<slug>' (e.g. 'nb:my-notebook').
// See useNotebooks.ts for the slug/tag convention and migration history.
export interface Notebook {
  id: string
  name: string
  color?: string
  icon?: string
  sort_order?: number
  note_count?: number
}

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  type: NoteType
  checklist_items?: ChecklistItem[]
  tags: string[]
  linked_items?: LinkedItem[]
  person_id?: string | null
  parent_id?: string | null
  sub_notes_count?: number
  sort_order?: number
  pinned?: boolean
  color?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Person {
  id: string
  user_id: string
  name: string
  role?: string
  company?: string
  email?: string
  phone?: string
  avatar_url?: string
  tags: string[]
  notes_count?: number
  last_interaction?: string
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  title: string
  url: string
  description?: string
  favicon_url?: string
  reading_time?: number | null
  hostname?: string
  last_visited_at?: string | null
  visit_count?: number
  tags: string[]
  linked_items?: LinkedItem[]
  created_at: string
  updated_at: string
}

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  person_id?: string | null
  tags: string[]
  linked_items?: LinkedItem[]
  created_at: string
  updated_at: string
}

export type LinkableType = 'note' | 'person' | 'bookmark' | 'task'

// LinkedItem is a denormalized view computed by the API, not a DB column.
// source_id/target_id in knowledge_links are untyped UUIDs — the app resolves
// them to the appropriate table at query time using source_type/target_type.
export interface LinkedItem {
  id: string
  type: LinkableType
  title: string
}

export interface KnowledgeLink {
  id: string
  user_id: string
  source_id: string
  source_type: LinkableType
  target_id: string
  target_type: LinkableType
  label?: string
  created_at: string
}
