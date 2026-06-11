import "server-only";

import { createClient } from "@/lib/supabase/server";

export class AdminAuthError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() ?? "";

const getAllowedAdminEmails = () => {
  const raw = process.env.CURATED_ASSET_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
};

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AdminAuthError("Unauthorized", 401);
  }

  const allowedEmails = getAllowedAdminEmails();
  const email = normalizeEmail(user.email);
  if (!email || !allowedEmails.has(email)) {
    throw new AdminAuthError("Forbidden", 403);
  }

  return user;
}
