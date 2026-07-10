import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Dotstell — Connect your knowledge',
  description: 'A personal knowledge graph and memory platform — connect your notes, people, tasks and bookmarks.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" theme="dark" richColors />
      </body>
    </html>
  )
}
