'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Upload, FolderOpen, Loader2, CheckCircle2, AlertCircle, Undo2, FileText, Folder, Link2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { planMarkdownImport, type ImportPlan } from '@/lib/import/vault'
import { ImportError, makeImportTag, readVaultFiles, runImport, undoImport, type RunProgress } from '@/lib/import/run'

type Phase = 'idle' | 'reading' | 'preview' | 'importing' | 'done' | 'error'

const VISIBLE_ISSUES = 6

export function ImportCard() {
  const zipInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [extraIssues, setExtraIssues] = useState<string[]>([])
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [importTag, setImportTag] = useState('')
  const [result, setResult] = useState<{ created: number; linked: number } | null>(null)
  const [undone, setUndone] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showAllIssues, setShowAllIssues] = useState(false)

  function reset() {
    setPhase('idle'); setPlan(null); setProgress(null); setResult(null); setUndone(null)
    setError(''); setExtraIssues([]); setShowAllIssues(false)
    if (zipInput.current) zipInput.current.value = ''
    if (folderInput.current) folderInput.current.value = ''
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setPhase('reading'); setError('')
    try {
      const { files, oversized } = await readVaultFiles(Array.from(list))
      const next = planMarkdownImport(files)
      if (next.notes.length === 0) {
        setError('No Markdown (.md) notes were found in that selection.')
        setPhase('error')
        return
      }
      setExtraIssues(oversized ? [`${oversized} file(s) over 25 MB were skipped.`] : [])
      setPlan(next)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
      setPhase('error')
    }
  }

  async function handleImport() {
    if (!plan) return
    const tag = makeImportTag()
    setImportTag(tag)
    setPhase('importing'); setProgress(null); setError('')
    try {
      const res = await runImport(plan, tag, setProgress)
      setResult(res)
      setPhase('done')
      toast.success(`Imported ${res.created} notes`)
    } catch (e) {
      const saved = e instanceof ImportError ? e.savedNotes : 0
      setResult(saved ? { created: saved, linked: 0 } : null)
      setError(e instanceof Error ? e.message : 'Import failed.')
      setPhase('error')
    }
  }

  async function handleUndo() {
    try {
      setUndone(await undoImport(importTag))
      toast.success('Import moved to the trash')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not undo the import')
    }
  }

  const issues = [...(plan?.report.issues ?? []), ...extraIssues]
  const shownIssues = showAllIssues ? issues : issues.slice(0, VISIBLE_ISSUES)
  const busy = phase === 'reading' || phase === 'importing'
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Card style={{ maxWidth: 720 }}>
      <CardHeader>
        <CardTitle>Import notes</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          Bring notes in from a zip or a folder of Markdown files. Folders become notebooks, tags and
          dates are kept, and <code>[[wikilinks]]</code> between notes keep working.{' '}
          <a
            href="https://github.com/dotstell/dotstell/blob/main/docs/IMPORT.md"
            target="_blank" rel="noopener noreferrer"
            className="underline text-[var(--primary)]"
          >
            How to export from other apps
          </a>
        </p>
      </CardHeader>

      <CardContent>
        {(phase === 'idle' || phase === 'reading' || phase === 'error') && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => zipInput.current?.click()} disabled={busy} className="touch-target-sm">
              {phase === 'reading' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {phase === 'reading' ? 'Reading files…' : 'Choose a zip'}
            </Button>
            <Button variant="outline" onClick={() => folderInput.current?.click()} disabled={busy} className="touch-target-sm">
              <FolderOpen size={16} /> Choose a folder
            </Button>
            {phase === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--destructive)]" role="alert">
                <AlertCircle size={15} className="flex-shrink-0" /> {error}
              </span>
            )}
          </div>
        )}

        <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={e => handleFiles(e.target.files)} />
        {/* webkitdirectory is non-standard but supported by every current browser except mobile Safari. */}
        <input
          ref={folderInput} type="file" hidden multiple onChange={e => handleFiles(e.target.files)}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />

        {phase === 'preview' && plan && (
          <div className="flex flex-col gap-4">
            <ul className="grid gap-2 text-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <Stat icon={FileText} value={plan.report.notes} one="note" many="notes" />
              <Stat icon={Folder} value={plan.report.notebooks} one="notebook" many="notebooks" />
              <Stat icon={Link2} value={plan.report.links.resolved} one="link kept" many="links kept" />
              <Stat icon={ImageIcon} value={plan.report.images.embedded} one="image" many="images" />
            </ul>

            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Includes</p>
              <p className="text-sm text-[var(--foreground)]">
                {plan.notes.slice(0, 5).map(n => n.title || 'Untitled').join(' · ')}
                {plan.notes.length > 5 && ` · and ${plan.notes.length - 5} more`}
              </p>
            </div>

            {issues.length > 0 && (
              <div className="rounded-md border border-[var(--border)] p-3">
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Worth knowing</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {shownIssues.map(line => <li key={line} className="text-[var(--foreground)]">{line}</li>)}
                </ul>
                {issues.length > VISIBLE_ISSUES && (
                  <button type="button" onClick={() => setShowAllIssues(s => !s)} className="text-xs underline text-[var(--primary)] mt-2 hit-slop">
                    {showAllIssues ? 'Show less' : `Show all ${issues.length}`}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleImport} className="touch-target-sm">
                <Upload size={16} /> Import {plan.report.notes} {plan.report.notes === 1 ? 'note' : 'notes'}
              </Button>
              <Button variant="outline" onClick={reset} className="touch-target-sm">Cancel</Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Nothing is saved until you import, and the whole import can be undone afterwards.
            </p>
          </div>
        )}

        {phase === 'importing' && (
          <div aria-live="polite" className="flex flex-col gap-2">
            <p className="text-sm text-[var(--foreground)] inline-flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              {progress ? (progress.phase === 'notes' ? 'Saving notes' : 'Connecting notes') : 'Starting'}
              {progress && ` — ${progress.done} of ${progress.total}`}
            </p>
            <div
              role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
              className="h-1.5 w-full rounded-full bg-[var(--muted)] overflow-hidden"
            >
              <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Keep this page open until it finishes.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {undone === null ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                Imported {result.created} notes{result.linked > 0 && ` and ${result.linked} links`}.
              </p>
            ) : (
              <p className="text-sm text-[var(--foreground)]">
                Moved {undone} notes to the trash. You can restore them from the Notes page.
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {undone === null && (
                <Link href="/notes" className="inline-flex"><Button className="touch-target-sm">View notes</Button></Link>
              )}
              {undone === null && (
                <Button variant="outline" onClick={handleUndo} className="touch-target-sm"><Undo2 size={16} /> Undo import</Button>
              )}
              <Button variant="outline" onClick={reset} className="touch-target-sm">Import more</Button>
            </div>
          </div>
        )}

        {phase === 'error' && result && result.created > 0 && (
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <span className="text-sm text-[var(--muted-foreground)]">{result.created} notes were saved before the problem.</span>
            <Button variant="outline" onClick={handleUndo} className="touch-target-sm"><Undo2 size={16} /> Undo what was saved</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ icon: Icon, value, one, many }: { icon: typeof FileText; value: number; one: string; many: string }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2">
      <Icon size={15} className="text-[var(--muted-foreground)] flex-shrink-0" />
      <span><strong>{value}</strong> <span className="text-[var(--muted-foreground)]">{value === 1 ? one : many}</span></span>
    </li>
  )
}
