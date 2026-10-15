'use client'
import { useState } from 'react'
import { Download, FileText, Users, CheckSquare, Bookmark, Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { createExportArchive, downloadBlob, type ExportProgress, type ExportSummary } from '@/lib/export'

const STAGE_LABEL: Record<ExportProgress['entity'], string> = {
  notebooks: 'notebooks', notes: 'notes', people: 'people', tasks: 'tasks', bookmarks: 'bookmarks', links: 'links',
}

const INCLUDED = [
  { icon: FileText,    text: 'Notes as Markdown files, one per note, with notebooks as folders and wikilinks preserved' },
  { icon: Users,       text: 'People, each with the notes and tasks linked to them' },
  { icon: CheckSquare, text: 'Tasks as a checklist and as a spreadsheet (CSV)' },
  { icon: Bookmark,    text: 'Bookmarks as a list and as a file any browser can import' },
  { icon: Database,    text: 'A full backup file (JSON) that keeps everything exactly as it is in dotstell, including colours and fonts' },
]

type Phase = 'idle' | 'working' | 'done' | 'error'

export default function SettingsPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [summary, setSummary] = useState<ExportSummary | null>(null)
  const [error, setError] = useState('')

  async function handleExport() {
    setPhase('working')
    setProgress(null)
    setError('')
    try {
      const { blob, fileName, summary } = await createExportArchive(setProgress)
      downloadBlob(blob, fileName)
      setSummary(summary)
      setPhase('done')
      toast.success('Export ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while exporting.')
      setPhase('error')
    }
  }

  const working = phase === 'working'

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Import & Export" description="Take your data with you" />

        <Card style={{ maxWidth: 720 }}>
          <CardHeader>
            <CardTitle>Export your data</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Your notes are yours. Download everything as a single zip of plain files (Markdown, CSV and
              JSON) that open in any notes app or text editor, or keep it as a backup.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 mb-5">
              {INCLUDED.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-[var(--foreground)]">
                  <Icon size={15} className="mt-0.5 flex-shrink-0 text-[var(--muted-foreground)]" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleExport} disabled={working} className="touch-target-sm">
                {working ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {working ? 'Preparing export…' : phase === 'done' ? 'Export again' : 'Export everything'}
              </Button>

              <div aria-live="polite" className="text-sm text-[var(--muted-foreground)]">
                {working && (progress
                  ? `Reading ${STAGE_LABEL[progress.entity]}… ${progress.fetched}`
                  : 'Starting…')}
                {phase === 'done' && summary && (
                  <span className="inline-flex items-center gap-1.5 text-[var(--foreground)]">
                    <CheckCircle2 size={15} className="text-green-500" />
                    Downloaded {summary.notes} notes, {summary.people} people, {summary.tasks} tasks
                    and {summary.bookmarks} bookmarks.
                  </span>
                )}
                {phase === 'error' && (
                  <span className="inline-flex items-center gap-1.5 text-[var(--destructive)]">
                    <AlertCircle size={15} />
                    {error}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mt-4">
              Notes in the trash are not included. The export is built in your browser; the zip is never
              stored on a server.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </AppLayout>
  )
}
