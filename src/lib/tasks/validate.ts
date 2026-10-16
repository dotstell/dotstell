// The database CHECK constraints only allow these values; checking here gives a clean 400 instead of a 500.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

/** Returns an error message for the first invalid task field, or null when all are acceptable. */
export function taskFieldError(body: Record<string, unknown>): string | null {
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 500)) return 'Invalid title'
  if (body.status != null && !(TASK_STATUSES as readonly unknown[]).includes(body.status)) return 'Invalid status'
  if (body.priority != null && !(TASK_PRIORITIES as readonly unknown[]).includes(body.priority)) return 'Invalid priority'
  if (body.tags != null && (!Array.isArray(body.tags) || body.tags.length > 50 || body.tags.some(t => typeof t !== 'string' || t.length > 100))) return 'Invalid tags'
  if (body.due_date != null && (typeof body.due_date !== 'string' || Number.isNaN(Date.parse(body.due_date)))) return 'Invalid due date'
  return null
}
