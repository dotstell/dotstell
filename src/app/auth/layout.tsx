// html/body are globally locked (position:fixed, overflow:hidden — see globals.css) to fix
// an iOS Safari bug where scrolling the *document* itself triggers the browser's toolbar
// to hide/show, desyncing position:fixed elements from the visual viewport. AppLayout
// pages get their own scroll container for free via <main>, but these auth pages had no
// layout at all, so each one's `min-h-screen` content — the login form, an error banner
// growing it taller, a keyboard shrinking visible height — silently became unreachable
// past the first viewport with the document unable to scroll to it. Same fix as AppLayout's
// <main>: this is the one scrollable region content actually lives on.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
    }}>
      {children}
    </div>
  )
}
