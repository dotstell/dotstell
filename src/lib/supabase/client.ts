import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // @supabase/ssr defaults to PKCE, which requires the code_verifier it stores in
        // *this* browser's local storage to still be there when the email link is opened.
        // Email/password reset and signup-confirmation links are routinely opened on a
        // different device (e.g. requested on desktop, clicked from a phone's mail app) —
        // there's no verifier on that device, so the exchange fails every time. This app
        // has no OAuth providers (PKCE's actual use case), only email/password, so implicit
        // flow's stateless token_hash verification — already the primary path our
        // /auth/callback route handles — works correctly across any device.
        flowType: 'implicit',
      },
    }
  )
}
