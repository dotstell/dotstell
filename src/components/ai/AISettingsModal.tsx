'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, ChevronDown, Check, AlertCircle, Loader2, Wifi, Database, RefreshCw } from 'lucide-react'
import {
  AIConfig, AIProvider, EmbeddingProvider,
  PROVIDER_LABELS, EMBEDDING_PROVIDER_LABELS,
  DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS,
  PROVIDERS_WITHOUT_EMBEDDINGS,
} from '@/lib/ai/types'
import { useAISettings } from '@/hooks/useAISettings'

interface AISettingsModalProps {
  onClose: () => void
}

// Fallback suggestions when Ollama can't be reached (e.g. not running yet)
const FALLBACK_OLLAMA_CHAT_MODELS = ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'gemma2', 'qwen2.5']
const FALLBACK_OLLAMA_EMBED_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm']

const CHAT_MODEL_SUGGESTIONS: Record<AIProvider, string[]> = {
  ollama:    FALLBACK_OLLAMA_CHAT_MODELS,
  openai:    ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5'],
  gemini:    ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  groq:      ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
}

const EMBED_MODEL_SUGGESTIONS: Record<EmbeddingProvider, string[]> = {
  ollama: FALLBACK_OLLAMA_EMBED_MODELS,
  openai: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
  gemini: ['text-embedding-004'],
}

