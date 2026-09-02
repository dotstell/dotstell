import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  // On cold starts or transient network hiccups it can throw instead of returning null.
  // Catch here so a Supabase failure degrades to pass-through instead of a 500 crash.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Session refresh failed — treat as anonymous for this request only.
    // The client-side Supabase listener will handle re-auth on the next interaction.
    return supabaseResponse
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isPublicRoute = request.nextUrl.pathname === '/'

  if (!user && !isAuthRoute && !isPublicRoute) {
    // API routes handle auth themselves and return JSON 401 — never redirect them
    // to the HTML login page, as that breaks all fetch() callers expecting JSON.
    if (request.nextUrl.pathname.startsWith('/api/')) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
