import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Copy any auth cookies Supabase wrote during this request onto a different response.
 *
 * getUser() silently refreshes an expired access token, and that refresh **rotates the
 * refresh token at Supabase**, immediately invalidating the old one. The new pair only
 * reaches the browser via the Set-Cookie headers that setAll() put on `supabaseResponse`.
 * Returning a response built any other way (a redirect, say) drops those headers, so the
 * browser keeps a refresh token the server has already revoked — the session is dead from
 * that point on and the user is forced to sign in again. Every early return therefore has
 * to carry these cookies forward.
 */
function withAuthCookies(response: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
  return response
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Cookies must be set on BOTH the request and the response:
  // - request: so subsequent server-component reads within the same request see the refreshed token
  // - response: so the browser stores the updated token for the next request
  // Omitting either half causes session refresh to silently fail on the next page load.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() contacts Supabase to verify/refresh the session token.
  // On cold starts or transient network hiccups it can throw instead of returning null —
  // or, worse, it can simply hang. A hang isn't a JS exception our try/catch can stop:
  // the Edge Function keeps running until Vercel's own platform timeout kills it, which
  // returns a raw, non-HTML failure that shows up as Chrome's native "This page couldn't
  // load" page — no amount of try/catch around the awaited call prevents that once the
  // platform decides to kill the invocation. Racing against our own short timeout means
  // *we* give up first and return a normal response, so the platform timeout never fires.
  // Three outcomes matter, not two: a signed-in user, an authoritative "not signed in",
  // and "we could not find out". Treating the third case as "not signed in" is what made a
  // slow cold start look like a logout — it redirected to /auth/login purely because the
  // check was slow, while the session itself was perfectly valid.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let sessionKnown = false

  // Resolving (not rejecting) on timeout keeps a handler attached to the getUser promise
  // even after the race is decided, so a late failure never surfaces as an unhandled
  // rejection. The timeout exists because a hung call would otherwise run until Vercel's
  // own platform timeout kills the invocation, which returns a raw non-HTML error page.
  const settled = await Promise.race([
    supabase.auth.getUser().then(
      r  => ({ known: true  as const, user: r.data.user ?? null }),
      () => ({ known: false as const, user: null }),
    ),
    new Promise<{ known: false; user: null }>(resolve =>
      setTimeout(() => resolve({ known: false, user: null }), 5000),
    ),
  ])
  user         = settled.user
  sessionKnown = settled.known

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isPublicRoute = request.nextUrl.pathname === '/'

  // Only bounce to the login page when Supabase actually confirmed there is no session.
  // When the check timed out or errored, fall through and serve the request: the page's
  // own API calls authenticate independently (and RLS guards the data), so nothing is
  // exposed, whereas redirecting would end a valid session for no reason.
  if (!user && sessionKnown && !isAuthRoute && !isPublicRoute) {
    // API routes handle auth themselves and return JSON 401 — never redirect them
    // to the HTML login page, as that breaks all fetch() callers expecting JSON.
    if (request.nextUrl.pathname.startsWith('/api/')) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return withAuthCookies(NextResponse.redirect(url), supabaseResponse)
  }

  // reset-password and confirmed are /auth routes an authenticated user is meant to land
  // on — the recovery/signup-confirmation callback signs them in specifically so they can
  // see this page (set a new password, or the "email confirmed" success screen).
  // Redirecting them to /dashboard on arrival (like any other already-authenticated visit
  // to /auth/*) would skip that step entirely.
  const AUTHED_AUTH_ROUTES = ['/auth/reset-password', '/auth/confirmed']
  if (user && isAuthRoute && !AUTHED_AUTH_ROUTES.includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return withAuthCookies(NextResponse.redirect(url), supabaseResponse)
  }

  return supabaseResponse
}
