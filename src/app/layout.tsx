import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Dotstell — Connect your knowledge',
  description: 'A personal knowledge graph and memory platform — connect your notes, people, tasks and bookmarks.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

const VALID_THEMES = ['dotstell','dracula','one-dark','tokyo-night','nord','solarized-dark','catppuccin','solarized-light','github-light','plain-light','pure-light','catppuccin-latte','rose-pine-dawn','gruvbox-light']
const LIGHT_THEMES = ['plain-light','pure-light','solarized-light','github-light','catppuccin-latte','rose-pine-dawn','gruvbox-light']

// Minimal client script: only sets colorScheme (cannot be done server-side)
// and syncs cookie from localStorage for first-time visitors who have no cookie yet.
const syncScript = `(function(){
  var valid = ${JSON.stringify(VALID_THEMES)};
  var light = ${JSON.stringify(LIGHT_THEMES)};
  var t = document.documentElement.getAttribute('data-theme') || 'dotstell';
  document.documentElement.style.colorScheme = light.indexOf(t) !== -1 ? 'light' : 'dark';
  var ls = localStorage.getItem('dotstell-theme');
  if (ls && valid.indexOf(ls) !== -1 && ls !== t) {
    document.documentElement.setAttribute('data-theme', ls);
    document.documentElement.style.colorScheme = light.indexOf(ls) !== -1 ? 'light' : 'dark';
    document.cookie = 'dotstell-theme=' + ls + ';path=/;max-age=31536000;samesite=lax';
  }
  if (ls && valid.indexOf(ls) !== -1) {
    localStorage.setItem('dotstell-theme', ls);
  }
})()`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const rawTheme = cookieStore.get('dotstell-theme')?.value ?? ''
  const theme = VALID_THEMES.includes(rawTheme) ? rawTheme : 'dotstell'
  const isLight = LIGHT_THEMES.includes(theme)

  return (
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: isLight ? 'light' : 'dark' }}
      suppressHydrationWarning
    >
      <head>
        {/* Sync colorScheme and handle first-visit (no cookie yet) before paint */}
        <script dangerouslySetInnerHTML={{ __html: syncScript }} />
        {/* Google Fonts — editor font picker */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Georgia&family=Merriweather:ital,wght@0,400;1,300&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500&family=Fira+Code&family=Source+Code+Pro&family=Caveat:wght@400;600&family=Indie+Flower&family=Kalam:wght@300;400&family=Patrick+Hand&family=Architects+Daughter&family=Nunito:wght@400;600&family=Poppins:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
        <Analytics />
      </body>
    </html>
  )
}
