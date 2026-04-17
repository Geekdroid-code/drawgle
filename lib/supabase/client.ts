import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);

  return browserClient;
}