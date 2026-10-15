'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Upload, FolderOpen, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Info, Undo2, FileText, Folder, Link2, Image as ImageIcon, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { planImport } from '@/lib/import/plan'
import type { ImportPlan } from '@/lib/import/vault'
import { ImportError, fromDataTransfer, fromFileList, makeImportTag, readVaultFiles, runImport, undoImport, type InputFile, type RunProgress } from '@/lib/import/run'

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
  const [result, setResult] = useState<{ created: number; linked: number; contacts: number; skippedContacts: number } | null>(null)
  const [undone, setUndone] = useState<{ trashed: number; removedPeople: number } | null>(null)
  const [includeContacts, setIncludeContacts] = useState(true)
  const [error, setError] = useState('')
  const [showAllIssues, setShowAllIssues] = useState(false)
  const [dragging, setDragging] = useState(false)

  function reset() {
    setPhase('idle'); setPlan(null); setProgress(null); setResult(null); setUndone(null)
    setError(''); setExtraIssues([]); setShowAllIssues(false); setIncludeContacts(true)
    if (zipInput.current) zipInput.current.value = ''
    if (folderInput.current) folderInput.current.value = ''
  }

  async function handleFiles(input: InputFile[]) {
    if (input.length === 0) return
    setPhase('reading'); setError('')
    try {
      const { files, oversized } = await readVaultFiles(input)
      const next = planImport(files)
      if (next.notes.length === 0 && next.contacts.length === 0) {
        setError(['Nothing to import was found in that selection: no Markdown, Evernote, Google Keep or contacts files.', ...next.report.warnings].join(' '))
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
      const res = await runImport(plan, tag, setProgress, includeContacts)
      setResult(res)
      setPhase('done')
      toast.success(summarise(res.created, res.contacts))
    } catch (e) {
      const saved = e instanceof ImportError ? e.savedNotes : 0
      setResult(saved ? { created: saved, linked: 0, contacts: 0, skippedContacts: 0 } : null)
      setError(e instanceof Error ? e.message : 'Import failed.')
      setPhase('error')
    }
  }

  async function handleUndo() {
    try {
      setUndone(await undoImport(importTag))
      toast.success('Import undone')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not undo the import')
    }
  }

  const issues = [...(plan?.report.issues ?? []), ...extraIssues]
  const shownIssues = showAllIssues ? issues : issues.slice(0, VISIBLE_ISSUES)
  const busy = phase === 'reading' || phase === 'importing'
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const savedAnything = !!result && (result.created > 0 || result.contacts > 0)
  const canDrop = phase === 'idle' || phase === 'error'
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    if (!canDrop) return
    handleFiles(await fromDataTransfer(e.dataTransfer))
  }

  return (
    <Card
      className="h-full"
      onDragOver={e => { e.preventDefault(); if (canDrop) setDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={handleDrop}
    >
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          Bring in Markdown notes (Obsidian, Notion, Bear …), Evernote (<code>.enex</code>), Google Keep
          (Takeout) and contacts (<code>.vcf</code>, <code>.csv</code>). Notebooks, tags, dates and links are kept.{' '}
          <a
            href="https://github.com/dotstell/dotstell/blob/main/docs/IMPORT.md"
            target="_blank" rel="noopener noreferrer"
            className="underline text-[var(--primary)]"
          >
            How to export from each app
          </a>
        </p>
      </CardHeader>

      <CardContent>
        {(phase === 'idle' || phase === 'reading' || phase === 'error') && (
          <div
            className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors"
            style={{
              borderColor: dragging ? 'var(--primary)' : 'var(--border)',
              background: dragging ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)]">
              {phase === 'reading'
                ? <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
                : <Upload size={20} className="text-[var(--primary)]" />}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {phase === 'reading' ? 'Reading your files…' : dragging ? 'Drop to preview' : 'Drop files, a zip or a folder here'}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">or choose one below. You will see a preview before anything is saved.</p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={() => zipInput.current?.click()} disabled={busy} className="touch-target-sm">
                <Upload size={16} /> Choose files
              </Button>
              <Button variant="outline" onClick={() => folderInput.current?.click()} disabled={busy} className="touch-target-sm">
                <FolderOpen size={16} /> Choose a folder
              </Button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
              Your browser asks you to confirm before sharing a folder. Files are read on your device;
              only the cleaned-up notes are saved to your account.
            </p>
            {phase === 'error' && (
              <span className="inline-flex items-start gap-1.5 text-sm text-[var(--destructive)] text-left" role="alert">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
              </span>
            )}
          </div>
        )}

        <input ref={zipInput} type="file" multiple accept=".zip,.enex,.vcf,.csv,.md,.json" hidden onChange={e => e.target.files && handleFiles(fromFileList(e.target.files))} />
        {/* webkitdirectory is non-standard but supported by every current browser except mobile Safari. */}
        <input
          ref={folderInput} type="file" hidden multiple onChange={e => e.target.files && handleFiles(fromFileList(e.target.files))}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />

        {phase === 'preview' && plan && (
          <div className="flex flex-col gap-4">
            <ul className="grid gap-2 text-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {plan.report.notes > 0 && <Stat icon={FileText} value={plan.report.notes} one="note" many="notes" />}
              {plan.report.notebooks > 0 && <Stat icon={Folder} value={plan.report.notebooks} one="notebook" many="notebooks" />}
              {plan.report.links.resolved > 0 && <Stat icon={Link2} value={plan.report.links.resolved} one="link kept" many="links kept" />}
              {plan.report.images.embedded > 0 && <Stat icon={ImageIcon} value={plan.report.images.embedded} one="image" many="images" />}
              {plan.report.contacts > 0 && <Stat icon={Users} value={plan.report.contacts} one="contact" many="contacts" />}
            </ul>

            {plan.notes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Includes</p>
                <p className="text-sm text-[var(--foreground)]">
                  {plan.notes.slice(0, 5).map(n => n.title || 'Untitled').join(' · ')}
                  {plan.notes.length > 5 && ` · and ${plan.notes.length - 5} more`}
                </p>
              </div>
            )}

            {plan.contacts.length > 0 && plan.notes.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                <input type="checkbox" checked={includeContacts} onChange={e => setIncludeContacts(e.target.checked)} />
                Also add the {plan.contacts.length} {plan.contacts.length === 1 ? 'contact' : 'contacts'} to People
              </label>
            )}

            {plan.report.warnings.length > 0 && (
              <div role="alert" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-[var(--foreground)] mb-1.5 inline-flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" /> Refused for your safety
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {plan.report.warnings.map(line => <li key={line} className="text-[var(--foreground)]">{line}</li>)}
                </ul>
                <p className="text-xs text-[var(--muted-foreground)] mt-2">These files were not opened or saved. The rest can still be imported.</p>
              </div>
            )}

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
                <Upload size={16} /> Import {summarise(plan.report.notes, includeContacts || plan.notes.length === 0 ? plan.report.contacts : 0, false)}
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
              {progress ? (progress.phase === 'notes' ? 'Saving notes' : progress.phase === 'links' ? 'Connecting notes' : 'Adding contacts') : 'Starting'}
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
              <div className="flex flex-col gap-1">
                <p className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                  {savedAnything
                    ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                    : <Info size={15} className="text-[var(--muted-foreground)] flex-shrink-0" />}
                  {savedAnything
                    ? <>{summarise(result.created, result.contacts, true)}{result.linked > 0 && `, with ${result.linked} links`}.</>
                    : 'Nothing new was added.'}
                </p>
                {result.skippedContacts > 0 && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {result.skippedContacts} {result.skippedContacts === 1 ? 'contact was' : 'contacts were'} already in People
                    (same email or name) and {result.skippedContacts === 1 ? 'was' : 'were'} skipped.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--foreground)]">
                {undone.trashed > 0 && `Moved ${undone.trashed} notes to the trash; you can restore them from the Notes page.`}{undone.trashed > 0 && undone.removedPeople > 0 && ' '}{undone.removedPeople > 0 && `Removed ${undone.removedPeople} imported contacts.`}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {undone === null && result.created > 0 && (
                <Link href="/notes" className="inline-flex"><Button className="touch-target-sm">View notes</Button></Link>
              )}
              {undone === null && result.contacts > 0 && (
                <Link href="/people" className="inline-flex">
                  <Button variant={result.created > 0 ? 'outline' : 'default'} className="touch-target-sm">View people</Button>
                </Link>
              )}
              {undone === null && savedAnything && (
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

/** "3 notes and 2 contacts"; with `past`, "Imported 3 notes and 2 contacts". */
function summarise(notes: number, contacts: number, past = true): string {
  const parts = [
    notes > 0 ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : '',
    contacts > 0 ? `${contacts} ${contacts === 1 ? 'contact' : 'contacts'}` : '',
  ].filter(Boolean)
  return `${past ? 'Imported ' : ''}${parts.join(' and ') || 'nothing'}`
}

function Stat({ icon: Icon, value, one, many }: { icon: typeof FileText; value: number; one: string; many: string }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2">
      <Icon size={15} className="text-[var(--muted-foreground)] flex-shrink-0" />
      <span><strong>{value}</strong> <span className="text-[var(--muted-foreground)]">{value === 1 ? one : many}</span></span>
    </li>
  )
}
