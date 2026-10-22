import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client — used in Server Components, Server Actions, Route Handlers.
 * Reads the user's session from cookies; RLS is the enforcement boundary for every query
 * made through this client. Every Server Action derives the user id from this client's own
 * session, never from client-supplied input.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — the middleware already refreshes
            // the session, so this can be safely ignored.
          }
        },
      },
    }
  );
}
