import type { Metadata } from 'next'
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

// Applied before first paint — sets data-theme and background before CSS variables resolve.
// Next.js hoists its stylesheet before inline scripts, so we cannot beat the CSS load order.
// Instead we set the exact background as an inline style on <html> AND inject a <style> for
// <body>, both using concrete hex values — no var() dependency, no ordering sensitivity.
const noFlashScript = `(function(){
  var valid = ['dotstell','dracula','one-dark','tokyo-night','nord','solarized-dark','catppuccin','solarized-light','github-light','plain-light','pure-light','catppuccin-latte','rose-pine-dawn','gruvbox-light'];
  var lightThemes = ['plain-light','pure-light','solarized-light','github-light','catppuccin-latte','rose-pine-dawn','gruvbox-light'];
  var bgMap = {
    'dotstell':'#0a0a14','dracula':'#282a36','one-dark':'#282c34',
    'tokyo-night':'#1a1b26','nord':'#2e3440','solarized-dark':'#002b36',
    'catppuccin':'#1e1e2e','solarized-light':'#fdf6e3','github-light':'#ffffff',
    'plain-light':'#faf9ff','pure-light':'#ffffff','catppuccin-latte':'#eff1f5',
    'rose-pine-dawn':'#faf4ed','gruvbox-light':'#fbf1c7'
  };
  var t = localStorage.getItem('dotstell-theme');
  if (!t || valid.indexOf(t) === -1) { t = 'dotstell'; localStorage.setItem('dotstell-theme', t); }
  var isLight = lightThemes.indexOf(t) !== -1;
  var bg = bgMap[t] || '#0a0a14';
  var html = document.documentElement;
  html.setAttribute('data-theme', t);
  html.style.colorScheme = isLight ? 'light' : 'dark';
  html.style.backgroundColor = bg;
  var s = document.createElement('style');
  s.id = '__theme-flash-prevention';
  s.textContent = 'html,body{background-color:' + bg + '!important}';
  document.head.appendChild(s);
})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* No-flash theme script — must be first; sets data-theme, colorScheme, and backgroundColor before any paint */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
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
