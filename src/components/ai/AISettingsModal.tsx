'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  X, Sparkles, ChevronDown, Check, AlertCircle, Loader2,
  Wifi, Database, RefreshCw, MessageSquareText, Search, Wand2,
  HelpCircle, ChevronRight,
} from 'lucide-react'
import {
  AIConfig, AIProvider, EmbeddingProvider,
  PROVIDER_LABELS, EMBEDDING_PROVIDER_LABELS,
  DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS,
  PROVIDERS_WITHOUT_EMBEDDINGS,
} from '@/lib/ai/types'
import { useAISettings } from '@/hooks/useAISettings'
import { fetchOllamaModelsBrowser, completeOllamaBrowser, checkLocalAgent, LOCAL_AGENT_BASE, isLocalHostname } from '@/lib/ai/ollama-browser'

interface AISettingsModalProps {
  onClose: () => void
}

// What each provider needs from the user
const PROVIDER_NOTES: Record<AIProvider, string> = {
  ollama:    'Free & private — runs entirely on your machine. No API key needed.',
  openai:    'Requires an OpenAI account and API key. Usage is billed per request.',
  anthropic: 'Requires an Anthropic account and API key. Usage is billed per request.',
  gemini:    'Requires a Google AI Studio API key. Has a generous free tier.',
  groq:      'Requires a Groq account. Very fast inference, generous free tier.',
}

const FALLBACK_OLLAMA_CHAT_MODELS  = ['llama3.2', 'phi4-mini', 'qwen2.5:7b', 'gemma2:9b', 'llama3.1', 'mistral', 'phi3', 'gemma2', 'qwen2.5']
const FALLBACK_OLLAMA_EMBED_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm']

