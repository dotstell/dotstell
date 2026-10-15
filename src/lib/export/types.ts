export interface ChecklistItem {
  id?: string
  text: string
  checked: boolean
}

export interface ExportNote {
  id: string
  title: string
  content: string
  type: 'plain' | 'markdown' | 'checklist'
  checklist_items: ChecklistItem[] | null
  tags: string[] | null
  person_id: string | null
  parent_id: string | null
  sort_order: number
  pinned: boolean
  color: string | null
  created_at: string
  updated_at: string
}

export interface ExportPerson {
  id: string
  name: string
  role: string | null
  company: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  tags: string[] | null
  last_interaction: string | null
  created_at: string
  updated_at: string
}

export interface ExportTask {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  person_id: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface ExportBookmark {
  id: string
  title: string
  url: string
  description: string | null
  favicon_url: string | null
  tags: string[] | null
  reading_time: number | null
  hostname: string | null
  last_visited_at: string | null
  visit_count: number | null
  created_at: string
  updated_at: string
}

export interface ExportNotebook {
  id: string
  name: string
  color: string | null
  icon: string | null
  sort_order: number
  created_at: string
}

export interface ExportLink {
  id: string
  source_id: string
  source_type: 'note' | 'person' | 'bookmark' | 'task'
  target_id: string
  target_type: 'note' | 'person' | 'bookmark' | 'task'
  label: string | null
  created_at: string
}

export interface ExportData {
  notes: ExportNote[]
  people: ExportPerson[]
  tasks: ExportTask[]
  bookmarks: ExportBookmark[]
  notebooks: ExportNotebook[]
  links: ExportLink[]
}

/** One file in the archive. `mtime` lets file managers and Obsidian sort by last edit. */
export interface ExportFile {
  content: string | Uint8Array
  mtime?: Date
}

export type ExportFiles = Record<string, ExportFile>
