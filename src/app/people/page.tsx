'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, User, Mail, Building2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Person } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatRelative } from '@/lib/utils'

const DEFAULT_PERSON: Partial<Person> = {
  name: '', role: '', company: '', email: '', phone: '', tags: [],
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Partial<Person>>(DEFAULT_PERSON)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPeople = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/people?${params}`)
    const data = await res.json()
    setPeople(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchPeople() }, [fetchPeople])

  function openNew() {
    setEditingPerson({ ...DEFAULT_PERSON })
    setTagInput('')
    setDialogOpen(true)
  }

  function openEdit(person: Person) {
    setEditingPerson(person)
    setTagInput('')
    setDialogOpen(true)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || editingPerson.tags?.includes(tag)) return
    setEditingPerson(prev => ({ ...prev, tags: [...(prev.tags ?? []), tag] }))
    setTagInput('')
  }

  async function savePerson() {
    if (!editingPerson.name?.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const isEdit = !!(editingPerson as Person).id
      const url = isEdit ? `/api/people/${(editingPerson as Person).id}` : '/api/people'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPerson),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Contact updated' : 'Contact added')
      setDialogOpen(false)
      fetchPeople()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deletePerson(id: string) {
    const res = await fetch(`/api/people/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPeople(prev => prev.filter(p => p.id !== id))
      toast.success('Contact deleted')
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl">
        <PageHeader
          title="People"
          description="Your team, colleagues, and contacts"
          action={<Button onClick={openNew}><Plus size={16} /> Add person</Button>}
        />

        <div className="mb-6">
          <Input
            placeholder="Search people..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {loading ? (
          <div className="text-[var(--muted-foreground)] text-sm">Loading...</div>
        ) : people.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No contacts yet"
            description="Add people you work with and attach 1-on-1 notes, tasks, and context directly to them."
            action="Add your first contact"
            onAction={openNew}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {people.map(person => (
              <div key={person.id} className="group bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--primary)]/40 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[var(--primary)] font-semibold text-sm">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Link
                        href={`/people/${person.id}`}
                        className="text-sm font-medium hover:text-[var(--primary)] transition-colors"
                      >
                        {person.name}
                      </Link>
                      {person.role && (
                        <p className="text-xs text-[var(--muted-foreground)]">{person.role}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                    onClick={() => deletePerson(person.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>

                <div className="space-y-1 mb-3">
                  {person.company && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Building2 size={11} /> {person.company}
                    </div>
                  )}
                  {person.email && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Mail size={11} /> {person.email}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {person.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <button
                    onClick={() => openEdit(person)}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{(editingPerson as Person).id ? 'Edit contact' : 'Add contact'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Full name *" value={editingPerson.name ?? ''} onChange={e => setEditingPerson(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Role / Title" value={editingPerson.role ?? ''} onChange={e => setEditingPerson(p => ({ ...p, role: e.target.value }))} />
            <Input placeholder="Company" value={editingPerson.company ?? ''} onChange={e => setEditingPerson(p => ({ ...p, company: e.target.value }))} />
            <Input placeholder="Email" type="email" value={editingPerson.email ?? ''} onChange={e => setEditingPerson(p => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Phone" value={editingPerson.phone ?? ''} onChange={e => setEditingPerson(p => ({ ...p, phone: e.target.value }))} />
            <div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(editingPerson.tags ?? []).map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer gap-1" onClick={() => setEditingPerson(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="text-xs" />
                <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={savePerson} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
