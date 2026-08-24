/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client.
 *
 * Gunakan file ini HANYA di dalam Client Components ('use client').
 * Jangan import file ini di Server Components, Server Actions, atau Route Handlers.
 *
 * createBrowserClient dari @supabase/ssr secara otomatis melakukan memoisation
 * instance berdasarkan URL + key yang sama, sehingga aman dipanggil berkali-kali
 * dalam satu sesi browser tanpa membuat koneksi baru.
 *
 * Security note:
 * Client ini menggunakan publishable (anon) key yang memang boleh terekspos
 * ke browser. Row Level Security (002_rls.sql) yang mengontrol akses data
 * di level database.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from "@/types/database";

/**
 * Membuat Supabase client untuk digunakan di browser (Client Component).
 *
 * Cara penggunaan:
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 *
 * export function MyComponent() {
 *   const supabase = createClient()
 *
 *   async function handleSignOut() {
 *     await supabase.auth.signOut()
 *   }
 *
 *   return <button onClick={handleSignOut}>Sign Out</button>
 * }
 * ```
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}