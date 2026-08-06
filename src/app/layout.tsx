import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Dotstell — Connect your knowledge',
  description: 'A personal knowledge graph and memory platform — connect your notes, people, tasks and bookmarks.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

// Applied before first paint — prevents flash of wrong theme
const noFlashScript = `(function(){
  var valid = ['dracula','one-dark','tokyo-night','nord','solarized-dark','catppuccin','solarized-light','github-light'];
  var t = localStorage.getItem('dotstell-theme');
  if (!t || valid.indexOf(t) === -1) { t = 'dracula'; localStorage.setItem('dotstell-theme', t); }
  document.documentElement.setAttribute('data-theme', t);
})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dracula" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        {/* No-flash theme script — must run before any paint */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        {/* Google Fonts — editor font picker */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Georgia&family=Merriweather:ital,wght@0,400;1,300&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500&family=Fira+Code&family=Source+Code+Pro&family=Caveat:wght@400;600&family=Indie+Flower&family=Kalam:wght@300;400&family=Patrick+Hand&family=Architects+Daughter&family=Nunito:wght@400;600&family=Poppins:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