export function AISettingsModal({ onClose }: AISettingsModalProps) {
  const { config, saveConfig, isConfigured } = useAISettings()
  const [draft,      setDraft]      = useState<AIConfig>(config)
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [indexing,   setIndexing]   = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)

  // Live list of models fetched from Ollama — replaces hardcoded suggestions when available
  const [ollamaModels,     setOllamaModels]     = useState<string[]>([])
  const [ollamaFetching,   setOllamaFetching]   = useState(false)
  const [ollamaFetchError, setOllamaFetchError] = useState<string | null>(null)

  // Fetch installed Ollama models via the Next.js API route (server-side proxy).
  // Direct browser fetch to localhost:11434 is blocked by corporate proxies,
  // so we relay through the server which can reach localhost freely.
  const fetchOllamaModels = useCallback(async (baseUrl: string) => {
    setOllamaFetching(true)
    setOllamaFetchError(null)
    try {
      const params = new URLSearchParams({ baseUrl: baseUrl || 'http://localhost:11434' })
      const res = await fetch(`/api/ai/ollama-models?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const models: Array<{ name: string; capabilities: string[] }> = data.models ?? []
      const names = models.map(m => m.name).filter(Boolean)
      setOllamaModels(names)
      // Auto-correct the chat model if it isn't actually installed
      setDraft(prev => {
        if (prev.provider !== 'ollama') return prev
        if (names.length > 0 && !names.includes(prev.model)) {
          // Prefer a model with 'completion' capability, fall back to first model
          const chatModel = models.find(m => m.capabilities.includes('completion'))?.name ?? names[0]
          return { ...prev, model: chatModel }
        }
        return prev
      })
    } catch (err) {
      setOllamaFetchError(err instanceof Error ? err.message : 'Cannot reach Ollama')
      setOllamaModels([])
    } finally {
      setOllamaFetching(false)
    }
  }, [])

  // Auto-fetch on mount and whenever the Ollama base URL changes
  useEffect(() => {
    if (draft.provider === 'ollama') {
      fetchOllamaModels(draft.baseUrl ?? 'http://localhost:11434')
    }
  }, [draft.provider, draft.baseUrl, fetchOllamaModels])

  // Reset test result whenever connection-relevant fields change
  useEffect(() => { setTestResult(null) }, [draft.provider, draft.apiKey, draft.model, draft.baseUrl])

  const needsEmbedConfig = PROVIDERS_WITHOUT_EMBEDDINGS.includes(draft.provider)

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          config:   draft,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Connection failed' }))
        setTestResult({ ok: false, message: err.error ?? 'Connection failed' })
        return
      }
      // Drain the stream to verify it works end-to-end
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   reply   = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try { const c = JSON.parse(line.slice(6)); reply += c.delta ?? ''; if (c.done) break } catch {}
        }
      }
      setTestResult({ ok: true, message: `Connected — model replied: "${reply.slice(0, 80)}"` })
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function reindexAll() {
    setIndexing(true)
    setIndexResult(null)
    try {
      const res = await fetch('/api/ai/embed', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config: draft }),
      })
      const data = await res.json()
      if (!res.ok) { setIndexResult(`Error: ${data.error}`); return }
      setIndexResult(`Indexed ${data.succeeded} items (${data.failed} failed) of ${data.total} total`)
    } catch (err) {
      setIndexResult(err instanceof Error ? err.message : 'Indexing failed')
    } finally {
      setIndexing(false)
    }
  }

  function handleSave() {
    saveConfig(draft)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="var(--primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>AI Settings</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>Configure your AI provider and models</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <Section title="Chat Provider">
          <Label>Provider</Label>
          <Select
            value={draft.provider}
            options={(Object.keys(PROVIDER_LABELS) as AIProvider[]).map(p => ({ value: p, label: PROVIDER_LABELS[p] }))}
            onChange={v => setDraft(prev => ({
              ...prev,
              provider:          v as AIProvider,
              model:             DEFAULT_CHAT_MODELS[v as AIProvider],
              embeddingProvider: PROVIDERS_WITHOUT_EMBEDDINGS.includes(v as AIProvider) ? prev.embeddingProvider : v as EmbeddingProvider,
              embeddingModel:    PROVIDERS_WITHOUT_EMBEDDINGS.includes(v as AIProvider) ? prev.embeddingModel : DEFAULT_EMBEDDING_MODELS[v as EmbeddingProvider] ?? prev.embeddingModel,
            }))}
          />

          {draft.provider !== 'ollama' && (
            <>
              <Label>API Key</Label>
              <input
                type="password"
                value={draft.apiKey ?? ''}
                onChange={e => setDraft(p => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-... or your provider key"
                style={inputStyle}
              />
            </>
          )}

          {draft.provider === 'ollama' && (
            <>
              <Label>Ollama Base URL</Label>
              <input
                value={draft.baseUrl ?? 'http://localhost:11434'}
                onChange={e => setDraft(p => ({ ...p, baseUrl: e.target.value }))}
                placeholder="http://localhost:11434"
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Ollama must be running locally. <a href="https://ollama.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Install Ollama →</a></p>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 2px' }}>
            <Label>Chat Model</Label>
            {draft.provider === 'ollama' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {ollamaFetching && <Loader2 size={11} color="var(--muted-foreground)" style={{ animation: 'spin 1s linear infinite' }} />}
                {ollamaFetchError && <span style={{ fontSize: 10, color: '#f87171' }}>Ollama unreachable</span>}
                {!ollamaFetching && ollamaModels.length > 0 && (
                  <span style={{ fontSize: 10, color: '#4ade80' }}>{ollamaModels.length} model{ollamaModels.length !== 1 ? 's' : ''} installed</span>
                )}
                <button type="button" onClick={() => fetchOllamaModels(draft.baseUrl ?? 'http://localhost:11434')} title="Refresh model list" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}>
                  <RefreshCw size={10} />
                </button>
              </div>
            )}
          </div>
          <ModelInput
            value={draft.model}
            suggestions={draft.provider === 'ollama' && ollamaModels.length > 0 ? ollamaModels : CHAT_MODEL_SUGGESTIONS[draft.provider]}
            onChange={v => setDraft(p => ({ ...p, model: v }))}
            placeholder={draft.provider === 'ollama' && ollamaModels.length > 0 ? `choose from ${ollamaModels.length} installed models` : `e.g. ${DEFAULT_CHAT_MODELS[draft.provider]}`}
          />
        </Section>

        <Section title={`Embedding Provider${needsEmbedConfig ? ' (required — your chat provider has no embedding API)' : ''}`}>
          {needsEmbedConfig && (
            <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', marginBottom: 12, fontSize: 12, color: '#fbbf24' }}>
              {PROVIDER_LABELS[draft.provider]} has no embedding API. Choose a separate provider for semantic search and RAG.
            </div>
          )}
          <Label>Embedding Provider</Label>
          <Select
            value={draft.embeddingProvider}
            options={(Object.keys(EMBEDDING_PROVIDER_LABELS) as EmbeddingProvider[]).map(p => ({ value: p, label: EMBEDDING_PROVIDER_LABELS[p] }))}
            onChange={v => setDraft(p => ({ ...p, embeddingProvider: v as EmbeddingProvider, embeddingModel: DEFAULT_EMBEDDING_MODELS[v as EmbeddingProvider] }))}
          />

          {draft.embeddingProvider !== 'ollama' && draft.embeddingProvider !== draft.provider && (
            <>
              <Label>Embedding API Key</Label>
              <input
                type="password"
                value={draft.embeddingApiKey ?? ''}
                onChange={e => setDraft(p => ({ ...p, embeddingApiKey: e.target.value }))}
                placeholder="API key for the embedding provider"
                style={inputStyle}
              />
            </>
          )}

          {draft.embeddingProvider === 'ollama' && (
            <>
              <Label>Ollama Embedding Base URL</Label>
              <input
                value={draft.embeddingBaseUrl ?? 'http://localhost:11434'}
                onChange={e => setDraft(p => ({ ...p, embeddingBaseUrl: e.target.value }))}
                placeholder="http://localhost:11434"
                style={inputStyle}
              />
            </>
          )}

          <Label>Embedding Model</Label>
          {draft.embeddingProvider === 'ollama' && ollamaModels.length > 0 && !ollamaModels.includes(draft.embeddingModel) && (
            <div style={{ padding: '6px 10px', borderRadius: 7, marginBottom: 4, fontSize: 11, color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>{draft.embeddingModel}</strong> is not in your Ollama installation. For embeddings, pull <code style={{ fontSize: 10 }}>nomic-embed-text</code> or pick an installed model below.</span>
            </div>
          )}
          <ModelInput
            value={draft.embeddingModel}
            suggestions={draft.embeddingProvider === 'ollama' && ollamaModels.length > 0 ? ollamaModels : EMBED_MODEL_SUGGESTIONS[draft.embeddingProvider]}
            onChange={v => setDraft(p => ({ ...p, embeddingModel: v }))}
            placeholder={`e.g. ${DEFAULT_EMBEDDING_MODELS[draft.embeddingProvider]}`}
          />
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
            Vector dimension: 768. Compatible with nomic-embed-text, text-embedding-3-small (dimensions: 768), text-embedding-004.
          </p>
        </Section>

        {/* Test + index */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={testConnection} disabled={testing} style={{ ...btnStyle, flex: 1 }}>
            {testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={13} />}
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" onClick={reindexAll} disabled={indexing} style={{ ...btnStyle, flex: 1 }}>
            {indexing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Database size={13} />}
            {indexing ? 'Indexing…' : 'Re-index all'}
          </button>
        </div>

        {testResult && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6,
            backgroundColor: testResult.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: testResult.ok ? '#4ade80' : '#f87171',
          }}>
            {testResult.ok ? <Check size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
            {testResult.message}
          </div>
        )}

        {indexResult && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
            {indexResult}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '6px 0 2px', fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{children}</p>
}

function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} />
    </div>
  )
}

function ModelInput({ value, suggestions, onChange, placeholder }: {
  value: string; suggestions: string[]; onChange: (v: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          {suggestions.map(s => (
            <button key={s} type="button" onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{ width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s} {value === s && <Check size={12} color="var(--primary)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  borderRadius: 8, border: '1px solid var(--border)',
  backgroundColor: 'var(--muted)', color: 'var(--foreground)',
  fontSize: 13, outline: 'none',
}

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '8px', borderRadius: 8, border: '1px solid var(--border)',
  backgroundColor: 'transparent', color: 'var(--foreground)',
  fontSize: 12, cursor: 'pointer', fontWeight: 500,
}