// First entry in each list is the recommended model for dotstell's use case
const CHAT_MODEL_SUGGESTIONS: Record<AIProvider, string[]> = {
  ollama:    FALLBACK_OLLAMA_CHAT_MODELS,
  openai:    ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5'],
  gemini:    ['gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-2.0-flash-lite-001', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash-8b'],
  groq:      ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
}

// Short guidance shown below the model picker for each provider.
// Kept generic — no specific model names — so it stays accurate as providers release new models.
const MODEL_HINTS: Record<AIProvider, string> = {
  ollama:    'Models at 7B or below work well for all features. Larger models are slow without a dedicated GPU.',
  openai:    'Mini or Turbo variants are recommended — fast, low cost, and ideal for summarisation and tagging.',
  anthropic: 'Haiku is the fastest and most affordable tier — ideal for summarisation and tagging.',
  gemini:    'Flash or Lite models are recommended — fast, free-tier friendly, and ideal for summarisation and tagging.',
  groq:      'Instant or small models are recommended — Groq\'s free tier is generous and inference is extremely fast.',
}

// Models flagged as too heavy for typical use without a GPU
const HEAVY_MODEL_PATTERN = /\b(70b|72b|405b|671b|110b|34b|32b)\b/i

const EMBED_MODEL_SUGGESTIONS: Record<EmbeddingProvider, string[]> = {
  ollama: FALLBACK_OLLAMA_EMBED_MODELS,
  openai: ['text-embedding-3-small', 'text-embedding-3-large'],
  gemini: ['gemini-embedding-001', 'text-embedding-004', 'embedding-001'],
}

// Providers that have NO embedding API — user must choose a separate one
const EMBED_PROVIDER_WHY_NOT: Partial<Record<AIProvider, string>> = {
  anthropic: 'Anthropic doesn\'t offer an embedding API yet.',
  groq:      'Groq doesn\'t offer an embedding API.',
}

export function AISettingsModal({ onClose }: AISettingsModalProps) {
  const { config, saveConfig, loaded } = useAISettings()
  const [draft,        setDraft]        = useState<AIConfig>(config)

  // useAISettings reads localStorage in a useEffect (async), so `config` starts as
  // DEFAULT_AI_CONFIG on first render. Sync draft once the hook has loaded the real value.
  useEffect(() => { if (loaded) setDraft(config) }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps
  const [saved,        setSaved]         = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [testResult,   setTestResult]   = useState<{ ok: boolean; message: string } | null>(null)
  const [indexing,     setIndexing]     = useState(false)
  const [indexResult,  setIndexResult]  = useState<{ ok: boolean; message: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Live Ollama model list — fetched directly from the browser (Ollama runs on the user's machine)
  const [ollamaModels,   setOllamaModels]   = useState<Array<{ name: string; capabilities: string[] }>>([])
  const [ollamaFetching, setOllamaFetching] = useState(false)
  const [ollamaError,    setOllamaError]    = useState<string | null>(null)

  // Local Agent status — only relevant on the live app (not on localhost)
  const [agentRunning,  setAgentRunning]  = useState<boolean | null>(null)
  useEffect(() => {
    if (draft.provider !== 'ollama' || isLocalHostname()) return
    checkLocalAgent().then(setAgentRunning)
  }, [draft.provider])

  const fetchOllamaModels = useCallback(async (baseUrl: string) => {
    setOllamaFetching(true)
    setOllamaError(null)
    try {
      const resolvedUrl = baseUrl || 'http://localhost:11434'
      let models: Array<{ name: string; capabilities: string[] }>
      if (isLocalHostname()) {
        // On localhost the corporate proxy can block direct browser→Ollama requests.
        // Route through the Next.js dev server instead (server→Ollama, same machine).
        const params = new URLSearchParams({ baseUrl: resolvedUrl })
        const res    = await fetch(`/api/ai/ollama-models?${params}`)
        const data   = await res.json()
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        models = data.models ?? []
      } else {
        // On the live app the Next.js server (Vercel) cannot reach the user's machine.
        // Call Ollama directly from the browser — requires OLLAMA_ORIGINS=* on the user's Ollama.
        models = await fetchOllamaModelsBrowser(resolvedUrl)
      }
      setOllamaModels(models)
      // Auto-select the best available chat model if the current one isn't installed
      setDraft(prev => {
        if (prev.provider !== 'ollama') return prev
        const names = models.map(m => m.name)
        if (names.length > 0 && !names.includes(prev.model)) {
          const best = models.find(m => m.capabilities.includes('completion'))?.name ?? names[0]
          return { ...prev, model: best }
        }
        return prev
      })
    } catch (err) {
      setOllamaError(err instanceof Error ? err.message : 'Cannot reach Ollama')
      setOllamaModels([])
    } finally {
      setOllamaFetching(false)
    }
  }, [])

  // Live model list for cloud providers (OpenAI, Anthropic, Groq, Gemini)
  const [cloudModels,      setCloudModels]      = useState<string[]>([])
  const [cloudEmbedModels, setCloudEmbedModels] = useState<string[]>([])
  const [cloudFetching,    setCloudFetching]    = useState(false)

  const CLOUD_PROVIDERS = ['openai', 'anthropic', 'groq', 'gemini'] as const

  const fetchCloudModels = useCallback(async (provider: string, apiKey: string) => {
    if (!apiKey) { setCloudModels([]); setCloudEmbedModels([]); return }
    setCloudFetching(true)
    try {
      const endpoint = provider === 'gemini' ? '/api/ai/gemini-models' : '/api/ai/cloud-models'
      const payload  = provider === 'gemini' ? { apiKey } : { provider, apiKey }
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const models: string[]      = data.models      ?? []
      const embedModels: string[] = data.embedModels ?? []
      setCloudModels(models)
      setCloudEmbedModels(embedModels)
      setDraft(prev => {
        let next = prev
        // Auto-select first live chat model if current isn't in the list
        if (prev.provider === provider && models.length > 0 && !models.includes(prev.model)) {
          next = { ...next, model: models[0] }
        }
        // Auto-select first live embedding model for Gemini if current isn't in the list
        if (provider === 'gemini' && prev.embeddingProvider === 'gemini' && embedModels.length > 0 && !embedModels.includes(prev.embeddingModel)) {
          next = { ...next, embeddingModel: embedModels[0] }
        }
        return next
      })
    } catch {
      setCloudModels([])
      setCloudEmbedModels([])
    } finally {
      setCloudFetching(false)
    }
  }, [])

  // Also fetch Gemini embedding models when embedding provider is Gemini but chat is not Gemini
  const fetchGeminiEmbedModels = useCallback(async (apiKey: string) => {
    if (!apiKey) { setCloudEmbedModels([]); return }
    try {
      const res  = await fetch('/api/ai/gemini-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) })
      const data = await res.json()
      if (!res.ok) return
      const embedModels: string[] = data.embedModels ?? []
      setCloudEmbedModels(embedModels)
      if (embedModels.length > 0) {
        setDraft(prev => {
          if (prev.embeddingProvider !== 'gemini') return prev
          if (embedModels.includes(prev.embeddingModel)) return prev
          return { ...prev, embeddingModel: embedModels[0] }
        })
      }
    } catch { /* fall back to static suggestions */ }
  }, [])

  useEffect(() => {
    if (draft.provider === 'ollama' || draft.embeddingProvider === 'ollama') {
      fetchOllamaModels(draft.baseUrl ?? 'http://localhost:11434')
    }
  }, [draft.provider, draft.embeddingProvider, draft.baseUrl, fetchOllamaModels])

  useEffect(() => {
    if ((CLOUD_PROVIDERS as readonly string[]).includes(draft.provider) && draft.apiKey) {
      fetchCloudModels(draft.provider, draft.apiKey)
    } else {
      setCloudModels([])
      // Fetch Gemini embed models separately when chat provider is not Gemini
      if (draft.embeddingProvider === 'gemini' && draft.embeddingApiKey) {
        fetchGeminiEmbedModels(draft.embeddingApiKey)
      }
    }
  }, [draft.provider, draft.apiKey, draft.embeddingProvider, draft.embeddingApiKey, fetchCloudModels, fetchGeminiEmbedModels])

  useEffect(() => { setTestResult(null) }, [draft.provider, draft.apiKey, draft.model, draft.baseUrl])

  // Ollama returns model names with `:latest` tag (e.g. "nomic-embed-text:latest")
  // but users typically save them without the tag. Normalise for comparison.
  const normalizeModel = (m: string) => m.replace(/:latest$/, '')

  const needsSeparateEmbedProvider = PROVIDERS_WITHOUT_EMBEDDINGS.includes(draft.provider)
  const ollamaNames = ollamaModels.map(m => m.name)
  // Merge static suggestions + live cloud models so the recommended model always appears
  // even when the provider's API doesn't list it (e.g. Gemini omits gemini-2.0-flash-lite).
  const chatModels  = draft.provider === 'ollama' && ollamaNames.length > 0
    ? ollamaNames
    : cloudModels.length > 0
    ? [
        ...CHAT_MODEL_SUGGESTIONS[draft.provider].filter(s => !cloudModels.includes(s)),
        ...cloudModels,
      ]
    : CHAT_MODEL_SUGGESTIONS[draft.provider]
  const embedModels = draft.embeddingProvider === 'ollama' && ollamaNames.length > 0
    ? ollamaNames
    : draft.embeddingProvider === 'gemini' && cloudEmbedModels.length > 0
    ? cloudEmbedModels
    : EMBED_MODEL_SUGGESTIONS[draft.embeddingProvider]

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      if (draft.provider === 'ollama' && !isLocalHostname()) {
        // On the live app: route through Local Agent (adds PNA header), or direct browser call
        const running = await checkLocalAgent()
        setAgentRunning(running)
        await completeOllamaBrowser(draft, [{ role: 'user', content: 'Reply with exactly: OK' }])
        setTestResult({ ok: true, message: running ? 'AI is ready — Ollama replied via Local Agent' : 'AI is ready — Ollama replied successfully' })
      } else {
        const res = await fetch('/api/ai/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ config: draft, messages: [{ role: 'user', content: 'Reply with exactly: OK' }] }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Connection failed' }))
          setTestResult({ ok: false, message: err.error ?? 'Connection failed' })
          return
        }
        const reader  = res.body!.getReader()
        const decoder = new TextDecoder()
        let   reply   = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of decoder.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue
            try { const c = JSON.parse(line.slice(6)); reply += c.delta ?? ''; if (c.done) break } catch {}
          }
        }
        void reply
        setTestResult({ ok: true, message: `AI is ready — ${PROVIDER_LABELS[draft.provider]} replied successfully` })
      }
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function buildSearchIndex() {
    setIndexing(true)
    setIndexResult(null)
    try {
      const res  = await fetch('/api/ai/embed', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config: draft }),
      })
      const data = await res.json()
      if (!res.ok) { setIndexResult({ ok: false, message: data.error ?? 'Indexing failed' }); return }
      const msg = data.total === 0
        ? 'All notes are already indexed — nothing to do'
        : `Done: indexed ${data.succeeded} of ${data.total} notes${data.failed > 0 ? ` (${data.failed} failed${data.firstError ? `: ${data.firstError}` : ''})` : ''}`
      setIndexResult({ ok: true, message: msg })
    } catch (err) {
      setIndexResult({ ok: false, message: err instanceof Error ? err.message : 'Indexing failed' })
    } finally {
      setIndexing(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="var(--primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>AI Settings</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>API keys are stored only in your browser — never sent to any server</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={iconBtn}><X size={15} /></button>
        </div>

        {/* ── What AI does in dotstell ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 20 }}>
          {[
            { icon: <MessageSquareText size={13} color="var(--primary)" />, label: 'Chat',    desc: 'Ask questions about your notes' },
            { icon: <Wand2            size={13} color="var(--primary)" />, label: 'Assist',  desc: 'Rewrite, expand, fix, outline text' },
            { icon: <Search           size={13} color="var(--primary)" />, label: 'Search',  desc: 'Find notes by meaning, not just keywords' },
          ].map(f => (
            <div key={f.label} style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {f.icon}
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{f.label}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{f.desc}</span>
            </div>
          ))}
        </div>

        {/* ── Step 1: AI Model ── */}
        <SectionHeader step={1} title="Choose your AI model" subtitle="Used for Chat, Assist, and all text generation" />

        <Field label="Provider">
          <Select
            value={draft.provider}
            options={(Object.keys(PROVIDER_LABELS) as AIProvider[]).map(p => ({ value: p, label: PROVIDER_LABELS[p] }))}
            onChange={v => setDraft(prev => ({
              ...prev,
              provider:          v as AIProvider,
              model:             DEFAULT_CHAT_MODELS[v as AIProvider],
              // Clear Ollama-specific baseUrl when switching to a cloud provider so
              // openaiStream doesn't accidentally hit localhost:11434
              baseUrl:           (v as AIProvider) === 'ollama' ? prev.baseUrl : undefined,
              embeddingProvider: PROVIDERS_WITHOUT_EMBEDDINGS.includes(v as AIProvider) ? prev.embeddingProvider : v as EmbeddingProvider,
              embeddingModel:    PROVIDERS_WITHOUT_EMBEDDINGS.includes(v as AIProvider) ? prev.embeddingModel : DEFAULT_EMBEDDING_MODELS[v as EmbeddingProvider] ?? prev.embeddingModel,
            }))}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{PROVIDER_NOTES[draft.provider]}</p>
        </Field>

        {draft.provider === 'ollama' ? (
          <Field label="Ollama URL">
            <input
              value={draft.baseUrl ?? 'http://localhost:11434'}
              onChange={e => setDraft(p => ({ ...p, baseUrl: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        ) : (
          <Field label="API Key">
            <input
              type="password"
              value={draft.apiKey ?? ''}
              onChange={e => setDraft(p => ({ ...p, apiKey: e.target.value }))}
              placeholder="Paste your API key here"
              style={inputStyle}
            />
          </Field>
        )}

        <Field
          label="Model"
          aside={draft.provider === 'ollama' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              {ollamaFetching
                ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} color="var(--muted-foreground)" /> detecting…</>
                : ollamaError
                ? <span style={{ color: '#f87171' }}>
                    {ollamaError.includes('CORS') ? 'CORS not configured — see below'
                      : ollamaError.includes('Private Network') ? 'Browser security blocks Ollama — see below'
                      : 'Ollama not found — is it running?'}
                  </span>
                : <span style={{ color: '#4ade80' }}>{ollamaModels.length} model{ollamaModels.length !== 1 ? 's' : ''} installed</span>
              }
              <button type="button" onClick={() => fetchOllamaModels(draft.baseUrl ?? 'http://localhost:11434')} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 1, display: 'flex' }}>
                <RefreshCw size={9} />
              </button>
            </span>
          ) : draft.apiKey ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted-foreground)' }}>
              {cloudFetching
                ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> fetching models…</>
                : cloudModels.length > 0
                ? <span style={{ color: '#4ade80' }}>{cloudModels.length} models available</span>
                : null
              }
              <button type="button" onClick={() => fetchCloudModels(draft.provider, draft.apiKey ?? '')} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 1, display: 'flex' }}>
                <RefreshCw size={9} />
              </button>
            </span>
          ) : undefined}
        >
          <ModelInput
            value={draft.model}
            suggestions={chatModels}
            recommendedModel={CHAT_MODEL_SUGGESTIONS[draft.provider][0]}
            onChange={v => setDraft(p => ({ ...p, model: v }))}
          />
          {/* Per-provider model guidance */}
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            💡 {MODEL_HINTS[draft.provider]}
          </p>
          {/* Heavy model warning — shown when user picks a known large model */}
          {HEAVY_MODEL_PATTERN.test(draft.model) && (
            <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 7, backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, color: '#fbbf24', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
              Large model detected — this will be slow without a powerful dedicated GPU. Consider a 7B model for a better experience.
            </div>
          )}
          {/* CORS notice — shown when Ollama is running but browser access isn't enabled */}
          {draft.provider === 'ollama' && ollamaError?.includes('CORS') && (
            <Notice type="warning" style={{ marginTop: 6 }}>
              {ollamaError}
            </Notice>
          )}
          {/* Local Agent status — only shown on the live app when Ollama is selected */}
          {draft.provider === 'ollama' && !isLocalHostname() && agentRunning === false && (
            <Notice type="warning" style={{ marginTop: 6 }}>
              Dotstell Local Agent not found on port 12345. Browser security (Private Network Access) blocks direct Ollama connections from dotstell.app.
              Start the agent to fix this:{' '}
              <code style={{ fontSize: 10, backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 3 }}>
                node packages/agent/index.mjs
              </code>
              |||http://127.0.0.1:12345/health|||Check agent health ↗
            </Notice>
          )}
          {draft.provider === 'ollama' && !isLocalHostname() && agentRunning === true && (
            <Notice type="success" style={{ marginTop: 6 }}>
              Dotstell Local Agent is running — Ollama connections are bridged correctly.
            </Notice>
          )}
        </Field>

        {/* ── Step 2: Semantic Search ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <SectionHeader step={2} title="Enable semantic search" subtitle="Powers Related Notes, AI Chat context, and search-by-meaning" />

          {needsSeparateEmbedProvider && (
            <Notice type="warning">
              {EMBED_PROVIDER_WHY_NOT[draft.provider]} Choose a separate provider below to enable semantic search — this is only needed for indexing, so a free-tier account works fine.
            </Notice>
          )}

          <Field label="Search engine provider">
            <Select
              value={draft.embeddingProvider}
              options={(Object.keys(EMBEDDING_PROVIDER_LABELS) as EmbeddingProvider[]).map(p => ({ value: p, label: EMBEDDING_PROVIDER_LABELS[p] }))}
              onChange={v => setDraft(p => ({ ...p, embeddingProvider: v as EmbeddingProvider, embeddingModel: DEFAULT_EMBEDDING_MODELS[v as EmbeddingProvider] }))}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
              Only Ollama, OpenAI, and Google Gemini offer embedding APIs — Anthropic and Groq don&apos;t provide them yet.
            </p>
          </Field>

          {draft.embeddingProvider !== 'ollama' && draft.embeddingProvider !== draft.provider && (
            <Field label="Search engine API Key">
              <input
                type="password"
                value={draft.embeddingApiKey ?? ''}
                onChange={e => setDraft(p => ({ ...p, embeddingApiKey: e.target.value }))}
                placeholder={`API key for ${PROVIDER_LABELS[draft.embeddingProvider as AIProvider] ?? draft.embeddingProvider}`}
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                This is separate from your chat API key — paste your {PROVIDER_LABELS[draft.embeddingProvider as AIProvider] ?? draft.embeddingProvider} key here.
              </p>
            </Field>
          )}

          <Field label="Embedding model">
            {draft.embeddingProvider === 'ollama' && ollamaNames.length > 0 && !ollamaNames.some(m => normalizeModel(m) === normalizeModel(draft.embeddingModel)) && (
              <Notice type="warning" style={{ marginBottom: 6 }}>
                <strong>{draft.embeddingModel}</strong> isn&apos;t installed. Run <code style={{ fontSize: 10, backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 3 }}>ollama pull nomic-embed-text</code> or pick an installed model below.
              </Notice>
            )}
            <ModelInput value={draft.embeddingModel} suggestions={embedModels} onChange={v => setDraft(p => ({ ...p, embeddingModel: v }))} />
          </Field>
        </div>

        {/* ── Step 3: Build search index ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <SectionHeader step={3} title="Build the search index" subtitle="One-time step — converts your notes into a searchable format" />
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5 }}>
            Click <strong>Build index</strong>{' '}after saving. dotstell will read each of your notes and create a compact numerical fingerprint (an &quot;embedding&quot;) that lets the AI find related notes by meaning. This runs once; new notes are indexed automatically as you write them.
          </p>
          <button
            type="button"
            onClick={buildSearchIndex}
            disabled={indexing}
            style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', fontSize: 12, cursor: indexing ? 'default' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {indexing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Indexing your notes…</> : <><Database size={13} /> Build search index</>}
          </button>
          {indexResult && (
            <Notice type={indexResult.ok ? 'success' : 'error'} style={{ marginTop: 8 }}>
              {indexResult.message}
            </Notice>
          )}
        </div>

        {/* ── Advanced (collapsible) ── */}
        {draft.provider === 'ollama' && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <button type="button" onClick={() => setShowAdvanced(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: 0, width: '100%' }}>
              <ChevronRight size={11} style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
              Advanced — separate Ollama URL for embeddings
            </button>
            {showAdvanced && (
              <Field label="Embedding Ollama URL" style={{ marginTop: 8 }}>
                <input
                  value={draft.embeddingBaseUrl ?? draft.baseUrl ?? 'http://localhost:11434'}
                  onChange={e => setDraft(p => ({ ...p, embeddingBaseUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                  style={inputStyle}
                />
              </Field>
            )}
          </div>
        )}

        {/* ── Test connection ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: testing ? 'default' : 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {testing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</> : <><Wifi size={13} /> Test connection</>}
          </button>
          {testResult && (
            <Notice type={testResult.ok ? 'success' : 'error'} style={{ marginTop: 8 }}>
              {testResult.message}
            </Notice>
          )}
        </div>

        {/* ── Save / Cancel ── */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saved}
            onClick={() => {
              saveConfig(draft)
              setSaved(true)
              setTimeout(onClose, 900)
            }}
            style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', backgroundColor: saved ? '#22c55e' : 'var(--primary)', color: 'white', fontSize: 13, cursor: saved ? 'default' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background-color 0.2s' }}
          >
            {saved ? <><Check size={14} /> Saved!</> : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {step}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, children, aside, style }: { label: string; children: React.ReactNode; aside?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{label}</p>
        {aside}
      </div>
      {children}
    </div>
  )
}

function Notice({ type, children, style }: { type: 'success' | 'error' | 'warning'; children: React.ReactNode; style?: React.CSSProperties }) {
  const colors = {
    success: { bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.3)',   text: '#4ade80' },
    error:   { bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.3)',  text: '#f87171' },
    warning: { bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.3)',   text: '#fbbf24' },
  }
  const c    = colors[type]
  const Icon = type === 'success' ? Check : AlertCircle

  // Parse "message|||url|||link label" format emitted by providerError()
  let message:   React.ReactNode = children
  let helpUrl:   string | null   = null
  let helpLabel: string | null   = null
  if (typeof children === 'string' && children.includes('|||')) {
    const parts = children.split('|||')
    message   = parts[0]
    helpUrl   = parts[1] ?? null
    helpLabel = parts[2] ?? null
  }

  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, fontSize: 11, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6, backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, ...style }}>
      <Icon size={12} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        {message}
        {helpUrl && helpLabel && (
          <a href={helpUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 4, fontSize: 10, fontWeight: 600, color: c.text, textDecoration: 'underline', opacity: 0.9 }}>
            {helpLabel} ↗
          </a>
        )}
      </span>
    </div>
  )
}

function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} />
    </div>
  )
}

function ModelInput({ value, suggestions, recommendedModel, onChange }: { value: string; suggestions: string[]; recommendedModel?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={inputStyle}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
          {suggestions.map(s => (
            <button key={s} type="button" onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{ width: '100%', padding: '7px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {recommendedModel === s && value !== s && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', padding: '1px 5px', borderRadius: 99 }}>
                    Recommended
                  </span>
                )}
                {value === s && <Check size={11} color="var(--primary)" />}
              </span>
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

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted-foreground)', padding: 4, borderRadius: 6, display: 'flex',
}
