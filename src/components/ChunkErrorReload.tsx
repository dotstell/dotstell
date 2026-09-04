'use client'
import { useEffect } from 'react'

const CHUNK_ERROR_PATTERN = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i
const RELOAD_GUARD_KEY = 'dotstell-chunk-reload-at'
const RELOAD_GUARD_WINDOW_MS = 10_000

// After a new deploy, a tab left open on an old build references JS chunk
// hashes that no longer exist on the CDN. The first client-side navigation
// that needs one of those chunks throws — with no error boundary catching
// it, the browser shows its own fatal "This page couldn't load" page.
// One automatic reload fetches the current build and resolves it; the
// sessionStorage guard stops a real, persistent failure from reload-looping.
export function ChunkErrorReload() {
  useEffect(() => {
    function reloadOnce(message: string) {
      if (!CHUNK_ERROR_PATTERN.test(message)) return
      const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
      if (Date.now() - lastReload < RELOAD_GUARD_WINDOW_MS) return
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
      window.location.reload()
    }

    function onError(e: ErrorEvent) {
      reloadOnce(e.message ?? '')
    }
    function onRejection(e: PromiseRejectionEvent) {
      reloadOnce(e.reason?.message ?? String(e.reason ?? ''))
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
