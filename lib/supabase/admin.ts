import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env/public";
import { getSupabaseServiceRoleKey } from "@/lib/env/server";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminClient() {
  const { url } = getSupabasePublicEnv();

  return createSupabaseClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}