'use client'
import { AIConfig } from '@/lib/ai/types'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { LOCAL_AGENT_BASE } from '@/lib/ai/ollama-browser'

const STORAGE_KEY = 'dotstell-ai-config'

function buildTaskText(task: {
  title: string; description: string | null
  status: string; priority: string; due_date: string | null; tags: string[] | null
}): string {
  const parts = [task.title]
  if (task.description?.trim()) parts.push(task.description.trim())
  const meta = [`Status: ${task.status}`, `Priority: ${task.priority}`]
  if (task.due_date) meta.push(`Due: ${task.due_date.split('T')[0]}`)
  if (task.tags?.length) meta.push(task.tags.join(', '))
  parts.push(meta.join(' · '))
  return parts.join('\n')
}

// Browser-side embedding via Local Agent (same path as the Build button uses for Ollama).
// Silently skips if the Local Agent is not running — AI Chat still works via direct DB fallback.
async function embedViaLocalAgent(
  config: AIConfig,
  entityType: 'note' | 'task' | 'bookmark',
  entityId: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient()

  let text = ''
  if (entityType === 'note') {
    const { data } = await supabase.from('notes').select('title, content').eq('id', entityId).single()
    if (!data) return
    text = `${data.title}\n${data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`
  } else if (entityType === 'task') {
    const { data } = await supabase.from('tasks')
      .select('title, description, status, priority, due_date, tags').eq('id', entityId).single()
    if (!data) return
    text = buildTaskText(data)
  } else {
    const { data } = await supabase.from('bookmarks').select('title, description').eq('id', entityId).single()
    if (!data) return
    text = `${data.title}\n${data.description ?? ''}`
  }

  const embedRes = await fetch(`${LOCAL_AGENT_BASE}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.embeddingModel, prompt: text.slice(0, 8000) }),
  })
  if (!embedRes.ok) return

  const { embedding } = await embedRes.json()
  if (!Array.isArray(embedding) || embedding.length === 0) return
  if (embedding.length !== 768) return  // DB column is vector(768); wrong-dim model — skip silently

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const table = entityType === 'note' ? 'notes' : entityType === 'bookmark' ? 'bookmarks' : 'tasks'
  await supabase.from(table)
    .update({ embedding, embedding_model: config.embeddingModel })
    .eq('id', entityId)
    .eq('user_id', user.id)
}

/**
 * Fire-and-forget: embed a single entity after it is saved.
 * - Cloud providers (OpenAI, Gemini, etc.): calls server-side /api/ai/embed
 * - Ollama: calls Local Agent browser-side, same as the Build button does
 * - Never throws; silently skips if the Local Agent is not running
 */
export function triggerEmbedBackground(
  entityType: 'note' | 'task' | 'bookmark',
  entityId: string,
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const config = JSON.parse(raw) as AIConfig
    if (!config.embeddingProvider) return

    if (config.embeddingProvider === 'ollama') {
      embedViaLocalAgent(config, entityType, entityId).catch(() => {})
    } else {
      fetch('/api/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, entityType, entityId }),
      }).catch(() => {})
    }
  } catch {}
}

/**
 * Silently re-index ALL un-embedded items after a provider switch.
 * Cloud providers only — Ollama requires the Local Agent which may not be running;
 * user can hit Build search index once if needed after switching to Ollama.
 */
export function triggerBulkEmbedBackground(config: AIConfig): void {
  if (!config.embeddingProvider || config.embeddingProvider === 'ollama') return
  fetch('/api/ai/embed', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }).catch(() => {})
}
