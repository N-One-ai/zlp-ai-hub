import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Browser client — anon key only, RLS-scoped. Never import service-role
 * credentials into any file reachable from this module. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
