import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — bypasses RLS entirely. Only for trusted
 * server-only contexts with no signed-in user to scope by (e.g. a cron
 * route, a webhook from an AI provider). Never import this from a file
 * reachable by a Client Component, and never from a Server Action that
 * carries a specific user's intent — those must use lib/supabase/server.ts
 * so RLS stays the real enforcement boundary.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
