'use client'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { APP_VERSION, RELEASES_URL } from '@/lib/version'

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'],        action: 'Open command palette / universal search' },
  { keys: ['/'],                 action: 'Slash commands in the note editor' },
  { keys: ['[['],                action: 'Insert a wikilink inside a note' },
  { keys: ['Ctrl', 'B'],        action: 'Bold in editor' },
  { keys: ['Ctrl', 'I'],        action: 'Italic in editor' },
  { keys: ['Ctrl', 'Shift', 'X'], action: 'Strikethrough in editor' },
  { keys: ['Ctrl', '`'],        action: 'Inline code in editor' },
  { keys: ['Ctrl', 'Z'],        action: 'Undo in editor' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 7px', borderRadius: 5,
      border: '1px solid var(--border)',
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
      lineHeight: 1.6,
    }}>
      {children}
    </kbd>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 600, color: 'var(--foreground)',
        margin: '0 0 16px', paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Tip({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 16px',
      borderRadius: 10, border: '1px solid var(--border)',
      backgroundColor: 'var(--muted)', marginBottom: 10,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Help & features" />

        <div style={{ maxWidth: 680, paddingBottom: 64 }}>

          <Section title="Wikilinks & backlinks">
            <Tip icon="⬡" title="Linking notes together"
              body={<>Type <Kbd>[[</Kbd> anywhere inside a note to insert a wikilink. Start typing a note title and select it from the dropdown — or create a new note on the spot. Backlinks appear automatically in the linked note's sidebar panel.</>}
            />
            <Tip icon="🔗" title="Manual knowledge links"
              body="Use the Link panel (bottom of any note, person, or bookmark) to manually connect any two items across types — e.g. link a bookmark to a task, or a note to a person. These edges appear in the knowledge graph."
            />
          </Section>

          <Section title="Knowledge graph">
            <Tip icon="⬡" title="How the graph builds itself"
              body="Every wikilink and manual link you create becomes an edge in the graph. Open the Graph page to see the full picture. Nodes are colored by type (notes, people, bookmarks, tasks). Click any node to open it."
            />
            <Tip icon="🖱️" title="Navigating the graph"
              body="Scroll to zoom. Click and drag the canvas to pan. Click a node to preview it. Double-click to open the full item. Use the search in the top-right to highlight a specific node."
            />
          </Section>

          <Section title="People & 1-on-1s">
            <Tip icon="👥" title="Contact-centered context"
              body="Each person is a hub. Open a contact to see all notes tagged to them, tasks assigned in their context, and a timeline of recent activity. Use this for meeting notes, 1-on-1 prep, and relationship tracking."
            />
            <Tip icon="📑" title="Attaching notes to people"
              body="When writing a note, use the Link panel to connect it to a person. Alternatively, wikilink to the person's name inside the note. Both approaches make the note appear on the person's page."
            />
          </Section>

          <Section title="Tasks">
            <Tip icon="✅" title="Kanban and list view"
              body="Switch between Kanban (column per status) and list view using the toggle at the top-right. Both views support priorities, due dates, and status updates. Overdue tasks surface on your dashboard."
            />
            <Tip icon="🔔" title="Overdue reminders"
              body="Tasks past their due date trigger a reminder notification. You can dismiss individual reminders; they will not resurface unless the due date changes."
            />
          </Section>

          <Section title="Bookmarks">
            <Tip icon="🔖" title="Saving a bookmark"
              body="Paste any URL into the bookmark input — title, description, and favicon are fetched automatically. You can also drag and drop a URL from your browser address bar directly onto the Bookmarks page."
            />
            <Tip icon="🏷️" title="Tags and filtering"
              body="Add tags when saving a bookmark, or edit them after. Use the tag filter bar at the top of the Bookmarks page to narrow the list. Tags work the same way across notes, people, and bookmarks."
            />
          </Section>

          <Section title="Keyboard shortcuts">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--muted-foreground)', fontWeight: 500, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Keys</th>
                  <th style={{ textAlign: 'left', padding: '6px 0 6px 16px', color: 'var(--muted-foreground)', fontWeight: 500, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(({ keys, action }) => (
                  <tr key={action} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                    <td style={{ padding: '10px 0', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        {keys.map((k, i) => (
                          <span key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {i > 0 && <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>+</span>}
                            <Kbd>{k}</Kbd>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td style={{ padding: '10px 0 10px 16px', color: 'var(--muted-foreground)' }}>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="About">
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7, margin: '0 0 12px' }}>
              dotstell is open source (AGPL-3.0) and built in public. If you find a bug or want to suggest a feature, open an issue on GitHub.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <a href="https://github.com/dotstell/dotstell/issues" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>
                Report a bug →
              </a>
              <a href="https://github.com/dotstell/dotstell/issues" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>
                Request a feature →
              </a>
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none' }}>
                v{APP_VERSION} — release notes →
              </a>
            </div>
          </Section>

        </div>
      </PageContainer>
    </AppLayout>
  )
}
