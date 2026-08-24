/**
 * lib/supabase/server.ts
 *
 * Server-side Supabase clients.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Server Components, Server Actions, and Route Handlers run on the server,
 * where cookies cannot be accessed via document.cookie.  Instead, Next.js
 * provides the `cookies()` helper from 'next/headers', which reads the
 * incoming request cookie jar and can write to the outgoing response.
 *
 * This file exports two server clients:
 *
 *   createClient()        — Uses the anon/publishable key.  Subject to RLS.
 *                           Use for all user-facing data access.
 *
 *   createServiceClient() — Uses the service_role key.  Bypasses RLS.
 *                           Use ONLY for trusted server operations:
 *                           admin tasks, migrations, or writing data that
 *                           RLS would otherwise block for the anon key.
 *
 * USAGE — regular client (Server Component)
 * ------------------------------------------
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function Page() {
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   // ...
 * }
 *
 * USAGE — service client (Server Action / Route Handler)
 * -------------------------------------------------------
 * import { createServiceClient } from '@/lib/supabase/server'
 *
 * export async function POST(req: Request) {
 *   const supabase = createServiceClient()
 *   // Bypass RLS for trusted admin operation...
 * }
 *
 * SECURITY NOTES
 * --------------
 * • ALWAYS use supabase.auth.getUser() to verify identity on the server.
 *   Never trust supabase.auth.getSession() for authorization decisions —
 *   getSession() reads the cookie directly without re-validating the token
 *   with the Auth server.
 *
 * • The service client (SUPABASE_SERVICE_ROLE_KEY) must NEVER be used in
 *   Client Components or exposed to the browser.  The variable is server-only
 *   (no NEXT_PUBLIC_ prefix) and will be undefined in browser bundles.
 *
 * • The try/catch around setAll in createClient() is intentional.
 *   Server Components cannot write cookies (only the proxy / Route Handlers
 *   can).  The catch silences the "cannot set cookies in a Server Component"
 *   error while still allowing the session to be read.  Session refresh
 *   (writing updated cookies) is handled by proxy.ts.
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Regular server client — respects RLS, uses anon/publishable key
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client suitable for Server Components, Server Actions,
 * and Route Handlers.  Session cookies are read from the incoming request and
 * written back to the response through Next.js's cookie store.
 *
 * This function is async because `cookies()` from 'next/headers' is async
 * in Next.js 15+.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        /**
         * getAll — reads all cookies from the incoming request.
         * The @supabase/ssr package calls this to retrieve the stored
         * session tokens (access token + refresh token).
         */
        getAll() {
          return cookieStore.getAll()
        },

        /**
         * setAll — writes updated session cookies to the response.
         * This is called when the auth SDK refreshes an expired access token.
         *
         * The try/catch is necessary because this method may be called from
         * inside a Server Component, where writing cookies is not allowed.
         * When that happens we silently ignore the error; the proxy.ts
         * middleware is responsible for refreshing and persisting the session
         * on every request.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a Server Component — cookie writes are not
            // permitted here.  The proxy handles session refresh.
          }
        },
      },
    },
  )
}

// ---------------------------------------------------------------------------
// Service role client — bypasses RLS, for trusted server-only operations
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client using the service_role key.
 *
 * ⚠️  DANGER: This client bypasses all Row Level Security policies.
 *     Use only for:
 *       • Admin user management (creating/deleting users)
 *       • Server-side migrations and seed scripts
 *       • Operations explicitly intended to bypass RLS
 *
 *     NEVER use this in Client Components or expose it to the browser.
 *     NEVER store or log the service role key.
 *
 * Unlike createClient(), this function is synchronous because it does not
 * need to read cookies — the service role key authenticates the client
 * directly without a user session.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'createServiceClient: NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.',
    )
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      // Disable automatic session persistence for the service client.
      // It authenticates via the service key, not user sessions.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

// ---------------------------------------------------------------------------
// Auth helpers — convenience wrappers for common server-side auth checks
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user from the current server request, or null
 * if the request is unauthenticated.
 *
 * This is the SAFE way to get the current user on the server.  It calls
 * getUser() which validates the JWT against the Auth server, not getSession()
 * which only reads from the cookie without re-validation.
 *
 * Usage in Server Components / Server Actions:
 *   const user = await getAuthUser()
 *   if (!user) redirect('/login')
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    // getUser() returns an error for unauthenticated requests.
    // This is expected behavior, not an application error.
    return null
  }

  return user
}

/**
 * Returns the authenticated user and throws a structured error if the
 * request is unauthenticated.  Use in Server Actions that must be called
 * by authenticated users only.
 *
 * Usage in Server Actions:
 *   const user = await requireAuthUser()
 *   // If we reach here, user is guaranteed to be non-null
 */
export async function requireAuthUser() {
  const user = await getAuthUser()

  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication required.')
  }

  return user
}
