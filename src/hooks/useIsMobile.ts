'use client'
import { useState, useLayoutEffect } from 'react'

// The single, canonical check for "should this render the mobile navigation shell" --
// drawer sidebar + bottom nav vs. the persistent desktop sidebar, and other shell/chrome
// decisions like consolidating header buttons into a single menu. Touch is the deciding
// factor, not screen width: an iPad in landscape has plenty of width but is still a touch
// device and should get the same navigation shell as a phone (just with more room for
// content within it -- that's a separate, width-based decision made per-page, not here).
// A narrow *desktop* browser window also gets the mobile shell, since there's genuinely
// not enough width for the persistent sidebar regardless of pointer type.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  // useLayoutEffect (not useEffect): runs synchronously before paint, so pages that gate
  // hydration-sensitive content on this value (e.g. notes/layout.tsx's Tiptap-adjacent
  // pane) never render a wrong-then-corrected frame.
  useLayoutEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}
